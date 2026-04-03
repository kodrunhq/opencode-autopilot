# Phase 20: New Primary Agents - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-03
**Phase:** 20-new-primary-agents
**Areas discussed:** Skill loading, Tab-cycle order, Agent naming, Agent permissions

---

## Skill Loading

| Option | Description | Selected |
|--------|-------------|----------|
| Embed in prompt | Read skill content at registration time and inline into agent prompt. Self-contained, no runtime dependency. | |
| Reference by name | Agent prompt says "follow the X skill" and trusts LLM to find it in context. | |
| Extend adaptive injector | Add agent-specific skill mapping to adaptive-injector.ts. More architectural work. | |

**User's choice:** Embed in prompt
**Notes:** None

### Follow-up: Build time vs load time embedding

| Option | Description | Selected |
|--------|-------------|----------|
| Static in source | Skill content baked into agent module as template literal. Zero I/O at load time. | ✓ |
| Read at load time | configHook reads SKILL.md files async and injects into prompts during registration. | |

**User's choice:** Static in source
**Notes:** None

### Follow-up: Code Reviewer oc_review invocation

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-invoke oc_review | Agent's prompt instructs it to call oc_review directly. Fully autonomous. | ✓ |
| Guide user to call | Agent provides methodology but tells user to run the tool themselves. | |

**User's choice:** Auto-invoke oc_review
**Notes:** None

---

## Tab-Cycle Order

| Option | Description | Selected |
|--------|-------------|----------|
| Registration order | Register agents in desired order in configHook. Add test for Object.keys order. | |
| Research OpenCode first | Read OpenCode source to understand exact Tab-cycle mechanism. | ✓ |
| You decide | Claude has discretion. | |

**User's choice:** Research OpenCode first
**Notes:** None

### Follow-up: If alphabetical sorting

| Option | Description | Selected |
|--------|-------------|----------|
| Accept alphabetical | Accept whatever order names produce naturally. autopilot/debugger/planner/reviewer is already alphabetical. | ✓ |
| Rename to force order | Choose names that sort correctly if needed. | |
| You decide | Claude has discretion. | |

**User's choice:** Accept alphabetical
**Notes:** None

---

## Agent Naming

| Option | Description | Selected |
|--------|-------------|----------|
| Plain names | debugger, planner, reviewer — consistent with existing user-facing agents. | ✓ |
| oc- prefixed | oc-debugger, oc-planner, oc-reviewer — consistent with pipeline agents. | |
| Role-based | debug, plan, review — shortest possible verb-based names. | |

**User's choice:** Plain names (debugger, planner, reviewer)
**Notes:** None

### Follow-up: pr-reviewer overlap

| Option | Description | Selected |
|--------|-------------|----------|
| Keep both | reviewer (primary, interactive) and pr-reviewer (subagent, GitHub PR-specific). Different scopes. | ✓ |
| Merge into reviewer | Absorb pr-reviewer into the new reviewer agent. | |
| Rename pr-reviewer | Rename to reduce confusion (e.g., gh-reviewer). | |

**User's choice:** Keep both
**Notes:** None

---

## Agent Permissions

| Option | Description | Selected |
|--------|-------------|----------|
| Role-scoped | Each agent gets only what its role requires. Least privilege. | ✓ |
| Generous (like autopilot) | All three get edit+bash+webfetch. Maximum capability. | |
| You decide | Claude has discretion. | |

**User's choice:** Role-scoped
**Notes:** Debugger: read+bash+edit. Planner: read+write+bash. Reviewer: read+bash.

### Follow-up: Planner bash access

| Option | Description | Selected |
|--------|-------------|----------|
| No bash | Planner reads code and writes plans only. | |
| Allow bash | Planner can run read-only commands for context gathering. | ✓ |
| You decide | Claude has discretion. | |

**User's choice:** Allow bash
**Notes:** Planner gets bash for read-only context (git log, ls, etc.)

---

## Claude's Discretion

- Exact prompt content for each agent
- maxSteps values
- Temperature settings
- Agent source file internal structure
- Planner output format

## Deferred Ideas

None — discussion stayed within phase scope.
