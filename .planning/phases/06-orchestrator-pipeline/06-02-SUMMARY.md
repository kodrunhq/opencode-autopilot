---
phase: 06-orchestrator-pipeline
plan: 02
subsystem: orchestrator
tags: [pipeline, handlers, arena, recon, challenge, architect, dispatch]

requires:
  - phase: 06-orchestrator-pipeline
    plan: 01
    provides: "handler types, artifact module, pipeline agents"
provides:
  - "handleRecon phase handler (dispatches oc-researcher)"
  - "handleChallenge phase handler (dispatches oc-challenger)"
  - "handleArchitect phase handler with Arena multi-proposal logic"
affects:
  - "src/orchestrator/handlers/ (new handler implementations)"

tech-stack:
  added: []
  patterns:
    - "Artifact-existence idempotency for multi-step Arena flow"
    - "Confidence-gated dispatch depth (HIGH=1, MEDIUM=2, LOW=3)"
    - "File reference prompts (never content injection)"

key-files:
  created:
    - src/orchestrator/handlers/recon.ts
    - src/orchestrator/handlers/challenge.ts
    - src/orchestrator/handlers/architect.ts
    - tests/handlers-early.test.ts
  modified: []

decisions:
  - "Arena uses readdir for proposal detection instead of hardcoded count"
  - "Single-dispatch path outputs design.md directly, multi-dispatch uses proposals/ dir"
  - "Critique existence OR design existence triggers complete (supports both paths)"

metrics:
  duration: "14min"
  completed: "2026-03-31T22:50:40Z"
  tasks: 2
  tests: 18
  files_created: 4
  files_modified: 0
---

# Phase 06 Plan 02: Early Phase Handlers Summary

Phase handlers for RECON, CHALLENGE, and ARCHITECT with confidence-gated Arena multi-proposal dispatch and artifact-existence idempotency.

## What Was Built

### Task 1: RECON and CHALLENGE Handlers

**handleRecon** (`src/orchestrator/handlers/recon.ts`):
- Dispatches `oc-researcher` with the user's idea and artifact output path
- Returns `action: "complete"` when result is provided (phase done)
- Uses `ensurePhaseDir` and `getArtifactRef` for directory creation and file references
- Frozen DispatchResult per immutability constraint

**handleChallenge** (`src/orchestrator/handlers/challenge.ts`):
- Dispatches `oc-challenger` with RECON artifact path reference (not content)
- References `phases/RECON/report.md` for research context
- Returns `action: "complete"` when result is provided
- Frozen DispatchResult per immutability constraint

### Task 2: ARCHITECT Handler with Arena

**handleArchitect** (`src/orchestrator/handlers/architect.ts`):
- Three-step flow using artifact-existence checks for idempotency:
  1. **No artifacts**: Dispatch architect(s) based on `getDebateDepth()` from confidence
  2. **Proposals exist, no critique**: Dispatch `oc-critic` to review proposals
  3. **Critique or design exists**: Return `action: "complete"`
- Confidence-gated Arena depth: HIGH=1 (single dispatch), MEDIUM=2, LOW=3 proposals
- Each proposal gets distinct constraint framing: simplicity, extensibility, performance
- Uses `readdir` for proposal detection (not hardcoded file count)
- 112 lines total, under the 120-line limit

## Test Coverage

18 tests across 3 describe blocks in `tests/handlers-early.test.ts`:

- **handleRecon (6 tests)**: dispatch, prompt content, artifact refs, no cross-phase contamination, complete on result, frozen result
- **handleChallenge (4 tests)**: dispatch, RECON artifact refs, complete on result, frozen result
- **handleArchitect (8 tests)**: HIGH/MEDIUM/LOW depth dispatch, proposals->critic flow, critique->complete flow, RECON+CHALLENGE refs in prompt, distinct constraint framings, frozen result

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all handlers are fully wired to their dependencies.

## Decisions Made

1. **readdir for proposal detection**: Instead of checking specific filenames, the handler reads the proposals directory and looks for any `proposal-*.md` files. This is more resilient to future changes in naming or count.
2. **Dual completion paths**: Both `critique.md` and `design.md` trigger completion, supporting the single-dispatch path (produces design.md directly) and the multi-dispatch path (produces proposals + critique).
3. **Critique output path**: The critic writes to `phases/ARCHITECT/critique.md` (a recognized artifact in PHASE_ARTIFACTS), keeping all ARCHITECT outputs in one phase directory.

## Self-Check: PASSED

- [x] src/orchestrator/handlers/recon.ts exists
- [x] src/orchestrator/handlers/challenge.ts exists
- [x] src/orchestrator/handlers/architect.ts exists
- [x] tests/handlers-early.test.ts exists
- [x] Commit f9c1287 exists (Task 1)
- [x] Commit c615a08 exists (Task 2)
