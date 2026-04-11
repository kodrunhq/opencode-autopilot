# CLI Reference

The OpenCode Autopilot CLI provides tools to install, configure, and verify the plugin. It runs using Bun and can be invoked directly via `bunx` or installed globally.

## Installation

You can run the CLI without a local installation using `bunx`:

```bash
bunx @kodrunhq/opencode-autopilot [command]
```

Alternatively, install it globally using npm:

```bash
npm install -g @kodrunhq/opencode-autopilot
```

The npm global path still requires Bun on `PATH`, because the published CLI entrypoints use a Bun shebang and the plugin uses Bun-specific APIs.

## Commands

### install

The `install` command sets up the plugin for use with OpenCode.

**What it does:**
*   Checks if the OpenCode CLI is installed on your system.
*   Resolves OpenCode configuration following OpenCode's rules: checks `OPENCODE_CONFIG` env var, `OPENCODE_CONFIG_DIR` env var, project config (walking up from cwd to git root), then global config at `~/.config/opencode/opencode.json`.
*   Creates a new `opencode.json` at the appropriate location if no config exists (at git root if in a repo, otherwise in global config).
*   Supports both JSON and JSONC (JSON with Comments) formats.
*   Registers `@kodrunhq/opencode-autopilot` in the `plugin` array.
*   Creates a starter configuration file at `~/.config/opencode/opencode-autopilot.json` if it does not exist.

**Usage:**
```bash
bunx @kodrunhq/opencode-autopilot install
```

**Options:**
*   `--no-tui`: Disables the text user interface during installation.

### configure

The `configure` command launches an interactive wizard to assign models to agent groups.

**What it does:**
*   Walks through the 8 model groups: Architects, Challengers, Builders, Reviewers, Red Team, Researchers, Communicators, and Utilities.
*   Allows you to select a primary model and multiple fallback models for each group.
*   Validates adversarial diversity between groups, ensuring Builders and Reviewers use different model families.
*   Saves the assignments to your global configuration file.

**Usage:**
```bash
bunx @kodrunhq/opencode-autopilot configure
```

### doctor

The `doctor` command runs a suite of health diagnostics to ensure the plugin is correctly set up.

**What it does:**
*   **System Checks**: Verifies OpenCode installation, plugin registration in OpenCode config (respecting `OPENCODE_CONFIG`, `OPENCODE_CONFIG_DIR`, project config, and global config), and configuration file health.
*   **Plugin Load Verification**: Attempts to verify that OpenCode can actually load the plugin (catches missing dependencies).
*   **Model Assignments**: Lists the primary and fallback models assigned to each agent group.
*   **Adversarial Diversity**: Checks if adversarial pairs, like Architects and Challengers, use different model families to avoid confirmation bias.
*   **Suggestions**: Provides actionable steps to fix any identified issues.

**Usage:**
```bash
bunx @kodrunhq/opencode-autopilot doctor
```

### inspect

The `inspect` command queries the plugin kernel database for stored projects, pipeline runs, events, lessons, preferences, and memory data.

**What it does:**
*   Reads from the SQLite kernel database that the plugin maintains across sessions.
*   Supports 8 views that expose different aspects of the plugin's stored state.
*   Can output as human-readable text (default) or structured JSON.

**Usage:**
```bash
bunx @kodrunhq/opencode-autopilot inspect <view> [options]
```

**Views:**

| View | Description | Required Options |
|------|-------------|------------------|
| `projects` | List all known projects | None |
| `project` | Show details for one project | `--project <ref>` |
| `paths` | List a project's path history | `--project <ref>` |
| `runs` | List pipeline runs (default limit: 20) | None (optional `--project`) |
| `events` | List forensic events | None (optional `--project`, `--run-id`, `--session-id`, `--type`) |
| `lessons` | List stored lessons | None (optional `--project`) |
| `preferences` | List stored user preferences | None |
| `memory` | Show memory overview | None |

**Options:**

*   `--project <ref>`: Project id, path, or unique name. Required for `project` and `paths` views, optional filter for `runs`, `events`, and `lessons`.
*   `--run-id <id>`: Filter events by pipeline run id.
*   `--session-id <id>`: Filter events by session id.
*   `--type <type>`: Filter events by event type.
*   `--limit <n>`: Limit the number of rows returned (default: 20 for `runs`, 50 for other views).
*   `--json`: Emit output as structured JSON instead of formatted text.
*   `--help`, `-h`: Show the inspect help message.

**Examples:**

```bash
# List all known projects
bunx @kodrunhq/opencode-autopilot inspect projects

# Show details for a specific project
bunx @kodrunhq/opencode-autopilot inspect project --project /path/to/repo

# List recent pipeline runs as JSON
bunx @kodrunhq/opencode-autopilot inspect runs --json --limit 10

# View events for a specific run
bunx @kodrunhq/opencode-autopilot inspect events --run-id abc123

# Show memory overview
bunx @kodrunhq/opencode-autopilot inspect memory
```

## Examples

**Register the plugin in a new project:**
```bash
bunx @kodrunhq/opencode-autopilot install
```

**Update model assignments:**
```bash
bunx @kodrunhq/opencode-autopilot configure
```

**Verify installation health:**
```bash
bunx @kodrunhq/opencode-autopilot doctor
```

**Inspect stored projects:**
```bash
bunx @kodrunhq/opencode-autopilot inspect projects
```

## Exit Codes

The CLI uses standard exit codes to indicate the result of an operation:

*   `0`: The command completed successfully.
*   `1`: An error occurred. This could be due to invalid configuration, missing dependencies, or failed health checks in the `doctor` command.

---

[Documentation Index](README.md)
