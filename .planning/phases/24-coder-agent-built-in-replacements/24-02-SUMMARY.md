---
phase: 24-coder-agent-built-in-replacements
plan: 02
subsystem: tools
tags: [fnv1a, cid-alphabet, hash-anchored-edit, file-editing]

# Dependency graph
requires: []
provides:
  - "oc_hashline_edit tool for hash-anchored file editing with stale-line detection"
  - "computeLineHash and CID_ALPHABET exports for LINE#ID generation"
affects: [24-coder-agent-built-in-replacements]

# Tech tracking
tech-stack:
  added: []
  patterns: [FNV-1a hashing, CID alphabet encoding, bottom-up edit ordering]

key-files:
  created: [src/tools/hashline-edit.ts, tests/tools/hashline-edit.test.ts]
  modified: [src/index.ts]

key-decisions:
  - "Bottom-up (descending line number) edit application prevents line-number drift without offset tracking"
  - "2-char CID hash from 16-char alphabet gives collision-resistant anchors for typical file sizes"

patterns-established:
  - "Hash-anchored editing: LINE#HASH format for stale-safe file edits"
  - "Error recovery with surrounding anchors: on mismatch, return 2 lines above/below with updated LINE#ID"

requirements-completed: []

# Metrics
duration: 3min
completed: 2026-04-03
---

# Phase 24 Plan 02: oc_hashline_edit Summary

**Hash-anchored file edit tool using FNV-1a + CID alphabet for stale-line-safe replace/append/prepend operations**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-03T21:16:23Z
- **Completed:** 2026-04-03T21:19:11Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments
- Implemented oc_hashline_edit tool with FNV-1a 32-bit hashing and omo's CID alphabet (ZPMQVRWSNKTXJBYH)
- Three edit operations: replace (single/range), append, prepend with null-for-delete support
- Stale edit rejection returns updated LINE#ID anchors for surrounding lines enabling retry
- Bottom-up edit ordering prevents line-number drift on multi-edit calls
- 17 tests covering all operations, error recovery, and edge cases

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement oc_hashline_edit core logic and tool registration**
   - `24cc299` (test: add failing tests for oc_hashline_edit tool)
   - `b9e275e` (feat: implement oc_hashline_edit tool with FNV-1a hashing and CID alphabet)

## Files Created/Modified
- `src/tools/hashline-edit.ts` - Hash-anchored edit tool with FNV-1a, CID alphabet, 3 operations, error recovery
- `tests/tools/hashline-edit.test.ts` - 17 tests for computeLineHash, parseAnchor, and all edit operations
- `src/index.ts` - Registered oc_hashline_edit in tool map

## Decisions Made
- Bottom-up edit ordering (sort by descending line number) chosen over offset tracking for simplicity
- Error recovery returns 2 surrounding lines above/below for context on hash mismatch
- Used `node:fs/promises` readFile/writeFile per CLAUDE.md constraint (no Bun.file/Bun.write)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- oc_hashline_edit available for coder agent to use in autonomous sessions
- computeLineHash and CID_ALPHABET exported for use by hashline-read tool (plan 01)

---
*Phase: 24-coder-agent-built-in-replacements*
*Completed: 2026-04-03*
