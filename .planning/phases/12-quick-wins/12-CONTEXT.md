# Phase 12: Quick Wins & Fixes - Context

**Gathered:** 2026-04-02
**Updated:** 2026-04-02 (post Phase 11 research)
**Status:** Ready for planning

<domain>
## Phase Boundary

Self-healing diagnostics, configuration repair, Zen model display fix, and quick task mode. All items are self-contained, low-risk, and don't require complex architecture. Phase 11 research identified the doctor/diagnostics as CRITICAL gaps (DX-01, CM-01, DX-02, NV-06) — they are the highest priority items in this phase.

</domain>

<decisions>
## Implementation Decisions

### Zen model display fix (from initial discussion)
- **D-01:** The interactive CLI configure wizard shows models without the Zen provider prefix
- **D-02:** OpenCode's native `/models` command correctly shows "zen/" prefixed models — our wizard should match
- **D-03:** Users MUST distinguish Go vs Zen providers — they are different providers
- **D-04:** Fix should use the same model metadata/display logic that OpenCode's native model selector uses

### Self-healing doctor (DX-01, NV-06, CRITICAL)
- **D-05:** Runs on every plugin load, checks core essentials only (<100ms target)
- **D-06:** Health checks: 14 agents injected, config v4 valid, asset directories exist, no corrupted JSON
- **D-07:** Auto-repair: re-run migration chain (v1→v2→v3→v4), re-inject missing agents via config hook, re-install missing assets via installer
- **D-08:** Repair notification: silent with toast — "✓ Auto-repaired: 2 missing agents re-injected". No interruption to workflow
- **D-09:** Extends existing config migration chain and COPYFILE_EXCL installer with a health check registry pattern

### Plugin health diagnostics command (CM-01, DX-02, CRITICAL)
- **D-10:** `/doctor` command — pass/fail checklist like `brew doctor` or `npm doctor`
- **D-11:** Each check shows ✓ or ✗ with a one-line explanation. Failed items include fix suggestions
- **D-12:** Checks: plugin registration, agent injection (14 agents present), config validity (v4 schema), model assignments working, asset directory health, hook registration
- **D-13:** Implemented as an `oc_doctor` tool (follows existing `oc_` prefix pattern)

### Config repair scope (SF-04, HIGH)
- **D-14:** Migration + structural repair: run v1→v2→v3→v4 chain, PLUS fix missing required fields (fill with Zod defaults), remove unknown keys, repair invalid values (enum out of range → default)
- **D-15:** Zod schema is the source of truth — `safeParse` with defaults handles all structural repair
- **D-16:** Agent re-injection happens as part of normal config hook on load — the hook is the repair mechanism (already runs every load)

### Quick task mode (WF-02, CM-09, MEDIUM)
- **D-17:** `/quick` command that runs a simplified pipeline: skip RECON, CHALLENGE, ARCHITECT phases, go straight to PLAN→BUILD→SHIP
- **D-18:** Still gets review and retrospective — quality isn't skipped, just discovery phases
- **D-19:** User explicitly invokes `/quick` — no auto-detection, no heuristics, no false positives
- **D-20:** Implemented as a tool that calls orchestrateCore with a phase-skip config override

### Claude's Discretion
- Health check registry design (array of check functions vs object map vs class hierarchy)
- Toast implementation (use OpenCode's tui.toast.show hook or return message from tool)
- /doctor output formatting details
- /quick pipeline configuration approach (config override vs separate orchestrate mode)

</decisions>

<specifics>
## Specific Ideas

- "It's key that the user understands which provider is behind each model"
- Doctor should feel like `brew doctor` — quick, clear, actionable
- Auto-repair should be invisible unless something was actually fixed
- /quick should feel natural for small tasks — "fix this typo" shouldn't require a full 8-phase pipeline

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 11 research (gap definitions)
- `.planning/phases/11-ecosystem-research/11-GAP-MATRIX.md` — Gap IDs DX-01, DX-02, CM-01, SF-04, NV-06, WF-02, CM-09
- `.planning/phases/11-ecosystem-research/11-PHASE-SCOPES.md` §Phase 12 — Feature definitions and scope

### Configure wizard (Zen fix)
- `src/tools/configure.ts` — CLI configure wizard with model selection (Zen display fix target)

### Config system (migration + repair)
- `src/config.ts` — Config v4 schema, v1→v2→v3→v4 migration chain, Zod validation
- `src/installer.ts` — Self-healing asset installer (COPYFILE_EXCL pattern)

### Agent injection (health check baseline)
- `src/agents/index.ts` — Config hook that injects 14 agents
- `src/index.ts` — Plugin entry point, hook registrations

### Orchestrator (quick task mode)
- `src/pipeline/orchestrate.ts` — Orchestrator core with phase handlers
- `src/schemas.ts` — Pipeline schemas including phase toggle config

### Plugin architecture
- `CLAUDE.md` — Architecture overview, tool registration pattern, `oc_` prefix requirement

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Config migration chain (`src/config.ts`) — already handles v1→v2→v3→v4, extend with structural repair via Zod `safeParse` + defaults
- Asset installer (`src/installer.ts`) — `copyIfMissing` with COPYFILE_EXCL, can be called for repair
- Config hook (`src/agents/index.ts`) — injects 14 agents every load, IS the agent repair mechanism
- Tool registration pattern (`src/tools/*.ts`) — `*Core` function + `tool()` wrapper, follow for `oc_doctor` and `oc_quick`
- Phase toggle config (`src/schemas.ts`, `orchestratorConfigSchema`) — already has per-phase boolean toggles, /quick can override these
- Event hook (`src/index.ts`) — existing `tui.toast.show` for repair notifications

### Established Patterns
- Tool registration: export `*Core` (testable, accepts baseDir) + `tool()` wrapper
- Zod validation on all tool inputs and config
- Immutable object construction with conditional spreads
- Atomic file writes via temp-file-then-rename

### Integration Points
- Plugin load lifecycle (`src/index.ts`) — where health checks run (after config hook, after installer)
- Config hook chain — agent injection already happens here
- Tool registration in `src/index.ts` — where `oc_doctor` and `oc_quick` get registered
- Orchestrator phase handlers — where /quick skips RECON/CHALLENGE/ARCHITECT

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-quick-wins*
*Context gathered: 2026-04-02*
*Updated: 2026-04-02 (post Phase 11 research — expanded from Zen fix only to 4 features)*
