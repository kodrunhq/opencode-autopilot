---
phase: 14-skills-commands
plan: 04
subsystem: skills
tags: [typescript, bun, go, python, rust, language-patterns, stack-gating]

# Dependency graph
requires:
  - phase: 14-skills-commands
    provides: coding-standards skill format (14-01)
provides:
  - Four language-specific pattern skills with stack-gated frontmatter
  - TypeScript/Bun patterns (type-level, runtime, testing, immutability)
  - Go patterns (error handling, concurrency, interfaces, testing)
  - Python patterns (type hints, pytest, async, project organization)
  - Rust patterns (ownership, Result/Option, unsafe guidelines, testing)
affects: [14-skills-commands, skill-injection, stack-gate]

# Tech tracking
tech-stack:
  added: []
  patterns: [stack-gated skill frontmatter with stacks array, language-specific anti-pattern catalogs]

key-files:
  created:
    - assets/skills/typescript-patterns/SKILL.md
    - assets/skills/go-patterns/SKILL.md
    - assets/skills/python-patterns/SKILL.md
    - assets/skills/rust-patterns/SKILL.md
  modified: []

key-decisions:
  - "All language skills follow same section pattern: core patterns, error handling, testing, anti-pattern catalog"
  - "TypeScript skill requires coding-standards as dependency; other language skills have no dependencies"
  - "Stack tags match exactly those in src/review/stack-gate.ts EXTENSION_TAGS"

patterns-established:
  - "Language skill format: YAML frontmatter with stacks array, 6-8 sections covering patterns/testing/anti-patterns, 200-300 lines"
  - "Anti-pattern catalog section: named anti-patterns with Instead: remediation"

requirements-completed: [SK-09, SK-10, SK-11, SK-12]

# Metrics
duration: 6min
completed: 2026-04-02
---

# Phase 14 Plan 04: Language Pattern Skills Summary

**Four stack-gated language skills (TypeScript/Bun, Go, Python, Rust) with type-level patterns, runtime idioms, testing conventions, and anti-pattern catalogs**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-02T19:03:35Z
- **Completed:** 2026-04-02T19:09:30Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- TypeScript/Bun patterns skill (278 lines) with type-level programming, Bun runtime APIs, bun:test patterns, immutability idioms, and performance patterns
- Go patterns skill (240 lines) with idiomatic error handling (%w wrapping), concurrency (context, errgroup), interface design, and table-driven testing
- Python patterns skill (255 lines) with type hints (Protocol, TypedDict), pytest fixtures/parametrize, async/await with TaskGroup, and pydantic validation
- Rust patterns skill (293 lines) with ownership/borrowing, Result/Option combinators, unsafe guidelines with SAFETY comments, and thiserror/anyhow patterns

## Task Commits

Each task was committed atomically:

1. **Task 1: Create TypeScript/Bun and Go pattern skills** - `75e0168` (feat)
2. **Task 2: Create Python and Rust pattern skills** - `fb52608` (feat)

## Files Created/Modified
- `assets/skills/typescript-patterns/SKILL.md` - TypeScript/Bun type-level, runtime, testing, immutability, performance patterns
- `assets/skills/go-patterns/SKILL.md` - Go error handling, concurrency, interfaces, testing, package organization
- `assets/skills/python-patterns/SKILL.md` - Python type hints, error handling, async, pytest, project organization
- `assets/skills/rust-patterns/SKILL.md` - Rust ownership, error handling, Option, unsafe, testing, crate organization

## Decisions Made
- All language skills follow the same structural pattern (6-8 sections) for consistency across languages
- TypeScript skill declares `requires: [coding-standards]` as a dependency per D-12; other languages are standalone
- Stack tags in frontmatter match exactly those defined in `src/review/stack-gate.ts` EXTENSION_TAGS map
- Each skill includes an anti-pattern catalog section with named anti-patterns and remediation guidance

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All four language-specific skills are ready for adaptive skill loading infrastructure
- Stack tags are consistent with existing stack-gate.ts detection system
- Skills can be loaded by the skill injection system when matching stacks are detected

---
*Phase: 14-skills-commands*
*Completed: 2026-04-02*
