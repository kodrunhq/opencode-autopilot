# Technology Stack

**Project:** OpenCode Assets Plugin v2.0 -- Autonomous Orchestrator + Review Engine
**Researched:** 2026-03-31
**Scope:** Stack additions for NEW capabilities only (orchestrator state machine, review pipeline, confidence system, institutional memory). Existing stack validated in prior milestone is listed for integration context but not re-evaluated.

## Existing Stack (VALIDATED -- DO NOT CHANGE)

Already in production. Listed for integration context only.

| Technology | Version | Purpose |
|------------|---------|---------|
| Bun | 1.2.x+ | JS/TS runtime, test runner, plugin host |
| TypeScript | 5.8.x (native via Bun) | Language |
| @opencode-ai/plugin | ^1.3.8 | Plugin SDK (tool registration, hooks, config) |
| Zod | transitive via plugin SDK | Schema validation (import { z } from "zod" works) |
| yaml | ^2.8.3 | YAML frontmatter generation |
| Biome | ^2.4.10 | Lint + format |
| node:fs/promises | built-in | File I/O (project constraint: no Bun.file/Bun.write) |
| node:path, node:os | built-in | Path manipulation, homedir resolution |
| bun:test | built-in | Jest-compatible test runner |

## Recommended Stack Additions

### State Machine: Hand-rolled with TypeScript discriminated unions

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Custom FSM | n/a (project code) | 8-phase orchestrator state machine | Zero deps, compile-time safety, ~80 lines |

**Why NOT XState v5:** XState v5 (latest 5.28.0, ~3.7M weekly downloads, zero deps) is a powerful statechart library with actor model support. However, it is overengineered for this use case:

1. The orchestrator has a **fixed 8-phase linear pipeline** with known transitions -- no hierarchical states, no parallel regions, no dynamic actor spawning
2. XState's actor model adds conceptual overhead (spawn, send, invoke) that maps poorly to OpenCode's Task tool dispatch model
3. Bundle size (~50KB+ minified) for what is a simple transition map
4. David Khourshid (XState's creator) himself wrote ["You don't need a library for state machines"](https://dev.to/davidkpiano/you-don-t-need-a-library-for-state-machines-k7h) for simple cases

**Implementation pattern:**
```typescript
// Discriminated union -- compiler enforces exhaustiveness
type OrchestratorPhase =
  | { phase: "research"; data: ResearchState }
  | { phase: "plan"; data: PlanState }
  | { phase: "architect"; data: ArchitectState }
  | { phase: "implement"; data: ImplementState }
  | { phase: "review"; data: ReviewState }
  | { phase: "fix"; data: FixState }
  | { phase: "verify"; data: VerifyState }
  | { phase: "ship"; data: ShipState };

// Pure function transition map
function transition(
  current: OrchestratorPhase,
  event: OrchestratorEvent
): OrchestratorPhase { /* switch on phase + event */ }
```

**Confidence:** HIGH -- standard TypeScript pattern, no library needed, follows codebase philosophy of "no unnecessary deps."

---

### State Persistence: JSON files via node:fs/promises + Zod

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| JSON files + Zod schemas | existing deps | Persist orchestrator state, confidence ledger, decision log | Matches existing config.ts pattern exactly |

**Why NOT bun:sqlite:** Bun ships with `bun:sqlite` (synchronous API, 3-6x faster than better-sqlite3), and it would be great for structured queries. However:

1. **Project constraint:** "No Bun.file()/Bun.write()" -- using bun-specific APIs reduces portability. While `bun:sqlite` is a different concern from `Bun.file()`, the spirit of the constraint favors standard Node APIs
2. **Write frequency:** ~8 writes per orchestration run (one per phase boundary) -- SQLite's advantages (concurrency, ACID) don't matter for sequential single-writer access
3. **Existing pattern:** `src/config.ts` already implements Zod-validated JSON load/save. Extending this pattern is zero learning curve
4. **Migration complexity:** SQLite requires schema DDL and migration tooling. JSON + Zod version field handles schema evolution with inline migration functions
5. **Future upgrade path:** If institutional memory grows beyond ~100 entries or needs cross-field queries, migrate to `bun:sqlite`. The Zod schemas become table definitions. This is a later concern

**Pattern:** Extend the existing `config.ts` approach:
```typescript
// Atomic write: temp file + rename (crash-safe)
async function saveState(state: OrchestratorState, path: string): Promise<void> {
  const validated = orchestratorStateSchema.parse(state);
  const tmp = `${path}.tmp.${Date.now()}`;
  await writeFile(tmp, JSON.stringify(validated, null, 2), "utf-8");
  await rename(tmp, path);
}
```

**Confidence:** HIGH -- mirrors existing codebase pattern, zero new dependencies.

---

### Event Bus: mitt

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| mitt | ^3.0.1 | Typed event emitter for orchestrator lifecycle events | 200 bytes gzipped, zero deps, typed generics, 16.7M weekly downloads |

**Why an event system at all:** The orchestrator pipeline has multiple consumers of state changes:
1. Decision logging observes every confidence change and phase transition
2. Plugin event hooks (session.updated) receive phase transition data
3. Future: TUI progress display via `tui.toast.show` hook
4. Review engine emits per-agent results that the confidence ledger consumes

Without an event bus, this requires threading callbacks through every function -- violating the codebase's pure-function patterns.

**Why mitt over alternatives:**

| Library | Size | Downloads/wk | API | Verdict |
|---------|------|-------------|-----|---------|
| mitt | 200B | 16.7M | on/off/emit | Use this -- minimal, typed, sufficient |
| eventemitter3 | ~1KB | 76.3M | Rich (wildcards, namespaces) | Overkill -- no wildcards needed |
| Node EventEmitter | built-in | n/a | Untyped by default | Requires wrapper for type safety |
| No event system | 0B | n/a | Callbacks | Callback threading breaks pure-function pattern |

**Usage:**
```typescript
import mitt from "mitt";

type OrchestratorEvents = {
  "phase:enter": { phase: string; timestamp: number };
  "phase:exit": { phase: string; result: PhaseResult };
  "confidence:update": ConfidenceEntry;
  "review:complete": ReviewResult;
};

const bus = mitt<OrchestratorEvents>();
```

**Confidence:** HIGH -- well-established, trivial API, 200 bytes.

---

### Confidence Ledger: Pure TypeScript with Zod

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Custom module | n/a (project code) | Numerical confidence tracking (0-1 scale) per phase/decision | Domain-specific logic, no library fits |

**Design:** Immutable append-only ledger. Each entry records:
- `phase`: which orchestrator phase produced the score
- `dimension`: what was measured (code-quality, test-coverage, architecture-alignment, security, performance)
- `score`: 0.0-1.0 float
- `source`: which agent/check produced it
- `timestamp`: ISO 8601

Aggregate confidence (weighted average across dimensions) drives pipeline decisions:
- >= 0.8: proceed to next phase
- 0.5-0.8: deepen current phase (run additional reviews, request fixes)
- < 0.5: abort with explanation

**No library needed because:** This is domain-specific arithmetic (weighted averages, threshold comparisons). The infrastructure is Zod (validation) + JSON files (persistence) -- both already available.

**Confidence:** HIGH -- pure business logic, no external dependencies.

---

### Subagent Definitions: AgentConfig objects via config hook

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| @opencode-ai/plugin config hook | existing dep | Register 12+ specialized subagents | Proven pattern in src/agents/index.ts |

**How subagent dispatch works (critical architectural insight):**

1. Plugin registers agent configs via `configHook` (mutates the Config object -- existing pattern)
2. OpenCode's built-in **Task tool** handles session creation for subagents
3. The orchestrator tool (`oc_orchestrate`) returns **instructions** telling the LLM which subagent to invoke via Task
4. The LLM dispatches via Task, subagent runs in its own session with its own tools/prompt
5. Result flows back to the orchestrator tool on the next invocation

**The plugin does NOT spawn agents directly.** OpenCode is the runtime. The orchestrator is a state machine that tells the LLM what to do next, and the LLM uses Task to dispatch. This means:
- No agent runtime library needed (no LangChain, Mastra, ADK-TS)
- No custom session management
- No process spawning or worker threads

**New agents to register (~12+):**

| Agent | Mode | Purpose |
|-------|------|---------|
| oc-proposer | subagent | Generate architecture proposals for Arena |
| oc-critic | subagent | Adversarial critique of proposals |
| oc-implementer | subagent | Code generation for implementation phase |
| oc-reviewer-security | subagent | Security-focused code review |
| oc-reviewer-perf | subagent | Performance review |
| oc-reviewer-errors | subagent | Error handling review |
| oc-reviewer-types | subagent | Type safety review |
| oc-reviewer-naming | subagent | Naming/readability review |
| oc-reviewer-tests | subagent | Test quality review |
| oc-reviewer-arch | subagent | Architecture alignment review |
| oc-fixer | subagent | Auto-fix loop for review findings |
| oc-verifier | subagent | Checkpoint verification (tests pass, lint clean) |

All follow the existing `src/agents/researcher.ts` pattern: `Readonly<AgentConfig>` with `Object.freeze()`.

**Confidence:** HIGH -- extends validated pattern, no new dependencies.

---

### Review Engine Dispatch: Pure function registry

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Custom registry | n/a (project code) | Map review dimensions to agent configs, flat fan-out dispatch | Lookup table + Promise.allSettled, not a framework problem |

**Design:** A `ReadonlyMap<ReviewDimension, AgentConfig>` where each dimension maps to an agent definition. The review engine:
1. Determines which dimensions to run (based on file types changed, user config)
2. Groups compatible reviews into waves (wave-based parallelism)
3. Emits dispatch instructions for each wave
4. Collects results, feeds to confidence ledger
5. If confidence < threshold, triggers fix loop

**Wave-based parallelism** is a simple array-of-arrays:
```typescript
const waves: readonly ReviewDimension[][] = [
  ["security", "performance", "error-handling"],  // Wave 1: independent
  ["architecture", "naming", "types"],             // Wave 2: independent
  ["tests"],                                        // Wave 3: depends on impl
];
```

**Why no orchestration framework:** This is flat fan-out (dispatch N agents, collect results, aggregate). No DAG, no conditional routing, no retry-with-backoff at the framework level. `Promise.allSettled` over dispatch instructions is sufficient.

**Confidence:** HIGH -- the complexity is in the agent prompts, not the dispatch mechanism.

---

### Institutional Memory: JSON files in state directory

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| JSON files + Zod | existing deps | Cross-project learning, pattern library, pitfall database | Same persistence pattern, start simple |

**Location:** `~/.config/opencode/opencode-assets/memory/`

**Schema versioning:** Include a `version` field (already done in `config.ts` with `version: z.literal(1)`). When schemas evolve, add migration functions inline.

**Contents:**
- `patterns.json` -- Successful architecture patterns with context
- `pitfalls.json` -- Mistakes encountered and how they were resolved
- `decisions.json` -- Key decisions log with rationale and outcome

**Future upgrade path:** If memory grows beyond ~100 entries or needs cross-field queries, migrate to `bun:sqlite`. The Zod schemas become table definitions.

**Confidence:** MEDIUM -- the pattern is proven, but institutional memory is the least well-defined requirement. May need a research spike during implementation to determine what data is actually useful to persist.

## What NOT to Add

| Category | Tempting Addition | Why Skip It |
|----------|-------------------|-------------|
| State machine lib | XState v5 | 8-phase linear pipeline doesn't need statecharts. Custom FSM is ~80 lines |
| Database | bun:sqlite | Low-frequency writes, JSON + Zod matches existing patterns. Revisit if query needs grow |
| Task queue | BullMQ, bee-queue | Subagent dispatch goes through OpenCode's Task tool, not a job queue |
| Logging framework | pino, winston | Plugin runs inside OpenCode's process. console.error for errors, structured JSON for decision logs |
| Schema migration lib | umzug, knex migrate | JSON file versioning with inline migration functions is sufficient |
| Agent framework | LangChain, Mastra, ADK-TS, VoltAgent | Agents are markdown prompts + OpenCode AgentConfig. OpenCode IS the agent runtime |
| DAG engine | dagster, temporal | Review dispatch is flat fan-out. Orchestrator is linear pipeline. Neither needs a DAG |
| HTTP client | axios, got | No HTTP calls needed. Subagents use OpenCode's built-in webfetch tool |
| Process manager | pm2, child_process | Subagents run in OpenCode sessions, not separate processes |
| Testing additions | none | bun:test covers everything. No new test infra required |

## Complete Dependency Change

```bash
# The ONLY new dependency for v2.0
bun add mitt
```

**Total new runtime dependencies: 1 package (200 bytes gzipped).**

Everything else is custom TypeScript using existing dependencies (Zod, yaml, node:fs/promises) or built-in Node/Bun APIs.

## Integration Points with Existing Codebase

| Existing Module | How New Code Integrates |
|----------------|------------------------|
| `src/index.ts` | Register `oc_orchestrate` and `oc_review` tools alongside existing creation tools |
| `src/agents/index.ts` | Add 12+ orchestrator/reviewer agent configs to configHook registry |
| `src/config.ts` | Extend pluginConfigSchema with orchestrator settings (autonomy, strictness, phase toggles) |
| `src/utils/validators.ts` | Reuse `validateAssetName` regex pattern for orchestrator input validation |
| `src/utils/fs-helpers.ts` | Reuse `ensureDir`, `isEnoentError`. Add `atomicWrite` (write-temp + rename) |
| `src/utils/paths.ts` | Add `getStateDir()`, `getMemoryDir()`, `getDecisionLogPath()` |
| `src/templates/` | Add orchestrator prompt templates (same pure-function pattern: input -> string) |

## New Directory Structure

```
src/
  orchestrator/
    machine.ts          State machine transitions + guards (pure functions)
    runner.ts           Orchestration loop (phase execution, tool return values)
    events.ts           mitt bus setup + typed event map
    types.ts            OrchestratorPhase, OrchestratorEvent discriminated unions
  review/
    engine.ts           Review dispatch + result aggregation
    dimensions.ts       ReviewDimension -> AgentConfig registry
    waves.ts            Wave grouping for parallel dispatch
    types.ts            ReviewResult, ReviewDimension types
  confidence/
    ledger.ts           Append-only ledger CRUD + aggregate scoring
    thresholds.ts       Decision rules (proceed / deepen / abort)
    types.ts            ConfidenceEntry, ConfidenceSummary schemas
  memory/
    store.ts            Institutional memory read/write
    types.ts            Memory entry Zod schemas
  tools/
    orchestrate.ts      oc_orchestrate tool (new)
    review.ts           oc_review tool (new, standalone review entry point)
    (existing creation tools unchanged)
  agents/
    (existing 4 agents unchanged)
    orchestrator/       12+ new subagent configs
  utils/
    atomic-write.ts     Write-temp + rename for crash-safe persistence
    (existing utils unchanged)
```

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| State machine | Custom FSM | XState v5 | Overkill for linear 8-phase pipeline, +50KB dep, actor model doesn't map to Task tool |
| Persistence | JSON + Zod | bun:sqlite | Matches existing pattern, low write frequency, avoids migration complexity |
| Events | mitt (200B) | eventemitter3 (1KB) | mitt's on/off/emit is sufficient; no wildcards/namespaces needed |
| Events | mitt | No event system | Callback threading violates pure-function patterns |
| Agent dispatch | OpenCode Task tool | Custom process spawn | OpenCode already manages subagent sessions |
| Review dispatch | Pure registry | LangGraph/Mastra | Flat fan-out is Promise.allSettled, not a DAG |
| Memory storage | JSON files | SQLite | Start simple, migrate later if query patterns demand it |

## Sources

- [OpenCode Plugin Documentation](https://opencode.ai/docs/plugins/) -- Plugin API, config hook, event hooks (HIGH confidence)
- [OpenCode Agent Documentation](https://opencode.ai/docs/agents/) -- Task tool dispatch, subagent architecture, permission model (HIGH confidence)
- [XState v5 documentation](https://stately.ai/docs/xstate) -- Evaluated and rejected for this use case (HIGH confidence)
- [XState npm page](https://www.npmjs.com/package/xstate) -- v5.28.0, ~3.7M weekly downloads, zero deps (HIGH confidence)
- [mitt GitHub](https://github.com/developit/mitt) -- 200 byte typed event emitter, 16.7M weekly downloads (HIGH confidence)
- [Bun SQLite docs](https://bun.com/docs/runtime/sqlite) -- Evaluated as future upgrade path for institutional memory (HIGH confidence)
- ["You don't need a library for state machines"](https://dev.to/davidkpiano/you-don-t-need-a-library-for-state-machines-k7h) -- David Khourshid (XState creator) on when simple FSMs suffice (MEDIUM confidence)
- [Supervisor pattern for agent orchestration](https://dev.to/programmingcentral/the-supervisor-pattern-stop-writing-monolithic-agents-and-start-orchestrating-teams-2olk) -- Hub-and-spoke topology validates orchestrator design (MEDIUM confidence)
- [npm-compare: mitt vs eventemitter3](https://npm-compare.com/emittery,eventemitter3,mitt,nanoevents) -- Download stats, size comparison (MEDIUM confidence)
