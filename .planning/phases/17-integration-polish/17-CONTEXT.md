# Phase 17: Integration & Polish - Context

**Gathered:** 2026-04-02
**Updated:** 2026-04-02 (absorbing Phase 16 scope)
**Status:** Ready for planning

<domain>
## Phase Boundary

Final milestone phase — cross-feature integration, adaptive skill wiring into the orchestrator (absorbed from Phase 16), memory-based confidence tuning, integration tests, full polish pass (error messages, documentation, rough edges). No new hooks. Normal release — not a major version bump.

**Absorbed from Phase 16:**
- Wire `loadAdaptiveSkillContext` into orchestrator dispatch (replacing single coding-standards skill)
- Memory-based confidence tuning (adjust pipeline depth from learned patterns)

**Original Phase 17 scope (retained):**
- Cross-feature integration testing
- Production polish pass

</domain>

<decisions>
## Implementation Decisions

### Absorbed from Phase 16 — Adaptive skill wiring
- **D-01:** Replace `loadSkillContent` + `buildSkillContext` with `loadAdaptiveSkillContext` in `orchestrate.ts:injectSkillContext()`. Every dispatch prompt gets the full stack-filtered, dependency-ordered skill context within token budget.
- **D-02:** No phase-aware skill filtering — all matching skills injected to every dispatch. Simpler, and token budget enforcement already prevents bloat.
- **D-03:** Memory injection via system prompt hook only (Phase 15) — no memory in dispatch prompts needed. Agents already get memory context via `experimental.chat.system.transform`.

### Absorbed from Phase 16 — Confidence tuning
- **D-04:** Adjust pipeline depth based on learned memory patterns. E.g., projects that always need thorough review get higher Arena depth automatically.
- **D-05:** Specifics at Claude's discretion — how to map memory patterns to pipeline parameters.

### Hooks
- **D-06:** Skip hooks for this phase. We already have observability events and memory injection. Additional hooks are speculative — better to add based on real user feedback in a future milestone.

### Integration testing
- **D-07:** Cross-feature integration tests exercising the full stack: orchestrator with adaptive skills + memory + observability working together.
- **D-08:** Key scenarios: session lifecycle (memory capture → retrieval → injection), skill-enhanced dispatch, config migration chain v1→v5.

### Polish
- **D-09:** Full polish pass: integration tests + error message review + documentation update (README, CHANGELOG) + rough edge fixes.
- **D-10:** "Every feature should feel like it was designed as a cohesive system, not bolted together."

### Release
- **D-11:** Normal release — NOT a v3.0 major version bump. The plugin is not mature enough for a major version yet.
- **D-12:** Standard release: version bump (patch/minor), CHANGELOG update, CI green, all tests pass.

### Claude's Discretion
- Confidence tuning implementation details (how memory patterns map to pipeline parameters)
- Integration test scenario selection and scope
- Which error messages need improvement
- Documentation update scope (README sections, new feature descriptions)
- Whether to add a CLAUDE.md update documenting the new memory/skill systems

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 16 context (absorbed scope)
- `.planning/phases/16-specialized-agents/16-CONTEXT.md` — Merge decision, skill routing details, memory dispatch decision

### Phase 14 skill system (wire into orchestrator)
- `src/skills/adaptive-injector.ts` — `loadAdaptiveSkillContext()` to replace old pattern
- `src/orchestrator/skill-injection.ts` — Current `loadSkillContent()` + `loadAdaptiveSkillContext()` (both defined here)

### Phase 15 memory system (integration target)
- `src/memory/` — Full memory module (capture, retrieval, injection, database)
- `src/memory/retrieval.ts` — `retrieveMemoryContext()` for potential confidence tuning integration

### Orchestrator (primary modification target)
- `src/tools/orchestrate.ts` — `injectSkillContext()` (line 102-112) needs upgrading
- `src/orchestrator/confidence/` — Confidence system for tuning integration
- `src/orchestrator/handlers/` — Phase handlers that receive dispatch prompts

### Phase 13 observability (integration testing)
- `src/observability/` — Event system that memory captures from

### Project infrastructure
- `CLAUDE.md` — Project instructions (may need updating)
- `package.json` — Version to bump
- `CHANGELOG.md` — Release notes
- `.github/workflows/` — CI pipeline

</canonical_refs>

<code_context>
## Existing Code Insights

### Key finding: loadAdaptiveSkillContext defined but never called
- `src/orchestrator/skill-injection.ts:69` exports `loadAdaptiveSkillContext`
- `src/tools/orchestrate.ts:102-112` still uses old `loadSkillContent` + `buildSkillContext`
- The upgrade is replacing 3 lines in `injectSkillContext()`

### Integration test gaps
- No test exercises orchestrator + skills + memory together
- No test verifies config migration chain v1→v5 end-to-end in a single test
- No test verifies memory capture from observability events in integration context

### Current test coverage: 1143 tests across 94 files
- Strong unit test coverage per module
- Missing cross-module integration tests

</code_context>

<specifics>
## Specific Ideas

- "No room for failure, let's do this perfectly and do it right, no matter what"
- The plugin should feel like a unified product, not a collection of features
- Not a v3.0 release — "the plugin is not mature enough for v3"

</specifics>

<deferred>
## Deferred Ideas

- **User-facing hooks** (pre-commit, post-session, auto-format) — add based on real user feedback in a future milestone
- **Phase-aware skill filtering** — different pipeline phases get different skills
- **Memory context in dispatch prompts** — currently unnecessary, system prompt hook suffices
- **v3.0 major version** — defer until plugin is more mature

</deferred>

---

*Phase: 17-integration-polish*
*Context gathered: 2026-04-02*
