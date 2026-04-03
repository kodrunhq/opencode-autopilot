# Phase 18: Namespace Cleanup - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-03
**Phase:** 18-namespace-cleanup
**Areas discussed:** Rename strategy, First-load toast update, Agent prompt references, README/docs updates

---

## Rename Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Atomic: rename + deprecate | Rename files to oc-* in assets/commands/, add old names to DEPRECATED_ASSETS so installer cleans them up on next load | ✓ |
| Keep both temporarily | Ship both old and new names for one release cycle, then remove old in the next version | |
| Rename only, no cleanup | Just rename the files. Old copies stay until user manually deletes them | |

**User's choice:** Atomic: rename + deprecate
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Rename all consistently | oc-new-agent, oc-new-skill, oc-new-command — everything gets oc-* prefix, no exceptions | ✓ |
| Keep creation cmds as-is | new-agent/new-skill/new-command are already unique and unlikely to clash | |

**User's choice:** Rename all consistently
**Notes:** None

---

## First-load Toast Update

| Option | Description | Selected |
|--------|-------------|----------|
| Point to CLI | "Run `opencode configure` in your terminal to set up models and preferences." | |
| Drop config mention | Remove the config line entirely. Keep the toast minimal. | ✓ |
| Show key commands | Replace config mention with a quick reference to useful commands | |

**User's choice:** Drop config mention
**Notes:** None

---

## Agent Prompt References

| Option | Description | Selected |
|--------|-------------|----------|
| Full grep + update all | Grep entire codebase for old command names, update every reference. Zero stale references. | ✓ |
| Code only, skip prose | Update references in .ts files, leave .md agent prompts as-is | |
| You decide | Claude's discretion — update whatever is functionally necessary | |

**User's choice:** Full grep + update all
**Notes:** None

---

## README/Docs Updates

| Option | Description | Selected |
|--------|-------------|----------|
| Update now, in this phase | Keep docs in sync with code. README.md, CLAUDE.md updated as part of the rename. | ✓ |
| Defer to Phase 23 | Phase 23 does a full documentation sweep anyway. | |

**User's choice:** Update now, in this phase
**Notes:** None

---

## Claude's Discretion

- Test file updates if they reference old command names
- CHANGELOG entry for the rename

## Deferred Ideas

None — discussion stayed within phase scope.
