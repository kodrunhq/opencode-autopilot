# Phase 12: Quick Wins & Fixes - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix known bugs and implement small, low-risk improvements that don't require research or complex architecture. The Zen model display fix is the confirmed item; Phase 11 research may surface additional quick wins.

</domain>

<decisions>
## Implementation Decisions

### Zen model display fix
- **D-01:** The interactive CLI configure wizard (from the `configure` command) shows models without the Zen provider prefix
- **D-02:** OpenCode's native `/models` command correctly shows "zen/" prefixed models — our wizard should match this behavior
- **D-03:** Users MUST be able to distinguish Go vs Zen providers when selecting a model — they are different providers with different characteristics
- **D-04:** Fix should use the same model metadata/display logic that OpenCode's native model selector uses

### Scope
- **D-05:** Additional quick wins may be added here after Phase 11 research completes
- **D-06:** Only items that are self-contained, low-risk, and don't require architectural decisions belong in this phase

### Claude's Discretion
- Implementation approach for the Zen display fix
- Whether to batch additional small fixes surfaced by research

</decisions>

<specifics>
## Specific Ideas

- "It's key that the user understands which provider is behind each model, Go and Zen are different providers"
- The fix should feel natural — model names should look identical to how OpenCode's native `/models` command displays them

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Configure wizard implementation
- `src/tools/configure.ts` — CLI configure wizard with model selection (the file to fix)
- `assets/commands/configure.md` — Configure command definition

### OpenCode model display
- OpenCode's model provider system — how it distinguishes Go vs Zen providers (research needed at plan time)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Configure wizard already has searchable model selection — fix is likely in how model names are formatted/displayed

### Established Patterns
- Plugin uses OpenCode's provider APIs for model listing — the data is likely available, just not displayed correctly

### Integration Points
- `src/tools/configure.ts` — primary file to modify

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-quick-wins*
*Context gathered: 2026-04-02*
