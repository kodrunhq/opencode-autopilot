# Phase 2: Creation Tooling - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-31
**Phase:** 02-creation-tooling
**Areas discussed:** Agent scaffolding, Skill scaffolding, Command scaffolding, Scope targeting

---

## Agent Scaffolding

| Option | Description | Selected |
|--------|-------------|----------|
| Full set | description, mode, model, temperature, permissions | ✓ |
| Minimal | Just description and mode | |
| You decide | Claude picks | |

**User's choice:** Full set (Recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| subagent | Most common — invoked via @mention | ✓ |
| Ask each time | Tool parameter lets user choose | |
| You decide | Claude picks | |

**User's choice:** subagent (Recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| LLM-generated | Placeholder prompt with guidance comments | ✓ |
| User-provided | Tool parameter accepts system prompt text | |
| Both | Accept user text if provided, otherwise placeholder | |

**User's choice:** LLM-generated

---

## Skill Scaffolding

| Option | Description | Selected |
|--------|-------------|----------|
| OpenCode strict | 1-64 chars, lowercase alphanumeric with hyphens | ✓ |
| Lenient | Just illegal filesystem chars | |
| You decide | Claude picks | |

**User's choice:** OpenCode strict (Recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Frontmatter + sections | YAML frontmatter + What I do / Rules / Examples | ✓ |
| Frontmatter only | Just YAML, user fills body | |
| You decide | Claude picks | |

**User's choice:** Frontmatter + sections

---

## Command Scaffolding

| Option | Description | Selected |
|--------|-------------|----------|
| Full template | YAML frontmatter + template body with $ARGUMENTS | ✓ |
| Minimal | Just description, empty body | |
| You decide | Claude picks | |

**User's choice:** Full template (Recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Validate | Check for illegal chars and built-in overrides | ✓ |
| No validation | Accept any name | |
| You decide | Claude picks | |

**User's choice:** Validate (Recommended)

---

## Scope Targeting

| Option | Description | Selected |
|--------|-------------|----------|
| User chooses each time | Tool has scope parameter | |
| Always global | Match Phase 1 D-05 | ✓ |
| Always project-local | Always .opencode/ | |
| You decide | Claude picks | |

**User's choice:** Always global

---

## Claude's Discretion

- Exact Zod schema field structure
- YAML generation approach
- Command structure (markdown files that instruct LLM to call tools)
- Error message format

## Deferred Ideas

None — discussion stayed within phase scope
