# Tools Reference

This document provides a reference hub for the 39 tools provided by the OpenCode Autopilot plugin.

## Overview

All tools in this plugin follow a consistent naming and implementation pattern.

### Naming Convention

Every tool is prefixed with `oc_` to prevent name collisions with OpenCode built-in tools or other plugins.

### Thin Wrapper Pattern

Tools are implemented using a two-layer design. Each tool file exports a `*Core` function that contains the actual logic and accepts a base directory or database instance. This makes the logic testable in isolation. The `tool()` wrapper then calls this core function with the appropriate global configuration paths.

### Argument Validation

Tools use Zod schemas for strict argument validation. If a tool is called with invalid arguments, the plugin returns a clear error message before executing any logic.

## Tool Categories

| Category | Tools |
|----------|-------|
| **Pipeline** | `oc_orchestrate`, `oc_state`, `oc_phase`, `oc_confidence`, `oc_plan`, `oc_quick` |
| **Review** | `oc_review` |
| **Configuration** | `oc_configure` |
| **Creation** | `oc_create_agent`, `oc_create_skill`, `oc_create_command` |
| **Management** | `oc_background`, `oc_loop`, `oc_delegate`, `oc_recover`, `oc_route` |
| **Diagnostics** | `oc_doctor`, `oc_forensics`, `oc_logs`, `oc_session_stats`, `oc_pipeline_report`, `oc_summary`, `oc_stocktake` |
| **Code Intelligence** | `oc_graph_index`, `oc_graph_query`, `oc_lsp_goto_definition`, `oc_lsp_find_references`, `oc_lsp_symbols`, `oc_lsp_diagnostics`, `oc_lsp_prepare_rename`, `oc_lsp_rename` |
| **Editing** | `oc_hashline_edit` |
| **Memory** | `oc_memory_status`, `oc_memory_preferences`, `oc_memory_save`, `oc_memory_search`, `oc_memory_forget` |
| **Docs** | `oc_update_docs` |
| **Testing** | `oc_mock_fallback` |

Detailed sections below cover the core tools most users touch directly; the category table above is the authoritative full inventory of all 39 registered tools.

---

## Pipeline Tools

Tools for driving and inspecting the autonomous SDLC pipeline.

### oc_orchestrate

Drive the orchestrator pipeline. Provide an idea to start a new run, or a result to advance the current phase.

**Arguments:**
* `idea` (string, optional): Idea to start a new orchestration run. Max 4096 chars.
* `result` (string, optional): Result from previous agent to advance the pipeline. Max 1MB.

**What it does:**
Acts as the core state machine for the 8-phase pipeline. It handles phase transitions, dispatches agents, and persists state to the project artifact directory.

---

### oc_state

Manage orchestrator pipeline state.

**Arguments:**
* `subcommand` (enum): `load`, `get`, `patch`, `append-decision`.
* `field` (string, optional): Field name for `get` or `patch`.
* `value` (string, optional): Value for `patch`.
* `phase` (string, optional): Phase name for `append-decision`.
* `agent` (string, optional): Agent name for `append-decision`.
* `decision` (string, optional): Decision text for `append-decision`.
* `rationale` (string, optional): Rationale text for `append-decision`.

**What it does:**
Provides low-level access to the pipeline state file. Use `patch` to manually correct state or `append-decision` to record manual interventions.

---

### oc_phase

Manage orchestrator phase transitions.

**Arguments:**
* `subcommand` (enum): `status`, `complete`, `validate`.
* `from` (string, optional): Source phase for `validate`.
* `to` (string, optional): Target phase for `validate`.

**What it does:**
Queries the current phase status or manually advances the pipeline to the next phase.

---

### oc_confidence

Manage orchestrator confidence ledger.

**Arguments:**
* `subcommand` (enum): `append`, `summary`, `filter`.
* `phase` (string, optional): Phase name for `append` or `filter`.
* `agent` (string, optional): Agent name for `append`.
* `area` (string, optional): Area of confidence for `append`.
* `level` (enum): `HIGH`, `MEDIUM`, `LOW`. Confidence level for `append`.
* `rationale` (string, optional): Rationale text for `append`.

**What it does:**
Tracks confidence signals from different agents throughout the pipeline. These signals influence architectural depth and review strictness.

---

### oc_plan

Query orchestrator plan data.

**Arguments:**
* `subcommand` (enum): `waves`, `status-count`.

**What it does:**
Retrieves task information from the PLAN phase. `Waves` groups tasks by their execution wave, while `status-count` provides a summary of task progress.

---

### oc_quick

Run a quick task through a simplified pipeline.

**Arguments:**
* `idea` (string): The task to accomplish.

**What it does:**
Bypasses the research and architecture phases (RECON, CHALLENGE, ARCHITECT, EXPLORE) and starts the pipeline directly at the PLAN phase. Use this for small, well-understood tasks.

---

## Review Tools

Tools for multi-agent code review.

### oc_review

Run multi-agent code review.

**Arguments:**
* `scope` (enum, optional): `staged`, `unstaged`, `branch`, `all`, `directory`.
* `filter` (string, optional): Regex pattern to filter files.
* `directory` (string, optional): Directory path for `directory` scope.
* `findings` (string, optional): JSON findings from previously dispatched review agents.

**What it does:**
Orchestrates a 4-stage review pipeline using up to 13 specialized agents. It detects the project stack, selects relevant agents, and aggregates findings into a final report.

---

## Configuration Tools

Tools for managing plugin settings and model assignments.

### oc_configure

Configure model assignments for agent groups.

**Arguments:**
* `subcommand` (enum): `start`, `assign`, `commit`, `doctor`, `reset`.
* `group` (string, optional): Group ID for `assign` (e.g., `architects`).
* `primary` (string, optional): Primary model ID for `assign`.
* `fallbacks` (string, optional): Comma-separated fallback model IDs for `assign`.

**What it does:**
Provides an interactive workflow to assign models to different agent groups. It checks for adversarial diversity and ensures that critical agent pairs (like Builders and Reviewers) use different model families.

---

## Creation Tools

Tools for extending the plugin in-session.

### oc_create_agent

Create a new OpenCode agent.

**Arguments:**
* `name` (string): Agent name. Lowercase alphanumeric with hyphens.
* `description` (string): What the agent does.
* `mode` (enum): `primary`, `subagent`, `all`. Default is `subagent`.
* `model` (string, optional): Model identifier.
* `temperature` (number, optional): Temperature 0.0 to 1.0.

**What it does:**
Generates a properly formatted agent markdown file in `~/.config/opencode/agents/`. The agent becomes available after restarting OpenCode.

---

### oc_create_skill

Create a new OpenCode skill.

**Arguments:**
* `name` (string): Skill name. Lowercase with hyphens.
* `description` (string): What the skill provides to the AI agent.
* `license` (string, optional): License (e.g., `MIT`).
* `compatibility` (string, optional): Compatibility (e.g., `opencode`).
* `stacks` (string[], optional): Stack tags for adaptive loading.
* `requires` (string[], optional): Required skill dependencies.

**What it does:**
Creates a skill directory and `SKILL.md` file in `~/.config/opencode/skills/`. Skills provide domain knowledge that is injected into agent prompts.

---

### oc_create_command

Create a new OpenCode command.

**Arguments:**
* `name` (string): Command name. Lowercase alphanumeric with hyphens.
* `description` (string): What the command does when invoked.
* `agent` (string, optional): Agent to use when running this command.
* `model` (string, optional): Model override for this command.

**What it does:**
Writes a command template to `~/.config/opencode/commands/`. It validates the name against built-in commands to prevent collisions.

---

## Management Tools

Tools for task orchestration and session resilience.

### oc_background

Manage background tasks.

**Arguments:**
* `action` (enum): `spawn`, `status`, `list`, `cancel`, `result`.
* `sessionId` (string, optional): Session ID to scope tasks to.
* `taskId` (string, optional): Background task ID.
* `description` (string, optional): Task description for `spawn`.
* `category` (string, optional): Optional task category.
* `agent` (string, optional): Optional agent hint for `spawn`.
* `priority` (number, optional): Optional task priority (0 to 100).
* `status` (enum, optional): Status filter for `list`.

**What it does:**
Handles concurrent task execution in the background. It manages a pool of execution slots and persists task state to a local database.

---

### oc_loop

Manage the autonomy loop.

**Arguments:**
* `action` (enum): `status`, `abort`, `start`, `pause`, `resume`, `iterate`.
* `taskDescription` (string, optional): Task description for `start`.
* `maxIterations` (number, optional): Max iterations for `start` (1 to 100).
* `iterationResult` (string, optional): Result of the current iteration for `iterate`.

**What it does:**
Runs a continuous loop of agent actions with verification checkpoints. It tracks progress across multiple iterations until the task is complete or the limit is reached.

---

### oc_delegate

Route a task to the best category.

**Arguments:**
* `task` (string): Task description to route.
* `category` (string, optional): Explicit routing category override.
* `spawn` (boolean, optional): Whether to spawn a background task. Default is `true`.

**What it does:**
Analyzes a task description to determine the most appropriate category and model group. It then spawns a background task with the correct context and skills.

---

### oc_recover

Inspect and manage session recovery state.

**Arguments:**
* `action` (enum): `status`, `retry`, `clear-strategies`, `history`.
* `sessionId` (string, optional): Session ID to inspect.

**What it does:**
Provides resilience against model failures or rate limits. It tracks recovery attempts and applies strategies like exponential backoff or model fallback.

---

## Diagnostics Tools

Tools for health checks and session analysis.

### oc_doctor

Run plugin health diagnostics.

**Arguments:**
None.

**What it does:**
Checks the health of the plugin installation, including config validity, agent injection, asset directories, and skill loading. It provides actionable fix suggestions for any failures.

---

### oc_forensics

Diagnose a failed orchestrator pipeline run.

**Arguments:**
None.

**What it does:**
Analyzes a failed pipeline run to identify the root cause. It determines if the failure is recoverable and suggests whether to resume or restart the pipeline.

---

### oc_logs

View session logs.

**Arguments:**
* `mode` (enum): `list`, `detail`, `search`.
* `sessionID` (string, optional): Session ID to view.
* `eventType` (string, optional): Filter events by type.
* `after` (string, optional): Only events after this ISO timestamp.
* `before` (string, optional): Only events before this ISO timestamp.
* `domain` (string, optional): Filter events by domain.
* `subsystem` (string, optional): Filter events by subsystem.
* `severity` (string, optional): Filter by severity.

**What it does:**
Provides a dashboard for inspecting structured session logs. Use it to debug issues or review the history of autonomous actions.

---

### oc_session_stats

View session statistics.

**Arguments:**
* `sessionID` (string, optional): Session ID to view.

**What it does:**
Computes event counts, decision totals, and error summaries for a session. It also provides a per-phase breakdown of activity.

---

### oc_pipeline_report

View pipeline decision trace.

**Arguments:**
* `sessionID` (string, optional): Session ID to view.

**What it does:**
Generates a phase-by-phase timeline of all autonomous decisions made during a pipeline run, including the agent involved and the rationale for each decision.

---

### oc_summary

Generate a markdown summary for a session.

**Arguments:**
* `sessionID` (string, optional): Session ID to summarize.

**What it does:**
Produces a human-readable summary of session outcomes, key decisions, and any errors encountered.

---

### oc_stocktake

Audit all installed assets.

**Arguments:**
* `lint` (boolean, optional): Run YAML frontmatter linter on all assets. Default is `true`.

**What it does:**
Lists all agents, skills, and commands currently installed in the global config directory. It identifies which assets are built-in and which were created by the user.

---

## Editing Tools

Tools for precise file modifications.

### oc_hashline_edit

Edit files using hash-anchored line references.

**Arguments:**
* `file` (string): Absolute path to the file to edit.
* `edits` (array): Array of edit operations.
    * `op` (enum): `replace`, `append`, `prepend`.
    * `pos` (string): `LINE#HASH` anchor (e.g., `42#VK`).
    * `end` (string, optional): End anchor for range replace.
    * `lines` (string, string[], or null): New content.

**What it does:**
Provides a safe way to edit files by verifying that the content of the target lines matches a known hash before applying changes. This prevents "stale edits" where an agent tries to modify a file that has changed since it last read it.

---

## Memory Tools

Tools for managing the smart memory system.

### oc_memory_status

Show memory system status.

**Arguments:**
* `detail` (enum): `summary`, `full`. Default is `summary`.

**What it does:**
Displays statistics about the memory database, including observation counts, storage size, and recent memories or preferences.

---

### oc_memory_preferences

Manage learned preferences.

**Arguments:**
* `subcommand` (enum): `delete`, `prune`, `prune-evidence`.
* `id` (string, optional): Preference record id for `delete`.
* `key` (string, optional): Preference key for `delete`.
* `scope` (enum): `global`, `project`. Default is `global`.
* `olderThanDays` (number, optional): Age threshold for pruning.
* `status` (enum, optional): Preference status filter.
* `keepLatestPerPreference` (number, optional): Evidence retention count.

**What it does:**
Allows manual cleanup of the preference memory. Use this to remove incorrect observations or prune old evidence to keep the memory system lean.

---

## Docs Tools

Tools for documentation maintenance.

### oc_update_docs

Detect documentation affected by code changes.

**Arguments:**
* `scope` (enum): `changed`, `all`. Default is `changed`.

**What it does:**
Analyzes recent code changes and identifies markdown files that may need updates based on file name and path heuristics.

---

## Testing Tools

Tools for verifying plugin behavior.

### oc_mock_fallback

Generate mock errors for fallback testing.

**Arguments:**
* `mode` (string): Failure mode to simulate or `list`.

**What it does:**
Simulates different types of model errors (rate limits, timeouts, etc.) to verify how the fallback system classifies and handles them.

---

[Documentation Index](README.md)
