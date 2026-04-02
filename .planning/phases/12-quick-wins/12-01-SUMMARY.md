---
phase: 12-quick-wins
plan: "01"
subsystem: tooling
tags: [configure, model-discovery, zen-provider, cli]

requires:
  - phase: 10-ux-polish
    provides: configure wizard with model groups and diversity checks
provides:
  - Fixed model ID construction using model.id field for sub-provider paths
  - Zen-proxied models display as zen/provider/model matching OpenCode native output
affects: [13-session-observability, configure-wizard]

tech-stack:
  added: []
  patterns: [model.id-over-record-key for provider-prefixed paths]

key-files:
  created: []
  modified:
    - src/tools/configure.ts
    - tests/tools/configure.test.ts

key-decisions:
  - "Use modelData.id field over Object.keys record key for full provider path construction"
  - "Fall back to record key when model.id is empty (backwards-compatible)"

patterns-established:
  - "Model discovery: prefer model.id for path construction, fall back to record key"

requirements-completed: []

duration: 2min
completed: 2026-04-02
---

# Phase 12 Plan 01: Fix Zen Model Provider Prefix Summary

**Fixed configure wizard model discovery to use model.id field, preserving Zen sub-provider prefixes (zen/anthropic/model) for correct Go vs Zen distinction**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-02T13:10:28Z
- **Completed:** 2026-04-02T13:12:32Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Fixed `discoverAvailableModels()` to use `modelData.id` instead of record key, preserving sub-provider paths like `anthropic/claude-opus-4-6` under a `zen` provider
- Users can now distinguish Go (direct) vs Zen (proxied) providers when selecting models in the configure wizard
- Added 4 targeted tests covering Zen prefix preservation, Go vs Zen distinction, id-over-key precedence, and empty-id fallback

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix model ID construction in configure.ts** - `06d3f32` (fix)
2. **Task 2: Add Zen provider model discovery tests** - `b26e44e` (test)

## Files Created/Modified

- `src/tools/configure.ts` - Fixed `discoverAvailableModels()` to iterate `Object.entries(provider.models)` and use `modelData.id || modelKey` for full path construction
- `tests/tools/configure.test.ts` - Added 4 tests: Zen sub-provider prefix, Go vs Zen distinction, id-over-key precedence, empty-id fallback

## Decisions Made

- **Use modelData.id over record key:** The model's `id` field carries the canonical identifier including sub-provider paths. The record key may be simplified. Using `modelData.id || modelKey` is backwards-compatible.
- **No changes to configure-tui.ts:** The CLI wizard uses `opencode models` CLI output which already includes correct provider prefixes. Only the SDK-based tool path needed fixing.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Next Phase Readiness

- Configure wizard correctly shows all provider-prefixed model IDs
- Ready for Phase 13 (Session Observability) or additional Phase 12 quick wins

## Self-Check: PASSED

---
*Phase: 12-quick-wins*
*Completed: 2026-04-02*
