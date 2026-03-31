# Phase 1: Plugin Infrastructure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-31
**Phase:** 01-plugin-infrastructure
**Areas discussed:** Package structure, Asset installation, Tool registration, Provider agnostic

---

## Package Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Flat package | Single package: src/ for plugin code, assets/ for bundled files. Simplest to publish and install. | ✓ |
| Monorepo | Separate packages for plugin core, assets, and CLI tools. More complex but allows independent versioning. | |
| You decide | Claude picks the best structure | |

**User's choice:** Flat package (Recommended)
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| assets/ directory | assets/agents/, assets/skills/, assets/commands/ mirroring .opencode/ structure | ✓ |
| Inline in src/ | Template strings embedded in TypeScript source code | |
| You decide | Claude picks the best approach | |

**User's choice:** assets/ directory
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Single plugin export | One default export: the plugin function that registers everything | ✓ |
| Named exports | Named exports for plugin + individual tools, allowing selective use | |
| You decide | Claude picks based on OpenCode conventions | |

**User's choice:** Single plugin export
**Notes:** None

---

## Asset Installation

| Option | Description | Selected |
|--------|-------------|----------|
| On plugin load | Plugin checks on every OpenCode start and copies missing assets. Self-healing. | ✓ |
| Postinstall script | npm/bun postinstall copies assets once during install | |
| On-demand only | Assets only created when user explicitly runs a setup command | |

**User's choice:** On plugin load (Recommended)
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Never overwrite | Skip existing files silently. User modifications are sacred. | ✓ |
| Ask to overwrite | Prompt user if conflicts found | |
| Force overwrite | Always replace with latest bundled version | |

**User's choice:** Never overwrite (Recommended)
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Project-local | .opencode/ in the current project | |
| Global | ~/.config/opencode/ — available everywhere | ✓ |
| Let user choose | Ask on first run or provide a config option | |

**User's choice:** Global
**Notes:** None

---

## Tool Registration

| Option | Description | Selected |
|--------|-------------|----------|
| oc_ prefix | e.g., oc_create_agent, oc_create_skill — clear namespace | ✓ |
| opencode_assets_ prefix | e.g., opencode_assets_create_agent — very explicit but verbose | |
| No prefix | e.g., create_agent — clean but risks shadowing | |
| You decide | Claude picks the best naming convention | |

**User's choice:** oc_ prefix (Recommended)
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| All params in one call | LLM gathers info conversationally, then calls tool with all parameters at once | ✓ |
| Multi-step tool calls | Tool prompts for each field interactively | |
| You decide | Claude picks based on OpenCode's tool API capabilities | |

**User's choice:** All params in one call (Recommended)
**Notes:** None

---

## Provider Agnostic

| Option | Description | Selected |
|--------|-------------|----------|
| Omit model field | Let OpenCode use whatever model the user has configured | |
| Suggest with fallback | Set a model in frontmatter but document that users can override | |
| Model aliases | Use generic aliases like 'fast' or 'smart' | |
| Configuration wizard | Prompt user to assign models per agent on first load, re-runnable via /configure | ✓ |

**User's choice:** Configuration wizard — prompt user to configure provider model per agent
**Notes:** User wants a wizard that runs on first plugin load and is re-runnable via /configure command. Stores config that's read when installing agent markdown files.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Strict per-agent | Read-only agents can't write, reviewers can't edit — principle of least privilege | ✓ |
| Permissive | All agents get full tool access, rely on LLM judgment | |
| You decide | Claude configures appropriate permissions per agent | |

**User's choice:** Strict per-agent (Recommended)
**Notes:** None

---

## Claude's Discretion

- Config file format and location for model mappings
- Exact Zod schema structure for creation tools
- How to detect "first load" vs subsequent loads
- Error handling strategy for failed asset copies

## Deferred Ideas

None — discussion stayed within phase scope
