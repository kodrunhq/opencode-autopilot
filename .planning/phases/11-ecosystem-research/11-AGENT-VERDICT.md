# Agent Verdict: Phase 16 Scope Decision

## Executive Summary

Phase 16 should be scoped down to a single integration plan (Option A: Scope Down). Of the 6 agent candidates assessed, none warrant implementation as a new dedicated agent. Every candidate is better served as a skill (Phase 14) or already covered by existing tools. The ecosystem trend is decisive: superpowers (131k+ stars) proves methodology transfer works as skills; ECC is transitioning from agents to skills; our 14 existing agents plus 22 review specialists already cover the pipeline. Phase 16 becomes a lightweight integration phase connecting Phase 14 skills and Phase 15 memory with the existing autopilot agent.

## Assessment Methodology

Each candidate was evaluated against four criteria (per D-12):

1. **Does this agent meaningfully outperform existing tools?** (oc_review with 22 specialists, oc_forensics, oc_orchestrate)
2. **Is the agent form factor better than a skill or command?** (Skills compose with any agent, cost zero tokens at rest, are user-editable; agents require dedicated context, mode management, and maintenance)
3. **Does at least one competitor validate demand?** (Stars, forks, adoption as evidence)
4. **Can it be implemented within our constraints?** (Model-agnostic, Bun-only, no external dependencies)

The assessment used evidence from all 5 deep-dives, the broader ecosystem scan, and our existing tool inventory.

## Candidate Assessments

### MasterDebugger

- **Ecosystem evidence:** Superpowers has `systematic-debugging` as a **skill** (not an agent): 4-phase root cause analysis (reproduce, isolate, diagnose, fix) with tracing and defense-in-depth. ECC has `build-error-resolver` and 6 language-specific variants as **agents**. OMO has `Oracle` agent for architecture/debugging.
- **What we already have:** `oc_forensics` tool for post-hoc failed-run diagnosis. Review engine catches bugs proactively. Pipeline hidden agents handle implementation and review.
- **Agent vs Skill analysis:** Superpowers' systematic-debugging skill has 131k+ stars -- the most validated debugging approach in the ecosystem -- and it is a skill. ECC's agent-based approach (build-error-resolver + 6 language variants) creates maintenance burden with marginal benefit over a single well-written skill. A debugging skill teaches Claude HOW to debug, composing with any agent context. A debugging agent creates a separate context that cannot access the user's current session state without handoff overhead.
- **Verdict:** SKIP as agent. BUILD as Phase 14 SKILL.
- **Rationale:** The skill form factor is strictly better for debugging methodology. A skill composes with the autopilot agent (which has full session context), costs zero tokens when not in use, and matches the pattern proven by superpowers. Our oc_forensics tool handles the tooling side; the skill provides the methodology side.
- **Phase assignment:** Phase 14 (Skills & Commands) -- Gap ID SK-03

### Reviewer Agent (Primary Mode)

- **Ecosystem evidence:** Superpowers splits code review into two **skills** (requesting-code-review + receiving-code-review). ECC has `code-reviewer` as both an agent and a workflow skill. OMO has no dedicated reviewer (uses Momus as plan reviewer).
- **What we already have:** `oc_review` tool with 22 specialist agents covering auth-flow, code-quality, concurrency, contract-verification, database, dead-code, go-idioms, logic, product-thinking, python-django, react-patterns, red-team, rust-safety, scope-intent, security, silent-failure, spec-checking, state-management, test-interrogation, type-soundness, wiring-inspection, and database review. This is the most comprehensive review engine in the entire ecosystem. Additionally, the /review-pr command provides PR-level review.
- **Agent vs Skill analysis:** Adding a new primary "Reviewer" agent would duplicate our oc_review tool. What we lack is the methodology guidance that superpowers provides: how to request a review (self-review checklist, document changes, identify concern areas) and how to receive review feedback (categorize, address blocking first, explain disagreements). These are skills, not agents.
- **Verdict:** SKIP as agent. BUILD review skills in Phase 14.
- **Rationale:** Our review engine with 22 specialists already exceeds every competitor's review capability. A new Reviewer agent would compete with our own tool for the same job. The gap is review methodology (how to ask for and integrate review feedback), which is a skill concern.
- **Phase assignment:** Phase 14 -- Gap ID SK-08

### Planner Agent

- **Ecosystem evidence:** Superpowers has `writing-plans` and `executing-plans` as **skills**. GSD has `gsd-planner` as an agent but within a standalone CLI orchestrator (different architecture). ECC has `planner` as an agent. OMO has `Prometheus` (strategic planner) and `Momus` (plan reviewer) as agents.
- **What we already have:** `oc-planner` (hidden pipeline agent) handles planning within the orchestrator. The autopilot agent drives user-facing planning.
- **Agent vs Skill analysis:** Our orchestrator already handles pipeline planning via oc-planner. What users need for ad-hoc work (outside the pipeline) is planning methodology: how to break down a feature into bite-sized tasks. This is superpowers' writing-plans skill. A new primary Planner agent would compete with both the existing oc-planner and the autopilot agent.
- **Verdict:** SKIP as agent. BUILD planning skills in Phase 14.
- **Rationale:** Planning methodology (task decomposition, dependency ordering, time estimation) works better as a composable skill than a dedicated agent. The user invokes `/write-plan` and gets structured planning guidance within their current session context.
- **Phase assignment:** Phase 14 -- Gap IDs SK-06, SK-07

### TDD Guide Agent

- **Ecosystem evidence:** Superpowers has `test-driven-development` as a **skill** with strict RED-GREEN-REFACTOR and anti-pattern catalog. ECC has `tdd-guide` as both an agent and a `tdd-workflow` skill. The TDD Guard ecosystem plugin enforces TDD via hooks.
- **What we already have:** Nothing for TDD methodology. Our review engine checks test coverage post-hoc but does not enforce test-first development.
- **Agent vs Skill analysis:** Superpowers proves TDD works as a skill (131k+ stars). ECC's dual implementation (agent + skill) reflects a transition in progress. A TDD skill teaches the methodology; a TDD enforcement hook (Phase 17) enforces compliance. Together, skill + hook is more powerful than a standalone TDD agent because: (a) the skill composes with any agent, (b) the hook enforces behavior without needing a dedicated agent context.
- **Verdict:** SKIP as agent. BUILD as Phase 14 SKILL + Phase 17 HOOK.
- **Rationale:** Skill for methodology (RED-GREEN-REFACTOR process, anti-pattern catalog) plus hook for enforcement (tool.execute.before checks test file existence) is strictly superior to a dedicated TDD agent. This two-layer approach (teach + enforce) is something no competitor has -- it combines superpowers' skill approach with TDD Guard's enforcement.
- **Phase assignment:** Phase 14 (skill, SK-02) + Phase 17 (enforcement hook, TS-01)

### Documentation Updater

- **Ecosystem evidence:** GSD has `gsd-doc-writer` and `gsd-doc-verifier` as agents. ECC has `doc-updater` as an agent and `/update-docs`, `/update-codemaps` as commands. OMO has `Librarian` agent.
- **What we already have:** `@documenter` subagent (prompt-based documentation generation). No documentation drift detection or automatic sync.
- **Agent vs Skill analysis:** Documentation sync is a command-driven operation: detect what code changed, identify which docs are affected, generate updates. ECC's `/update-docs` is a command, not an agent invocation. The most valuable form factor is a command that analyzes git diff and updates relevant docs. A dedicated agent adds overhead for what is fundamentally a deterministic workflow (detect changes -> find affected docs -> generate updates).
- **Verdict:** SKIP as agent. BUILD as Phase 14 COMMAND.
- **Rationale:** `/update-docs` as a command is simpler, faster, and more natural than invoking a dedicated agent. The @documenter subagent already handles documentation generation when explicitly called.
- **Phase assignment:** Phase 14 -- Gap ID CM-02

### Background Task Agent

- **Ecosystem evidence:** OMO has `Sisyphus-Junior` (lightweight task executor) and background agent system with configurable concurrency. ECC has `loop-operator` for autonomous loop management. GSD spawns parallel subagent sessions.
- **What we already have:** 9 hidden pipeline agents for orchestrator task dispatch. The orchestrator handles parallel task dispatch within sessions.
- **Agent vs Skill analysis:** Our orchestrator already handles task dispatch and the pipeline agents execute background work. Adding a dedicated "background task" agent would duplicate existing dispatch infrastructure. The gap (if any) is in the dispatch mechanism, not in the agent.
- **Verdict:** SKIP.
- **Rationale:** Our existing pipeline architecture (dispatch instructions from handler tools, orchestrator invokes hidden agents) already provides background task execution. Improving it is an orchestrator enhancement, not a new agent.

## Phase 16 Recommendation

### Option A: Scope Down
Phase 16 becomes a lightweight integration phase (1 plan) focused on connecting Phase 14 skills and Phase 15 memory with the existing autopilot agent. No new agents are built. The autopilot agent is enhanced with memory-aware behavior, skill-informed dispatch, and confidence-driven decision making.

### Option B: Focused Agents
Phase 16 implements 1-2 agents that passed evaluation. However, no candidate passed the bar -- every use case is better served as a skill, command, or hook.

### Option C: Phase Elimination
Phase 16 is eliminated entirely. Its single integration plan is absorbed into Phase 17 (Integration & Polish).

### Recommended Option: A (Scope Down)

**Justification:**

1. **Research is decisive:** Across 5 competitor deep-dives and a 52+ plugin ecosystem scan, the consistent finding is that skills outperform agents for methodology transfer. Superpowers' 131k+ stars with zero agents proves this empirically. ECC's transition from 68 commands to skills-first architecture validates it directionally.

2. **Our existing agent set is complete:** 14 agents (5 primary, 9 pipeline) plus 22 review specialists already cover the SDLC pipeline. Adding new agents would create marginal value with maintenance cost.

3. **The real gap is skills + memory:** Phase 14 skills (brainstorming, TDD, debugging, planning, verification) and Phase 15 memory (cross-session persistence, pattern evolution) are where the research-identified value lives. Phase 16's original mandate ("implement specialized primary agents") has been fulfilled more effectively by distributing agent capabilities across skills and commands.

4. **Integration work is real but small:** Connecting skills and memory to the autopilot agent is meaningful work but fits in 1 plan. This does not warrant a standalone phase with its own planning overhead.

**Phase 16 retained (not eliminated)** because the integration work has distinct dependencies (requires Phase 14 and Phase 15 complete) that distinguish it from Phase 17's cross-system integration. Keeping it as a minimal phase maintains the dependency chain clarity.

## Verdict Summary

| Candidate | Verdict | Implementation | Phase | Gap ID |
|-----------|---------|----------------|-------|--------|
| MasterDebugger | SKIP agent, BUILD skill | Systematic debugging skill | Phase 14 | SK-03 |
| Reviewer (Primary) | SKIP agent, BUILD skills | Review requesting + receiving skills | Phase 14 | SK-08 |
| Planner | SKIP agent, BUILD skills | Plan writing + executing skills | Phase 14 | SK-06, SK-07 |
| TDD Guide | SKIP agent, BUILD skill + hook | TDD workflow skill + enforcement hook | Phase 14 + 17 | SK-02, TS-01 |
| Documentation Updater | SKIP agent, BUILD command | /update-docs command | Phase 14 | CM-02 |
| Background Task Agent | SKIP | Not needed (existing pipeline handles it) | N/A | N/A |

## Phase 16 Scope Resolution

Phase 16 currently has no gap IDs assigned from the gap matrix (all agent gaps were rated LOW and skipped). Two paths forward:

1. **Assign concrete deliverables (recommended):** Memory injection into autopilot dispatch prompts, skill-aware routing logic (select relevant skills per task type), and confidence threshold tuning based on learned patterns. These are integration deliverables that depend on Phase 14 skills and Phase 15 memory being complete.
2. **Merge into Phase 17:** If the integration deliverables above prove too thin to warrant a standalone phase, absorb them into Phase 17 (Integration & Polish) as additional integration items.

The decision should be made after Phase 14 and Phase 15 planning is complete, when the concrete integration surface area is known.

## Impact on ROADMAP.md

**Phase 16 description change:** From "Implement specialized primary agents if Phase 11 validates value" to "Autopilot agent integration with Phase 14 skills and Phase 15 memory."

**Phase 16 plan count:** Reduced from TBD to 1 plan.

**Phase 16 success criteria update:**
1. ~~Each agent passes the "meaningfully better than existing tools" test~~ -> Autopilot agent enhanced with memory context injection and skill-aware behavior
2. ~~Agents are primary mode~~ -> Autopilot remains the primary orchestration agent with enriched capabilities
3. ~~Agents integrate with skills and memory~~ -> Skills and memory integrated into autopilot dispatch flow
4. ~~Agents support autonomous workflow~~ -> Confidence-driven autonomy connects to orchestrator dispatch

**Dependency clarification:** Phase 16 depends on Phase 14 (skills to integrate) and Phase 15 (memory to integrate). Phase 17 depends on Phase 16 for the integrated agent as input to final polish.
