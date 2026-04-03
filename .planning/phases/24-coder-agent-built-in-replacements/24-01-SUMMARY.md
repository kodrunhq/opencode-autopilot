---
phase: 24-coder-agent-built-in-replacements
plan: 01
subsystem: agents
tags: [coder, tdd, coding-standards, config-hook, tab-cycle]

requires:
  - phase: 20-new-primary-agents
    provides: "Agent pattern with static skill embedding and alphabetical map ordering"
provides:
  - "Coder agent (src/agents/coder.ts) with embedded tdd-workflow and coding-standards skills"
  - "/oc-tdd command routed to coder agent via agent: coder frontmatter"
affects: [24-02, 24-03, 24-04]

tech-stack:
  added: []
  patterns: ["Static skill embedding in agent prompt with XML skill tags"]

key-files:
  created:
    - src/agents/coder.ts
    - tests/agents/coder.test.ts
  modified:
    - src/agents/index.ts
    - assets/commands/oc-tdd.md
    - tests/agents-visibility.test.ts

key-decisions:
  - "Coder agent maxSteps set to 30 (between debugger 25 and autopilot 50)"
  - "Skill content condensed for prompt embedding while preserving key methodology"

patterns-established:
  - "Command-to-agent routing via agent: field in YAML frontmatter"

requirements-completed: []

duration: 3min
completed: 2026-04-03
---

# Phase 24 Plan 01: Coder Agent Summary

**Coder agent with embedded TDD workflow and coding standards skills, routed from /oc-tdd command, in Tab cycle between autopilot and debugger**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-03T21:16:39Z
- **Completed:** 2026-04-03T21:19:56Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Created coder agent at src/agents/coder.ts with mode "all", maxSteps 30, embedded tdd-workflow and coding-standards skills
- Registered coder in agents map in alphabetical position (autopilot, coder, debugger, ...) for correct Tab cycle ordering
- Routed /oc-tdd command to coder agent via agent: coder frontmatter

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Coder agent with embedded TDD and coding-standards skills** - `bc16412` (test: RED), `2c1a129` (feat: GREEN)
2. **Task 2: Route /oc-tdd command to coder agent** - `38b751b` (feat)

## Files Created/Modified

- `src/agents/coder.ts` - Coder agent definition with embedded tdd-workflow and coding-standards skills
- `src/agents/index.ts` - Added coder import, agents map entry, and re-export
- `assets/commands/oc-tdd.md` - Added agent: coder to YAML frontmatter
- `tests/agents/coder.test.ts` - 9 tests covering mode, description, skills, permissions, frozen state, map key, ordering
- `tests/agents-visibility.test.ts` - Updated agent counts and primary agent lists for coder

## Decisions Made

- Coder agent maxSteps set to 30 (between debugger's 25 and autopilot's 50) per plan specification
- Skill content condensed for prompt embedding while preserving core methodology sections

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated agents-visibility.test.ts for new agent count**
- **Found during:** Task 1 (coder agent implementation)
- **Issue:** Existing tests had hardcoded agent count (8 standard, 4 primary) and expected lists that did not include coder
- **Fix:** Updated count to 9 standard, 5 primary; added "coder" to all expected agent name arrays
- **Files modified:** tests/agents-visibility.test.ts
- **Verification:** All 77 agent tests pass
- **Committed in:** 2c1a129 (part of Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Necessary update to existing tests for correctness. No scope creep.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Coder agent registered and testable via Tab cycle and /oc-tdd command
- Ready for 24-02 (reviewer agent built-in replacement) and subsequent plans

---
*Phase: 24-coder-agent-built-in-replacements*
*Completed: 2026-04-03*
