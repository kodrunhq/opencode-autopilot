---
phase: 22-production-hardening
plan: 02
subsystem: utils
tags: [language-detection, commands, adaptive-context, stack-tags]

requires:
  - phase: 21-content-expansion
    provides: detectProjectStackTags with EXT_MANIFEST_TAGS pattern
provides:
  - resolveLanguageTag utility with per-root caching
  - substituteLanguageVar for $LANGUAGE template substitution
  - Four language-aware command templates (tdd, brainstorm, review-pr, write-plan)
affects: [command-system, skill-injection]

tech-stack:
  added: []
  patterns: [$LANGUAGE template variable in command markdown files]

key-files:
  created:
    - src/utils/language-resolver.ts
    - tests/utils/language-resolver.test.ts
  modified:
    - assets/commands/oc-tdd.md
    - assets/commands/oc-review-pr.md
    - assets/commands/oc-brainstorm.md
    - assets/commands/oc-write-plan.md

key-decisions:
  - "Reuse detectProjectStackTags from adaptive-injector -- no duplication of stack detection logic"
  - "Per-projectRoot Map cache for language resolution to avoid repeated filesystem access"

patterns-established:
  - "$LANGUAGE variable pattern: commands reference $LANGUAGE for language-adaptive guidance"

requirements-completed: [HARD-02]

duration: 2min
completed: 2026-04-03
---

# Phase 22 Plan 02: Language-Aware Commands Summary

**Language resolver utility with per-root caching and $LANGUAGE injection in four command templates (tdd, brainstorm, review-pr, write-plan)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-03T16:45:25Z
- **Completed:** 2026-04-03T16:47:13Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Created language resolver that wraps detectProjectStackTags with caching and string formatting
- Added $LANGUAGE variable to oc-tdd, oc-brainstorm, oc-review-pr, and oc-write-plan commands
- Full test coverage with 6 passing tests including cache behavior verification

## Task Commits

Each task was committed atomically:

1. **Task 1: Language resolver utility (TDD)** - `0cc023c` (test: RED), `2ba3e11` (feat: GREEN)
2. **Task 2: Update four command markdown files** - `d53271d` (feat)

_TDD task had separate test and implementation commits._

## Files Created/Modified
- `src/utils/language-resolver.ts` - resolveLanguageTag, substituteLanguageVar, clearLanguageCache exports
- `tests/utils/language-resolver.test.ts` - 6 tests covering tag resolution, caching, and substitution
- `assets/commands/oc-tdd.md` - Added $LANGUAGE for test framework adaptation
- `assets/commands/oc-brainstorm.md` - Added $LANGUAGE for library/pattern suggestions
- `assets/commands/oc-review-pr.md` - Added $LANGUAGE for idiom/convention checking
- `assets/commands/oc-write-plan.md` - Added $LANGUAGE for tooling references

## Decisions Made
- Reused detectProjectStackTags from adaptive-injector to avoid duplicating manifest detection logic
- Used simple Map cache keyed by projectRoot (cleared per test via clearLanguageCache)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Language resolver is ready for wiring into command execution pipeline
- $LANGUAGE substitution needs to be called at command render time (future plan)

---
*Phase: 22-production-hardening*
*Completed: 2026-04-03*
