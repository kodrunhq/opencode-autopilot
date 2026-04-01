---
phase: 06-orchestrator-pipeline
plan: 01
subsystem: orchestrator
tags: [pipeline, agents, subagent, zod, state-machine, artifacts]

requires:
  - phase: 04-orchestrator-foundation
    provides: "schemas, types, state, phase transitions, config v2"
provides:
  - "DispatchResult and PhaseHandler types for handler implementations"
  - "AGENT_NAMES constant mapping phases to agent names"
  - "Artifact directory management (getPhaseDir, ensurePhaseDir, getArtifactRef)"
  - "buildProgressSchema for BUILD phase task cycling"
  - "10 pipeline subagent configs (9 in pipelineAgents barrel)"
affects: [06-02, 06-03, 06-04]

tech-stack:
  added: []
  patterns:
    - "Pipeline agent configs as Readonly<AgentConfig> + Object.freeze()"
    - "AGENT_NAMES as single source of truth for agent name strings"
    - "Artifact paths resolved via getPhaseDir under .opencode-autopilot/phases/{PHASE}/"

key-files:
  created:
    - src/orchestrator/handlers/types.ts
    - src/orchestrator/artifacts.ts
    - src/agents/pipeline/index.ts
    - src/agents/pipeline/oc-researcher.ts
    - src/agents/pipeline/oc-challenger.ts
    - src/agents/pipeline/oc-architect.ts
    - src/agents/pipeline/oc-critic.ts
    - src/agents/pipeline/oc-explorer.ts
    - src/agents/pipeline/oc-planner.ts
    - src/agents/pipeline/oc-implementer.ts
    - src/agents/pipeline/oc-reviewer.ts
    - src/agents/pipeline/oc-shipper.ts
    - src/agents/pipeline/oc-retrospector.ts
    - tests/artifacts.test.ts
    - tests/agents-pipeline.test.ts
  modified:
    - src/orchestrator/schemas.ts
    - src/orchestrator/types.ts

key-decisions:
  - "Pre-computed buildProgress defaults to avoid Zod v4 nested default issue"
  - "oc-explorer agent added to match AGENT_NAMES.EXPLORE (plan omitted file)"
  - "oc-reviewer excluded from pipelineAgents barrel (no REVIEW phase in AGENT_NAMES)"

patterns-established:
  - "Pipeline agent pattern: Readonly<AgentConfig> + Object.freeze(), mode subagent, no model field, lean prompt 200-500 chars"
  - "AGENT_NAMES as authoritative phase-to-agent mapping"

requirements-completed: [ORCH-01, PIPE-01, PIPE-02, PIPE-03, PIPE-04, PIPE-05, PIPE-07, PIPE-08]

duration: 5min
completed: 2026-03-31
---

# Phase 6 Plan 1: Handler Types, Artifacts, and Pipeline Agents Summary

**DispatchResult/PhaseHandler type system, artifact directory helpers, buildProgress schema extension, and 10 pipeline subagent configs with barrel export**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-31T22:27:25Z
- **Completed:** 2026-03-31T22:32:57Z
- **Tasks:** 2
- **Files modified:** 17

## Accomplishments
- Handler type system with DispatchResult (4 action variants) and PhaseHandler interface for all phase implementations
- Artifact directory management with getPhaseDir, ensurePhaseDir, getArtifactRef, and PHASE_ARTIFACTS map
- buildProgressSchema extending pipelineStateSchema for BUILD phase task cycling (currentTask, currentWave, attemptCount, strikeCount, reviewPending)
- 10 pipeline subagent configs with lean prompts, all frozen, mode subagent, no model field
- pipelineAgents barrel export mapping 9 AGENT_NAMES values to configs

## Task Commits

Each task was committed atomically:

1. **Task 1: Handler types, artifact module, and schema extension** - `5842a5e` (feat)
2. **Task 2: All 9 pipeline subagent configs and barrel export** - `9af6e36` (feat)

## Files Created/Modified
- `src/orchestrator/handlers/types.ts` - DispatchResult, PhaseHandler, AGENT_NAMES constant
- `src/orchestrator/artifacts.ts` - getPhaseDir, ensurePhaseDir, getArtifactRef, PHASE_ARTIFACTS
- `src/orchestrator/schemas.ts` - Added buildProgressSchema and buildProgress field to pipelineStateSchema
- `src/orchestrator/types.ts` - Added BuildProgress type
- `src/agents/pipeline/*.ts` - 10 pipeline subagent config files
- `src/agents/pipeline/index.ts` - Barrel export mapping AGENT_NAMES to configs
- `tests/artifacts.test.ts` - 18 tests for types, artifacts, schema
- `tests/agents-pipeline.test.ts` - 10 tests for pipeline agent validation

## Decisions Made
- Pre-computed buildProgress default object in pipelineStateSchema to avoid Zod v4 nested default issue (consistent with Phase 04 pattern)
- Created oc-explorer agent file not listed in plan to satisfy AGENT_NAMES.EXPLORE mapping
- oc-reviewer agent kept as standalone file but excluded from pipelineAgents barrel since there is no REVIEW phase in AGENT_NAMES

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added oc-explorer agent for AGENT_NAMES completeness**
- **Found during:** Task 2 (pipeline agents barrel)
- **Issue:** AGENT_NAMES.EXPLORE maps to "oc-explorer" but plan files_modified omitted oc-explorer.ts
- **Fix:** Created src/agents/pipeline/oc-explorer.ts with appropriate EXPLORE phase prompt
- **Files modified:** src/agents/pipeline/oc-explorer.ts
- **Verification:** pipelineAgents barrel includes all 9 AGENT_NAMES values, tests pass
- **Committed in:** 9af6e36

**2. [Rule 1 - Bug] Pre-computed Zod nested defaults for buildProgress**
- **Found during:** Task 1 (schema extension)
- **Issue:** `buildProgressSchema.default({})` produced empty object instead of nested defaults (Zod v4 behavior)
- **Fix:** Passed explicit default values matching schema field defaults
- **Files modified:** src/orchestrator/schemas.ts
- **Verification:** buildProgressSchema.parse({}) returns correct defaults, pipelineStateSchema.parse() defaults buildProgress correctly
- **Committed in:** 5842a5e

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Handler types and artifacts module ready for phase handler implementations (plans 02 and 03)
- AGENT_NAMES constant provides single source of truth for dispatch
- buildProgressSchema ready for BUILD phase handler task cycling logic
- All 28 new tests passing, 425 total tests passing, lint clean (warnings only)

---
*Phase: 06-orchestrator-pipeline*
*Completed: 2026-03-31*
