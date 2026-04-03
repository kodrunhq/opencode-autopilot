# Phase 19: Agent Visibility & Fixes - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-03
**Phase:** 19-agent-visibility-fixes
**Areas discussed:** Stocktake detection strategy, Ambiguous agent replacement, Tab cycle control, Stocktake output format

---

## Stocktake Detection Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Static manifest in code | Maintain a list of config-hook agent names in stocktake.ts | |
| Read config.agent at runtime | Query the live OpenCode config object at invocation time | |
| Import agent registry | Import agents map from src/agents/index.ts and pipeline/index.ts directly | ✓ |

**User's choice:** Import agent registry
**Notes:** Auto-syncs at compile time when agents are added/removed. Most maintainable.

### Follow-up: Agent scope

| Option | Description | Selected |
|--------|-------------|----------|
| All agents (user-facing + pipeline) | Complete picture — shows everything the plugin registers | ✓ |
| User-facing only | Only show agents users can directly invoke | |
| All agents with grouping | Show all but group by role (Primary, Subagent, Pipeline) | |

**User's choice:** All agents (user-facing + pipeline)

---

## Ambiguous Agent Replacement

| Option | Description | Selected |
|--------|-------------|----------|
| Remove if we control them | If general/explore are ours, remove them | |
| Investigate first | Research whether they're OpenCode built-ins or our creation | ✓ |
| Rename oc-explorer | oc-explorer is fine as pipeline agent, just ensure subagent-only | |

**User's choice:** Investigate first
**Notes:** "general" doesn't exist in our code. "explore" maps to oc-explorer (pipeline, already hidden). Research needed to determine if general/explore are OpenCode built-ins.

---

## Tab Cycle Control

| Option | Description | Selected |
|--------|-------------|----------|
| Verify and test | Confirm mode/hidden fields work, add assertion test | ✓ |
| Something is broken | Investigate pipeline agents appearing in Tab cycle | |
| Just document | Existing pattern works, just document in stocktake | |

**User's choice:** Verify and test
**Notes:** Pipeline agents already use mode: "subagent" + hidden: true. Autopilot uses mode: "all". Need test to enforce this invariant.

---

## Stocktake Output Format

### Origin values

| Option | Description | Selected |
|--------|-------------|----------|
| Three origins | built-in, config-hook, user-created | ✓ |
| Two origins with detail | built-in vs user-created, plus source field | |
| Flat list with mode | Don't change origin, just add mode field | |

**User's choice:** Three origins

### Additional fields

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, both mode and model | Full diagnostic: name, type, origin, mode, model | ✓ |
| Mode only, no model | Add mode but skip model (doctor handles that) | |
| Keep current fields | Just add config-hook origin, nothing else | |

**User's choice:** Yes, both mode and model

---

## Claude's Discretion

- Import strategy to avoid circular dependencies
- Whether to add a `group` field for model group membership
- Test file structure

## Deferred Ideas

None — discussion stayed within phase scope.
