# OpenCode Autopilot: Revised Analysis and Implementation Plan

## Executive Summary

This revision corrects three important problems in the earlier analysis:

1. **ULW was mischaracterized.** In `oh-my-openagent`, ULW is not "Oracle on every iteration," and the hook does not directly run Oracle. It is a normal work loop with a **post-completion Oracle gate**: work loop -> `<promise>DONE</promise>` -> `verification_pending` -> injected prompt telling the agent to call `task(subagent_type="oracle", ...)` -> Oracle consultation -> `<promise>VERIFIED</promise>` or restart.
2. **The memory comparison overstated MemPalace and understated the current OpenCode system.** OpenCode Autopilot currently exposes **5 memory tools**, not 3, and its memory model is **curated and evidence-based**, not raw-verbatim retrieval.
3. **The code graph recommendation was too wide.** The practical next step is a **local SQLite MVP** that complements the existing `oc_lsp_*` tools, not Neo4j or natural-language-to-Cypher work.

The result is a narrower, more decision-grade plan:

- **Phase 1:** add a **post-completion Oracle verification gate** to Autopilot.
- **Phase 2:** selectively add memory structure without abandoning curated memory.
- **Phase 3:** build a TS/JS-focused SQLite code graph MVP with exact-span retrieval.

---

## 1. Oracle Pipeline Analysis

### Current State

OpenCode Autopilot already has meaningful Oracle infrastructure:

- **Oracle agent**: `src/agents/oracle.ts`
- **Oracle gate**: `src/orchestrator/oracle-gate.ts`
- **Current use**: architectural consultation, difficult review cases, repeated failures

The current Autopilot autonomy loop already has:

- iteration tracking
- completion detection
- post-iteration verification

What it does **not** yet have is a **hard post-completion Oracle gate** analogous to ULW.

### ULW: Actual Flow

The earlier draft incorrectly described ULW as Oracle reviewing every iteration. The current `oh-my-openagent` flow is different.

**Actual ULW flow:**

1. The normal Ralph/ULW work loop runs until the worker emits `<promise>DONE</promise>`.
2. ULW does **not** complete at `DONE`.
3. The loop transitions into `verification_pending` and changes the expected promise from `DONE` to `VERIFIED`.
4. The hook injects a continuation prompt telling the agent to call `task(subagent_type="oracle", ...)`.
5. The agent then calls Oracle; the hook itself does not directly invoke Oracle.
6. If Oracle produces `<promise>VERIFIED</promise>`, the loop completes.
7. If Oracle rejects or verification fails, the work loop restarts.

This is a **post-completion gate**, not an Oracle-on-every-iteration loop.

### Evidence For The Actual ULW Flow

- `oh-my-openagent/src/hooks/ralph-loop/completion-handler.ts:25-53`
  - When ULW sees `DONE`, it calls `markVerificationPending()` instead of clearing the loop.
- `oh-my-openagent/src/hooks/ralph-loop/loop-state-controller.ts:121-138`
  - `markVerificationPending()` sets `verification_pending = true` and swaps the promise to the ULW verification promise.
- `oh-my-openagent/src/hooks/ralph-loop/ralph-loop-event-handler.ts:144-163`
  - While verification is pending, the idle handler routes to `handlePendingVerification()` instead of continuing the normal work loop.
- `oh-my-openagent/src/hooks/ralph-loop/pending-verification-handler.ts:14-27, 88-151`
  - The pending-verification path injects prompt text instructing the agent to call Oracle; Oracle is reached through the agent tool call, not directly by the hook.
- `oh-my-openagent/src/hooks/ralph-loop/ralph-loop-event-handler.ts:125-141`
  - Completion detection routes to `handleDetectedCompletion()`.
- `oh-my-openagent/src/hooks/ralph-loop/verification-failure-handler.ts:45-102`
  - Failed verification restarts the parent loop and injects a continuation prompt.
- `oh-my-openagent/src/hooks/ralph-loop/loop-state-controller.ts:155-176`
  - `restartAfterFailedVerification()` increments iteration, restores the original completion promise, and clears verification-pending state.
- `oh-my-openagent/src/hooks/ralph-loop/ralph-loop-hook.ts:50-64`
  - The hook entrypoint wires the loop state controller into the Ralph event handler; the transition logic itself lives in the supporting files above.

### What Autopilot Should Borrow

The right lesson is not "embed Oracle into every iteration." The right lesson is:

**Autopilot should add a post-completion Oracle gate.**

That means:

1. Worker claims completion with `<promise>DONE</promise>`.
2. Run enters `verification_pending`.
3. Oracle evaluates the completion claim.
4. Oracle either:
   - returns `<promise>VERIFIED</promise>`, or
   - returns fix instructions and restarts the worker.

This is much smaller than a full loop rewrite and directly targets the real failure mode: false completion.

### Missing ULW Failure Modes

The previous analysis also missed several ULW failure modes and design hazards that matter if we adopt this pattern. The evidence level is not the same for all of them, so they should be classified separately.

#### Confirmed: Promise spoofing / honor-system completion

ULW can still accept completion without proving meaningful work happened in the iteration.

- `oh-my-openagent` issue `#1921` documents this explicitly: an agent can emit `DONE` immediately without doing work.
- The current completion path in `ralph-loop-event-handler.ts` accepts completion based on promise detection and then transitions to completion handling; there is no minimum-work proof in the cited flow.

**Implication for Autopilot:** a completion gate should include a **minimum work proof** before `DONE` is accepted.

#### Confirmed: Missing verification-attempt circuit breaker

ULW has a generic iteration cap, but the verification path does not have a dedicated cap for repeated verification failures.

- `oh-my-openagent/src/hooks/ralph-loop/loop-state-controller.ts:155-176`
  - Failed verification restarts the loop by incrementing normal iteration state.
- `oh-my-openagent` issue `#3212`
  - Calls out the missing dedicated cap for verification attempts.

**Implication for Autopilot:** add a separate `maxVerificationRestarts` limit rather than relying only on the main loop iteration cap.

#### Confirmed implementation constraint: verification evidence parsing is narrower than a blanket part scan

The earlier draft overstated this as a generic `tool_result` blind spot. The narrower claim supported by current code is:

- generic completion detection scans `assistant` messages for `text` parts
- `tool_result` is specially inspected only for Oracle `VERIFIED` evidence parsing, not as a blanket generic completion-detection path

- `oh-my-openagent/src/hooks/ralph-loop/completion-promise-detector.ts:36-50, 145-149`
  - Promise matching is gated by `shouldInspectSessionMessagePart()` and the normal path focuses on `assistant` `text` parts.
- `oh-my-openagent/src/hooks/ralph-loop/pending-verification-handler.ts:56-71`
  - Parent-session Oracle recovery has special handling for Oracle verification evidence.
- `oh-my-openagent` issue `#3212`
  - Describes a failure mode where Oracle `VERIFIED` exists but is not detected because it lands in the wrong message/part shape.

**Implication for Autopilot:** verification detection should explicitly define which message roles and part types count for worker completion versus Oracle verification evidence.

#### Inferred design risk: race and persistence hazards

The ULW model is sensitive to session persistence timing and state durability. These are best described as design risks inferred from the architecture and issue history, not as a single confirmed bug class with one root cause.

- `oh-my-openagent` issue `#1233`
  - Documents a race where `session.idle` fired before assistant output was fully persisted, causing promise detection to miss valid completion.
- `oh-my-openagent/src/hooks/ralph-loop/loop-state-controller.ts:121-176`
  - Verification state is persisted, but correctness still depends on transcript/session-message ordering and durability.

Practical risk areas include state-file read/write ordering and per-handler in-flight session bookkeeping.

**Implication for Autopilot:** verification state must be persisted explicitly, and the verification path should tolerate delayed session-message visibility.

### Recommendation

#### Phase 1: Add A Post-Completion Oracle Gate

This should be the first autonomy enhancement.

```typescript
export interface OracleCompletionGateConfig {
	readonly enabled: boolean;
	readonly requiredOnCompletion: boolean;
	readonly maxVerificationRestarts: number;
	readonly minWorkSignalsBeforeDone: number;
}

export interface CompletionGateState {
	readonly verificationPending: boolean;
	readonly verificationSessionId: string | null;
	readonly verificationAttempts: number;
	readonly workerDoneSeenAt: string | null;
}
```

**Phase 1 behavior:**

1. Normal worker loop runs unchanged.
2. Worker emits `<promise>DONE</promise>`.
3. Autopilot transitions to `verificationPending`.
4. Oracle is consulted once, after completion.
5. Oracle either verifies completion or restarts the worker with fix instructions.
6. Verification restarts are capped independently.

### Phase 1 Implementation: Exact Files and Flow

Phase 1 should map directly onto the existing autonomy loop and verification path:

- `src/autonomy/types.ts`
  - add `OracleVerificationState`
- `src/autonomy/state.ts`
  - add `oracleVerification` to loop state
- `src/autonomy/controller.ts`
  - extend `detectCompletion()` so the first `DONE` signal sets `oracleVerification = { status: 'pending', attemptCount: 0 }`
  - inject the Oracle-consultation prompt instead of completing immediately
  - continue the loop until Oracle verification resolves
- `src/autonomy/prompts.ts`
  - add the Oracle consultation prompt template
- `src/autonomy/verification.ts`
  - parse Oracle verification results and map them to `verified` / `failed`

Deterministic checks remain first in the verification order:

1. `detectCompletion()` sees a `DONE` signal.
2. Run the existing `VerificationHandler` (tests, lint, artifacts).
3. If deterministic checks pass and `oracleVerification?.status === 'verified'`, complete.
4. If deterministic checks pass but Oracle has not yet verified, prompt for Oracle consultation.
5. If Oracle fails, restart the loop.

`minWorkSignalsBeforeDone` is deferred to Phase 2. The current `accumulatedContext: string[]` is freeform text, so it cannot support reliable signal counting yet; a proper signal taxonomy belongs in the next phase.

This should be framed as a **post-completion gate**, not a full ULW clone.

---

## 2. Memory System Analysis: OpenCode vs MemPalace

### Current OpenCode Memory System

The earlier draft was directionally right about the current memory architecture, but it understated the current tool surface and compared unlike-for-like systems.

**Current strengths:**

- curated memory capture
- five memory kinds with weights
- SQLite + FTS5 retrieval
- evidence tracking with confidence
- project/user scopes
- deduplication and merge behavior

### Important Correction: OpenCode Has 5 Memory Tools

The runtime tool surface is **5 memory tools**, not 3.

**Source of truth:** `src/index.ts`

- `src/index.ts:85-89`
  - imports `ocMemoryForget`, `ocMemoryPreferences`, `ocMemorySave`, `ocMemorySearch`, `ocMemoryStatus`
- `src/index.ts:541-545`
  - registers:
    - `oc_memory_status`
    - `oc_memory_preferences`
    - `oc_memory_save`
    - `oc_memory_search`
    - `oc_memory_forget`

The current docs still describe the model interacting through three core tools (`save`, `search`, `forget`), which is incomplete documentation rather than the actual runtime surface.

- `docs/memory-system.md:32-68`

### Explicit Tool-Surface Comparison

| Area | Current OpenCode Memory (5 tools) | MemPalace (19 tools) | Specific gap |
|---|---|---|---|
| Runtime operator surface | `oc_memory_status`, `oc_memory_preferences`, `oc_memory_save`, `oc_memory_search`, `oc_memory_forget` | broader multi-tool memory operating surface | fewer operator entry points in OpenCode today |
| Storage and retrieval | SQLite + FTS5 lexical retrieval | embedding-backed retrieval stack | vector retrieval layer missing |
| Memory organization | kinds + scopes + evidence weights | rooms / wings / halls / tunnels | structural metadata layer missing |
| Recall mode | curated saves | raw verbatim recall paths | optional raw-attachment recall missing |
| Entity relationships | no dedicated KG traversal | temporal / graph-style memory relations | entity-relationship layer missing |
| Session bootstrapping | no dedicated wake-up tier | L0/L1 wake-up stack | cheap cold-start wake-up layer missing |
| Benchmark discipline | no published memory benchmark suite | benchmarked retrieval variants | reproducible memory benchmark harness missing |

This is the clearest apples-to-apples statement of the gap: OpenCode already has a real memory subsystem, but its operator surface and retrieval modes are much narrower than MemPalace.

### OpenCode And MemPalace Are Different Memory Philosophies

This is the most important correction in the memory section.

**OpenCode Autopilot** is a **curated, evidence-based memory system**:

- the model decides what is worth remembering
- saved memories become structured records
- evidence is tracked per memory
- memory injection is ranked and budgeted

Evidence:

- `docs/memory-system.md:7-19`
  - tool-based, curated memory philosophy and five memory kinds
- `docs/memory-system.md:83-94`
  - explicit evidence-tracking model

**MemPalace** is primarily a **raw verbatim retrieval system**:

- store original text
- retrieve with embeddings
- minimize curation and summarization in the benchmark path

Evidence:

- `mempalace/benchmarks/BENCHMARKS.md:16-18`
  - raw verbatim ChromaDB baseline is the key finding
- `mempalace/benchmarks/BENCHMARKS.md:28-35`
  - raw 96.6% vs hybrid 100% with rerank
- `mempalace/README.md:17-20`
  - raw verbatim storage, 96.6% from raw mode

So this is not "OpenCode has a worse version of MemPalace." It is:

- **OpenCode:** curated memory for high signal injection
- **MemPalace:** raw recall for maximum retained context

### MemPalace Caveats That Matter

The earlier draft treated several MemPalace claims too loosely. Their own docs are more careful.

#### 1. The 96.6% claim is raw-mode only

- `mempalace/benchmarks/BENCHMARKS.md:16-18, 28-35, 58-60`
- `mempalace/README.md:36-46`

The flagship LongMemEval number is from **raw ChromaDB retrieval**, not AAAK mode and not palace-room mode.

#### 2. AAAK currently regresses to 84.2%

- `mempalace/README.md:19-20`
- `mempalace/README.md:58-61`
- `mempalace/README.md:290-296`
- `mempalace/benchmarks/README.md:23-30`

AAAK is explicitly described as experimental, lossy, and currently worse than raw mode on LongMemEval.

#### 3. The "+34%" uplift is metadata filtering

- `mempalace/README.md:62-64`
- `mempalace/README.md:262-274`

MemPalace's own README now says the palace boost is from wing+room metadata filtering and is useful but not a unique retrieval moat.

#### 4. Contradiction detection is not fully wired

- `mempalace/README.md:64-65, 300-315`

Contradiction detection is mentioned in the README, but the feature wiring is incomplete, as the README notes via issue `#27`.

### MemPalace Structure And Tunnel Implementation

The palace structure itself is real and technically implemented.

- `mempalace/mempalace/palace_graph.py:5-8`
  - tunnels are defined as shared rooms across wings
- `mempalace/mempalace/palace_graph.py:68-85`
  - edge construction from rooms spanning multiple wings
- `mempalace/mempalace/palace_graph.py:161-190`
  - `find_tunnels()` returns the room bridges across wings

That matters because it shows MemPalace's structure is more than just naming. But it still does not mean OpenCode should copy the system wholesale.

### Revised Gap Analysis

| Feature | Current OpenCode | MemPalace | Real Gap |
|---|---|---|---|
| Storage backend | SQLite + FTS5 | ChromaDB + embeddings | vector retrieval missing |
| Memory philosophy | curated + evidence-based | raw verbatim retrieval | different tradeoff, not just a missing feature |
| Structure | flat kinds + scopes | wings / rooms / halls / tunnels | optional structural metadata missing |
| Tool surface | 5 tools | 19 tools | smaller operator surface |
| Wake-up layer | no dedicated wake-up tier | L0/L1 wake-up stack | cheap bootstrapping layer missing |
| KG layer | none | temporal triples | entity-relationship layer missing |
| Benchmarking | no published benchmark | reproducible benchmark suite | benchmark discipline missing |

### Recommendation

The right memory recommendation is **selective import**, not imitation.

#### Do

1. Keep the curated/evidence-based OpenCode core.
2. Add lightweight structural metadata analogous to `wing` / `room` where it helps retrieval.
3. Consider optional raw-source attachments for high-value artifacts.
4. Add benchmark discipline before making retrieval-architecture claims.

#### Do Not

1. Replace curated memory with raw-ingest-by-default.
2. Treat AAAK's benchmark result as evidence for a compression roadmap.
3. Assume contradiction detection is production-ready just because it exists in MemPalace docs.

#### Practical Near-Term Memory Plan

```typescript
export interface MemoryV3 {
	// existing fields...
	topicGroup?: string | null;
	topic?: string | null;
	sourceKind?: "curated" | "raw_attachment";
}
```

This is enough to test structural filtering without replacing the existing memory model.

---

## 3. Codebase Graph Analysis

### Earlier Recommendation Was Too Broad

The previous draft drifted into a platform plan:

- SQLite and Neo4j options
- natural-language graph querying
- large MCP surface area before an MVP existed

That is too much for the current decision.

### Strongest External Signal

The best directly relevant external evidence here is **CodeGraph**.

- `colbymchenry/codegraph/README.md:41-50`
  - average claim: **92% fewer tool calls** and **71% faster** across six codebases
- `colbymchenry/codegraph/README.md:67-93`
  - benchmark details showing major reductions in tool calls and zero file reads on the indexed path
- `colbymchenry/codegraph/README.md:258-260`
  - local SQLite storage for the graph

This supports a local pre-indexed graph as a productivity accelerator.

### What The MVP Should Be

The next step should be a **local SQLite code graph MVP** with a very small scope.

#### Supported Languages

Phase 1 should support only:

- TypeScript
- TSX
- JavaScript
- JSX

Why this narrow scope:

1. This repository is TypeScript-first.
2. It lets us test graph value without a parser matrix.
3. It avoids the usual multi-language MVP collapse.

#### Storage Model

```typescript
export interface GraphNode {
	id: string;
	type: "file" | "function" | "class" | "interface" | "method";
	name: string;
	filePath: string;
	byteStart: number;
	byteEnd: number;
	lineStart: number;
	lineEnd: number;
	hash: string;
}

export interface GraphEdge {
	from: string;
	to: string;
	type: "imports" | "exports" | "extends" | "implements" | "contains";
}
```

**Key decision:** store **byte offsets** as well as line numbers.

That lets the graph return exact spans for authoritative retrieval rather than becoming a summarization layer.

#### Incremental Reindexing

The MVP should reindex by changed file only.

**Mechanism:**

1. Track `mtime`, file hash, and parser version.
2. On file change, delete graph rows for that file.
3. Reparse only that file.
4. Recompute directly affected import/export edges.

This should be `O(changed files)`, not full rebuild.

#### Stale-Index Behavior

This is critical.

If the graph is stale:

1. return a structured stale result
2. fall back to LSP / `grep` / `Read`
3. never block editing on graph freshness

The graph should be an accelerator, not a correctness dependency.

#### Relationship To Existing LSP Tools

OpenCode Autopilot already has these semantic tools registered:

- `oc_lsp_goto_definition`
- `oc_lsp_find_references`
- `oc_lsp_symbols`
- `oc_lsp_diagnostics`
- `oc_lsp_prepare_rename`
- `oc_lsp_rename`

Evidence:

- `src/index.ts:511-516`

So the graph should **complement** the LSP tools, not replace them.

**Division of responsibility:**

- **Graph:** broad discovery, module dependency views, exact-span lookup, persistent cross-file navigation
- **LSP:** authoritative definition/reference/rename/diagnostics behavior

### Recommended MVP Query Surface

Do not add NL-to-Cypher or a big MCP suite yet.

Start with a small API:

```typescript
export interface CodebaseQuery {
	findDefinitions(name: string): readonly SymbolHit[];
	findImports(filePath: string): readonly FileEdge[];
	findDependents(filePath: string): readonly FileEdge[];
	getModuleOutline(filePath: string): readonly SymbolHit[];
}
```

That is enough to prove value while keeping graph correctness manageable.

---

## 4. Combined Architecture Vision

```text
┌─────────────────────────────────────────────────────────────────┐
│                    OpenCode Autopilot Enhanced                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Oracle Completion Gate                                         │
│  Work loop -> <promise>DONE</promise>                           │
│            -> verification_pending                              │
│            -> Oracle consult                                    │
│            -> <promise>VERIFIED</promise> or restart            │
│                                                                 │
│  Memory                                                         │
│  Curated + evidence-based core                                  │
│  Optional structural metadata                                   │
│  Optional raw attachments for high-value artifacts              │
│                                                                 │
│  Code Graph                                                     │
│  TS/JS local SQLite index                                       │
│  Exact byte offsets for retrieval                               │
│  Stale-index fallback to LSP/read/grep                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Implementation Priority

### Immediate

1. **Post-completion Oracle gate**
   - Add `verificationPending` state after worker completion.
   - Require Oracle verification before final completion.
   - Add a dedicated verification restart cap.

### Short-Term

2. **Memory structural metadata**
   - Add lightweight grouping/topic fields to curated memory.
   - Preserve evidence-based memory semantics.

3. **Memory benchmark discipline**
   - Create benchmark tasks for recall, injection quality, and latency before making architecture claims.

### Medium-Term

4. **SQLite code graph MVP**
   - TS/JS-only parsing
   - exact byte offsets
   - incremental reindexing
   - stale-index fallback

### Long-Term

5. **Optional memory KG / raw retrieval layers**
   - only if a concrete retrieval failure justifies them

6. **Broader code graph language support**
   - after the TS/JS MVP proves real value

---

## 6. Success Metrics

### Oracle Gate

- zero false-complete outcomes after worker `DONE`
- separate measurement for normal iterations vs verification restarts
- no unbounded verification loops

### Memory

- maintain or improve current injection quality
- benchmark any raw-retrieval addition separately from curated memory
- <200ms query latency for normal retrieval paths

### Code Graph

- measurable reduction in exploratory file reads on TS/JS repos
- exact-span retrieval correctness for indexed symbols
- stale graph never blocks work

---

## Conclusion

The corrected roadmap is smaller and stronger:

1. **Phase 1 is a post-completion Oracle gate**, not a full Oracle-in-the-loop rewrite.
2. **Memory should stay curated and evidence-based**, while selectively adopting structure where it helps.
3. **The code graph plan should be a local SQLite MVP** that accelerates discovery and exact retrieval and works alongside the existing LSP tools.

That is the highest-confidence path from the current codebase to a more reliable autonomous system.

---

## Source Appendix

### oh-my-openagent ULW / Ralph Sources

Pinned commit: `bf5d1c58a47c76e836908726318932d5bb73fd43`

- `oh-my-openagent@bf5d1c58a47c76e836908726318932d5bb73fd43:src/hooks/ralph-loop/ralph-loop-hook.ts:50-64`
  - entrypoint wiring for loop state + event handler
- `oh-my-openagent@bf5d1c58a47c76e836908726318932d5bb73fd43:src/hooks/ralph-loop/completion-handler.ts:25-53`
  - `DONE` transitions ULW into Oracle verification pending
- `oh-my-openagent@bf5d1c58a47c76e836908726318932d5bb73fd43:src/hooks/ralph-loop/loop-state-controller.ts:121-138`
  - verification-pending state transition
- `oh-my-openagent@bf5d1c58a47c76e836908726318932d5bb73fd43:src/hooks/ralph-loop/ralph-loop-event-handler.ts:125-163`
  - completion path and pending-verification routing
- `oh-my-openagent@bf5d1c58a47c76e836908726318932d5bb73fd43:src/hooks/ralph-loop/loop-state-controller.ts:155-176`
  - restart after failed verification
- `oh-my-openagent@bf5d1c58a47c76e836908726318932d5bb73fd43:src/hooks/ralph-loop/completion-promise-detector.ts:36-50, 68-99, 101-165`
  - promise detection behavior; generic completion detection is narrow, while `tool_result` receives special-case inspection in the verification path
- `oh-my-openagent@bf5d1c58a47c76e836908726318932d5bb73fd43:src/hooks/ralph-loop/pending-verification-handler.ts:14-27, 56-71, 88-151`
  - parent-session Oracle verification recovery behavior

### MemPalace Sources

Pinned commit: `a036b4300d46fe6d399f8f89347f816462dd2c22`

- `mempalace@a036b4300d46fe6d399f8f89347f816462dd2c22:benchmarks/BENCHMARKS.md:16-18, 28-35, 58-60, 170-178`
  - 96.6% raw-mode benchmark basis
- `mempalace@a036b4300d46fe6d399f8f89347f816462dd2c22:benchmarks/README.md:23-30, 39-45`
  - reproduction commands and expected raw output
- `mempalace@a036b4300d46fe6d399f8f89347f816462dd2c22:README.md:17-20, 36-46`
  - raw verbatim mode is the headline benchmark path
- `mempalace@a036b4300d46fe6d399f8f89347f816462dd2c22:README.md:58-65, 262-274, 300-315`
  - AAAK caveats, +34% metadata-filtering caveat, contradiction-detection caveat
- `mempalace@a036b4300d46fe6d399f8f89347f816462dd2c22:mempalace/palace_graph.py:5-8, 68-85, 161-190`
  - tunnel implementation details

### CodeGraph Sources

Pinned commit: `19532a81a54b1a46ef73927cd2269fa9e467e736`

- `codegraph@19532a81a54b1a46ef73927cd2269fa9e467e736:README.md:41-50`
  - average benchmark: 92% fewer tool calls
- `codegraph@19532a81a54b1a46ef73927cd2269fa9e467e736:README.md:67-93`
  - detailed benchmark breakdown
- `codegraph@19532a81a54b1a46ef73927cd2269fa9e467e736:README.md:258-260`
  - SQLite graph storage

### Current OpenCode Memory Tool Sources

- `src/index.ts:85-89`
  - imports for all five memory tools
- `src/index.ts:541-545`
  - registrations for:
    - `oc_memory_status`
    - `oc_memory_preferences`
    - `oc_memory_save`
    - `oc_memory_search`
    - `oc_memory_forget`
- `docs/memory-system.md:7-19, 83-94`
  - current curated/evidence-based memory design

*Analysis revised: April 10, 2026*
