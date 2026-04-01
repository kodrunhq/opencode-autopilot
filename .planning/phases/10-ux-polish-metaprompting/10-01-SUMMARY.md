---
phase: 10-ux-polish-metaprompting
plan: 01
subsystem: review, agents
tags: [severity, review-engine, agent-modes, autopilot, pipeline]

# Dependency graph
requires:
  - phase: 05-review-engine
    provides: "Review schemas, severity definitions, agent prompts"
  - phase: 06-orchestrator-pipeline
    provides: "Pipeline agents, orchestrator agent registration"
provides:
  - "4-tier severity taxonomy (CRITICAL/HIGH/MEDIUM/LOW) across all review components"
  - "Autopilot agent replacing orchestrator with mode: all"
  - "Researcher and metaprompter agents with mode: all"
  - "All 10 pipeline agents with hidden: true"
affects: [review, agents, pipeline, config-hook]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "4-tier severity taxonomy: CRITICAL (blocks PR) > HIGH (strongly recommended) > MEDIUM (noted) > LOW (optional)"
    - "mode: all for user-facing agents (autopilot, researcher, metaprompter)"
    - "hidden: true for pipeline-internal agents excluded from autocomplete"

key-files:
  created:
    - "src/agents/autopilot.ts"
  modified:
    - "src/review/schemas.ts"
    - "src/review/severity.ts"
    - "src/review/report.ts"
    - "src/review/finding-builder.ts"
    - "src/review/agents/*.ts (all 8)"
    - "src/agents/index.ts"
    - "src/agents/researcher.ts"
    - "src/agents/metaprompter.ts"
    - "src/agents/pipeline/*.ts (all 10)"

key-decisions:
  - "MEDIUM severity tier added for edge cases, minor perf, and incomplete error context"
  - "Both HIGH and MEDIUM findings return CONCERNS verdict (not just HIGH)"
  - "Autopilot agent uses mode: all for both Tab-cycle and @-mention access"
  - "Pipeline agents get hidden: true (not visible in autocomplete, only dispatchable)"

patterns-established:
  - "4-tier severity: CRITICAL (blocks), HIGH (recommended fix), MEDIUM (convenience fix), LOW (optional)"
  - "Agent visibility: mode: all + no hidden = user-facing; mode: subagent + hidden: true = internal"

requirements-completed: [UXP-01, UXP-02]

# Metrics
duration: 10min
completed: 2026-04-01
---

# Phase 10 Plan 01: Severity Alignment & Agent Rename Summary

**Standardized review severity to 4-tier CRITICAL/HIGH/MEDIUM/LOW taxonomy and renamed orchestrator to autopilot with updated agent modes and hidden flags**

## Performance

- **Duration:** 10 min
- **Started:** 2026-04-01T15:58:05Z
- **Completed:** 2026-04-01T16:08:35Z
- **Tasks:** 2
- **Files modified:** 36

## Accomplishments
- Unified severity taxonomy from 3-tier (CRITICAL/WARNING/NITPICK) to 4-tier (CRITICAL/HIGH/MEDIUM/LOW) across schemas, definitions, report builder, and all 8 review agent prompts
- Renamed orchestrator agent to autopilot with mode: all, making it accessible via both Tab cycle and @-mention
- Changed researcher and metaprompter agents from mode: subagent to mode: all for direct user access
- Added hidden: true to all 10 pipeline agents, removing them from Tab and @ autocomplete

## Task Commits

Each task was committed atomically:

1. **Task 1: Severity alignment** - `0f3530a` (feat) -- schemas, definitions, report, 8 agent prompts, 4 test files
2. **Task 2: Agent rename and modes** - `bcc4866` (feat) -- autopilot.ts, index.ts, modes, hidden flags, 8 additional test fixes

## Files Created/Modified
- `src/review/schemas.ts` - SEVERITIES constant updated to 4-tier, default threshold to MEDIUM
- `src/review/severity.ts` - 4 severity definitions with MEDIUM tier, updated SEVERITY_RANK
- `src/review/report.ts` - SEVERITY_ORDER, determineVerdict (HIGH+MEDIUM=CONCERNS), buildSummary counts
- `src/review/finding-builder.ts` - Updated sort comment
- `src/review/agents/*.ts` (8 files) - Updated prompt severity strings and severityFocus arrays
- `src/agents/autopilot.ts` - New file replacing orchestrator.ts with mode: all
- `src/agents/index.ts` - Imports and registers autopilot instead of orchestrator
- `src/agents/researcher.ts` - mode changed to all
- `src/agents/metaprompter.ts` - mode changed to all
- `src/agents/pipeline/*.ts` (10 files) - Added hidden: true
- `tests/review/*.test.ts` (6 test files) - Updated severity assertions
- `tests/agents/*.test.ts` (2 test files) - Updated mode assertions
- `tests/tools/orchestrate.test.ts` - Imports autopilotAgent, updated assertions
- `tests/orchestrate-pipeline.test.ts` - agents.autopilot instead of agents.orchestrator

## Decisions Made
- MEDIUM severity tier criteria: edge cases potentially unhandled, incomplete error context, minor performance concern, missing input validation on non-critical path, inconsistent error handling pattern
- Both HIGH and MEDIUM findings return CONCERNS verdict (not APPROVED), ensuring meaningful issues are always surfaced
- Autopilot description changed to user-friendly language emphasizing autonomous end-to-end delivery

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed additional test files not listed in plan**
- **Found during:** Task 2 (full test suite run)
- **Issue:** tests/agents/researcher.test.ts, tests/agents/metaprompter.test.ts, tests/review/pipeline.test.ts, and tests/review/finding-builder.test.ts had old severity values and mode assertions that broke after source changes
- **Fix:** Updated 4 additional test files with new severity values and mode assertions
- **Files modified:** tests/agents/researcher.test.ts, tests/agents/metaprompter.test.ts, tests/review/pipeline.test.ts, tests/review/finding-builder.test.ts
- **Verification:** Full test suite passes (694 tests, 0 failures)
- **Committed in:** bcc4866 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed stale severity comment in finding-builder.ts**
- **Found during:** Task 2 (final grep verification)
- **Issue:** Comment in src/review/finding-builder.ts still referenced WARNING/NITPICK
- **Fix:** Updated comment to reference HIGH/MEDIUM/LOW
- **Files modified:** src/review/finding-builder.ts
- **Committed in:** bcc4866 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs from incomplete file lists in plan)
**Impact on plan:** Necessary corrections for test suite integrity. No scope creep.

## Issues Encountered
None - all changes applied cleanly, full test suite passes.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Severity taxonomy is unified; future plans can reference CRITICAL/HIGH/MEDIUM/LOW consistently
- Agent visibility model is established: user-facing agents use mode: all, internal agents use hidden: true
- Ready for plan 02 (prompt rewrite and skill injection)

---
*Phase: 10-ux-polish-metaprompting*
*Completed: 2026-04-01*
