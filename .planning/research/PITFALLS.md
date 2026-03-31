# Domain Pitfalls

**Domain:** Porting autonomous SDLC orchestrator (hands-free) + multi-agent review engine (ace) into an existing OpenCode plugin (opencode-assets)
**Researched:** 2026-03-31
**Source analysis:** claude-hands-free (2413-line orchestrator, 12 agents, 3300 lines CJS tooling, 8-phase state machine), claude-ace (30 agents, 8-phase review pipeline, 6 bash scripts, references directory with hard gates), opencode-assets (924 lines TS, 4 agents, 3 creation tools)

---

## Critical Pitfalls

Mistakes that cause rewrites, token budget blowouts, or render the system unusable.

### Pitfall 1: Token Budget Explosion from Prompt Concatenation

**What goes wrong:** The hands-free orchestrator is 2413 lines of markdown instruction. Ace's full pipeline requires loading agent-catalog.md (200 lines), agent-hard-gates.md (196 lines), enforcement-hard-gates.md (52 lines), orchestration-protocol.md (124 lines), team-lead-protocol.md (139 lines), and severity-definitions.md (40 lines) into context before dispatching any agent. When the orchestrator dispatches the ace review engine as a sub-pipeline within BUILD phase, the total prompt context easily exceeds 30K tokens before a single line of user code is analyzed.

**Why it happens:** Both systems were designed as standalone top-level dispatchers. Hands-free assumes it owns the entire context window. Ace-full's SKILL.md reads 10 reference files into context at Step 1 before doing anything. Neither was designed to be nested inside the other.

**Consequences:** The orchestrator consumes half the context window on instructions alone. Subagent prompts that include "Full diff" plus agent instructions plus reference material overflow on medium-sized codebases. The convergence loop (Phase 6-7 re-verify + fix cycles) multiplies this by up to 3x. Real-world cost: a single hands-free run on a moderate project could dispatch 40+ agent calls, each loading substantial prompt material.

**Prevention:**
1. **Never embed the full orchestrator prompt in a tool description.** The orchestrator logic must be in TypeScript code (the `oc_orchestrate` tool implementation), not in a 2400-line system prompt that gets loaded into every context.
2. **Lazy-load reference material.** Ace's references should be loaded only when the specific phase that needs them runs, not all upfront. The team-lead only needs agent-catalog.md and team-lead-protocol.md -- not hard-gates.md or finding-format.md.
3. **Compress agent prompts.** Hands-free agents average 170 lines each. OpenCode agents are TypeScript objects with inline prompts (see researcher.ts at 43 lines). Port the essential behavioral contract, not the verbose instruction format.
4. **Cap prompt budgets per phase.** Measure: if orchestrator prompt + phase-specific context + diff > 15K tokens, the architecture is wrong.

**Detection:** Measure total token consumption of a single orchestration run on a small project (< 500 lines changed). If it exceeds 200K tokens, the design is bloated. Compare: current hands-free + ace runs should be the baseline.

**Phase to address:** Phase 1 (architecture design). This is a foundational constraint that shapes every subsequent decision.

---

### Pitfall 2: Franken-Architecture -- Two State Machines Glued Together

**What goes wrong:** Hands-free has an 8-phase state machine (RECON -> CHALLENGE -> ARCHITECT -> EXPLORE -> PLAN -> BUILD -> SHIP -> RETROSPECTIVE) with YAML frontmatter in state.md, a confidence ledger, and decision-log.md. Ace has its own 8-phase pipeline (Pre-flight -> Team Lead -> Phase 1-4 review -> Auto-fix -> Re-verify -> Verdict) with its own memory system (~/.claude/ace/<project-key>/). Naively porting both creates two independent state machines with two config systems, two memory stores, and no shared data model.

**Why it happens:** The temptation to "port first, integrate later" means each system retains its own state format. State.md uses schema_version: 2 with regex-based parsing. Ace uses script-based detection (detect-stack.sh, classify-changes.sh). The config files are incompatible: hands-free uses `.hands-free/config.md` with key-value pairs; ace uses script arguments and environment detection.

**Consequences:** Dual state tracking means bugs where one state machine advances but the other doesn't. Configuration conflicts (hands-free's `review_provider: ace` vs ace's own config). Memory stored in two places (~/.claude/ace/ and .hands-free/) with no cross-reference. The user sees two mental models for what should be one system.

**Prevention:**
1. **Single state machine.** Define one pipeline: the hands-free phases are the top-level flow; ace review is a sub-operation within BUILD phase (and optionally a standalone tool). Do not give ace its own pipeline state when running inside the orchestrator.
2. **Single config schema.** Port both configs into the existing opencode-assets Zod-validated config system (src/config.ts). One schema, one load/save path.
3. **Single working directory.** Use `.opencode/orchestrate/` (or similar) for all runtime state -- not `.hands-free/` and `~/.claude/ace/` separately. Follow OpenCode conventions, not Claude Code conventions.
4. **Single memory interface.** Ace's project memory (findings, false-positives, fix-failures) and hands-free's institutional memory should share a storage abstraction.

**Detection:** If you find yourself writing two separate state-loading functions, or two config parsers, or checking two directories for runtime data -- stop. The architecture is fragmenting.

**Phase to address:** Phase 1 (architecture design). Must be settled before any code is written.

---

### Pitfall 3: Blind Port of Claude Code Agent Dispatch to OpenCode

**What goes wrong:** Claude Code agents are markdown files with YAML frontmatter (`name`, `model`, `tools`, `permissionMode`, `maxTurns`). They are dispatched via the `Agent` tool with a string prompt. OpenCode agents are TypeScript objects with `AgentConfig` shape (`description`, `mode`, `prompt`, `permission`), injected via the config hook, and dispatched via OpenCode's internal agent system. The dispatch mechanisms are fundamentally different.

**Why it happens:** The hands-free orchestrator dispatches agents by calling `Agent` tool with the agent name and a dynamic prompt. Ace does the same -- `ace-full` dispatches 21 agents via parallel `Agent` tool calls. But OpenCode's tool system, agent dispatch, and permission model are different from Claude Code's. The `Agent` tool may not exist in OpenCode, or may behave differently.

**Consequences:** If agents are ported as markdown files and you assume `Agent` tool dispatch works identically, every single agent call will fail. If agents are ported as config-hook injections but the orchestrator tries to call them via `Agent` tool, the invocation path is wrong. The entire pipeline becomes non-functional.

**Prevention:**
1. **Verify OpenCode's agent dispatch API first.** Before porting a single agent, confirm: How does an OpenCode tool invoke a subagent? Is there an `Agent` tool equivalent? Can tools dispatch agents programmatically?
2. **If OpenCode lacks programmatic agent dispatch,** the orchestrator must use tool-based dispatch instead. Each "agent" becomes a tool that accepts a prompt and returns a result. This changes the entire architecture.
3. **Port agent behavior as tool implementations, not markdown files.** The hands-free agents' behavioral contracts (what they read, what they write, what they return) matter more than their format. A TypeScript tool function with the right logic is more reliable than a markdown system prompt.
4. **Test one agent dispatch path end-to-end before porting all 30+.** Confirm the pattern works before scaling it.

**Detection:** If the first dispatched agent doesn't produce expected output, the dispatch mechanism is wrong. Build a smoke test for single-agent dispatch in Phase 1.

**Phase to address:** Phase 1 (proof of concept). This is the first thing to validate.

---

### Pitfall 4: CJS-to-TypeScript Port Introduces Subtle Behavioral Drift

**What goes wrong:** Hands-free has 3300 lines of CommonJS tooling (13 modules in bin/lib/) doing state parsing, confidence tracking, arena scoring, plan indexing, validation, and forensics. All use regex-based YAML frontmatter parsing, fs.readFileSync/writeFileSync, and a custom atomic write pattern with O_EXCL lock files. Porting to TypeScript with async fs operations and Zod validation subtly changes behavior in edge cases.

**Why it happens:** CJS tools use synchronous I/O for determinism -- no race conditions between state read and write. The regex parsers are battle-tested against specific state.md format quirks (hands-free went through 8 phases and 161 accumulated decisions to stabilize these parsers). Porting to async/await with node:fs/promises introduces timing windows. Replacing regex parsing with Zod schemas may reject states that the regex parser accepted (or vice versa).

**Consequences:** State corruption during concurrent access (orchestrator and subagent both writing state). Confidence ledger entries lost due to async write interleaving. Validation rules that pass in CJS but fail in TS port (or vice versa), causing false pipeline halts.

**Prevention:**
1. **Port the test suite first, then the implementation.** Write TypeScript tests against the exact same input/output contracts as the CJS tools. Run both implementations against the same fixtures.
2. **Keep synchronous writes for state.** Use `writeFileSync` for state.md mutations even in the TS port. The performance cost is negligible; the correctness guarantee is critical. OpenCode-assets already uses `writeFile(path, content, { flag: "wx" })` for atomic creation -- extend this pattern.
3. **Port one module at a time with parity tests.** State module first (most critical), then confidence, then config. Each module gets a parity test suite before the next begins.
4. **Preserve the lock file pattern for concurrent writes.** The O_EXCL spin-backoff-jitter pattern in core.cjs writeAtomic() exists for a reason -- don't replace it with "hope for the best" async writes.

**Detection:** Run the CJS validation script (validate.cjs, 70+ structural checks) against state files produced by the TS port. Any divergence is a bug.

**Phase to address:** Phase 2 (deterministic tooling port). Dedicated phase with parity testing.

---

### Pitfall 5: Ace Agent Count Overwhelms the Plugin

**What goes wrong:** Ace has 30 agents across three categories: 3 core squad, 16 parallel specialists, 2 sequenced specialists, and 9 enforcement pipeline agents. Injecting all 30 via OpenCode's config hook pollutes the agent namespace. The team-lead selection mechanism (score every agent 0-10, threshold >= 7) still requires loading the full agent catalog into context every time.

**Why it happens:** Ace was designed for Claude Code where agents are filesystem markdown files that exist passively until dispatched. Loading 30 agent definitions into OpenCode's config hook means 30 entries in the agent configuration, even though most runs only dispatch 5-8 agents. The team-lead agent's scoring protocol requires the full catalog, consuming tokens for agents that won't be selected.

**Consequences:** The config hook becomes a bottleneck. The agent catalog bloats context. Users see 30+ agents in their OpenCode agent list (unless all are hidden). Stack-irrelevant agents (go-idioms-auditor for a TypeScript project, rust-safety-auditor for a Python project) waste catalog space. The overhead of "select from 30, dispatch 5" is worse than "have 5, dispatch 5."

**Prevention:**
1. **Do not inject review agents as OpenCode agents.** Review specialists are internal implementation details of the review engine, not user-facing agents. They should be tool-internal prompt templates, not config-hook agents.
2. **Hardcode the core squad.** Logic-auditor, test-interrogator, and contract-verifier always run. They don't need a selection mechanism. They're functions, not agents.
3. **Make team-lead selection a TypeScript function.** Instead of dispatching a team-lead agent that reads a 200-line catalog, implement the scoring logic as a deterministic TypeScript function: given (detected stack, changed file types, diff size), return (selected agents). This eliminates an entire agent dispatch and catalog loading.
4. **Lazy-load specialist prompts.** Only load the prompt template for an agent when it's actually selected for dispatch. Use a registry pattern: `agentPrompts.get("security-auditor")` loads from a template file on demand.
5. **Cap visible agents.** Only the orchestrator-level agents (researcher, proposer, critic, implementer, reviewer, etc.) should be config-hook agents. Review specialists stay internal.

**Detection:** Count the agents injected via config hook. If it exceeds 15, the design is leaking internal implementation as public API.

**Phase to address:** Phase 1 (architecture) for the boundary decision, Phase 3 (ace port) for implementation.

---

## Moderate Pitfalls

### Pitfall 6: Shell Script Dependencies That Don't Exist in OpenCode

**What goes wrong:** Ace relies on 6 bash scripts (diff-scope.sh, detect-stack.sh, load-memory.sh, classify-changes.sh, resolve-project-key.sh, codebase-scope.sh) for pre-flight data gathering. Hands-free uses shell scripts in hooks. These scripts assume a bash environment, specific git configurations, and filesystem paths that may differ in OpenCode's runtime context.

**Why it happens:** Both systems were built for Claude Code which runs in a local terminal with full shell access. OpenCode plugins run in Bun within the OpenCode process. While Bun can spawn processes, the overhead of shelling out for every pre-flight check is wasteful and fragile.

**Prevention:**
1. **Port all shell scripts to TypeScript functions.** diff-scope becomes a function calling `git diff` via child_process, parsing the output in TS. detect-stack becomes a file-existence check function. These are deterministic operations that don't need shell scripting.
2. **Use Bun's built-in APIs** for file operations and process spawning instead of bash wrappers.
3. **Test each ported script** against the original's output on the same repo state.

**Phase to address:** Phase 2 (deterministic tooling).

---

### Pitfall 7: State Machine Resume Logic Assumes Session Continuity

**What goes wrong:** Hands-free's state machine is designed for crash recovery: the orchestrator loads state.md on every invocation, checks `currentPhase`, and resumes from where it left off. But it assumes the same session context (same working directory, same git state, same .hands-free/ directory contents). In OpenCode, if the user switches projects or the plugin is reloaded, the state machine may resume into an inconsistent environment.

**Why it happens:** Claude Code sessions are per-project directory. Hands-free's state machine stores absolute phase status but relative file paths. If state.md says "BUILD phase, task 3 of 7" but the git branch has been rebased or the plan files have been modified, resuming produces nonsensical behavior.

**Prevention:**
1. **Add a git SHA checkpoint to state.** Record the HEAD SHA at each phase transition. On resume, compare current HEAD to stored SHA. If they diverge, warn and offer to re-plan from the divergence point.
2. **Validate working directory on resume.** Check that expected artifacts from previous phases actually exist (e.g., if PLAN is complete, verify plan files exist).
3. **Add a "stale state" detection.** If state.md was last updated more than N hours ago, flag it as potentially stale and prompt for confirmation before resuming.

**Phase to address:** Phase 2 (state management tooling).

---

### Pitfall 8: Ace's Convergence Loop Creates Unbounded Agent Cascades

**What goes wrong:** Ace's Phase 5-7 (Auto-fix -> Re-verify -> Converge) can loop up to 3 times. Each cycle re-dispatches all agents whose domains had findings. With 8 agents dispatched and 3 convergence cycles, that's 24 additional agent invocations after the initial review. Combined with hands-free's own review invocation during BUILD phase, a single task's review could spawn 50+ agent calls.

**Why it happens:** Ace's convergence loop was designed for standalone reviews where cost is acceptable. Inside an autonomous pipeline processing multiple tasks (hands-free can have 10+ build tasks), the multiplicative effect is devastating: 10 tasks x 50 agent calls = 500 agent dispatches per pipeline run.

**Prevention:**
1. **Default convergence cycles to 1, not 3.** Most regressions from auto-fix are caught in the first re-verify. Allow configuration to increase if needed.
2. **Short-circuit aggressively.** If all findings are nitpick severity, skip the fix cycle entirely. If fix-to-finding ratio is < 50% (more findings created than fixed), abort immediately, not after 3 cycles.
3. **Use the confidence ledger to gate review depth.** If the confidence ledger shows HIGH confidence from prior phases, use a lighter review (core squad only, no convergence loop). Reserve full review for LOW confidence phases.
4. **Budget agent calls per pipeline run.** Set a configurable cap (default: 100 agent dispatches per orchestration). If the pipeline approaches the cap, switch to abbreviated review mode.

**Phase to address:** Phase 3 (ace review engine port).

---

### Pitfall 9: Config Complexity Creates a Three-Layer Override Nightmare

**What goes wrong:** Hands-free has global config (~/.claude/hands-free-config.md), project config (.hands-free/config.md), and runtime flags. Ace has project memory (~/.claude/ace/<project-key>/), script-based detection, and mode flags. The existing opencode-assets has its own Zod-validated config. Merging these creates a three-layer configuration system where the user has no idea which setting wins.

**Why it happens:** Each system solves its own config needs independently. Hands-free's three-branch priority (global > ace auto-detect > defaults) is already confusing. Adding ace's memory directory and opencode-assets' config creates a system where a single setting like "review strictness" could be defined in five different places.

**Prevention:**
1. **One config schema with clear precedence.** OpenCode-assets' Zod config is the single source of truth. All hands-free and ace settings get fields in this schema.
2. **Precedence: user-explicit > project-detected > plugin-default.** Three layers maximum. Document it in the config schema comments.
3. **No separate config files for sub-systems.** Don't create .hands-free/config.md or ~/.claude/ace/ directories. All config lives in the plugin's existing config system.
4. **Provide a config dump tool.** `oc_config_dump` that shows all resolved settings with their source (explicit, detected, default). This is essential for debugging.

**Phase to address:** Phase 1 (architecture design) for the schema, Phase 2 for implementation.

---

### Pitfall 10: Memory/Learning Systems Create Unbounded Growth

**What goes wrong:** Hands-free has institutional memory (dual-indexed lessons in domain and pattern_type files at ~/.claude/memories/). Ace has project memory (findings.md, false-positives.md, fix-failures.md, project-profile.md per project). Both are append-only. Over months of use across multiple projects, these files grow unbounded and loading them into agent context consumes increasing tokens.

**Why it happens:** Neither system has a pruning or summarization mechanism. Ace appends every finding to findings.md. Hands-free appends every lesson to memory files. The memory injection mechanism (memory.cjs `inject` command) loads entire files into agent prompts.

**Prevention:**
1. **Cap memory file sizes.** When a memory file exceeds a threshold (e.g., 50 entries or 5000 tokens), summarize older entries and archive the full version.
2. **Use recency weighting.** Most recent findings are most relevant. Load the last N entries, not all entries.
3. **Budget memory injection.** Each agent prompt gets at most 500 tokens of memory context. If the memory file is larger, extract only entries relevant to the current stack/domain.
4. **Implement memory garbage collection.** False positives should be used to prune future findings, not just stored alongside them.

**Phase to address:** Phase 4 (memory/institutional learning), but design the storage format in Phase 1.

---

### Pitfall 11: Permission Model Mismatch Between Platforms

**What goes wrong:** Hands-free agents use `permissionMode: bypassPermissions` (Claude Code concept) -- the orchestrator, implementer, and shipper all need unrestricted tool access. OpenCode agents use granular `permission: { bash: "allow", edit: "allow" }`. Porting `bypassPermissions` to OpenCode either grants too much access (if OpenCode has a global bypass) or requires mapping every tool permission individually for 12+ agents.

**Why it happens:** Hands-free made a deliberate decision (logged as decision [01-01]) to use `bypassPermissions` on destructive agents and `default` on read-only agents. This permission split doesn't map cleanly to OpenCode's model. The Phase 08 state file documents that all agents eventually got bypassPermissions due to permission degradation issues.

**Prevention:**
1. **Audit each agent's actual tool usage.** Hands-free logged all tools per agent in its decisions. Map to OpenCode's permission model explicitly.
2. **No blanket bypass.** The orchestrator tool itself should run with elevated permissions; individual review agents should be read-only.
3. **Test permission boundaries.** Verify that read-only agents (researcher, critic, reviewer) can't accidentally write files, and that write agents (implementer, shipper) have the access they need.

**Phase to address:** Phase 1 (agent architecture).

---

## Minor Pitfalls

### Pitfall 12: Model Routing Assumptions Break Model Agnosticism

**What goes wrong:** Hands-free hardcodes model preferences: Opus for orchestrator/architect/planner/critic, Sonnet for implementer/reviewer/qa/shipper, Haiku for researcher. Ace uses Sonnet for team-lead and orchestrator. OpenCode is model-agnostic -- the existing CLAUDE.md constraint says "Never hardcode model identifiers."

**Prevention:** Never set `model` in agent definitions. Let the user's OpenCode configuration control model routing. If a specific agent benefits from deeper reasoning, document it in the agent's description but don't enforce it. Provide optional model routing config fields that the user can set.

**Phase to address:** Phase 1 (agent definitions).

---

### Pitfall 13: Arena Architecture Over-Engineering for Small Projects

**What goes wrong:** Hands-free's Architecture Arena (ARCHITECT phase) dispatches 3 proposer agents with different framings (SIMPLICITY, SCALABILITY, ERGONOMICS), then a critic, then a mediator, then optionally a comparator. This is 5-6 agent dispatches for architecture selection on a project that might be a simple CLI tool. The arena mechanism is valuable for complex projects but wasteful for simple ones.

**Prevention:** Make the arena opt-in or confidence-gated. If RECON confidence is HIGH and the project is small scope, skip the arena and use a single architecture proposal. The arena depth calculation already exists in arena.cjs -- port it faithfully and default to shallow.

**Phase to address:** Phase 3 (orchestrator implementation).

---

### Pitfall 14: Git Operations Assume GitHub-Only Workflow

**What goes wrong:** Hands-free mandates "branch-from-main" as a hard rule, uses `gh pr create` for each task, squash merges, and assumes GitHub as the remote. Ace's diff-scope.sh assumes standard git diff formats. Porting these assumptions means the pipeline breaks for GitLab users, trunk-based development, or repos without a remote.

**Prevention:** Abstract git operations behind a VCS interface. Default to GitHub-flavored workflows but make the PR creation, branching strategy, and merge method configurable. Support "no remote" mode where the pipeline just commits locally without PRs.

**Phase to address:** Phase 2 (tooling), Phase 3 (orchestrator BUILD phase).

---

### Pitfall 15: Testing an Autonomous Pipeline Is Fundamentally Hard

**What goes wrong:** The orchestrator dispatches 12+ subagents across 8 phases. Each subagent reads and writes files, makes decisions, and affects subsequent phases. Testing this end-to-end requires either expensive LLM calls or a complex mock infrastructure that may not reflect real behavior.

**Prevention:**
1. **Test each phase independently.** Each phase is a function: given (state, config, previous phase artifacts) -> (updated state, new artifacts). Mock the agent dispatch, test the state transitions.
2. **Test tooling with unit tests.** The deterministic tooling (state management, confidence tracking, etc.) is pure functions -- 100% unit testable without LLM calls.
3. **Create fixture-based integration tests.** Record a real orchestration run's agent inputs/outputs as fixtures. Replay them in tests to verify pipeline coordination logic.
4. **Test ace review agents with known-buggy code samples.** Create small code samples with known issues (SQL injection, unclosed resources, etc.) and verify agents detect them.

**Phase to address:** Every phase, but the testing strategy must be designed in Phase 1.

---

### Pitfall 16: Orchestrator Prompt as Markdown vs Logic in Code

**What goes wrong:** The hands-free orchestrator is a 2413-line markdown command file that embeds all pipeline logic as natural language instructions for the LLM. This works in Claude Code where commands ARE markdown files. In OpenCode, the equivalent would be either (a) a massive tool description string, or (b) a markdown command file -- neither of which is testable, type-safe, or maintainable.

**Why it happens:** Claude Code's design philosophy is "prompt engineering IS the programming." The orchestrator's logic (phase transitions, vague detection, state recovery, arena triggering) is all prose. Porting this verbatim means 2400 lines of untestable, unrefactorable string.

**Prevention:** Extract every deterministic decision from the orchestrator prompt into TypeScript functions. Phase transition logic, vague detection heuristics, state recovery, arena depth calculation -- all these become testable TS code. The orchestrator prompt shrinks to behavioral guidance ("be autonomous, log decisions") while the pipeline logic lives in code. The existing hands-free already partially did this with hf-tools.cjs -- continue that trajectory to its logical conclusion.

**Phase to address:** Phase 1 (architecture). This is the single most impactful design decision.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Architecture design (Phase 1) | Porting both systems' architectures instead of designing a unified one (P2) | Start from OpenCode's plugin model and work backward to required capabilities |
| Architecture design (Phase 1) | 2400-line orchestrator prompt doesn't fit in a tool description (P1, P16) | Orchestrator logic in TypeScript code, not in a system prompt |
| Architecture design (Phase 1) | Agent dispatch mechanism unknown for OpenCode (P3) | Validate one agent dispatch end-to-end before designing the full pipeline |
| Deterministic tooling (Phase 2) | Async/sync behavioral drift during CJS-to-TS port (P4) | Parity test suite: same inputs, same outputs, both implementations |
| Deterministic tooling (Phase 2) | Shell scripts not portable to Bun runtime (P6) | Port all 6 ace scripts + hf hooks to TypeScript functions |
| Ace review engine (Phase 3) | 30 agents overwhelming the system (P5), convergence loop unbounded (P8) | Internal agent registry (not config-hook), 1-cycle default convergence |
| Orchestrator pipeline (Phase 3) | Arena over-engineering for small projects (P13) | Confidence-gated arena depth, default to shallow |
| Memory/learning (Phase 4) | Unbounded memory growth, dual storage locations (P10) | Single storage abstraction, size caps, recency weighting |
| Config unification (Phase 2) | Three-layer config override confusion (P9) | Single Zod schema, documented three-level precedence |
| BUILD phase (Phase 3) | Git workflow assumes GitHub only (P14) | VCS abstraction layer, configurable workflow |
| Testing strategy (all phases) | No way to test autonomous pipeline without LLM calls (P15) | Phase-independent testing, fixture-based integration, deterministic tooling unit tests |

## Sources

- Direct analysis of claude-hands-free source code at /home/joseibanez/develop/projects/claude-hands-free/
  - commands/hands-free.md (2413 lines, full orchestrator prompt)
  - bin/hf-tools.cjs + bin/lib/*.cjs (3538 lines, 13 modules)
  - agents/*.md (12 agents, 2051 lines total)
  - .hands-free/config.md (config format: key-value pairs)
  - .planning/STATE.md (161 accumulated decisions across 8 phases, state machine evolution)
- Direct analysis of claude-ace source code at /home/joseibanez/develop/projects/claude-ace/
  - agents/*.md (30 agents, 2275 lines total across review + enforcement categories)
  - skills/ace-full/SKILL.md (528 lines, main pipeline with 8 steps)
  - skills/ace-full/references/orchestration-protocol.md (124 lines, 8-phase pipeline)
  - references/agent-catalog.md (200 lines, 16 parallel + 2 sequenced + 9 enforcement agents)
  - references/enforcement-hard-gates.md (52 lines, mandatory gates per enforcement agent)
  - scripts/*.sh (6 bash scripts for pre-flight data gathering)
- Direct analysis of opencode-assets source code at /home/joseibanez/develop/projects/opencode-assets/
  - src/index.ts (37 lines, plugin entry with tool + config hook registration)
  - src/agents/index.ts (35 lines, config hook pattern for agent injection)
  - src/agents/researcher.ts (43 lines, agent definition pattern -- contrast with hf-researcher.md at 170+ lines)
  - src/config.ts (44 lines, Zod-validated config load/save)
- Confidence levels: All findings are HIGH confidence -- derived from direct source code analysis of the three codebases, not from web searches or training data.
