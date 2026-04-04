# Phase 26: Pipeline Hardening — Context

**Created:** 2026-04-04
**Trigger:** Live failure of orchestration pipeline on Gloomberg project (session `ses_2aa4a650bffejaeA3Bwk3IRefw`)

## Background

The opencode-autopilot plugin was tested against a real Python trading platform project (Gloomberg). The orchestration pipeline failed catastrophically:

- **Infinite loop:** ARCHITECT handler dispatched 14+ times without advancing
- **Path mismatch:** Files written to `{project}/phases/` instead of `{project}/.opencode-autopilot/phases/`
- **Context bloat:** ~32KB of skill text injected per dispatch (methodology skills with empty stacks always included)
- **No logs:** Session logs only flush on session end; infinite loop = no flush = no logs
- **No memory writes:** Orchestrator never emits events that memory capture listens for
- **No user visibility:** No phase numbers, no progress indicators, no indication of what the autopilot is doing

## Analysis Sources

1. **Live session transcript** — 30-minute recording of the failure, showing 14+ identical ARCHITECT dispatches
2. **Claude Code codebase exploration** — 3 parallel agents mapped the full orchestrator (73 files, 6661 lines)
3. **Claude Opus Desktop review** — Full codebase audit identifying 22 issues (2 P0, 5 P1, 8 P2, 7 P3)

## Key Decisions

- **Absolute paths everywhere:** `getArtifactRef` will require `artifactDir` and return absolute paths. No more relative refs in prompts.
- **Circuit breaker over handler fixes:** Even after fixing the ARCHITECT handler, we add per-phase max dispatch counts as defense-in-depth.
- **Skill summaries over full content:** Orchestration dispatches get frontmatter summaries (200 chars/skill), not full 13KB skill bodies.
- **Phase-aware skill filtering:** Each phase gets only the 1-2 skills relevant to it, not all methodology skills.
- **Empty confidence = HIGH:** No evidence of low confidence should not trigger expensive multi-proposal arena.
- **Numbered folders:** `01-RECON/`, `02-CHALLENGE/` etc. for user clarity.
- **Append-only JSONL logging:** Project-local `orchestration.jsonl` survives crashes (unlike session-end-only logs).

## Non-Goals for Phase 26

- handleBuild refactor (402-line conditional tree) — needs its own phase
- Memory DB singleton replacement — works for serial execution
- extractJson parser rewrite — edge cases, not pipeline-breaking
