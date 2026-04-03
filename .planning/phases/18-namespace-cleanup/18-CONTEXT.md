# Phase 18: Namespace Cleanup - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

All plugin commands renamed to use a consistent `oc-` namespace prefix. The `oc-configure` slash command is removed entirely (config is CLI-only). Old command names are cleaned up via the existing DEPRECATED_ASSETS installer pattern. All references across the codebase updated.

</domain>

<decisions>
## Implementation Decisions

### Rename Strategy
- **D-01:** Atomic rename + deprecate. Rename all 10 command files in `assets/commands/` to `oc-*` prefixed names. Add all old names to `DEPRECATED_ASSETS` in `src/installer.ts` so the installer cleans them up on next plugin load. No gradual migration.
- **D-02:** Rename ALL commands consistently — no exceptions. This includes creation commands: `new-agent` -> `oc-new-agent`, `new-skill` -> `oc-new-skill`, `new-command` -> `oc-new-command`.
- **D-03:** The `oc-configure.md` command file is deleted entirely (not renamed). It's already in DEPRECATED_ASSETS as `commands/configure.md` — add the new path `commands/oc-configure.md` to DEPRECATED_ASSETS as well.

### Full rename mapping
| Old Name | New Name |
|----------|----------|
| brainstorm.md | oc-brainstorm.md |
| new-agent.md | oc-new-agent.md |
| new-command.md | oc-new-command.md |
| new-skill.md | oc-new-skill.md |
| quick.md | oc-quick.md |
| review-pr.md | oc-review-pr.md |
| stocktake.md | oc-stocktake.md |
| tdd.md | oc-tdd.md |
| update-docs.md | oc-update-docs.md |
| write-plan.md | oc-write-plan.md |
| oc-configure.md | DELETED |

### First-Load Toast
- **D-04:** Drop the config mention from the first-load toast entirely. Do not replace it with CLI instructions or key commands. Keep the toast minimal.

### Agent Prompt References
- **D-05:** Full grep + update ALL references. Every occurrence of old command names in .ts files, .md agent prompts, and command markdown bodies must be updated. Zero stale references.

### Documentation
- **D-06:** Update README.md and CLAUDE.md in this phase (not deferred). All documentation must reflect the new `oc-*` command names immediately.

### Claude's Discretion
- Test file updates: if any test files reference old command names, update them too
- CHANGELOG entry: Claude decides whether to add a changelog entry for the rename

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Installer Pattern
- `src/installer.ts` — DEPRECATED_ASSETS array and cleanup logic (proven pattern for command removal)

### Command Files
- `assets/commands/` — All 11 current command markdown files to be renamed/deleted

### References to Update
- `src/tools/quick.ts` — References `/quick` in code comments and agent dispatch
- `src/index.ts` — Tool imports (functional names unchanged, just command file renames)
- `src/utils/validators.ts` — BUILT_IN_COMMANDS set (may need oc-* names added)
- `README.md` — Command reference table
- `CLAUDE.md` — Architecture documentation

### Research
- `.planning/research/PITFALLS.md` — Command renaming pitfalls and detection strategies
- `.planning/research/ARCHITECTURE.md` — Detailed rename implementation plan with DEPRECATED_ASSETS expansion

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DEPRECATED_ASSETS` in `src/installer.ts`: Proven pattern for cleaning up old files. Currently handles `agents/placeholder-agent.md` and `commands/configure.md`. Expand with 10 old command paths.
- `FORCE_OVERWRITE_ASSETS` in `src/installer.ts`: Forces overwrite of specific files on install. May need the new `oc-*` files added here for one release to ensure rename propagates.

### Established Patterns
- Command files are pure markdown in `assets/commands/`. The filename (minus `.md`) IS the command name in OpenCode.
- The installer copies files from `assets/` to `~/.config/opencode/` using `copyIfMissing` (COPYFILE_EXCL). New `oc-*` files will be treated as new files and copied.
- Old unprefixed files will persist in user's `~/.config/opencode/commands/` until the DEPRECATED_ASSETS cleanup runs.

### Integration Points
- `src/index.ts` first-load toast: references `/oc-configure` — must be updated to remove config mention
- Agent system prompts (in `src/agents/`) may reference command names — grep and update
- `src/tools/quick.ts` references `/quick` — update to `/oc-quick`

</code_context>

<specifics>
## Specific Ideas

No specific requirements — straightforward rename with established patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 18-namespace-cleanup*
*Context gathered: 2026-04-03*
