# Configuration Structure

OpenCode Autopilot configuration uses a versioned schema with automatic migrations.

## Current Version: v6

```json
{
  "version": 6,
  "configured": true,
  "groups": {
    "architects": { "primary": "anthropic/claude-opus-4-6", "fallbacks": ["openai/gpt-5.4"] },
    "challengers": { "primary": "openai/gpt-5.4", "fallbacks": ["google/gemini-3.1-pro"] },
    "builders": { "primary": "anthropic/claude-opus-4-6", "fallbacks": ["anthropic/claude-sonnet-4-6"] },
    "reviewers": { "primary": "openai/gpt-5.4", "fallbacks": ["google/gemini-3.1-pro"] },
    "red-team": { "primary": "google/gemini-3.1-pro", "fallbacks": ["openai/gpt-5.4"] },
    "researchers": { "primary": "anthropic/claude-sonnet-4-6", "fallbacks": ["openai/gpt-5.4"] },
    "communicators": { "primary": "anthropic/claude-sonnet-4-6", "fallbacks": ["anthropic/claude-haiku-4-5"] },
    "utilities": { "primary": "anthropic/claude-haiku-4-5", "fallbacks": ["google/gemini-3-flash"] }
  },
  "overrides": {},
  "orchestrator": {
    "autonomy": "full",
    "strictness": "normal",
    "phases": {
      "recon": true,
      "challenge": true,
      "architect": true,
      "explore": true,
      "plan": true,
      "build": true,
      "ship": true,
      "retrospective": true
    }
  },
  "confidence": {
    "enabled": true,
    "thresholds": { "proceed": "MEDIUM", "abort": "LOW" }
  },
  "fallback": {
    "enabled": true,
    "testMode": { "enabled": false, "primaryOverride": null, "fallbackOverride": null }
  },
  "memory": {
    "enabled": true,
    "injectionBudget": 2000,
    "decayHalfLifeDays": 90
  }
}
```

## v7 Extensions (Planned)

v7 will add:
- `background`: Background agent manager settings
- `autonomy`: Autonomy loop configuration

```json
{
  "version": 7,
  "...v6 fields...",
  "background": {
    "enabled": true,
    "maxConcurrent": 5,
    "defaultTimeout": 300000
  },
  "autonomy": {
    "enabled": false,
    "verification": "normal",
    "maxIterations": 10
  }
}
```

## Migration Path

Configurations migrate automatically on load:
- v1 → v2 → v3 → v4 → v5 → v6 → v7

Each migration adds new fields with sensible defaults.

## File Location

```
~/.config/opencode/opencode-autopilot.json
```

## Model Groups

| Group | Agents | Purpose |
|-------|--------|---------|
| architects | oc-architect, oc-planner, autopilot | System design, planning |
| challengers | oc-critic, oc-challenger | Challenge architecture |
| builders | oc-implementer | Write production code |
| reviewers | oc-reviewer + 19 review agents | Find bugs, security issues |
| red-team | red-team, product-thinker | Adversarial perspective |
| researchers | oc-researcher, researcher | Domain research |
| communicators | oc-shipper, documenter, oc-retrospector | Docs, changelogs |
| utilities | oc-explorer, metaprompter, pr-reviewer | Fast lookups |

## Validation

The config is validated using Zod schemas in `src/config.ts`. Invalid configurations throw descriptive errors.

## CLI Commands

```bash
# Interactive configuration
bunx @kodrunhq/opencode-autopilot configure

# Health check
bunx @kodrunhq/opencode-autopilot doctor
```

## Environment Variables

None required. Configuration is file-based.