# Configuration Reference

The OpenCode Autopilot Plugin uses a versioned JSON configuration file to manage model assignments, orchestrator behavior, and system thresholds. This document provides a complete reference for the v7 configuration schema.

## Configuration File

The configuration file is located at:
`~/.config/opencode/opencode-autopilot.json`

This file is automatically created on first load and migrates across versions as the plugin updates.

## Schema Reference (v7)

### Core Fields

*   `version`: literal `7`. The current schema version.
*   `configured`: boolean. Indicates if the initial setup is complete.

### Model Groups (`groups`)

A record of model assignments for different agent categories. Each group requires a primary model and an optional list of fallback models.

*   `architects`: System design, task decomposition, and pipeline orchestration.
*   `challengers`: Adversarial review of architecture proposals.
*   `builders`: Production code implementation.
*   `reviewers`: Bug hunting, security audits, and logic verification.
*   `red-team`: Final adversarial pass and UX gap analysis.
*   `researchers`: Domain research and feasibility analysis.
*   `communicators`: Documentation, changelogs, and lesson extraction.
*   `utilities`: Fast lookups and prompt tuning.

Each group entry has the following structure:
*   `primary`: string. The model identifier (e.g., `anthropic/claude-3-5-sonnet`).
*   `fallbacks`: array of strings. Models to use if the primary model fails.

### Per-Agent Overrides (`overrides`)

A record of model assignments that override the group defaults for specific agents.

*   `primary`: string. The model identifier for this specific agent.
*   `fallbacks`: array of strings (optional). Fallback models for this specific agent.

### Orchestrator Settings (`orchestrator`)

Controls the behavior of the autonomous pipeline.

*   `autonomy`: `full`, `supervised`, or `manual`.
    *   `full`: The pipeline advances automatically between phases.
    *   `supervised`: The pipeline pauses for user approval before advancing.
    *   `manual`: The user must trigger every phase transition.
*   `strictness`: `strict`, `normal`, or `lenient`. Controls how strictly the orchestrator enforces phase requirements.
*   `phases`: A record of boolean toggles for each pipeline phase:
    *   `recon`: Domain research and assessment.
    *   `challenge`: Idea enhancement and design critique.
    *   `architect`: Multi-proposal design arena.
    *   `explore`: Speculative analysis.
    *   `plan`: Task decomposition and wave scheduling.
    *   `build`: Code implementation and inline review.
    *   `ship`: Documentation and changelog generation.
    *   `retrospective`: Lesson extraction and persistence.

### Confidence Thresholds (`confidence`)

Manages the confidence-driven decision system.

*   `enabled`: boolean. Whether to use the confidence system.
*   `thresholds`:
    *   `proceed`: `HIGH`, `MEDIUM`, or `LOW`. The minimum confidence required to advance a phase.
    *   `abort`: `HIGH`, `MEDIUM`, or `LOW`. The confidence level at which the pipeline should abort.

### Fallback System (`fallback`)

Configures the automatic model fallback mechanism.

*   `enabled`: boolean. Whether to enable automatic fallbacks.
*   `retryOnErrors`: array of numbers. HTTP status codes that trigger a fallback (default: `[401, 402, 429, 500, 502, 503, 504]`).
*   `retryableErrorPatterns`: array of strings. Regex patterns in error messages that trigger a fallback.
*   `maxFallbackAttempts`: number. Maximum number of fallback attempts before failing (default: `10`).
*   `cooldownSeconds`: number. Time to wait before attempting to return to the primary model (default: `60`).
*   `timeoutSeconds`: number. Request timeout for fallback attempts (default: `30`).
*   `notifyOnFallback`: boolean. Whether to show a notification when a fallback occurs.
*   `testMode`:
    *   `enabled`: boolean. Whether to simulate failures for testing.
    *   `sequence`: array of error types to simulate (e.g., `rate_limit`, `timeout`).

### Memory System (`memory`)

Configures the smart dual-scope memory.

*   `enabled`: boolean. Whether to enable the memory system.
*   `injectionBudget`: number. Maximum characters to inject from memory into the system prompt (default: `2000`).
*   `decayHalfLifeDays`: number. The half-life for relevance scoring of observations (default: `90`).

### Background Tasks (`background`)

Manages concurrent background operations.

*   `enabled`: boolean. Whether to allow background task execution.
*   `maxConcurrent`: number. Maximum number of concurrent background slots (1 to 50, default: `5`).
*   `persistence`: boolean. Whether to persist task state across sessions.

### Autonomy Loop (`autonomy`)

Configures the top-level autonomy loop.

*   `enabled`: boolean. Whether the autonomy loop is active.
*   `verification`: `strict`, `normal`, or `lenient`. The level of verification required after each iteration.
*   `maxIterations`: number. Maximum number of iterations before the loop stops (1 to 50, default: `10`).

### Task Routing (`routing`)

Configures the category-based task routing engine.

*   `enabled`: boolean. Whether to use the routing engine.
*   `categories`: A record of category configurations. Each category can specify an `agentId`, `modelGroup`, `maxTokenBudget`, `timeoutSeconds`, and a list of `skills`.

### Recovery System (`recovery`)

Manages session recovery and failure resilience.

*   `enabled`: boolean. Whether to enable the recovery system.
*   `maxRetries`: number. Maximum number of recovery attempts for a failed operation (0 to 10, default: `3`).

### MCP Integration (`mcp`)

Configures the Model Context Protocol (MCP) skill integration.

*   `enabled`: boolean. Whether to enable MCP integration.
*   `skills`: A record of MCP skill configurations.

## Migration Chain

The configuration system automatically migrates your settings as the plugin evolves.

*   **v1 to v2**: Introduced the `orchestrator` and `confidence` sections to support the autonomous pipeline.
*   **v2 to v3**: Added the `fallback` section and global `fallback_models` for basic error recovery.
*   **v3 to v4**: Major architectural shift from a flat `models` record to structured `groups` and `overrides`. Global fallbacks were migrated to per-group fallback chains.
*   **v4 to v5**: Added the `memory` section to support project-specific patterns and user preferences.
*   **v5 to v6**: Introduced `testMode` in the fallback configuration for system testing.
*   **v6 to v7**: Expanded the system with `background` task management, a top-level `autonomy` loop, task `routing`, `recovery` strategies, and `mcp` integration.

## Example Configurations

### Minimal Starter

```json
{
  "version": 7,
  "configured": true,
  "groups": {
    "architects": { "primary": "anthropic/claude-3-5-sonnet", "fallbacks": [] },
    "builders": { "primary": "anthropic/claude-3-5-sonnet", "fallbacks": [] }
  }
}
```

### Full Production

```json
{
  "version": 7,
  "configured": true,
  "groups": {
    "architects": { "primary": "anthropic/claude-3-5-sonnet", "fallbacks": ["openai/gpt-4o"] },
    "challengers": { "primary": "openai/gpt-4o", "fallbacks": ["google/gemini-1.5-pro"] },
    "builders": { "primary": "anthropic/claude-3-5-sonnet", "fallbacks": ["anthropic/claude-3-haiku"] },
    "reviewers": { "primary": "openai/gpt-4o", "fallbacks": ["google/gemini-1.5-pro"] },
    "red-team": { "primary": "google/gemini-1.5-pro", "fallbacks": ["openai/gpt-4o"] },
    "researchers": { "primary": "anthropic/claude-3-5-sonnet", "fallbacks": [] },
    "communicators": { "primary": "anthropic/claude-3-haiku", "fallbacks": [] },
    "utilities": { "primary": "anthropic/claude-3-haiku", "fallbacks": [] }
  },
  "orchestrator": {
    "autonomy": "full",
    "strictness": "normal",
    "phases": {
      "recon": true,
      "challenge": true,
      "architect": true,
      "explore": false,
      "plan": true,
      "build": true,
      "ship": true,
      "retrospective": true
    }
  },
  "confidence": {
    "enabled": true,
    "thresholds": {
      "proceed": "MEDIUM",
      "abort": "LOW"
    }
  },
  "background": {
    "enabled": true,
    "maxConcurrent": 5,
    "persistence": true
  },
  "recovery": {
    "enabled": true,
    "maxRetries": 3
  }
}
```

### Per-Agent Override

```json
{
  "version": 7,
  "configured": true,
  "groups": {
    "builders": { "primary": "anthropic/claude-3-5-sonnet", "fallbacks": [] }
  },
  "overrides": {
    "oc-implementer": { "primary": "openai/gpt-4o", "fallbacks": ["anthropic/claude-3-5-sonnet"] }
  }
}
```

---

[Documentation Index](README.md)
