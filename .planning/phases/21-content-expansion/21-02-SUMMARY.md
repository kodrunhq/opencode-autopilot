---
phase: 21-content-expansion
plan: 02
subsystem: commands
tags: [agents.md, review, templates, starter-templates, installer]

requires:
  - phase: 18-namespace-cleanup
    provides: oc- prefix convention for commands
provides:
  - /oc-review-agents command for agents.md audit and scoring
  - Four starter agents.md templates (web-api, cli-tool, library, fullstack)
  - Templates directory wired into asset installer
affects: [content-expansion, asset-installer, user-onboarding]

tech-stack:
  added: []
  patterns: [prompt-only command with scoring rubric, starter template convention]

key-files:
  created:
    - assets/commands/oc-review-agents.md
    - assets/templates/web-api.md
    - assets/templates/cli-tool.md
    - assets/templates/library.md
    - assets/templates/fullstack.md
  modified:
    - src/installer.ts

key-decisions:
  - "Templates use OpenCode agents.md format (not YAML frontmatter) for direct copy-paste usability"
  - "oc-review-agents runs in current agent context (no dedicated agent) like oc-stocktake pattern"

patterns-established:
  - "Starter template convention: assets/templates/{type}.md copied to ~/.config/opencode/templates/"
  - "Prompt-only review command pattern: structured scoring rubric with per-item and overall scores"

requirements-completed: [CMND-10, CMND-11]

duration: 3min
completed: 2026-04-03
---

# Phase 21 Plan 02: Review Agents Command and Starter Templates Summary

**Prompt-only /oc-review-agents command with 7-point per-agent scoring rubric plus four curated starter agents.md templates for web-api, cli-tool, library, and fullstack projects**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-03T15:37:03Z
- **Completed:** 2026-04-03T15:40:15Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Created /oc-review-agents command that validates structure (0-3), assesses prompt quality (0-4), checks coverage against project type, and outputs a numerical overall score
- Created four immediately-usable starter templates with curated agents for web-api (5 agents), cli-tool (4 agents), library (4 agents), and fullstack (6 agents) project types
- Wired templates directory into the asset installer so templates are copied to ~/.config/opencode/templates/ on plugin load

## Task Commits

Each task was committed atomically:

1. **Task 1: Create oc-review-agents command and four starter templates** - `7894777` (feat)
2. **Task 2: Wire templates directory into the asset installer** - `b335947` (feat)

## Files Created/Modified
- `assets/commands/oc-review-agents.md` - Prompt-only command for reviewing and scoring agents.md files
- `assets/templates/web-api.md` - Starter agents.md with api-designer, db-architect, security-auditor, test-engineer, devops
- `assets/templates/cli-tool.md` - Starter agents.md with ux-writer, arg-parser-expert, test-engineer, release-manager
- `assets/templates/library.md` - Starter agents.md with api-designer, docs-writer, test-engineer, perf-analyst
- `assets/templates/fullstack.md` - Starter agents.md with frontend-architect, backend-architect, security-auditor, test-engineer, ux-reviewer, devops
- `src/installer.ts` - Added templates to processFiles Promise.all and return aggregation

## Decisions Made
- Templates use plain agents.md format (not YAML frontmatter) so users can copy them directly as their project's agents.md
- oc-review-agents has no `agent:` field, running in current agent context (same pattern as oc-stocktake)
- Each template agent includes description, system prompt, and explicit tool permissions for immediate usability

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - all files are complete and functional.

## Next Phase Readiness
- Command and templates are ready for use
- Installer will copy templates on next plugin load
- All tests pass (1209/1209), no regressions

---
*Phase: 21-content-expansion*
*Completed: 2026-04-03*
