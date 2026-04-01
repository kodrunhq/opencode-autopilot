# Phase 7: Learning & Resilience - Research

**Researched:** 2026-04-01
**Domain:** Post-run intelligence (lesson extraction, memory persistence, failure diagnostics)
**Confidence:** HIGH

## Summary

Phase 7 adds two capabilities to the orchestrator pipeline: (1) structured lesson extraction from successful runs with time-based decay persistence, and (2) a forensics tool for diagnosing failed runs. Both capabilities follow existing codebase patterns closely -- lesson memory mirrors `review/memory.ts` (load/prune/save with atomic writes and Zod validation), and forensics follows the `*Core` + `tool()` pattern established by every other tool.

The implementation is well-constrained by CONTEXT.md decisions. Lesson memory lives at `.opencode-autopilot/lesson-memory.json` (project-local), uses 90-day TTL with 50-lesson cap, and categorizes by four fixed domains. The retrospective handler needs enhancement (not creation) to parse structured JSON from the oc-retrospector agent and persist lessons. The forensics tool reads pipeline state and classifies failures as recoverable vs terminal using phase-based heuristics.

**Primary recommendation:** Implement in three waves -- (1) lesson schema + memory module, (2) retrospective handler enhancement + agent prompt update + lesson injection into phase dispatches, (3) forensics tool + failure metadata capture in orchestrateCore.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Lesson memory is project-local, stored at `.opencode-autopilot/lesson-memory.json`. Follows the review memory pattern: Zod schema, atomic writes (tmp + rename), load/prune/save lifecycle.
- **D-02:** Lessons are tagged with one of 4 fixed domain categories: `architecture`, `testing`, `review`, `planning`. This matches LRNR-02 exactly. No catch-all or free-form tags.
- **D-03:** Lessons are injected into future pipeline runs via prompt context. When dispatching a phase handler, load lessons filtered by matching domain and append to the agent dispatch prompt as "Prior lessons: [...]". No schema changes to DispatchResult needed.
- **D-04:** The oc-retrospector agent writes structured JSON (not markdown) to the RETROSPECTIVE artifact directory. The RETROSPECTIVE handler reads the JSON output, validates via Zod `lessonSchema`, and calls `saveLessonMemory()` to persist. No markdown parsing needed.
- **D-05:** Retrospective runs only on successful pipeline completion (all 8 phases). Failed runs are handled by forensics (separate tool).
- **D-06:** Forensics is a separate `oc_forensics` tool following the `*Core` + `tool()` pattern. Not a flag on `oc_orchestrate`. Clean separation of concerns.
- **D-07:** Failure metadata captured when a pipeline fails: `failedPhase`, `failedAgent`, `errorMessage`, `timestamp`, `lastSuccessfulPhase`. Add a `failureContext` optional field to `PipelineState` schema.
- **D-08:** Forensics classifies failures as recoverable vs terminal using heuristics: RECON/CHALLENGE/ARCHITECT failures are recoverable (re-run from that phase). BUILD failures with strike overflow are terminal. State corruption is terminal.
- **D-09:** Forensics output is structured JSON. Fields: `failedPhase`, `failedAgent`, `errorMessage`, `lastSuccessfulPhase`, `recoverable`, `suggestedAction`, `phasesCompleted`.
- **D-10:** Lessons expire after 90 days. Time-based decay, pruned on load like review memory.
- **D-11:** Lesson store capped at 50 lessons total, keep newest. Domain filtering at injection time keeps prompt context concise.

### Claude's Discretion
- Exact lesson JSON schema field names and structure (must include: content, domain, extractedAt, source phase)
- How `orchestrateCore` persists failure metadata (where in the catch block, exact field mapping)
- Domain-to-phase mapping for lesson injection (which domains go to which phases)
- Whether forensics reads state directly or uses `loadState`

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LRNR-01 | Institutional memory persists lessons from completed runs to a global store, with decay mechanism for stale entries | Lesson memory module (mirroring review/memory.ts), 90-day TTL, 50-lesson cap, atomic writes. Schema + load/prune/save functions. |
| LRNR-02 | Retrospective agent extracts lessons categorized by domain (architecture, testing, review, planning) after each run | Updated oc-retrospector prompt to output structured JSON with 4 fixed domain categories. Enhanced RETROSPECTIVE handler to parse JSON + persist. |
| LRNR-03 | Forensics tool analyzes failed runs: identifies failing phase, agent, root cause, and classifies as recoverable vs. terminal | `oc_forensics` tool with `forensicsCore` function. Reads `failureContext` from pipeline state. Phase-based recoverability heuristics. |
| LRNR-04 | User can invoke forensics via a `--forensics` flag on the orchestrator tool | NOTE: CONTEXT.md D-06 decided forensics is a SEPARATE `oc_forensics` tool, not a flag on `oc_orchestrate`. This is a cleaner approach. Requirement intent (user can diagnose failures) is met by the separate tool. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | transitive via @opencode-ai/plugin | Lesson schema validation | Already used for all schemas in codebase |
| node:fs/promises | built-in | Atomic file I/O (readFile, writeFile, rename) | Project constraint: no Bun.file/Bun.write |
| node:path | built-in | Path construction | Standard across codebase |
| node:os | built-in | tmpdir for tests | Standard test pattern |

### Supporting
No new dependencies required. All functionality builds on existing modules:
- `src/utils/fs-helpers.ts` (ensureDir, isEnoentError)
- `src/orchestrator/state.ts` (loadState, patchState, saveState)
- `src/orchestrator/artifacts.ts` (getPhaseDir, PHASE_ARTIFACTS)
- `src/utils/paths.ts` (getProjectArtifactDir)

**Installation:** No new packages needed.

## Architecture Patterns

### Recommended File Structure
```
src/
  orchestrator/
    lesson-memory.ts          # Load/save/prune lesson memory (mirrors review/memory.ts)
    lesson-schemas.ts         # Zod schemas for lessons (lessonSchema, lessonMemorySchema)
    lesson-types.ts           # z.infer<> type exports
    handlers/
      retrospective.ts        # Enhanced: parse JSON result, validate, persist lessons
    schemas.ts                # Enhanced: add failureContext to pipelineStateSchema
  tools/
    forensics.ts              # oc_forensics tool (forensicsCore + tool wrapper)
  agents/pipeline/
    oc-retrospector.ts        # Updated prompt: output structured JSON
tests/
  orchestrator/
    lesson-memory.test.ts     # Unit tests for lesson memory module
    forensics.test.ts         # Unit tests for forensicsCore
    handlers/
      retrospective.test.ts   # Tests for enhanced retrospective handler
```

### Pattern 1: Lesson Memory Module (mirrors review/memory.ts)
**What:** A self-contained module with `loadLessonMemory`, `saveLessonMemory`, `pruneLessons`, `createEmptyLessonMemory` functions.
**When to use:** Any time lessons need to be read, written, or pruned.
**Example:**
```typescript
// Source: Adapted from src/review/memory.ts pattern
const LESSON_FILE = "lesson-memory.json";
const MAX_LESSONS = 50;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export async function loadLessonMemory(projectRoot: string): Promise<LessonMemory | null> {
  const memoryPath = join(projectRoot, ".opencode-autopilot", LESSON_FILE);
  try {
    const raw = await readFile(memoryPath, "utf-8");
    const parsed = JSON.parse(raw);
    const validated = lessonMemorySchema.parse(parsed);
    return pruneLessons(validated);
  } catch (error: unknown) {
    if (isEnoentError(error)) return null;
    if (error instanceof SyntaxError || (error !== null && typeof error === "object" && "issues" in error)) {
      return null;
    }
    throw error;
  }
}
```

### Pattern 2: Failure Metadata in PipelineState
**What:** Optional `failureContext` field added to `pipelineStateSchema` for capturing failure info when a pipeline errors.
**When to use:** In the catch block of `orchestrateCore` before returning the error JSON.
**Example:**
```typescript
// Added to pipelineStateSchema in schemas.ts
failureContext: z.object({
  failedPhase: phaseSchema,
  failedAgent: z.string().max(128).nullable(),
  errorMessage: z.string().max(4096),
  timestamp: z.string().max(128),
  lastSuccessfulPhase: phaseSchema.nullable(),
}).nullable().default(null),
```

### Pattern 3: Lesson Injection into Phase Dispatches
**What:** Before dispatching an agent, load lessons filtered by relevant domains and append to the prompt.
**When to use:** In each handler's dispatch prompt construction.
**Example:**
```typescript
// Domain-to-phase mapping (Claude's discretion)
const PHASE_LESSON_DOMAINS: Record<Phase, readonly LessonDomain[]> = {
  RECON: ["planning"],
  CHALLENGE: ["architecture", "planning"],
  ARCHITECT: ["architecture"],
  EXPLORE: [],
  PLAN: ["planning", "architecture"],
  BUILD: ["testing", "review"],
  SHIP: ["planning"],
  RETROSPECTIVE: [],
};

// Utility to build lesson context string
function buildLessonContext(lessons: readonly Lesson[], phase: Phase): string {
  const domains = PHASE_LESSON_DOMAINS[phase];
  const relevant = lessons.filter(l => domains.includes(l.domain));
  if (relevant.length === 0) return "";
  const items = relevant.map(l => `- [${l.domain}] ${l.content}`).join("\n");
  return `\n\nPrior lessons from previous runs:\n${items}`;
}
```

### Pattern 4: Forensics Tool (*Core + tool() wrapper)
**What:** Separate tool that reads pipeline state and diagnoses failures.
**When to use:** After a pipeline fails, user invokes `oc_forensics` directly.
**Example:**
```typescript
// Source: follows src/tools/review.ts pattern
export async function forensicsCore(
  _args: ForensicsArgs,
  artifactDir: string,
): Promise<string> {
  const state = await loadState(artifactDir);
  if (state === null) {
    return JSON.stringify({ action: "error", message: "No pipeline state found" });
  }
  if (state.status !== "FAILED" || !state.failureContext) {
    return JSON.stringify({ action: "error", message: "No failure to diagnose" });
  }
  const { failureContext } = state;
  const recoverable = isRecoverable(failureContext);
  return JSON.stringify({
    failedPhase: failureContext.failedPhase,
    failedAgent: failureContext.failedAgent,
    errorMessage: failureContext.errorMessage,
    lastSuccessfulPhase: failureContext.lastSuccessfulPhase,
    recoverable,
    suggestedAction: getSuggestedAction(failureContext, recoverable),
    phasesCompleted: state.phases.filter(p => p.status === "DONE").map(p => p.name),
  });
}
```

### Anti-Patterns to Avoid
- **Parsing markdown from retrospector:** D-04 locks in structured JSON output. Never parse markdown to extract lessons.
- **Mutating lesson memory in place:** Always create new objects via spread, return frozen results.
- **Unbounded lesson accumulation:** Always prune on load (cap + TTL). Never skip pruning.
- **Injecting all lessons into all phases:** Domain filtering is mandatory. Sending 50 lessons to every phase wastes tokens.
- **Adding forensics as a flag on oc_orchestrate:** D-06 explicitly chose a separate tool. Keep concerns separated.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic file writes | Custom write logic | Copy pattern from review/memory.ts (tmp + rename) | Race conditions, corruption prevention |
| Schema validation | Manual field checks | Zod schemas with `.parse()` | Consistent with entire codebase, bidirectional validation |
| State loading | Custom JSON parsing | `loadState` from orchestrator/state.ts | Already handles ENOENT, parse errors |
| Phase transitions | Manual status tracking | `completePhase`, `getNextPhase` from orchestrator/phase.ts | Validated transitions |

**Key insight:** Every pattern this phase needs already exists in the codebase. The lesson memory module is a near-clone of review/memory.ts. The forensics tool follows the exact same *Core pattern as review and orchestrate. No new patterns need invention.

## Common Pitfalls

### Pitfall 1: Retrospector Agent Prompt Drift
**What goes wrong:** The oc-retrospector agent outputs free-form text or malformed JSON instead of the expected structured format.
**Why it happens:** LLM agents are unreliable at consistently producing exact JSON schemas, especially when the prompt is vague about format.
**How to avoid:** Include an explicit JSON schema example in the agent prompt. The handler should also gracefully handle malformed JSON (log warning, skip persistence) rather than crashing the pipeline.
**Warning signs:** Zod parse failures in retrospective handler during testing.

### Pitfall 2: Lesson Memory File Corruption on Concurrent Runs
**What goes wrong:** Two concurrent pipeline runs in the same project clobber each other's lesson memory.
**Why it happens:** Load-modify-save is not atomic across processes.
**How to avoid:** Atomic writes (tmp + rename) protect against partial writes but not against lost updates. Since the orchestrator is designed as single-run-at-a-time per project, this is acceptable. Document the single-run assumption.
**Warning signs:** Lesson count is lower than expected after multiple sequential runs.

### Pitfall 3: Failure Metadata Not Persisted Before Error Return
**What goes wrong:** `orchestrateCore` catch block returns the error JSON but never persists `failureContext` to state, so forensics has nothing to read.
**Why it happens:** The current catch block (line ~170 in orchestrate.ts) only formats the error message -- it does not call `patchState` + `saveState`.
**How to avoid:** In the catch block, after formatting the error, attempt to load current state, patch with `failureContext`, and save. Wrap this in its own try/catch so a save failure doesn't mask the original error.
**Warning signs:** `forensicsCore` always returns "No failure to diagnose" after a real pipeline failure.

### Pitfall 4: Schema Version Mismatch After Adding failureContext
**What goes wrong:** Adding `failureContext` to `pipelineStateSchema` could break existing state files that lack the field.
**Why it happens:** The field must be `.nullable().default(null)` so Zod parsing of old state files succeeds.
**How to avoid:** Use `.nullable().default(null)` on the new field. No schema version bump needed since it is backward-compatible (old state files parse cleanly with the default).
**Warning signs:** `loadState` throws ZodError on existing state files.

### Pitfall 5: Lesson Injection Bloating Agent Prompts
**What goes wrong:** Too many lessons injected into a phase dispatch prompt, consuming excessive tokens.
**Why it happens:** No per-phase cap on injected lessons combined with a full lesson store.
**How to avoid:** Domain filtering (D-03) naturally limits to ~12 lessons per phase. Additionally, truncate individual lesson content to a reasonable length (e.g., 256 chars) and cap injected count at ~10 per dispatch.
**Warning signs:** Agent dispatch prompts exceeding expected token budgets.

### Pitfall 6: RETROSPECTIVE Artifact Path Change
**What goes wrong:** The current `PHASE_ARTIFACTS` maps RETROSPECTIVE to `["lessons.md"]`. If the retrospector now writes JSON, the artifact filename should change or the handler should write to a different file.
**How to avoid:** Update `PHASE_ARTIFACTS` to reflect the new JSON output (e.g., `lessons.json`). Or have the handler write the persisted lesson memory separately from the agent's raw output. The handler controls persistence; the artifact map is for cross-phase references.
**Warning signs:** Other handlers or the ship handler referencing `lessons.md` when it no longer exists.

## Code Examples

### Lesson Schema (recommended structure)
```typescript
// Source: Adapted from review/schemas.ts pattern
import { z } from "zod";

export const LESSON_DOMAINS = Object.freeze([
  "architecture", "testing", "review", "planning"
] as const);

export const lessonDomainSchema = z.enum(LESSON_DOMAINS);

export const lessonSchema = z.object({
  content: z.string().max(1024),
  domain: lessonDomainSchema,
  extractedAt: z.string().max(128),
  sourcePhase: z.string().max(128),
});

export const lessonMemorySchema = z.object({
  schemaVersion: z.literal(1),
  lessons: z.array(lessonSchema).max(50),
  lastUpdatedAt: z.string().max(128).nullable(),
});
```

### Failure Context Schema Addition
```typescript
// Added to schemas.ts, inside pipelineStateSchema
failureContext: z.object({
  failedPhase: phaseSchema,
  failedAgent: z.string().max(128).nullable(),
  errorMessage: z.string().max(4096),
  timestamp: z.string().max(128),
  lastSuccessfulPhase: phaseSchema.nullable(),
}).nullable().default(null),
```

### Enhanced orchestrateCore Catch Block
```typescript
// In orchestrate.ts catch block
catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  // Persist failure metadata for forensics (best-effort)
  try {
    const currentState = await loadState(artifactDir);
    if (currentState?.currentPhase) {
      const lastDone = currentState.phases
        .filter(p => p.status === "DONE")
        .pop();
      const failureContext = {
        failedPhase: currentState.currentPhase,
        failedAgent: null, // Could be enhanced with handler-level tracking
        errorMessage: message,
        timestamp: new Date().toISOString(),
        lastSuccessfulPhase: lastDone?.name ?? null,
      };
      const failed = patchState(currentState, {
        status: "FAILED",
        failureContext,
      });
      await saveState(failed, artifactDir);
    }
  } catch {
    // Swallow save errors -- original error takes priority
  }

  return JSON.stringify({ action: "error", message });
}
```

### Recoverability Heuristic
```typescript
function isRecoverable(ctx: FailureContext): boolean {
  const recoverablePhases: readonly string[] = [
    "RECON", "CHALLENGE", "ARCHITECT", "EXPLORE", "PLAN", "SHIP", "RETROSPECTIVE"
  ];
  return recoverablePhases.includes(ctx.failedPhase);
  // BUILD failures are terminal when caused by strike overflow
  // State corruption is terminal (handled by loadState returning null)
}

function getSuggestedAction(
  ctx: FailureContext,
  recoverable: boolean,
): "resume" | "restart" | "manual" {
  if (!recoverable) return "restart";
  if (ctx.failedPhase === "RECON") return "restart"; // nothing to resume from
  return "resume";
}
```

### Updated oc-retrospector Prompt
```typescript
export const ocRetrospectorAgent: Readonly<AgentConfig> = Object.freeze({
  description: "Analyzes pipeline run and extracts lessons for institutional memory",
  mode: "subagent",
  maxSteps: 25,
  prompt: `You are oc-retrospector. Analyze the entire pipeline run and extract lessons for institutional memory.

Read all phase artifacts. Extract 3-8 generalizable lessons.

Output ONLY valid JSON matching this schema:
{
  "lessons": [
    {
      "content": "Brief lesson (1-2 sentences, generalizable, no project-specific identifiers)",
      "domain": "architecture" | "testing" | "review" | "planning",
      "sourcePhase": "RECON" | "CHALLENGE" | "ARCHITECT" | "PLAN" | "BUILD" | "SHIP"
    }
  ]
}

Domain guide:
- architecture: Design decisions, component structure, API patterns
- testing: Test strategies, coverage gaps, quality gates
- review: Code review findings, common issues, fix patterns
- planning: Task decomposition, estimation, dependency management

Rules:
- Lessons must be generalizations, not project-specific details
- Each lesson must have exactly one domain
- 3-8 lessons per run
- No markdown, only JSON`,
  permission: {
    edit: "allow",
  },
});
```

## Project Constraints (from CLAUDE.md)

- **Runtime:** Bun only -- tests use `bun:test`
- **Formatting:** Biome with tabs, 100-char line width
- **No Bun.file/Bun.write:** Use `node:fs/promises`
- **No standalone Zod install:** Import `z` from `"zod"` (transitive dep)
- **Model agnostic:** No model identifiers in agent definitions
- **Global vs project scope:** Lesson memory writes to `<projectRoot>/.opencode-autopilot/` (project-local per D-01)
- **`oc_` prefix:** Forensics tool must be `oc_forensics`
- **Agent permissions:** oc-retrospector has `edit: "allow"` only (no bash) -- already correct
- **Immutable frozen returns:** All handler results use `Object.freeze({...} satisfies DispatchResult)`
- **Atomic writes:** tmp + rename pattern for all JSON persistence
- **Prompt sanitization:** Any user content in prompts must pass through `sanitizeTemplateContent()`

## Open Questions

1. **LRNR-04 vs D-06 tension:**
   - What we know: LRNR-04 says "forensics via a `--forensics` flag on the orchestrator tool" but D-06 decided it is a separate `oc_forensics` tool.
   - What's unclear: Whether the planner should also add a `forensics` arg to `oc_orchestrate` that delegates to `forensicsCore`, or just implement the separate tool.
   - Recommendation: Implement as separate `oc_forensics` tool per D-06. LRNR-04's intent (user can diagnose failures) is fully met. A thin delegation from oc_orchestrate is unnecessary complexity.

2. **Agent-level failure tracking:**
   - What we know: D-07 includes `failedAgent` in failure metadata. The current catch block in `orchestrateCore` does not know which agent was being dispatched.
   - What's unclear: How to capture the agent name in the catch block since handlers return dispatch instructions but the error may occur within the handler itself.
   - Recommendation: Set `failedAgent` to `null` in the catch block. If more granularity is needed, handlers can include the agent name in their error messages. The phase alone is sufficient for most diagnostics.

3. **Lesson injection point -- handler vs orchestrateCore:**
   - What we know: D-03 says inject at dispatch time.
   - What's unclear: Whether injection happens inside each handler's prompt construction or in `processHandlerResult` when it encounters a dispatch action.
   - Recommendation: Inject in a centralized location (`processHandlerResult` or a utility called before dispatch) rather than modifying every handler. This keeps handlers clean and ensures consistent injection.

## Sources

### Primary (HIGH confidence)
- `src/review/memory.ts` -- Complete load/save/prune pattern reference
- `src/review/schemas.ts` -- Zod schema pattern reference
- `src/orchestrator/schemas.ts` -- PipelineState schema (needs failureContext addition)
- `src/orchestrator/state.ts` -- State management (loadState, patchState, saveState)
- `src/orchestrator/handlers/retrospective.ts` -- Current handler to enhance
- `src/orchestrator/handlers/types.ts` -- DispatchResult, AGENT_NAMES, PhaseHandler
- `src/tools/orchestrate.ts` -- orchestrateCore catch block (line ~170)
- `src/tools/review.ts` -- *Core + tool() pattern reference
- `src/agents/pipeline/oc-retrospector.ts` -- Current agent prompt
- `src/index.ts` -- Tool registration point

### Secondary (MEDIUM confidence)
- `07-CONTEXT.md` -- All 11 locked decisions constraining implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing patterns
- Architecture: HIGH -- direct mirror of review/memory.ts pattern, CONTEXT.md locks all key decisions
- Pitfalls: HIGH -- based on direct code reading of existing catch blocks, schema patterns, and memory module

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable -- internal codebase patterns, no external dependency churn)
