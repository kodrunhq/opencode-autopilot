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

## Commands

### install

The `install` command sets up the plugin for use with OpenCode.

**What it does:**
*   Checks if the OpenCode CLI is installed on your system.
*   Locates or creates an `opencode.json` file in the current directory.
*   Registers `@kodrunhq/opencode-autopilot` in the `plugin` array of `opencode.json`.
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
*   **System Checks**: Verifies OpenCode installation, plugin registration in `opencode.json`, and configuration file health.
*   **Model Assignments**: Lists the primary and fallback models assigned to each agent group.
*   **Adversarial Diversity**: Checks if adversarial pairs, like Architects and Challengers, use different model families to avoid confirmation bias.
*   **Suggestions**: Provides actionable steps to fix any identified issues.

**Usage:**
```bash
bunx @kodrunhq/opencode-autopilot doctor
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

## Exit Codes

The CLI uses standard exit codes to indicate the result of an operation:

*   `0`: The command completed successfully.
*   `1`: An error occurred. This could be due to invalid configuration, missing dependencies, or failed health checks in the `doctor` command.

---

[Documentation Index](README.md)
