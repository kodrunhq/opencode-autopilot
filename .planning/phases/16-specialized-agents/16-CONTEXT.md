# Phase 16: Autopilot Integration (Skills + Memory) - Context

**Gathered:** 2026-04-02
**Updated:** 2026-04-02 (post Phase 14+15 completion)
**Status:** MERGED INTO PHASE 17

<domain>
## Phase Boundary

**This phase has been merged into Phase 17.** The concrete work (adaptive skill routing into orchestrator, memory-based confidence tuning) is too thin for a standalone phase. All Phase 16 deliverables are absorbed into Phase 17: Integration & Polish.

### What Phase 16 was supposed to deliver:
1. Wire `loadAdaptiveSkillContext` into orchestrator dispatch (replacing single coding-standards skill)
2. Memory injection into dispatch prompts (determined unnecessary — system prompt hook is sufficient)
3. Confidence threshold tuning based on memory patterns

### Merge rationale:
- Skill routing wire-up is ~20 lines in `orchestrate.ts`
- Memory injection already works via `experimental.chat.system.transform` hook (Phase 15)
- Phase 11 research flagged this phase as potentially "too thin" (D-04)
- Better to combine with Phase 17's integration polish as one cohesive phase

</domain>

<decisions>
## Implementation Decisions

### Merge decision
- **D-01:** Phase 16 scope merged into Phase 17 — not enough standalone work after Phase 14+15 delivered their features
- **D-02:** All Phase 16 success criteria become Phase 17 success criteria

### Skill routing (moves to Phase 17)
- **D-03:** Replace `loadSkillContent` (single coding-standards skill) with `loadAdaptiveSkillContext` (all matching skills) in `orchestrate.ts`. Simplest upgrade — every dispatch gets full stack-filtered, dependency-ordered skill context within token budget.
- **D-04:** No phase-aware skill filtering — all matching skills injected to every dispatch. Simpler, and the token budget enforcement already prevents bloat.

### Memory in dispatch (resolved — no work needed)
- **D-05:** System prompt injection only. The existing `experimental.chat.system.transform` hook from Phase 15 is sufficient. No memory context in dispatch prompts — agents already get memory via their system prompt.
- **D-06:** No double-injection risk since dispatch prompts are tool-return instructions, not direct LLM calls.

### Confidence tuning (moves to Phase 17)
- **D-07:** Memory-based confidence tuning moves to Phase 17 scope — adjust pipeline depth based on learned patterns (e.g., projects that always need thorough review get higher Arena depth).

### Claude's Discretion
- How confidence tuning maps memory patterns to pipeline parameters
- Whether to expose confidence tuning as user-configurable or fully automatic

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 14 skill system (what to wire in)
- `src/skills/adaptive-injector.ts` — `loadAdaptiveSkillContext()` function to replace `loadSkillContent`
- `src/skills/loader.ts` — `loadAllSkills()` for loading all skill directories
- `src/skills/dependency-resolver.ts` — Topological sort for skill ordering

### Phase 15 memory system (already integrated)
- `src/memory/injector.ts` — System prompt injection (already working, no changes needed)
- `src/memory/retrieval.ts` — `retrieveMemoryContext()` for potential confidence tuning

### Orchestrator (target for changes)
- `src/tools/orchestrate.ts` — `injectSkillContext()` function to upgrade (line 102-112)
- `src/orchestrator/skill-injection.ts` — Current single-skill injection pattern
- `src/orchestrator/confidence/` — Confidence system for tuning

</canonical_refs>

<code_context>
## Existing Code Insights

### Key finding: loadAdaptiveSkillContext already exists but isn't wired in
- `src/orchestrator/skill-injection.ts:69` exports `loadAdaptiveSkillContext` — does stack detection, skill filtering, dependency ordering, token budgeting
- `src/tools/orchestrate.ts:102-112` still uses the old `loadSkillContent` (single coding-standards skill)
- The upgrade is literally replacing `loadSkillContent` + `buildSkillContext` with `loadAdaptiveSkillContext`

### Integration Points
- `src/tools/orchestrate.ts:injectSkillContext()` — replace with adaptive version
- `src/orchestrator/confidence/` — read memory patterns for tuning (Phase 17 scope)

</code_context>

<deferred>
## Deferred Ideas

- **Phase-aware skill filtering** — different pipeline phases get different skills (RECON gets brainstorming, BUILD gets TDD). More sophisticated but not needed for v3.0.
- **Memory context in dispatch prompts** — add memory alongside skills in dispatch. Currently unnecessary since system prompt hook handles it.

</deferred>

---

*Phase: 16-specialized-agents (MERGED INTO PHASE 17)*
*Context gathered: 2026-04-02*
