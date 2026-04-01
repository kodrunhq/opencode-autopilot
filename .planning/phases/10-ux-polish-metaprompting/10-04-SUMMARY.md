---
phase: 10-ux-polish-metaprompting
plan: 04
subsystem: review
tags: [review-agents, stack-detection, agent-selection, execFile, pipeline]

requires:
  - phase: 10-01
    provides: "Severity alignment, review types, stack-gate.ts with detectStackTags"
provides:
  - "13 specialized review agents (wiring, dead-code, spec, database, auth, types, state-mgmt, concurrency, scope, react, go, python, rust)"
  - "SPECIALIZED_AGENTS barrel export with all 13 agents"
  - "ALL_REVIEW_AGENTS expanded from 8 to 21 agents"
  - "Stack-aware startNewReview using git execFile + detectStackTags"
  - "Pipeline filtering from ALL_REVIEW_AGENTS using selectedAgentNames"
affects: [review, orchestrator, pipeline]

tech-stack:
  added: []
  patterns:
    - "ReviewAgent files follow frozen-object pattern with {{DIFF}}/{{PRIOR_FINDINGS}}/{{MEMORY}} placeholders"
    - "execFile (not exec) for shell-injection-safe git commands"
    - "Stack-gated agents excluded when relevantStacks has no overlap with detectedStacks"

key-files:
  created:
    - src/review/agents/wiring-inspector.ts
    - src/review/agents/dead-code-scanner.ts
    - src/review/agents/spec-checker.ts
    - src/review/agents/database-auditor.ts
    - src/review/agents/auth-flow-verifier.ts
    - src/review/agents/type-soundness.ts
    - src/review/agents/state-mgmt-auditor.ts
    - src/review/agents/concurrency-checker.ts
    - src/review/agents/scope-intent-verifier.ts
    - src/review/agents/react-patterns-auditor.ts
    - src/review/agents/go-idioms-auditor.ts
    - src/review/agents/python-django-auditor.ts
    - src/review/agents/rust-safety-auditor.ts
  modified:
    - src/review/agents/index.ts
    - src/tools/review.ts
    - src/review/pipeline.ts
    - tests/review/agents.test.ts
    - tests/review/selection.test.ts
    - tests/review/tool.test.ts
    - tests/review/pipeline.test.ts

key-decisions:
  - "Universal specialized agents (wiring, dead-code, spec, database, auth, concurrency, scope) have empty relevantStacks for always-on selection"
  - "Stack-gated agents (type-soundness, state-mgmt, react, go, python, rust) filter via relevantStacks matching detectStackTags output"
  - "getChangedFiles uses node:child_process execFile (not exec) to prevent shell injection"
  - "Pipeline case 1 filters from ALL_REVIEW_AGENTS excluding stage 3 (red-team, product-thinker) for cross-verification"
  - "Pipeline case 3 uses ALL_REVIEW_AGENTS filtered by selectedAgentNames plus stage 3 agents for fix cycle"

patterns-established:
  - "Specialized ReviewAgent pattern: frozen object with domain-specific prompt checks, relevant stacks, and JSON output format"
  - "getChangedFiles async helper with scope-based git diff args and 10s timeout"

requirements-completed: [UXP-06]

duration: 8min
completed: 2026-04-01
---

# Phase 10 Plan 04: Specialized Review Agents Summary

**13 stack-aware review agents with full prompts, wired into pipeline via detectStackTags and execFile-based file detection**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-01T16:11:05Z
- **Completed:** 2026-04-01T16:19:09Z
- **Tasks:** 2
- **Files modified:** 20

## Accomplishments
- Created 13 specialized ReviewAgent files with detailed domain-specific prompts covering wiring inspection, dead code, spec compliance, database safety, auth flows, type soundness, state management, concurrency, scope verification, React patterns, Go idioms, Python/Django patterns, and Rust safety
- Wired stack detection into startNewReview using safe execFile-based git diff to detect changed file extensions and framework indicators
- Updated pipeline to filter from ALL_REVIEW_AGENTS (21 total) instead of hardcoded REVIEW_AGENTS (6), enabling specialized agents to participate in cross-verification and fix cycles

## Task Commits

Each task was committed atomically:

1. **Task 1: Create 13 new ReviewAgent files with full prompts and stack-gated relevantStacks** - `fefa8d8` (feat)
2. **Task 2: Wire stack detection and all-agent selection into review pipeline** - `9dc937b` (feat)

## Files Created/Modified
- `src/review/agents/wiring-inspector.ts` - End-to-end connectivity auditor (universal)
- `src/review/agents/dead-code-scanner.ts` - Unused imports, orphaned functions, debug artifacts (universal)
- `src/review/agents/spec-checker.ts` - Requirement coverage and scope creep detection (universal)
- `src/review/agents/database-auditor.ts` - Migration safety, N+1, SQL injection, transaction boundaries (universal)
- `src/review/agents/auth-flow-verifier.ts` - Route protection, token validation, privilege escalation (universal)
- `src/review/agents/type-soundness.ts` - Type correctness, any usage, assertions (typescript/kotlin/rust/go)
- `src/review/agents/state-mgmt-auditor.ts` - Stale closures, infinite loops, derived state (react/vue/svelte/angular)
- `src/review/agents/concurrency-checker.ts` - Thread safety, lock balance, missing await (universal)
- `src/review/agents/scope-intent-verifier.ts` - Scope alignment and ungoverned features (universal)
- `src/review/agents/react-patterns-auditor.ts` - Hooks rules, useEffect deps, hydration (react/nextjs)
- `src/review/agents/go-idioms-auditor.ts` - Defer-in-loop, goroutine leaks, nil interface (go)
- `src/review/agents/python-django-auditor.ts` - N+1 templates, ModelForms, CSRF, mutable defaults (django/fastapi)
- `src/review/agents/rust-safety-auditor.ts` - Unsafe blocks, unwrap, lifetimes, Send/Sync (rust)
- `src/review/agents/index.ts` - Updated barrel with SPECIALIZED_AGENTS and expanded ALL_REVIEW_AGENTS (21)
- `src/tools/review.ts` - Added getChangedFiles, async startNewReview with detectStackTags
- `src/review/pipeline.ts` - Updated to filter from ALL_REVIEW_AGENTS
- `tests/review/agents.test.ts` - Updated for 21-agent registry, stack-gated verification
- `tests/review/selection.test.ts` - Added specialized agent selection/exclusion tests
- `tests/review/tool.test.ts` - Added tests for specialized agents in dispatch output
- `tests/review/pipeline.test.ts` - Added full pipeline traversal tests with expanded agents

## Decisions Made
- Universal specialized agents (7 of 13) have empty relevantStacks to always run, matching the agent-catalog.ts stackAffinity of "universal"
- Stack-gated agents (6 of 13) use relevantStacks to participate only when their stack is detected
- Used execFile (not exec) for safe git command execution, preventing shell injection
- Pipeline case 1 cross-verification excludes stage 3 agents (red-team, product-thinker) since they run in stage 3
- Pipeline case 3 fix cycle includes all selected agents plus stage 3 for complete coverage

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 21 review agents operational and selectable via stack detection
- Review pipeline fully wired to use specialized agents
- Ready for integration with orchestrator dispatch

---
*Phase: 10-ux-polish-metaprompting*
*Completed: 2026-04-01*

## Self-Check: PASSED

- All 16 key files verified present
- Commit fefa8d8 (Task 1) verified in history
- Commit 9dc937b (Task 2) verified in history
- 708 tests pass, lint clean
