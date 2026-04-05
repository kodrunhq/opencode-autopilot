---
# opencode-autopilot
description: Run plugin health diagnostics — config validity, agent injection, native suppression, assets, memory, commands, and v7 config fields (background, routing, recovery, mcp)
---

Invoke the `oc_doctor` tool to run a full health check on the opencode-autopilot plugin.

`oc_doctor` runs the current built-in health checks and reports the results by diagnostic area. These checks cover:

- **Config health** — The plugin config exists, parses correctly, and required modern config sections such as `background`, `routing`, `recovery`, and `mcp` are present or reported as needing migration.
- **Agent setup** — Expected autopilot agents are present in the OpenCode config, and native `plan`/`build` agents are suppressed as subagents.
- **Assets and installation paths** — Bundled asset directories and the global `~/.config/opencode/` target are accessible.
- **Skill loading** — Skills load correctly and are filtered against the detected project stack.
- **Memory storage** — The memory SQLite database is available, readable, or cleanly reported as not yet initialized on first install.
- **Command files** — Expected slash command files exist and have valid YAML frontmatter.

Each failing check includes a **Fix** suggestion. Run this after installation, after upgrades, or whenever something feels off.
