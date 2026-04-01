---
phase: 10-ux-polish-metaprompting
plan: 02
subsystem: agents
tags: [prompts, metaprompting, pipeline-agents, structured-prompts]

requires:
  - phase: 10-01
    provides: "Pipeline agent file structure with AgentConfig types and barrel exports"
provides:
  - "10 production-grade pipeline agent prompts with structured format (281-413 words each)"
  - "Fixed metaprompter with ~/.config/opencode/ paths"
  - "Clarified researcher constraint (source files vs project files)"
  - "Documenter with concrete coding-standards skill path"
affects: [orchestrator, pipeline-dispatch, build-handler]

tech-stack:
  added: []
  patterns: ["Structured agent prompt format: Role, Steps, Output Format, Constraints, Error Recovery"]

key-files:
  created: []
  modified:
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
    - src/agents/metaprompter.ts
    - src/agents/researcher.ts
    - src/agents/documenter.ts
    - tests/agents-pipeline.test.ts

key-decisions:
  - "Structured prompt format: Role, Steps, Output Format, Constraints, Error Recovery sections"
  - "oc-implementer is most detailed (413 words) with CLAUDE.md and coding-standards references"
  - "Test updated from char-length range to word-count + section presence validation"

patterns-established:
  - "Pipeline agent prompt structure: role sentence, ## Steps numbered list, ## Output Format specification, ## Constraints DO/DO NOT rules, ## Error Recovery fallback actions"

requirements-completed: [UXP-03]

duration: 4min
completed: 2026-04-01
---

# Phase 10 Plan 02: Pipeline Agent Prompt Rewrite Summary

**Rewrote all 10 pipeline agent prompts from terse 30-70 word stubs to 281-413 word structured prompts with role, steps, output format, constraints, and error recovery; fixed metaprompter paths, researcher constraint, and documenter skill reference**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-01T16:10:50Z
- **Completed:** 2026-04-01T16:15:37Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- All 10 pipeline agent prompts rewritten with structured format (Role, Steps, Output Format, Constraints, Error Recovery)
- oc-implementer is the most detailed at 413 words, referencing CLAUDE.md and coding-standards skill
- Word counts range: researcher (281), challenger (291), architect (293), critic (283), explorer (305), planner (306), implementer (413), reviewer (287), shipper (294), retrospector (281)
- Metaprompter paths corrected from .opencode/ to ~/.config/opencode/
- Researcher constraint clarified from "project files" to "source files"
- Documenter given concrete coding-standards skill path

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite all 10 pipeline agent prompts** - `881bbf4` (feat)
2. **Task 2: Fix base agent prompt issues** - `173bdf8` (fix)

## Files Created/Modified
- `src/agents/pipeline/oc-researcher.ts` - Domain researcher with 281-word structured prompt
- `src/agents/pipeline/oc-challenger.ts` - Enhancement proposer with 291-word structured prompt
- `src/agents/pipeline/oc-architect.ts` - System designer with 293-word structured prompt
- `src/agents/pipeline/oc-critic.ts` - Adversarial evaluator with 283-word structured prompt
- `src/agents/pipeline/oc-explorer.ts` - Technical spike investigator with 305-word structured prompt
- `src/agents/pipeline/oc-planner.ts` - Task decomposer with 306-word structured prompt
- `src/agents/pipeline/oc-implementer.ts` - Production code implementer with 413-word structured prompt (CLAUDE.md + coding-standards refs)
- `src/agents/pipeline/oc-reviewer.ts` - Code review coordinator with 287-word structured prompt
- `src/agents/pipeline/oc-shipper.ts` - Ship package assembler with 294-word structured prompt
- `src/agents/pipeline/oc-retrospector.ts` - Lesson extractor with 281-word structured prompt
- `src/agents/metaprompter.ts` - Fixed .opencode/ to ~/.config/opencode/ paths
- `src/agents/researcher.ts` - Changed "project files" to "source files" constraint
- `src/agents/documenter.ts` - Added concrete ~/.config/opencode/skills/coding-standards/SKILL.md path
- `tests/agents-pipeline.test.ts` - Updated test from char-length to word-count + section validation

## Decisions Made
- Adopted structured prompt format with 5 sections (Role, Steps, Output Format, Constraints, Error Recovery) as the standard for all pipeline agents
- Made oc-implementer the most detailed prompt (413 words) because it is the highest-risk agent (writes production code, manages branches, commits)
- Updated test from char-range (100-600) to word-count minimum (150+) plus section presence checks for stronger validation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated test char-length assertion to word-count + section check**
- **Found during:** Task 1 (pipeline prompt rewrite)
- **Issue:** Existing test checked prompt char length between 100-600; new structured prompts exceed 600 chars
- **Fix:** Changed test to validate 150+ words and presence of ## Steps, ## Constraints, ## Error Recovery sections
- **Files modified:** tests/agents-pipeline.test.ts
- **Verification:** bun test tests/agents-pipeline.test.ts passes (10 tests, 104 expect() calls)
- **Committed in:** 881bbf4 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Test update necessary for correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All pipeline agent prompts are production-grade and ready for autonomous pipeline operation
- The structured prompt format establishes a pattern for any future agents
- Base agent fixes ensure consistent path references across the codebase

## Self-Check: PASSED

- All 15 files verified present on disk
- Both commits (881bbf4, 173bdf8) verified in git log
- 691/691 tests passing, 0 failures

---
*Phase: 10-ux-polish-metaprompting*
*Completed: 2026-04-01*
