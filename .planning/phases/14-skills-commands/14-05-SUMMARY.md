---
phase: 14-skills-commands
plan: 05
subsystem: tools
tags: [linter, stocktake, update-docs, yaml, frontmatter, skill-template]

# Dependency graph
requires:
  - phase: 14-01
    provides: base tool registration pattern and index.ts structure
  - phase: 14-04
    provides: command wrapper pattern (quick.md reference)
provides:
  - oc_stocktake tool for asset health auditing with integrated YAML linting
  - oc_update_docs tool for documentation drift detection via git diff
  - Asset markdown linter (lintSkill, lintCommand, lintAgent)
  - Skill template with stacks/requires frontmatter fields
affects: [14-06, phase-15]

# Tech tracking
tech-stack:
  added: []
  patterns: [asset-linter-pattern, stocktake-audit-pattern, git-diff-doc-analysis]

key-files:
  created:
    - src/skills/linter.ts
    - src/tools/stocktake.ts
    - src/tools/update-docs.ts
    - assets/commands/stocktake.md
    - assets/commands/update-docs.md
    - tests/skills/linter.test.ts
    - tests/tools/stocktake.test.ts
    - tests/tools/update-docs.test.ts
  modified:
    - src/templates/skill-template.ts
    - src/tools/create-skill.ts
    - src/index.ts
    - tests/index.test.ts

key-decisions:
  - "Frontmatter regex handles empty frontmatter (---\\n---) via optional capture group"
  - "stacks and requires default to [] in generated skill frontmatter to prevent Pitfall 2"
  - "stocktake lint defaults to true for maximum asset health visibility"
  - "update-docs uses execFile (not exec) for shell-injection-safe git commands"

patterns-established:
  - "Asset linter pattern: extractFrontmatter + per-type lint function returning LintResult"
  - "Stocktake audit pattern: scan dirs, classify built-in vs user-created, optional lint integration"

requirements-completed: [CM-02, CM-03, DX-05]

# Metrics
duration: 6min
completed: 2026-04-02
---

# Phase 14 Plan 05: Tool-Backed Commands Summary

**Asset linter, stocktake audit tool, update-docs drift detector, and skill template stacks/requires fields**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-02T19:04:09Z
- **Completed:** 2026-04-02T19:10:03Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Created asset markdown linter (lintSkill, lintCommand, lintAgent) validating YAML frontmatter, required fields, and content
- Built oc_stocktake tool that audits all installed skills, commands, and agents with integrated lint validation
- Built oc_update_docs tool that detects documentation drift via git diff analysis
- Updated skill template to always include stacks and requires fields in generated frontmatter
- Added stacks/requires parameters to create-skill tool schema
- Registered oc_stocktake and oc_update_docs in plugin entry point (now 19 tools total)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create asset linter, stocktake tool, and update-docs tool (RED)** - `50bc852` (test)
2. **Task 1: Create asset linter, stocktake tool, and update-docs tool (GREEN)** - `c82cfc9` (feat)
3. **Task 2: Update skill template, create-skill tool, and register new tools** - `f9052ab` (feat)

_Note: TDD task had separate test and implementation commits_

## Files Created/Modified
- `src/skills/linter.ts` - Asset markdown linter with YAML frontmatter validation
- `src/tools/stocktake.ts` - oc_stocktake tool auditing all installed assets
- `src/tools/update-docs.ts` - oc_update_docs tool detecting doc drift via git diff
- `assets/commands/stocktake.md` - Thin command wrapper for oc_stocktake
- `assets/commands/update-docs.md` - Thin command wrapper for oc_update_docs
- `tests/skills/linter.test.ts` - 8 tests for linter functions
- `tests/tools/stocktake.test.ts` - 3 tests for stocktake core
- `tests/tools/update-docs.test.ts` - 2 tests for update-docs core
- `src/templates/skill-template.ts` - Added stacks/requires to SkillTemplateInput and frontmatter
- `src/tools/create-skill.ts` - Added stacks/requires to tool schema
- `src/index.ts` - Registered oc_stocktake and oc_update_docs
- `tests/index.test.ts` - Updated tool count from 17 to 19

## Decisions Made
- Frontmatter regex uses optional capture group to handle empty frontmatter (`---\n---`)
- stacks and requires default to `[]` in generated skill frontmatter to prevent Pitfall 2
- stocktake lint defaults to true for maximum asset health visibility
- update-docs uses execFile (not exec) for shell-injection-safe git commands

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Empty frontmatter regex handling**
- **Found during:** Task 1 (linter implementation)
- **Issue:** Regex `^---\n([\s\S]*?)\n---` failed to match `---\n---` (empty frontmatter) because it required content between markers
- **Fix:** Changed to `^---\n([\s\S]*?\n)?---` with null coalescing for capture group
- **Files modified:** src/skills/linter.ts
- **Verification:** lintCommand test for empty frontmatter now passes
- **Committed in:** c82cfc9 (Task 1 commit)

**2. [Rule 1 - Bug] Updated index test tool count**
- **Found during:** Task 2 (tool registration)
- **Issue:** tests/index.test.ts expected 17 tools, but we added 2 new ones (19 total)
- **Fix:** Updated expected tool list and count in index test
- **Files modified:** tests/index.test.ts
- **Verification:** All 1021 tests pass
- **Committed in:** f9052ab (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all tools are fully wired with real data sources.

## Next Phase Readiness
- All tool-backed commands from plan 14-05 are complete and registered
- Asset linter is available for integration into other tools
- Skill template produces valid frontmatter with stacks/requires fields

---
*Phase: 14-skills-commands*
*Completed: 2026-04-02*
