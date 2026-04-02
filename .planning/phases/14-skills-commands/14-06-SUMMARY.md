---
phase: 14-skills-commands
plan: 06
subsystem: skills
tags: [yaml, topological-sort, stack-detection, adaptive-loading, token-budget]

requires:
  - phase: 14-01
    provides: skill creation tooling and SKILL.md format
  - phase: 14-02
    provides: command creation tooling
  - phase: 14-03
    provides: agent creation tooling
  - phase: 14-04
    provides: curated skills with frontmatter
provides:
  - Skill frontmatter parser and directory loader (parseSkillFrontmatter, loadAllSkills)
  - Topological dependency resolver with cycle detection (resolveDependencyOrder)
  - Manifest-based project stack detection (detectProjectStackTags)
  - Stack-aware skill filtering (filterSkillsByStack)
  - Token-budgeted multi-skill context builder (buildMultiSkillContext)
  - Adaptive skill injection orchestrator (loadAdaptiveSkillContext)
affects: [phase-16-integration, orchestrator-dispatch, pipeline-agents]

tech-stack:
  added: []
  patterns: [manifest-based-stack-detection, topological-sort-dfs, token-budget-enforcement, best-effort-loading]

key-files:
  created:
    - src/skills/loader.ts
    - src/skills/dependency-resolver.ts
    - src/skills/adaptive-injector.ts
    - tests/skills/loader.test.ts
    - tests/skills/dependency-resolver.test.ts
    - tests/skills/adaptive-injector.test.ts
  modified:
    - src/orchestrator/skill-injection.ts

key-decisions:
  - "Manifest-based stack detection complements file-path detection (detectStackTags only works on git diff files)"
  - "Token budget default 8000 tokens (~32K chars) per research recommendation"
  - "Cycle participants excluded from context (graceful degradation, not error)"
  - "loadAdaptiveSkillContext added alongside existing functions for backward compatibility"

patterns-established:
  - "MANIFEST_TAGS pattern: check project root for manifest files to detect stack without git diff"
  - "Token budget enforcement: estimate 4 chars/token, stop adding skills when budget exceeded"
  - "Dependency-ordered skill injection: prerequisites loaded before dependents via topological sort"

requirements-completed: [SK-16, SK-17]

duration: 3min
completed: 2026-04-02
---

# Phase 14 Plan 06: Adaptive Skill Loading Summary

**Manifest-based project stack detection with topological dependency resolution and token-budgeted multi-skill context injection**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-02T19:12:28Z
- **Completed:** 2026-04-02T19:15:51Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Three new infrastructure modules in src/skills/ providing skill loading, dependency resolution, and adaptive injection
- 24 tests covering frontmatter parsing, topological sort, cycle detection, stack detection, skill filtering, and context building
- Updated skill-injection.ts with loadAdaptiveSkillContext that orchestrates the full adaptive loading pipeline
- All 1025 existing tests continue to pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Create skill loader, dependency resolver, and adaptive injector** - `45587de` (test: RED), `432fc52` (feat: GREEN)
2. **Task 2: Update skill-injection.ts with adaptive multi-skill loading** - `78544e8` (feat)

## Files Created/Modified
- `src/skills/loader.ts` - Skill frontmatter parser (YAML-based) and directory loader
- `src/skills/dependency-resolver.ts` - Topological sort with cycle detection via DFS
- `src/skills/adaptive-injector.ts` - Manifest-based stack detection, skill filtering, token-budgeted context builder
- `src/orchestrator/skill-injection.ts` - Added loadAdaptiveSkillContext (backward-compatible addition)
- `tests/skills/loader.test.ts` - 10 tests for frontmatter parsing and skill loading
- `tests/skills/dependency-resolver.test.ts` - 6 tests for topological sort and cycle detection
- `tests/skills/adaptive-injector.test.ts` - 8 tests for stack detection, filtering, and context building

## Decisions Made
- Manifest-based stack detection (detectProjectStackTags) complements file-path detection (detectStackTags) -- the latter only works on git diff files, manifest detection works from project root
- Token budget default set to 8000 tokens (~32K chars) per research recommendation
- Cycle participants are excluded from context via graceful degradation (not errors)
- Existing loadSkillContent and buildSkillContext preserved for backward compatibility

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Adaptive skill loading infrastructure is complete and ready for wiring into dispatch pipeline (Phase 16 scope)
- loadAdaptiveSkillContext is the public API -- accepts baseDir, projectRoot, optional tokenBudget
- All skills created in 14-04 will be automatically loaded and filtered based on project stack

---
*Phase: 14-skills-commands*
*Completed: 2026-04-02*
