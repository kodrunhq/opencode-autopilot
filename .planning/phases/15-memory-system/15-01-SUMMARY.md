---
phase: 15-memory-system
plan: 01
subsystem: database
tags: [sqlite, fts5, bun-sqlite, zod, sha256, memory]

requires: []
provides:
  - "SQLite memory database with FTS5 full-text search (src/memory/database.ts)"
  - "Repository CRUD + FTS5 search operations (src/memory/repository.ts)"
  - "Zod schemas for observation, project, preference (src/memory/schemas.ts)"
  - "TypeScript types inferred from schemas (src/memory/types.ts)"
  - "SHA-256 project key hashing (src/memory/project-key.ts)"
  - "Constants: type weights, injection budget, half-life, token ratio (src/memory/constants.ts)"
affects: [15-02, 15-03, memory-capture, memory-injection]

tech-stack:
  added: [bun:sqlite, FTS5]
  patterns: [database-singleton, external-content-fts5, trigger-sync, snake-to-camel-mapping]

key-files:
  created:
    - src/memory/database.ts
    - src/memory/repository.ts
    - src/memory/schemas.ts
    - src/memory/types.ts
    - src/memory/constants.ts
    - src/memory/project-key.ts
    - src/memory/index.ts
    - tests/memory/database.test.ts
    - tests/memory/repository.test.ts
    - tests/memory/project-key.test.ts
  modified: []

key-decisions:
  - "Database singleton with lazy init accepts optional dbPath for testability with :memory:"
  - "initMemoryDb extracted as public function for test setup without singleton"
  - "Repository functions accept optional db parameter defaulting to getMemoryDb()"
  - "Snake-case DB columns mapped to camelCase TypeScript via explicit row mappers"
  - "FTS5 external content table with 3 triggers (insert/delete/update) for auto-sync"

patterns-established:
  - "Database singleton: module-level let + getMemoryDb(dbPath?) + closeMemoryDb()"
  - "Repository functions: optional db param for testability, Zod validation on insert"
  - "Row mapping: snake_case DB -> camelCase TS via rowTo* helper functions"

requirements-completed: [MEM-01, MEM-02, MEM-03]

duration: 4min
completed: 2026-04-02
---

# Phase 15 Plan 01: Memory Storage Layer Summary

**SQLite database with FTS5 full-text search, Zod-validated repository CRUD, BM25-ranked search, and SHA-256 project key hashing**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-02T20:24:37Z
- **Completed:** 2026-04-02T20:28:50Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Complete SQLite storage layer with WAL mode, foreign keys, and FTS5 virtual table
- FTS5 validated working with BM25 ranking (satisfies D-11 blocking prerequisite)
- Repository with typed CRUD operations: insert, search, upsert, get, delete for observations, projects, and preferences
- Zod schemas enforce validation on all inserts; types inferred from schemas
- 51 tests passing across 3 test files

## Task Commits

Each task was committed atomically:

1. **Task 1: Memory schemas, types, constants, and project-key module** - `ab1150e` (feat)
2. **Task 2: SQLite database singleton with FTS5 and repository CRUD** - `044c851` (feat)

_TDD workflow: tests written first (RED), then implementation (GREEN), then format/lint pass._

## Files Created/Modified
- `src/memory/constants.ts` - Type weights, injection budget, half-life, token ratio, observation types
- `src/memory/schemas.ts` - Zod schemas for observation, project, preference
- `src/memory/types.ts` - TypeScript types inferred from schemas
- `src/memory/project-key.ts` - SHA-256 project path hashing
- `src/memory/database.ts` - SQLite singleton with lazy init, WAL mode, FTS5, migrations
- `src/memory/repository.ts` - CRUD + FTS5 search operations with BM25 ranking
- `src/memory/index.ts` - Barrel export for complete public API
- `tests/memory/project-key.test.ts` - 22 tests for schemas, types, constants, project-key
- `tests/memory/database.test.ts` - 11 tests for database creation, FTS5, singleton behavior
- `tests/memory/repository.test.ts` - 18 tests for all repository operations

## Decisions Made
- Extracted `initMemoryDb` as public function so tests can init :memory: databases without going through the singleton
- Repository functions accept optional `db` parameter defaulting to `getMemoryDb()` for testability
- Used explicit row mapper functions (rowToObservation, rowToProject, rowToPreference) for snake_case-to-camelCase conversion
- FTS5 search filters by projectId (null for user-level) using dynamic WHERE clause

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## Known Stubs

None - all functionality is fully wired and tested.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Storage layer fully operational for Plans 02 (capture) and 03 (injection)
- FTS5 validated working (D-11 satisfied)
- All data stored in global config space via getGlobalConfigDir() (D-06, D-07)
- Project-level (with project_id) and user-level (NULL project_id) scopes work (D-01, D-04)

---
*Phase: 15-memory-system*
*Completed: 2026-04-02*
