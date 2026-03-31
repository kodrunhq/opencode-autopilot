---
phase: 05-review-engine
plan: 01
subsystem: review
tags: [zod, review-engine, agent-catalog, stack-gate, severity]

requires:
  - phase: 04-foundation-infrastructure
    provides: "Zod patterns, orchestrator schemas, pipeline types"
provides:
  - "Review Zod schemas (finding, report, config, severity, verdict)"
  - "Agent catalog with 21 review agents (3 core, 16 parallel, 2 sequenced)"
  - "Stack gate filtering for technology-specific agents"
  - "Team selection logic combining catalog + stack gate"
  - "Severity definitions with comparison and blocking check"
  - "Finding builder with dedup and severity sorting"
affects: [05-review-engine, 06-orchestrator-pipeline]

tech-stack:
  added: []
  patterns: ["Agent catalog as frozen data registry", "Stack gate filtering pattern", "Finding deduplication by file+title"]

key-files:
  created:
    - src/review/schemas.ts
    - src/review/types.ts
    - src/review/severity.ts
    - src/review/agent-catalog.ts
    - src/review/stack-gate.ts
    - src/review/team-selection.ts
    - src/review/finding-builder.ts
    - tests/review/schemas.test.ts
    - tests/review/severity.test.ts
    - tests/review/agent-catalog.test.ts
    - tests/review/stack-gate.test.ts
    - tests/review/team-selection.test.ts
    - tests/review/finding-builder.test.ts
  modified: []

key-decisions:
  - "Severity uses CRITICAL/WARNING/NITPICK (3-level) matching ace reference, not 4-level CRITICAL/HIGH/MEDIUM/LOW"
  - "Stack gate uses simple tag-based filtering instead of scoring thresholds"
  - "Finding dedup key is file+title, keeping higher severity on collision"

patterns-established:
  - "Agent catalog: frozen array of AgentDefinition objects with category/domain/catches/stackAffinity"
  - "Stack gate: STACK_GATE_RULES map + applyStackGate filter function"
  - "Team selection: selectReviewTeam returns {core, parallel, sequenced} grouped agents"
  - "Finding builder: createFinding validates via Zod and freezes, mergeFindings deduplicates and sorts"

requirements-completed: [REVW-02, REVW-03, REVW-05]

duration: 7min
completed: 2026-03-31
---

# Phase 5 Plan 01: Review Engine Data Layer Summary

**Review engine foundation with 21-agent catalog, Zod schemas, stack-gated team selection, severity system, and finding builder**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-31T17:13:43Z
- **Completed:** 2026-03-31T17:21:00Z
- **Tasks:** 6
- **Files created:** 13

## Accomplishments
- Complete Zod schema layer for review findings, reports, agent results, and config with defaults
- Agent catalog ported from ace reference with all 21 agents (3 core squad, 16 parallel specialists, 2 sequenced)
- Stack gate filtering that excludes technology-specific agents when project lacks matching stack tags
- Team selection logic that combines catalog + stack gate for intelligent agent selection
- Severity definitions with machine-readable criteria from ace, plus comparison and blocking utilities
- Finding builder with Zod validation, immutability, deduplication by file+title, and severity-sorted merging

## Task Commits

Each task was committed atomically:

1. **Task 1: Review Zod schemas and types** - `4fe49d5` (feat)
2. **Task 2: Severity definitions and comparison** - `99e4aa0` (feat)
3. **Task 3: Agent catalog registry** - `801f0d7` (feat)
4. **Task 4: Stack gate filtering** - `871875f` (feat)
5. **Task 5: Team selection logic** - `b8a1043` (feat)
6. **Task 6: Finding builder utilities** - `2aae1a5` (feat)
7. **Lint cleanup** - `0c33f8d` (chore)

## Files Created/Modified
- `src/review/schemas.ts` - Zod schemas for ReviewFinding, AgentResult, ReviewReport, ReviewConfig
- `src/review/types.ts` - TypeScript types inferred from schemas + AgentDefinition interface
- `src/review/severity.ts` - SEVERITY_DEFINITIONS, compareSeverity, isBlockingSeverity
- `src/review/agent-catalog.ts` - AGENT_CATALOG (21 agents), CORE_SQUAD, getAgentsByCategory
- `src/review/stack-gate.ts` - STACK_GATE_RULES, applyStackGate, detectStackTags
- `src/review/team-selection.ts` - selectReviewTeam, scoreAgent
- `src/review/finding-builder.ts` - createFinding, createAgentResult, mergeFindings
- `tests/review/*.test.ts` - 75 tests across 6 test files

## Decisions Made
- Used 3-level severity (CRITICAL/WARNING/NITPICK) matching the ace reference instead of 4-level, since the reference explicitly defines these three levels with distinct criteria and actions
- Stack gate uses simple tag presence check rather than scoring thresholds -- simpler and deterministic
- Finding dedup uses file+title as composite key, keeping the higher severity when findings collide from multiple agents
- detectStackTags infers from file extensions and framework-specific filenames (manage.py for Django, etc.)

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all modules are fully implemented with production logic.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Review data layer is complete, ready for pipeline orchestration (cross-verification, fix cycle, verdict)
- Agent catalog can be extended with additional language-specific agents
- Team selection can be enhanced with diff-aware scoring in a future plan

---
*Phase: 05-review-engine*
*Completed: 2026-03-31*
