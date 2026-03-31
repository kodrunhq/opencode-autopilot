---
phase: 04-foundation-infrastructure
plan: 02
subsystem: config
tags: [zod, schema-migration, config-v2, orchestrator, confidence]

requires:
  - phase: 03-curated-assets
    provides: v1 config system (loadConfig, saveConfig, isFirstLoad, createDefaultConfig)
provides:
  - Config v2 schema with orchestrator and confidence namespaces
  - Auto-migration from v1 to v2 on load
  - Exported orchestratorConfigSchema and confidenceConfigSchema for downstream tools
affects: [04-03, 04-04, phase-05]

tech-stack:
  added: []
  patterns: [pre-computed Zod defaults for nested object schemas, version-discriminated config migration]

key-files:
  created: [tests/config.test.ts]
  modified: [src/config.ts]

key-decisions:
  - "Pre-compute nested Zod defaults to work around Zod v4 not resolving inner defaults on .default({})"
  - "V1 schema kept as internal-only for migration; pluginConfigSchema alias points to V2"
  - "Auto-persist migrated config to disk on v1 detection (no silent in-memory-only migration)"

patterns-established:
  - "Version-discriminated config migration: try v2 parse, fall back to v1 parse + migrate"
  - "Pre-computed Zod defaults: parse({}) once at module level, reuse for default values"

requirements-completed: [TOOL-02, ORCH-04]

duration: 3min
completed: 2026-03-31
---

# Phase 04 Plan 02: Config V2 Schema Summary

**Config v2 schema with orchestrator (autonomy/strictness/phase-toggles) and confidence (enabled/thresholds) namespaces, plus transparent v1-to-v2 auto-migration**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-31T14:04:19Z
- **Completed:** 2026-03-31T14:07:31Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 2

## Accomplishments
- Extended config from v1 to v2 with orchestrator and confidence namespaces
- Auto-migration: existing v1 configs transparently upgrade to v2 on load and persist back to disk
- All existing exports preserved (loadConfig, saveConfig, isFirstLoad, createDefaultConfig, PluginConfig)
- Exported orchestratorConfigSchema and confidenceConfigSchema for use by downstream tools (Plan 04-03, 04-04)
- 17 config tests passing (up from 9), covering migration, validation, defaults, and round-trips

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Failing tests for v2 schema** - `0e00d72` (test)
2. **Task 1 (GREEN): Config v2 implementation with migration** - `b74830a` (feat)

_TDD task with RED and GREEN commits._

## Files Created/Modified
- `src/config.ts` - V2 schema with orchestratorConfigSchema, confidenceConfigSchema, migrateV1toV2, updated loadConfig/createDefaultConfig
- `tests/config.test.ts` - 17 tests covering v2 defaults, v1 migration, validation rejection, round-trips

## Decisions Made
- Pre-compute nested Zod defaults at module level because Zod v4 `.default({})` does not recursively resolve inner field defaults
- Keep pluginConfigSchemaV1 as internal-only (not exported) since it is only needed for migration
- Auto-persist migrated v2 config back to disk when v1 is detected, so migration is a one-time operation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Zod v4 nested default resolution**
- **Found during:** Task 1 (GREEN phase)
- **Issue:** Zod v4 `.default({})` on nested objects does not fill inner field defaults -- `phases` and `thresholds` came back as empty objects
- **Fix:** Pre-compute defaults via `.parse({})` at module level, use those resolved objects as `.default()` values
- **Files modified:** src/config.ts
- **Verification:** All 17 tests pass including deep default assertions
- **Committed in:** b74830a

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix for correctness. No scope creep.

## Issues Encountered
None beyond the Zod default resolution issue documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Config v2 schema ready for consumption by Plan 04-03 (state machine) and Plan 04-04 (tool registration)
- orchestratorConfigSchema and confidenceConfigSchema exported for downstream use
- No blockers

---
*Phase: 04-foundation-infrastructure*
*Completed: 2026-03-31*
