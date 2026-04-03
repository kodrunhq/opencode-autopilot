---
phase: 22-production-hardening
plan: 04
subsystem: hooks
tags: [anti-slop, regex, code-quality, PostToolUse]

requires: []
provides:
  - "Anti-slop PostToolUse hook detecting AI comment bloat in 13 code file types"
  - "Curated regex pattern list for obvious/sycophantic comments"
  - "Non-blocking warning via showToast on slop detection"
affects: [production-hardening, code-quality]

tech-stack:
  added: []
  patterns: ["comment-only regex matching to avoid false positives on code tokens"]

key-files:
  created:
    - src/hooks/slop-patterns.ts
    - src/hooks/anti-slop.ts
    - tests/hooks/anti-slop.test.ts
  modified:
    - src/index.ts

key-decisions:
  - "Scan output.output (tool output) rather than re-reading files to avoid stale reads"
  - "Comment-only matching: extract comment text first, then test against slop patterns"
  - "Warn-only via showToast (non-blocking, best-effort, try/catch wrapped)"

patterns-established:
  - "Hook pattern: createXxxHandler factory returning tool.execute.after-shaped async function"
  - "Comment extraction: EXT_COMMENT_STYLE -> COMMENT_PATTERNS -> SLOP_PATTERNS pipeline"

requirements-completed: [HARD-04]

duration: 3min
completed: 2026-04-03
---

# Phase 22 Plan 04: Anti-Slop Comment Hook Summary

**PostToolUse hook scanning 13 code file types for AI comment bloat using curated regex patterns with comment-only matching to avoid false positives**

## What Was Built

1. **Slop pattern definitions** (`src/hooks/slop-patterns.ts`): Frozen constants for CODE_EXTENSIONS (13 types), EXT_COMMENT_STYLE (extension-to-prefix map), COMMENT_PATTERNS (prefix-to-regex map), and SLOP_PATTERNS (19 curated regexes for obvious/sycophantic comments).

2. **Anti-slop detection logic** (`src/hooks/anti-slop.ts`): Three exports -- `isCodeFile` (extension check), `scanForSlopComments` (comment extraction + pattern matching), `createAntiSlopHandler` (factory returning tool.execute.after handler). Scans only comment text, not code tokens, to prevent false positives like `const robust = true`.

3. **Hook registration** (`src/index.ts`): Anti-slop handler initialized with `sdkOps.showToast` and called in `tool.execute.after` after fallback handling, wrapped in try/catch for best-effort behavior.

## Task Completion

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Slop patterns and anti-slop detection logic | 6a0d9d3 | src/hooks/slop-patterns.ts, src/hooks/anti-slop.ts, tests/hooks/anti-slop.test.ts |
| 2 | Register anti-slop hook in plugin entry | 82db082 | src/index.ts |

## Verification Results

- `bun test tests/hooks/anti-slop.test.ts tests/index.test.ts` -- 27 tests pass
- `bun run lint` -- no errors in new/modified files
- Code file detection: .ts, .py, .go, .java confirmed
- Non-code files (.md, .json) correctly skipped
- False positive avoidance: "robust" in code vs comment verified

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

None -- all functionality is fully wired.
