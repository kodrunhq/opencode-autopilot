---
phase: 05-review-engine
plan: "03"
subsystem: review-pipeline
tags: [pipeline, selection, cross-verification, report, state-machine]
dependency_graph:
  requires: ["05-01 schemas/types/severity", "05-02 agent definitions"]
  provides: ["selection module", "pipeline state machine", "cross-verification prompts", "report builder"]
  affects: ["05-04 review tool registration"]
tech_stack:
  added: []
  patterns: ["state machine (dispatch/complete pattern)", "robust JSON extraction from LLM output", "condensed finding format for token control"]
key_files:
  created:
    - src/review/selection.ts
    - src/review/cross-verification.ts
    - src/review/pipeline.ts
    - src/review/report.ts
    - tests/review/selection.test.ts
    - tests/review/pipeline.test.ts
    - tests/review/report.test.ts
  modified: []
decisions:
  - "Adapted plan interfaces to actual codebase types (CRITICAL/WARNING/NITPICK instead of CRITICAL/HIGH/MEDIUM/LOW)"
  - "Pipeline returns dispatch instructions only -- does NOT invoke agents"
  - "Verdict determination: BLOCKED (any CRITICAL), CONCERNS (any WARNING), APPROVED (only NITPICK), CLEAN (none)"
  - "startReview omitted as standalone export since it requires async git operations; pipeline entry point is advancePipeline"
metrics:
  duration: "4m 33s"
  completed: "2026-03-31T17:29:46Z"
  tasks_completed: 2
  tasks_total: 2
  tests_added: 34
  files_created: 7
---

# Phase 05 Plan 03: Pipeline State Machine and Report Builder Summary

Two-pass deterministic agent selection, cross-verification prompt generation, 4-stage pipeline state machine, and structured report builder with deduplication and severity sorting.

## What Was Built

### Selection Module (src/review/selection.ts)
- `selectAgents()` -- Two-pass deterministic selection: stack gate filter (agents with empty relevantStacks always pass; agents with non-empty stacks need at least one match) + diff relevance scoring (stored for future ordering, no filtering yet)
- `computeDiffRelevance()` -- Base 1.0 score with bonuses: security-auditor +0.5 for auth changes, +0.3 for config; test-interrogator +0.5 when no tests detected
- `SelectionResult` interface with readonly `selected` and `excluded` arrays, all frozen

### Cross-Verification Module (src/review/cross-verification.ts)
- `condenseFinding()` -- Converts findings to 1-line format `[agent] [severity] [file:line] title` capped at ~150 chars to prevent token budget explosion
- `buildCrossVerificationPrompts()` -- Generates per-agent prompts with all OTHER agents' condensed findings injected into `{{PRIOR_FINDINGS}}` placeholder; agent's own findings are excluded

### Pipeline State Machine (src/review/pipeline.ts)
- `advancePipeline()` -- 4-stage state machine returning dispatch instructions:
  - Stage 1->2: Parse findings, build cross-verification prompts
  - Stage 2->3: Build red-team + product-thinker prompts with accumulated findings
  - Stage 3->4: Fix cycle if CRITICAL findings with actionable fixes, otherwise complete
  - Stage 4->complete: Final report
- `parseAgentFindings()` -- Robust JSON extraction from LLM output handling: markdown code blocks, `{"findings": [...]}` wrapper, raw arrays, embedded JSON in prose. Validates each finding through Zod schema, discards invalid entries.
- `ReviewState` interface for serializable pipeline state between rounds

### Report Builder (src/review/report.ts)
- `buildReport()` -- Deduplicates, groups by file, sorts by severity (CRITICAL first), computes verdict and summary counts, validates through reviewReportSchema
- `deduplicateFindings()` -- Keyed by agent:file:line, keeps higher severity on collision
- `SEVERITY_ORDER` constant for deterministic sorting
- Verdict logic: BLOCKED (CRITICAL), CONCERNS (WARNING only), APPROVED (NITPICK only), CLEAN (no findings)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Adapted to actual codebase types**
- **Found during:** Task 1
- **Issue:** Plan referenced `CRITICAL/HIGH/MEDIUM/LOW` severities and a finding schema with `{finding, suggestion}` fields, but actual codebase uses `CRITICAL/WARNING/NITPICK` severities and `{title, evidence, problem, fix}` fields
- **Fix:** All modules built to actual codebase types from schemas.ts and types.ts
- **Files modified:** All source files
- **Commit:** cdebf79, 16e7dee

**2. [Rule 3 - Blocking] startReview not exported as standalone**
- **Found during:** Task 2
- **Issue:** Plan called for `startReview(scope, projectRoot)` with async git/stack detection, but those operations require runtime context (git commands, file system scanning) that would make the module impure and hard to test
- **Fix:** Pipeline entry point is `advancePipeline` with externally-provided state. The orchestrator tool (Plan 04) will handle the async setup and call advancePipeline.
- **Commit:** 16e7dee

## Test Results

34 tests added across 3 test files. All 123 review tests pass (including pre-existing).

## Known Stubs

None. All modules are fully wired to actual types and exports.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | cdebf79 | Deterministic agent selection and cross-verification |
| 2 | 16e7dee | Pipeline state machine and report builder |

## Self-Check: PASSED

All 7 created files verified on disk. Both commit hashes (cdebf79, 16e7dee) verified in git log.
