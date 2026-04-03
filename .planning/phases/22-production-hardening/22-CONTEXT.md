# Phase 22: Production Hardening - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the plugin resilient to model failures in test scenarios, auto-detect project language for commands, extend self-diagnostics with skill/memory/command checks, and prevent AI comment bloat via a PostToolUse hook. Four orthogonal workstreams — no new user-facing tools.

</domain>

<decisions>
## Implementation Decisions

### Mock Fallback Test Mode (HARD-01)
- **D-01:** Activation via config flag only. Add a `fallback.testMode` field to plugin config with a v6 migration. User enables via `oc_configure` CLI. No runtime toggle tool.
- **D-02:** Simulate all four failure scenarios: rate limit (429), quota exceeded, service unavailable (503), and malformed response.
- **D-03:** Deterministic sequence triggering. Config specifies an ordered list of failure types. Each model call hits the next failure in sequence, then cycles. Predictable and reproducible.
- **D-04:** Implementation builds on existing `src/orchestrator/fallback/error-classifier.ts` patterns and `fallback-manager.ts` state machine. The mock layer intercepts before real API calls when testMode is active.

### Context-Aware Commands (HARD-02)
- **D-05:** Inject detected language via a `$LANGUAGE` variable into command prompts, similar to how `$ARGUMENTS` works today. The skill injection layer (or a new pre-command hook) resolves `detectProjectStackTags()` and makes the result available.
- **D-06:** Four commands become language-aware: `oc-tdd`, `oc-review-pr`, `oc-brainstorm`, `oc-write-plan`. Each command's markdown prompt references `$LANGUAGE` to adapt its guidance.
- **D-07:** Stack detection reuses `detectProjectStackTags()` from `src/skills/adaptive-injector.ts` — no duplication. The detection already handles `MANIFEST_TAGS` + `EXT_MANIFEST_TAGS`.

### Skill-Aware Doctor (HARD-03)
- **D-08:** Skill diagnostics show a per-stack summary: detected stacks and how many skills matched/loaded for each (e.g., "typescript: 3/5 skills loaded"). Concise and actionable.
- **D-09:** Memory DB health check: verify SQLite DB file exists and is readable, report observation count and last-captured date. Lightweight — covers the common failure mode (missing/corrupt DB).
- **D-10:** Command accessibility check: verify each expected command .md file exists in target directory AND parse YAML frontmatter to verify description and argument-hint are present. Catches both missing and corrupted commands.
- **D-11:** New checks added to `src/health/checks.ts` following the existing `HealthResult` pattern with `Object.freeze()`.

### Anti-Slop Comment Hook (HARD-04)
- **D-12:** Warn only — print a warning with offending lines when slop comments are detected. Non-blocking. Good default for v1 since false positives are likely.
- **D-13:** Detection via a curated regex pattern list matching common AI comment slop: "increment.*by 1", "this function.*does", "elegantly", "robust", "comprehensive", etc. Fast, deterministic, easy to extend.
- **D-14:** Fires on all code file types: .ts, .tsx, .js, .jsx, .py, .go, .rs, .java, .cs, .rb, .cpp, .c, .h. Skips non-code files (.md, .json, .yaml).
- **D-15:** Implemented as a PostToolUse hook registered in `src/index.ts` alongside existing hooks. Hook reads the edited file content and runs the pattern list against comment lines.

### Claude's Discretion
- Exact regex patterns for the anti-slop list (within the "obvious comments + sycophantic language" scope)
- How `$LANGUAGE` variable is resolved and injected (hook vs inline in injection layer)
- Comment syntax detection per language (single-line // vs # vs --)
- Config v6 schema for testMode (exact field structure and defaults)
- How mock failures integrate with the existing fallback state machine
- Doctor output formatting (table vs list)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Fallback System
- `src/orchestrator/fallback/error-classifier.ts` — Existing retryable error patterns (15+ regexes) that mock mode simulates
- `src/orchestrator/fallback/fallback-manager.ts` — State machine and dispatch logic where mock interception happens
- `src/orchestrator/fallback/fallback-state.ts` — Immutable state transitions mock mode must respect
- `src/orchestrator/fallback/types.ts` — ErrorType and fallback config types to extend
- `src/orchestrator/fallback/fallback-config.ts` — Existing fallback configuration

### Stack Detection
- `src/skills/adaptive-injector.ts` — `detectProjectStackTags()`, `MANIFEST_TAGS`, `EXT_MANIFEST_TAGS` — reuse for $LANGUAGE
- `src/review/stack-gate.ts` — `EXTENSION_TAGS` for diff-path detection (complementary)

### Health System
- `src/health/checks.ts` — Existing health checks (config, agent, asset) — extend with new checks
- `src/health/types.ts` — `HealthResult` type to follow
- `src/health/runner.ts` — Health check runner to register new checks with
- `src/tools/doctor.ts` — Doctor tool that invokes the health runner

### Config System
- `src/config.ts` — Zod schema, v1-v5 migration chain — add v6 migration for testMode

### Plugin Entry
- `src/index.ts` — Hook registration point for anti-slop PostToolUse hook

### Commands
- `assets/commands/oc-tdd.md` — Primary command to make language-aware
- `assets/commands/oc-review-pr.md` — PR review command
- `assets/commands/oc-brainstorm.md` — Brainstorm command
- `assets/commands/oc-write-plan.md` — Plan writing command

### Memory System
- `src/memory/database.ts` — SQLite DB operations for memory health check
- `src/memory/repository.ts` — CRUD operations to query observation count

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `detectProjectStackTags()` in adaptive-injector.ts: Already detects languages from manifest files — reuse for $LANGUAGE injection
- `RETRYABLE_ERROR_PATTERNS` in error-classifier.ts: 15+ regex patterns for rate-limit, quota, 503 — mock mode simulates these exact error shapes
- `HealthResult` type in health/types.ts: Frozen result objects with name/status/message — new checks follow this pattern
- `loadConfig()` and migration chain in config.ts: v1→v5 migration pattern to extend with v6

### Established Patterns
- **Health checks**: Pure async functions returning `Object.freeze()`d `HealthResult` objects
- **Config migration**: Each version adds a migration function in the chain, bumps version number
- **Hook registration**: Hooks registered in `src/index.ts` default export alongside tools and config hook
- **Regex-based detection**: Both error-classifier and stack-gate use curated regex/pattern lists — same pattern for slop detection

### Integration Points
- `src/index.ts`: Register anti-slop PostToolUse hook
- `src/config.ts`: Add testMode to fallback config, bump to v6
- `src/health/runner.ts`: Register new skill, memory, and command health checks
- Command markdown files: Add `$LANGUAGE` references to adapt prompts

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for all four workstreams.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 22-production-hardening*
*Context gathered: 2026-04-03*
