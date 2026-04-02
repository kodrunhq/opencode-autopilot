# Phase 13: Session Observability - Context

**Gathered:** 2026-04-02
**Updated:** 2026-04-02 (post Phase 11 research — expanded from 6 to 12 features)
**Status:** Ready for planning

<domain>
## Phase Boundary

Full plugin observability system: structured event logging, token/cost tracking, pipeline decision replay, context window monitoring, session analysis reports, TUI dashboard, retention management, and mock provider for fallback testing. Covers 13 gap IDs (1 CRITICAL, 9 HIGH, 2 MEDIUM, 1 HIGH test).

</domain>

<decisions>
## Implementation Decisions

### Structured event logging (OB-01, CRITICAL) — from initial discussion
- **D-01:** Two-tier logging: structured JSON events + human-readable session summaries generated from them
- **D-02:** Structured events capture each discrete occurrence: fallback triggers, errors, autopilot decisions, model switches, with timestamp, context, and outcome
- **D-03:** Session summaries are generated from structured events — one summary per session

### What to log — from initial discussion
- **D-04:** Fallback events — which model failed, which tried next, success/failure
- **D-05:** Error events — classified by the existing error classifier (retryable, terminal, model-specific)
- **D-06:** Autopilot decision events — every autonomous decision with rationale
- **D-07:** Model switch events — when a model override happens

### Storage — from initial discussion
- **D-08:** Logs persist in `~/.config/opencode/logs/`
- **D-09:** NOT in the project directory — user-scoped
- **D-10:** Structured events as JSON files (one per session)
- **D-11:** Session summaries as human-readable markdown

### Data retention — from initial discussion
- **D-12:** Time-based: auto-prune logs older than 30 days (configurable)
- **D-13:** Retention period configurable in plugin settings
- **D-14:** Pruning runs on plugin load (non-blocking)

### TUI dashboard — from initial discussion
- **D-15:** Rich TUI dashboard accessible via `/logs` command
- **D-16:** List sessions, view detail, search/filter events, time-based filtering
- **D-17:** Session timeline, error highlighting, filterable columns
- **D-18:** Implemented as `oc_logs` tool

### Mock provider — from initial discussion
- **D-19:** Configurable failure mode: rate limit, quota exceeded, timeout, malformed response
- **D-20:** Failure type configurable per-test, not random
- **D-21:** Integrates with existing fallback chain for end-to-end validation
- **D-22:** Usable for automated tests and manual exploration

### Token / cost tracking (OB-02, HIGH) — NEW from Phase 11
- **D-23:** Per-session totals: total input/output tokens, broken down by pipeline phase (RECON, BUILD, etc.)
- **D-24:** Low overhead — aggregate counters, not per-call logging
- **D-25:** Token summary appears as a section in the TUI dashboard session detail view (not a separate command)
- **D-26:** Cost estimates based on model pricing (if available from provider metadata)

### Pipeline decision replay (OB-04, NV-04, HIGH) — NEW from Phase 11
- **D-27:** Each autonomous decision captured with: what was decided, why, confidence level
- **D-28:** Format: `{ decision, rationale, confidence, phase, agent, timestamp }` — compact, actionable
- **D-29:** `/pipeline-report` command shows post-session summary: phases executed, decisions at each phase, total time/tokens, outcome
- **D-30:** Read-only report — no interactive replay or what-if overrides

### Session commands (CM-04, CM-05, HIGH) — NEW from Phase 11
- **D-31:** `/session-stats` command — token counts, tool breakdown, duration, cost per session
- **D-32:** `/pipeline-report` command — post-run decision trace with phase-by-phase breakdown
- **D-33:** Both implemented as `oc_` tools following existing pattern

### Context window monitoring (HK-04, HIGH) — NEW from Phase 11
- **D-34:** Emit structured event when context hits 80% utilization
- **D-35:** Show toast warning: "⚠ Context at 82% — consider compacting"
- **D-36:** Non-blocking, informational — toast fires once at threshold, not repeatedly

### Session error capture hook (HK-09, HIGH) — NEW from Phase 11
- **D-37:** Reuse existing fallback error classifier — pipe classification output into event log
- **D-38:** No new classification system — existing categories (retryable, terminal, model-specific) are sufficient

### Tool usage metrics hook (HK-10, HIGH) — NEW from Phase 11
- **D-39:** Per tool.execute.after: tool name, invocation count, duration (ms), success/failure
- **D-40:** Aggregated per session — not raw per-call logs
- **D-41:** Feeds into /session-stats command and dashboard

### Session analysis (OB-06, MEDIUM) — NEW from Phase 11
- **D-42:** Post-session analysis report with strategic guidance
- **D-43:** Generates from structured events — decisions made, phases executed, token cost, findings

### Context utilization dashboard (OB-07, MEDIUM) — NEW from Phase 11
- **D-44:** TUI-compatible context utilization display
- **D-45:** Shows current token budget and subsystem allocation

### Claude's Discretion
- JSON event schema design (field names, nesting, versioning)
- TUI dashboard layout and interaction patterns
- Mock provider registration with OpenCode's provider system
- Session ID generation strategy
- Whether summaries are generated on-demand or eagerly after session end
- How context monitoring hooks into OpenCode's session events
- Token counting mechanism (provider metadata vs estimate)

</decisions>

<specifics>
## Specific Ideas

- "Give the user the ability to understand, post session, what happened"
- "Did fallbacks happen? What were the errors? Did the autopilot agent take decisions? Which ones?"
- The dashboard should feel like a real observability tool, not a glorified log viewer
- Mock provider should be a "dummy model inserted in the providers" — feels like a real provider
- Token tracking should be low-overhead — aggregates, not per-call recording

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 11 research (gap definitions)
- `.planning/phases/11-ecosystem-research/11-GAP-MATRIX.md` — Gap IDs OB-01, OB-02, OB-03, OB-04, OB-06, OB-07, CM-04, CM-05, HK-04, HK-09, HK-10, NV-04, TS-03
- `.planning/phases/11-ecosystem-research/11-PHASE-SCOPES.md` §Phase 13 — Feature definitions and scope

### Fallback system (event sources)
- `src/pipeline/fallback/` — Fallback manager, error classifier, state machine
- `src/pipeline/fallback/types.ts` — Error classification types
- `src/pipeline/fallback/classifier.ts` — Error classifier (reuse for HK-09)
- `src/schemas.ts` — Zod schemas including fallback config

### Orchestrator (decision event sources)
- `src/pipeline/orchestrate.ts` — Orchestrator core with phase handlers
- `src/pipeline/handlers/` — Phase handlers that make autonomous decisions
- `src/orchestrator/state.ts` — Pipeline state (decision log source)

### Plugin hooks (integration points)
- `src/index.ts` — Plugin entry with hook registrations
- `src/health/` — Health check module from Phase 12 (pattern reference)

### Config system
- `src/config.ts` — Config v4 schema, migration chain (extend for logging settings)
- `src/utils/paths.ts` — `getGlobalConfigDir()` for log storage path

### Existing tools (pattern reference)
- `src/tools/doctor.ts` — Recent tool following *Core + tool() pattern (Phase 12)
- `src/tools/quick.ts` — Recent tool following same pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Error classifier (`src/pipeline/fallback/classifier.ts`) — pipe into event log for HK-09
- Fallback state machine — emit events on transitions
- Health check module (`src/health/`) — pattern for composable check functions
- Config migration chain (v1→v2→v3→v4) — extend to v5 for logging settings
- Event hook system in `src/index.ts` — tap existing hooks
- Toast via `tui.toast.show` — used by health checks, reuse for context warnings

### Established Patterns
- Tool registration: `*Core` function + `tool()` wrapper
- `oc_` prefix on all tool names
- Zod validation on schemas
- Atomic file writes (temp-file-then-rename)
- `node:fs/promises` for all I/O
- Global config directory for user-scoped data

### Integration Points
- `src/index.ts` — register new tools (oc_logs, oc_session_stats, oc_pipeline_report), add hooks
- Event hooks — tap session.created, session.error, tool.execute.after
- Fallback manager — add event emission on state transitions
- Orchestrator handlers — add decision event emission
- Plugin load lifecycle — add retention pruning
- `~/.config/opencode/logs/` — new directory for event storage

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 13-session-observability*
*Context gathered: 2026-04-02*
*Updated: 2026-04-02 (post Phase 11 research — expanded from 6 to 12 features, 22 to 45 decisions)*
