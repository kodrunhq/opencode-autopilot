---
# opencode-autopilot
description: Run plugin health diagnostics — config validity, agent injection, native suppression, assets, memory, commands, and v7 config fields (background, routing, recovery, mcp)
---

Invoke the `oc_doctor` tool to run a full health check on the opencode-autopilot plugin.

Checks performed:

- **config-validity** — Plugin config file exists and passes Zod schema validation.
- **config-version** — Config is on the latest version (currently v7); older configs will be auto-migrated.
- **config-v7-fields** — v7 config has all four new top-level objects: `background`, `routing`, `recovery`, and `mcp`. Reports a pending-migration notice for pre-v7 configs.
- **config-groups** — All eight model groups (architects, challengers, builders, reviewers, red-team, researchers, communicators, utilities) have a primary model assigned.
- **agent-injection** — All expected agents (standard + pipeline) are present in the OpenCode config.
- **native-agent-suppression** — OpenCode native `plan`/`build` agents are disabled and hidden as subagents.
- **asset-directories** — Both the bundled asset source directory and the global `~/.config/opencode/` target directory are accessible.
- **skill-loading** — Skills are loaded and filtered against the detected project stack.
- **memory-db** — The memory SQLite database exists and is readable (or reports a clean first-install status).
- **command-accessibility** — All expected slash command files exist and have valid YAML frontmatter.
- **hook-registration** — Plugin tools are registered (confirmed by `oc_doctor` being callable).

Each failing check includes a **Fix** suggestion. Run this after installation, after upgrades, or whenever something feels off.
