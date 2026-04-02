# Phase 13: Session Observability - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Full session observability system: structured event logging for fallbacks, errors, and autopilot decisions; human-readable session summaries; global persistence with time-based retention; rich TUI dashboard for navigating logs; and a configurable mock provider for testing the fallback chain end-to-end.

</domain>

<decisions>
## Implementation Decisions

### Log detail level
- **D-01:** Two-tier logging: structured JSON events + human-readable session summaries generated from them
- **D-02:** Structured events capture each discrete occurrence: fallback triggers, errors, autopilot decisions, model switches, with timestamp, context, and outcome
- **D-03:** Session summaries are generated from structured events — one summary per session showing what happened, what failed, what decisions were made

### What to log
- **D-04:** Fallback events — when a fallback was triggered, which model failed, which model was tried next, success/failure of fallback
- **D-05:** Error events — model errors (rate limit, quota, timeout, malformed), classified by the existing error classifier
- **D-06:** Autopilot decision events — every autonomous decision made by the orchestrator/autopilot agent, with rationale
- **D-07:** Model switch events — when a model override happens (via fallback or user config)

### Storage
- **D-08:** Logs persist in the global config directory: `~/.config/opencode/logs/`
- **D-09:** NOT in the project directory — logs are user-scoped, not project-scoped
- **D-10:** Structured events stored as JSON files (one per session)
- **D-11:** Session summaries as human-readable markdown (generated from JSON events)

### Data retention
- **D-12:** Time-based retention: auto-prune logs older than 30 days
- **D-13:** Retention period configurable in plugin settings
- **D-14:** Pruning runs on plugin load (non-blocking)

### CLI navigation
- **D-15:** Rich TUI dashboard — not just a simple viewer
- **D-16:** Commands: list sessions, view session detail, search/filter events, time-based filtering
- **D-17:** Dashboard should show session timeline, error highlighting, filterable columns — like a mini observability tool
- **D-18:** Should be accessible via a plugin command (e.g., `/logs` or `/session-logs`)

### Fallback testing infrastructure
- **D-19:** Configurable failure mode mock provider — can simulate specific failures: rate limit, quota exceeded, timeout, malformed response
- **D-20:** Failure type is configurable per-test, not random
- **D-21:** Mock provider integrates with the existing fallback chain to validate end-to-end behavior
- **D-22:** Should be usable both for automated tests and for manual "let me see what happens when X fails"

### Claude's Discretion
- JSON event schema design (field names, nesting, versioning)
- TUI dashboard layout and interaction patterns
- How to register the mock provider with OpenCode's provider system
- Session ID generation strategy
- Whether session summaries are generated on-demand or eagerly after session end

</decisions>

<specifics>
## Specific Ideas

- "Give the user the ability to understand, post session, what happened"
- "Did fallbacks happen? What were the errors? Did the autopilot agent take decisions? Which ones?"
- The dashboard should feel like a real observability tool, not a glorified log viewer
- Mock provider should be a "dummy model inserted in the providers" — feels like a real provider to the system

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Fallback system (what generates the events to log)
- `src/pipeline/fallback/` — Fallback manager, error classifier, state machine, message replay
- `src/pipeline/fallback/types.ts` — Error classification types, fallback state types
- `src/schemas.ts` — Zod schemas including fallback config

### Orchestrator (source of autopilot decision events)
- `src/pipeline/orchestrate.ts` — Orchestrator core with phase handlers
- `src/pipeline/handlers/` — Phase handlers that make autonomous decisions

### Plugin hooks (where logging taps in)
- `src/index.ts` — Plugin entry with hook registrations (chat.message, tool.execute.after, event hooks)

### Config system (where retention settings live)
- `src/config.ts` — Config schema, load/save, migration chain

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Error classifier (`src/pipeline/fallback/classifier.ts`) — already classifies model errors, can feed log events
- Fallback state machine — transitions are already tracked, just need to emit events
- Config v3 schema — already has fallback settings namespace, can extend for logging settings
- Event hook system — `event` hook already fires on orchestrator events

### Established Patterns
- Atomic file writes (temp-file-then-rename) — use for log file writes
- Zod validation on all schemas — use for log event schema
- Config migration chain (v1->v2->v3->v4) — extend for logging config

### Integration Points
- Event hooks in `src/index.ts` — tap into existing hooks to capture events
- Fallback manager — add event emission on state transitions
- Orchestrator handlers — add event emission on autonomous decisions
- Plugin load lifecycle — add retention pruning on load

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 13-session-observability*
*Context gathered: 2026-04-02*
