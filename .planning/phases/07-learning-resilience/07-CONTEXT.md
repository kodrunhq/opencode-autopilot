# Phase 7: Learning & Resilience - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Post-run intelligence: the system extracts structured lessons from completed pipeline runs and persists them to project-local memory with decay, and provides a diagnostic forensics tool for analyzing failed runs. Lessons are injected into future pipeline runs via phase-matched prompt context.

</domain>

<decisions>
## Implementation Decisions

### Lesson Memory Structure
- **D-01:** Lesson memory is project-local, stored at `.opencode-assets/lesson-memory.json`. Follows the review memory pattern: Zod schema, atomic writes (tmp + rename), load/prune/save lifecycle.
- **D-02:** Lessons are tagged with one of 4 fixed domain categories: `architecture`, `testing`, `review`, `planning`. This matches LRNR-02 exactly. No catch-all or free-form tags.
- **D-03:** Lessons are injected into future pipeline runs via prompt context. When dispatching a phase handler, load lessons filtered by matching domain (e.g., ARCHITECT gets `architecture` lessons, BUILD gets `testing` + `review` lessons) and append to the agent dispatch prompt as "Prior lessons: [...]". No schema changes to DispatchResult needed.

### Retrospective Integration
- **D-04:** The oc-retrospector agent writes structured JSON (not markdown) to the RETROSPECTIVE artifact directory. The RETROSPECTIVE handler reads the JSON output, validates via Zod `lessonSchema`, and calls `saveLessonMemory()` to persist. No markdown parsing needed.
- **D-05:** Retrospective runs only on successful pipeline completion (all 8 phases). Failed runs are handled by forensics (separate tool). This keeps retrospective focused on "what worked" learning.

### Forensics Tool
- **D-06:** Forensics is a separate `oc_forensics` tool following the `*Core` + `tool()` pattern. Not a flag on `oc_orchestrate`. Clean separation of concerns.
- **D-07:** Failure metadata captured when a pipeline fails: `failedPhase`, `failedAgent` (if dispatch was in progress), `errorMessage`, `timestamp`, `lastSuccessfulPhase`. Add a `failureContext` optional field to `PipelineState` schema. Enough to diagnose without bloating state.
- **D-08:** Forensics classifies failures as recoverable vs terminal using heuristics: RECON/CHALLENGE/ARCHITECT failures are recoverable (re-run from that phase). BUILD failures with strike overflow are terminal. State corruption is terminal. Output includes a `recoverable: boolean` field and `suggestedAction: "resume" | "restart" | "manual"`.
- **D-09:** Forensics output is structured JSON matching the `*Core` pattern. Fields: `failedPhase`, `failedAgent`, `errorMessage`, `lastSuccessfulPhase`, `recoverable`, `suggestedAction`, `phasesCompleted`. Consistent with all other `oc_*` tools.

### Decay & Lifecycle
- **D-10:** Lessons expire after 90 days (longer than review memory's 30 days since lessons are higher-value). Time-based decay, pruned on load like review memory. Simple, predictable, avoids unbounded growth.
- **D-11:** Lesson store capped at 50 lessons total, keep newest. Each pipeline run extracts ~3-8 lessons, so 50 covers ~6-15 runs worth of history. Domain filtering at injection time keeps prompt context concise (~12 lessons per phase max).

### Claude's Discretion
- Exact lesson JSON schema field names and structure (as long as it includes: content, domain, extractedAt, source phase)
- How `orchestrateCore` persists failure metadata (where in the catch block, exact field mapping)
- Domain-to-phase mapping for lesson injection (which domains go to which phases)
- Whether forensics reads state directly or uses `loadState`

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Memory Pattern (reuse)
- `src/review/memory.ts` -- Load/save/prune pattern with atomic writes, Zod validation, time-based decay. Primary reference for lesson memory implementation.
- `src/review/schemas.ts` -- `reviewMemorySchema` for schema pattern reference
- `src/review/types.ts` -- `ReviewMemory` type for type pattern reference

### Existing Retrospective Infrastructure
- `src/orchestrator/handlers/retrospective.ts` -- Current handler (dispatches oc-retrospector, returns complete). Needs enhancement to parse JSON + persist lessons.
- `src/agents/pipeline/oc-retrospector.ts` -- Current agent prompt (writes markdown). Needs update to write structured JSON.

### State & Error Handling
- `src/orchestrator/schemas.ts` -- `pipelineStateSchema` needs `failureContext` field addition
- `src/orchestrator/state.ts` -- `loadState`, `saveState`, `patchState` for state management pattern
- `src/tools/orchestrate.ts` -- `orchestrateCore` error catch block (line ~170) needs failure metadata persistence

### Tool Pattern Reference
- `src/tools/review.ts` -- `reviewCore` + `ocReview` as the most recent *Core + tool() reference
- `src/orchestrator/handlers/types.ts` -- `AGENT_NAMES`, `DispatchResult` for handler contract

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `review/memory.ts`: Full load/save/prune/decay pattern — directly adaptable for lesson memory. Same atomic write, Zod validation, cap-based pruning.
- `handlers/retrospective.ts`: Handler skeleton exists — needs enhancement, not creation from scratch.
- `oc-retrospector` agent: Exists with correct permissions (edit only, no bash). Prompt needs update.

### Established Patterns
- All tools follow `*Core(args, baseDir)` + `tool()` wrapper. Forensics tool follows this.
- All schemas use Zod with `z.infer<>` for types. Lesson schema follows this.
- All state mutations go through `patchState` + `saveState`. Failure context follows this.
- Handler returns use `Object.freeze({...} satisfies DispatchResult)`.

### Integration Points
- `orchestrateCore` catch block: where failure metadata gets persisted before returning error JSON
- `PHASE_HANDLERS` in `handlers/index.ts`: RETROSPECTIVE handler enhanced, no new handlers needed
- `src/index.ts` plugin entry: new `oc_forensics` tool registered alongside existing tools
- Each phase handler's dispatch prompt: where lesson injection happens (load lessons, filter by domain, append to prompt)

</code_context>

<specifics>
## Specific Ideas

No specific requirements -- open to standard approaches following established codebase patterns.

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope.

</deferred>

---

*Phase: 07-learning-resilience*
*Context gathered: 2026-04-01*
