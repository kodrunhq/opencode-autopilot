---
phase: 20-new-primary-agents
plan: 01
subsystem: agents
tags: [agent-config, debugger, planner, reviewer, skills-embedding, tab-cycle]

requires:
  - phase: 19-agent-visibility-fixes
    provides: Agent visibility and stocktake detection working correctly
provides:
  - Three new primary agents (debugger, planner, reviewer) with embedded skill content
  - Tab-cycle accessible agents via mode "all"
  - Role-scoped permissions for each agent
affects: [20-02-PLAN, agent-registration, config-hook]

tech-stack:
  added: []
  patterns: [static-skill-embedding, role-scoped-permissions, frozen-agent-config]

key-files:
  created:
    - src/agents/debugger.ts
    - src/agents/planner.ts
    - src/agents/reviewer.ts
  modified: []

key-decisions:
  - "Embedded full skill content statically in prompts rather than runtime file reads"
  - "Reviewer gets edit:deny to enforce review-only role; planner gets edit:allow for plan file creation with prompt-level source code editing prohibition"
  - "All three agents deny webfetch to keep them focused on local codebase work"

patterns-established:
  - "Static skill embedding: strip YAML frontmatter from SKILL.md, wrap in <skill name=X> tags within agent prompt"
  - "Role-scoped permissions: use SDK permission fields for hard constraints, prompt rules for soft constraints"

requirements-completed: [AGNT-10, AGNT-11, AGNT-12]

duration: 7min
completed: 2026-04-03
---

# Phase 20 Plan 01: New Primary Agents Summary

**Debugger, planner, and reviewer agents with full skill content embedded in prompts, mode "all" for Tab-cycle, and role-scoped permissions**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-03T14:35:28Z
- **Completed:** 2026-04-03T14:43:01Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments
- Created debugger agent with systematic-debugging skill (294 lines of skill content), maxSteps 25, edit+bash allowed
- Created planner agent with plan-writing and plan-executing skills (both embedded), maxSteps 20, edit+bash allowed
- Created reviewer agent with code-review skill, oc_review auto-invocation instruction, maxSteps 30, edit denied
- All three agents use mode "all" for Tab-cycle and @ autocomplete visibility
- Zero TypeScript errors confirmed via tsc --noEmit

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Debugger, Planner, and Reviewer agent source files** - `22214f3` (feat)

**Plan metadata:** (pending final commit)

## Files Created/Modified
- `src/agents/debugger.ts` - Primary debugger agent with embedded systematic-debugging skill
- `src/agents/planner.ts` - Primary planner agent with embedded plan-writing and plan-executing skills
- `src/agents/reviewer.ts` - Primary code reviewer agent with embedded code-review skill and oc_review auto-invocation

## Decisions Made
- Embedded full skill markdown content statically in agent prompts (stripped YAML frontmatter, kept all sections from heading onward)
- Reviewer agent uses edit:"deny" as hard constraint since it should never modify code; planner uses edit:"allow" because the SDK cannot distinguish write-new from edit-existing, and plan file creation requires edit permission
- All three agents deny webfetch to keep focus on local codebase operations
- Wrapped skill content in `<skill name="X">` XML tags within the prompt template literal for clear delineation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all agents are fully wired with complete skill content.

## Next Phase Readiness
- Three agent source files ready for registration in the config hook (Plan 02)
- Agent exports and agents map in src/agents/index.ts need updating in Plan 02

## Self-Check: PASSED

- src/agents/debugger.ts: FOUND
- src/agents/planner.ts: FOUND
- src/agents/reviewer.ts: FOUND
- Commit 22214f3: FOUND

---
*Phase: 20-new-primary-agents*
*Completed: 2026-04-03*
