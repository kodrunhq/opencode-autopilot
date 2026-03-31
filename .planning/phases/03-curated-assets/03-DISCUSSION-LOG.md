# Phase 3: Curated Assets - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.

**Date:** 2026-03-31
**Phase:** 03-curated-assets
**Areas discussed:** Agent prompts, Agent permissions, Skill content, Config hook wiring

---

## Agent Prompts

| Option | Description | Selected |
|--------|-------------|----------|
| Production-ready | Detailed prompts with role, instructions, constraints, output format | ✓ |
| Starter templates | Basic role + key instructions, user customizes | |
| You decide per agent | Claude picks depth per agent | |

**User's choice:** Production-ready

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, explicit | Prompts mention specific tools/skills available | ✓ |
| No, generic | Tool-agnostic prompts | |
| You decide | Claude picks | |

**User's choice:** Yes, explicit (Recommended)

---

## Agent Permissions

**Researcher:** Read + Web + Write (can write MD reports for other agents to read)
**Metaprompter:** Read + Write (reads patterns, writes new asset files)
**Documenter:** Read + Write + Edit (reads code, writes/edits documentation)
**PR Reviewer:** Read + Bash (reads code, runs git/gh commands)

---

## Skill Content

| Option | Description | Selected |
|--------|-------------|----------|
| Universal best practices | Language-agnostic patterns | |
| TypeScript-focused | TS-specific patterns | |
| Both layers | Universal + TS-specific | |
| Universal + modular & abstraction | User's custom choice | ✓ |

**User's choice:** Universal best practices + modularity & abstraction focus

---

| Option | Description | Selected |
|--------|-------------|----------|
| Opinionated | Clear "DO/DON'T" rules | ✓ |
| Advisory | Suggestions and guidelines | |
| You decide | Claude picks tone | |

**User's choice:** Opinionated (Recommended)

---

## Config Hook Wiring

| Option | Description | Selected |
|--------|-------------|----------|
| Separate modules | Each agent in own file under src/agents/ | ✓ |
| Inline in config hook | All agent configs defined in handler function | |
| You decide | Claude picks | |

**User's choice:** Separate modules (Recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Don't touch | Leave Build/Plan as-is | ✓ |
| Enhance them | Override with improved prompts | |
| You decide | Claude picks | |

**User's choice:** Don't touch (Recommended)

---

## Claude's Discretion

- Exact prompt content for each agent
- Config hook handler structure
- Agent temperature settings
- Coding standards skill exact rules

## Deferred Ideas

None
