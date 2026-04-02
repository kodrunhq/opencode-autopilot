# Novel Opportunities: Beyond Competitor Matching

## Philosophy

"Best-in-class" does not mean feature parity with every competitor. It means solving developer problems better than anyone else -- sometimes with features no one has thought of, sometimes by combining existing patterns in ways no single competitor has achieved.

The five competitors analyzed in 11-RESEARCH.md each excel at one thing: superpowers at teaching methodology, ECC at breadth, claude-mem at memory, OMO at tooling, GSD at workflow orchestration. None of them do everything well. The opportunity is not to copy each of them, but to build the **connective tissue** between these capabilities -- a plugin that makes skills, memory, observability, and orchestration reinforce each other.

The user's directive is clear: "The plugin should set the standard." This means our novel opportunities must be features that competitors would want to copy, not the other way around.

---

## Opportunities

### Opportunity 1: Adaptive Skill Loading via Project Fingerprinting

- **What:** On session start, the plugin automatically analyzes the project's tech stack (package.json, go.mod, Cargo.toml, pyproject.toml, etc.) and loads only the relevant skill stacks. No user configuration required. A TypeScript/React project gets TypeScript patterns, React testing, and frontend debugging skills. A Go project gets Go idioms, Go testing, and concurrency skills. Mixed projects get a union of relevant stacks.
- **Why novel:** ECC has 151+ skills but requires users to manually select language stacks (as of v1.9.0). Superpowers has no language-specific skills at all. No competitor does zero-config, project-aware skill selection. Our Phase 10 already has `relevantStacks` detection for review agents -- this extends the same pattern to skills.
- **User value:** Developers get expert-level language guidance without configuring anything. New projects are immediately handled with appropriate patterns. Polyglot developers switching between projects never get wrong-language advice.
- **Feasibility:** HIGH -- we already detect project stacks in Phase 10's `relevantStacks` for review agent selection. Extending this to skill loading is a natural progression. File detection is synchronous, Bun-native, and requires no external dependencies.
- **Implementation scope:** Phase 14 (Skills & Commands). Estimated complexity: 1 plan. Requires: stack detection utility (reuse from review agent selection), skill metadata with `languages` field, selective loading in skill injection hook.
- **Risk:** Over-detection (loading too many stacks for monorepos) could cause token bloat. Mitigated by a token budget cap per skill injection and a priority ranking when multiple stacks compete.

### Opportunity 2: Confidence-Driven Progressive Autonomy

- **What:** Instead of a binary autonomous/manual toggle, the plugin adjusts its autonomy level based on the confidence ledger. High-confidence decisions (well-understood patterns, strong test coverage, familiar codebase) proceed autonomously. Low-confidence decisions (new architecture, unfamiliar domain, security-sensitive changes) pause for user input. The autonomy level adapts per-decision, not per-session.
- **Why novel:** GSD has a fixed autonomy mode. ECC has fixed hook profiles (minimal/standard/strict). No competitor has per-decision adaptive autonomy based on measured confidence. Our confidence ledger (Phase 4) already tracks per-decision confidence -- this connects it to the user interaction model.
- **User value:** Developers get the speed of full autonomy on routine tasks AND the safety of human oversight on risky decisions. No manual toggling required. The plugin "earns trust" over time as confidence scores improve.
- **Feasibility:** HIGH -- the confidence ledger already exists and scores every decision. Adding a threshold check before proceeding is a conditional branch in the orchestrator's dispatch logic. The config system already supports autonomy settings.
- **Implementation scope:** Phase 17 (Integration & Polish). Estimated complexity: 1 plan. Requires: confidence threshold in config, conditional pause in orchestrator dispatch, user-facing explanation of why a pause occurred.
- **Risk:** Threshold calibration is tricky -- too low and it always pauses (annoying), too high and it never pauses (defeats the purpose). Mitigated by starting with a conservative default and allowing user override.

### Opportunity 3: Cross-Session Pattern Evolution (Instinct-to-Skill Pipeline)

- **What:** A closed-loop learning system where the plugin (a) captures recurring patterns from code review findings, debugging sessions, and user corrections, (b) scores their confidence over time (repeated observations strengthen, one-off observations decay), (c) when a pattern reaches a confidence threshold, automatically promotes it to a project-level skill. This is ECC's instinct system taken further: instincts do not just persist, they evolve into first-class skills that compose with the existing skill injection pipeline.
- **Why novel:** ECC has `/evolve` to cluster instincts into skills, but it requires manual invocation and is a command, not an automatic pipeline. claude-mem stores observations but never promotes them. No competitor has a fully automatic instinct-to-skill pipeline with confidence gating. Our lesson memory (Phase 7) already captures patterns with domain categorization and decay -- this extends it with promotion logic.
- **User value:** The plugin genuinely "gets smarter" over time. Project-specific conventions, common pitfalls, and team patterns are learned and enforced without anyone writing skill files manually. New team members inherit institutional knowledge automatically.
- **Feasibility:** MEDIUM -- the lesson memory system exists and captures patterns. Adding confidence scoring and promotion logic is feasible. The skill injection pipeline is proven. The challenge is quality gating: automatically generated skills must be high-quality to avoid injecting noise into agent prompts.
- **Implementation scope:** Phase 15 (Memory System). Estimated complexity: 2 plans. Requires: confidence scoring on lesson entries, promotion threshold, skill template generation from high-confidence lessons, quality validation before promotion.
- **Risk:** Low-quality auto-generated skills degrade agent performance. Mitigated by high promotion threshold (e.g., 5+ observations of the same pattern across 3+ sessions), human-reviewable skill preview before activation, and a rollback mechanism.

### Opportunity 4: Pipeline Observability with Decision Replay

- **What:** Every orchestrator pipeline run produces a structured decision log: what phase ran, what decisions were made, what confidence scores were assigned, what alternatives were considered and rejected. This log is both (a) viewable as a post-run report (`/pipeline-report`) and (b) replayable -- a user can inspect any decision point, understand why the agent chose option A over option B, and override it for future runs.
- **Why novel:** GSD has execution logs but they are state files, not decision replays. ECC has session evaluation but it is a post-session summary, not a per-decision trace. Vibe-Log produces HTML reports but cannot replay decisions. No competitor combines structured decision logging with decision replay and override capability.
- **User value:** Full transparency into autonomous decisions. When something goes wrong, the user can trace exactly where the pipeline diverged from their expectations. Overrides teach the system the user's preferences, feeding into the memory/instinct system. This directly addresses the trust problem with autonomous agents: "I need to understand why it did that."
- **Feasibility:** HIGH -- our orchestrator already logs decisions to the decision log (Phase 4). The confidence ledger tracks per-decision scores. Structuring these into a replayable format is a presentation layer change. The `/pipeline-report` command is a new command referencing existing data.
- **Implementation scope:** Phase 13 (Observability). Estimated complexity: 1 plan. Requires: structured decision log format, `/pipeline-report` command, decision override mechanism stored in config/memory.
- **Risk:** Decision logs could be verbose and token-expensive if injected into future sessions. Mitigated by summarizing decisions (not raw logs) and using progressive disclosure (summary -> detail on demand).

### Opportunity 5: Composable Skill Chains

- **What:** Skills can declare dependencies on other skills, forming chains. When a `debugging` skill is loaded, it automatically loads `verification-before-completion` as a post-step. When `tdd` is loaded, it chains `code-review` as a follow-up. Skills enhance each other rather than operating in isolation. This is declared in skill metadata (`requires: [verification]`), resolved at injection time, and cycle-detected to prevent infinite loops.
- **Why novel:** Superpowers skills are independent -- each operates alone. ECC skills are independent with manual workflow orchestration. No competitor has skill dependency resolution. Our plugin already has a skill injection pipeline (Phase 10) -- adding dependency resolution extends it from a flat list to a graph.
- **User value:** Developers get comprehensive workflows from a single skill activation. Loading "tdd" gets you testing, verification, AND review guidance without configuring each separately. Skill authors (via `/new-skill`) can build on existing skills rather than duplicating content.
- **Feasibility:** MEDIUM -- skill injection already loads skills selectively. Adding a `requires` field to skill metadata and resolving dependencies at injection time is a graph traversal problem (well-understood). Cycle detection prevents infinite loops. The challenge is token budget management: chained skills multiply context cost.
- **Implementation scope:** Phase 14 (Skills & Commands). Estimated complexity: 1 plan (within the skill infrastructure work). Requires: `requires` field in SKILL.md frontmatter, dependency resolver in skill injection, cycle detection, token budget enforcement across chains.
- **Risk:** Deep chains consume too many tokens. Mitigated by a max chain depth (e.g., 3), a total token budget for all injected skills, and priority-based truncation when the budget is exceeded.

### Opportunity 6: Self-Healing Configuration with Doctor-Driven Repair

- **What:** Beyond a diagnostic `/doctor` command that reports problems, the plugin automatically repairs common configuration issues: missing agents re-injected, corrupted config auto-migrated, stale assets re-installed, version mismatches resolved. The doctor is not just a reporter -- it is a remediation engine. On every plugin load, a lightweight health check runs and silently fixes what it can, logging repairs for transparency.
- **Why novel:** OMO's `/doctor` reports issues but does not fix them. agnix has auto-fix for markdown structure but not for plugin configuration. No competitor has a self-healing configuration system. Our installer already has self-healing properties (never overwrites user files, re-copies missing assets) -- this extends the pattern to the full configuration stack.
- **User value:** The plugin "just works" even when configuration drifts. Users who manually edit config files and break things get automatic recovery. Plugin updates that change config schema auto-migrate without user action. The plugin is resilient to its own complexity.
- **Feasibility:** HIGH -- our config v3 migration system already chains v1->v2->v3 migrations. The installer already re-copies missing assets. Extending this to a comprehensive health check on plugin load requires enumerating known-good states and repairing deviations. All repairs are within our filesystem scope (`~/.config/opencode/`).
- **Implementation scope:** Phase 12 (Quick Wins). Estimated complexity: 1 plan. Requires: health check registry (list of checks + repair functions), silent-repair-on-load behavior, `/doctor` command for explicit diagnostics with repair log.
- **Risk:** Auto-repair could overwrite intentional user customizations. Mitigated by the existing "never overwrite user files" principle (COPYFILE_EXCL), a repair log that shows what was changed, and an opt-out flag in config for users who want manual control.

### Opportunity 7: Context-Aware Token Budgeting

- **What:** Instead of static token limits, the plugin dynamically allocates token budgets across its subsystems (skill injection, memory injection, observability headers) based on the remaining context window. Early in a session (lots of room), skills and memory get generous budgets. Late in a session (context pressure), budgets tighten automatically -- less memory injected, fewer skills loaded, observability data summarized more aggressively. The budgeting is transparent: a `/context-budget` command shows current allocations.
- **Why novel:** opencode-snip and Dynamic Context Pruning reduce tokens, but they do not coordinate across subsystems. ECC has `suggest-compact` but it is a reactive alert, not a proactive budget system. No competitor has a unified token budgeting system that allocates across memory, skills, and observability dynamically.
- **User value:** Sessions last longer without compaction. The plugin never contributes to context overflow -- it is always a net positive, shrinking its footprint when space is tight. Users stop seeing "context limit" warnings caused by plugin overhead.
- **Feasibility:** MEDIUM -- requires tracking context window utilization (available via OpenCode session metadata), calculating subsystem token costs (measurable at injection time), and adjusting budgets dynamically. The `session.compacted` and `session.status` hooks provide the signals needed.
- **Implementation scope:** Phase 17 (Integration & Polish). Estimated complexity: 1-2 plans. Requires: context utilization tracking, per-subsystem budget allocation, dynamic budget adjustment on session status changes, `/context-budget` command.
- **Risk:** Budget calculation may be approximate (token counting is model-dependent). Mitigated by using conservative estimates and treating the budget as a guideline, not a hard cap.

---

## Opportunities We Considered and Rejected

| Idea | Why Rejected |
|------|-------------|
| **Browser-based plan annotation UI** | open-plan-annotator's browser UI is impressive but violates our TUI-only constraint. Users should not need to leave the terminal. Plan review can be achieved as a skill or command within the session. |
| **Multi-model ensemble execution** | Running the same prompt against multiple models and synthesizing outputs sounds powerful but is extremely token-expensive, adds latency, and conflicts with our model-agnostic constraint (we cannot assume which models are available). Cost-to-value ratio is poor. |
| **Plugin marketplace/registry** | Building a discovery and install system for third-party skills/agents is a platform concern, not a plugin concern. OpenCode itself should provide this. Our plugin distributes via npm; that is sufficient. |
| **LSP integration tools** | OMO's `lsp_rename`, `lsp_goto_definition` are powerful but require deep OpenCode integration that is outside our plugin API surface. These are features OpenCode should provide natively, not via plugins. |
| **Real-time collaboration** | Multi-user session sharing for pair programming is architecturally incompatible with OpenCode's single-user session model. Out of scope per PROJECT.md. |
| **Autonomous dependency updates** | Auto-updating npm/pip/cargo dependencies sounds useful but is extremely risky in production. The blast radius of a bad update is too high for autonomous execution. Better as a manual-review skill. |

---

## Synthesis: What "Best-in-Class" Looks Like

The v3.0 plugin vision is not a feature list -- it is a system where capabilities reinforce each other:

1. **Zero-config intelligence**: The plugin detects your project, loads relevant skills, injects relevant memories, and configures itself. No setup wizards, no manual skill selection, no configuration files to edit. It just works.

2. **Transparent autonomy**: Every autonomous decision is logged, traceable, and overridable. The plugin earns trust by showing its work, not by hiding behind a black box. Confidence-driven progressive autonomy means it pauses when uncertain, proceeds when confident, and improves over time.

3. **Continuous improvement**: Patterns learned from code reviews, debugging sessions, and user corrections are captured, scored, and promoted into project-level skills. The plugin genuinely gets better with use. This is not raw memory storage -- it is curated, confidence-gated knowledge evolution.

4. **Context-efficient by design**: Every subsystem (skills, memory, observability) operates within a dynamic token budget. The plugin never causes context overflow. Long sessions benefit from aggressive summarization of completed work. The plugin is a net positive on context utilization, not a cost.

5. **Self-healing resilience**: Configuration drift, missing assets, version mismatches -- all silently repaired on load. A `/doctor` command provides full diagnostic visibility. Users never debug the plugin itself.

6. **Composable skill ecosystem**: Skills enhance each other through dependency chains. Loading one skill pulls in its prerequisites. The skill injection pipeline resolves dependencies, enforces token budgets, and prevents conflicts. Creating new skills (via `/new-skill`) is a first-class workflow that builds on the existing skill graph.

This vision differentiates us from every competitor: ECC has breadth but not intelligence. claude-mem has memory but not skill evolution. Superpowers has methodology but not automation. GSD has orchestration but not learning. Our plugin combines orchestration (v2.0), intelligence (v3.0 memory + learning), and developer experience (diagnostics, transparency, self-healing) into a unified system.

### Priority Ordering for Implementation

Based on feasibility, user value, and dependency structure, the recommended implementation order within each phase is:

| Priority | Opportunity | Feasibility | User Value | Dependencies |
|----------|-------------|-------------|------------|--------------|
| 1 | Self-Healing Doctor | HIGH | HIGH | None -- standalone quick win |
| 2 | Adaptive Skill Loading | HIGH | HIGH | Requires skill infrastructure (Phase 14 foundation) |
| 3 | Pipeline Observability | HIGH | HIGH | Requires decision log format standardization |
| 4 | Composable Skill Chains | MEDIUM | MEDIUM | Requires skill metadata format (co-develop with #2) |
| 5 | Confidence-Driven Autonomy | HIGH | HIGH | Requires confidence ledger v2 tuning |
| 6 | Instinct-to-Skill Pipeline | MEDIUM | HIGH | Requires memory system (Phase 15) foundation |
| 7 | Context-Aware Budgeting | MEDIUM | MEDIUM | Requires observability (Phase 13) metrics as input |

Items 1-3 are independently valuable and have no cross-dependencies. Item 4 pairs naturally with Item 2 (both in Phase 14). Items 5-7 depend on earlier phases and should be implemented after their foundations are in place.

### Competitive Moat Analysis

The strongest competitive moats come from opportunities that are hard to replicate:

- **Instinct-to-Skill Pipeline** (Opportunity 3) creates a compounding advantage: the longer a team uses the plugin, the better it gets. Competitors cannot replicate this value without rebuilding their entire memory and skill systems.
- **Confidence-Driven Autonomy** (Opportunity 2) requires an existing confidence ledger -- which we built in Phase 4. Competitors would need to add confidence tracking before they could implement adaptive autonomy.
- **Context-Aware Budgeting** (Opportunity 7) requires coordination across subsystems. Only a plugin that controls memory, skills, and observability can implement unified budgeting. Single-purpose plugins (claude-mem, superpowers) cannot.

The lesson: our multi-system architecture (orchestrator + review + memory + skills + observability) is itself the moat. Novel opportunities that leverage cross-system integration are the hardest for competitors to replicate.

---

## Impact on Phase Structure

Per D-03, research can propose new phases if significant gaps emerge. After analyzing 52+ plugins across the broader ecosystem and identifying 7 novel opportunities, the assessment is:

**No new phases beyond 11-17 are needed.**

The existing phase structure accommodates all identified opportunities:

| Opportunity | Phase | Rationale |
|-------------|-------|-----------|
| Adaptive Skill Loading | Phase 14 (Skills & Commands) | Extension of skill injection infrastructure |
| Confidence-Driven Autonomy | Phase 17 (Integration & Polish) | Connects existing confidence ledger to orchestrator UX |
| Instinct-to-Skill Pipeline | Phase 15 (Memory System) | Extension of lesson memory with promotion logic |
| Pipeline Observability | Phase 13 (Observability) | Core observability deliverable |
| Composable Skill Chains | Phase 14 (Skills & Commands) | Skill infrastructure enhancement |
| Self-Healing Doctor | Phase 12 (Quick Wins) | Low-complexity, high-value DX improvement |
| Context-Aware Budgeting | Phase 17 (Integration & Polish) | Cross-system integration concern |

**Why no new phases:** The identified opportunities are enhancements to planned capabilities, not entirely new capability domains. Phase 14 absorbs skill intelligence features. Phase 15 absorbs learning/evolution features. Phase 17 absorbs integration features. The existing structure has sufficient scope to deliver "best-in-class" without expansion.

**One scope adjustment recommended:** Phase 16 (Specialized Agents) should be scoped down or merged into Phase 14/17, per the agent assessment in 11-RESEARCH.md. Research indicates most "specialized agent" needs are better served as skills. If Phase 16 remains, it should focus on a single validated agent use case, not speculative archetypes.
