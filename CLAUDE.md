# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

OpenCode Autopilot Plugin — an npm package that provides autonomous SDLC orchestration, multi-agent code review, smart memory, adaptive skills, session observability, and in-session creation tools for the OpenCode AI coding CLI.

Installed via one line in `opencode.json`: `{ "plugin": ["@kodrunhq/opencode-autopilot"] }`

## Commands

```bash
bun test                    # Run all tests
bun test tests/validators   # Run a single test file
bun run lint                # Lint and check formatting (Biome)
bun run format              # Auto-format all files (Biome)
bun install                 # Install dependencies
```

No build step needed — Bun runs TypeScript natively.

## Architecture

**Two-layer design:** The plugin has a JS/TS module (registers tools + hooks via `@opencode-ai/plugin`) and filesystem assets (markdown files copied to `~/.config/opencode/`).

```
src/index.ts              Plugin entry — single default export, registers all tools,
                          runs asset installer on every load, detects first-load

src/tools/                Tool definitions (thin shell calling *Core function)
  create-agent.ts         oc_create_agent — validates name, generates markdown, writes file
  create-skill.ts         oc_create_skill — validates name, creates dir + SKILL.md
  create-command.ts       oc_create_command — validates name + built-in collision check

src/templates/            Pure functions: input → markdown string (no side effects)
  agent-template.ts       YAML frontmatter via `yaml` package + prompt scaffold
  skill-template.ts       YAML frontmatter + section scaffolding
  command-template.ts     YAML frontmatter + $ARGUMENTS template body

src/utils/                Shared utilities (stateless, no internal deps)
  validators.ts           validateAssetName (regex), validateCommandName (+ built-in check)
  paths.ts                getGlobalConfigDir(), getAssetsDir()
  fs-helpers.ts           ensureDir, copyIfMissing (COPYFILE_EXCL), isEnoentError

src/memory/               Smart dual-scope memory (project patterns + user preferences)
  database.ts             bun:sqlite with FTS5, schema initialization
  capture.ts              Event-driven observation capture from session events
  retrieval.ts            3-layer progressive disclosure with token-budgeted context
  injector.ts             System prompt injection via experimental.chat.system.transform
  decay.ts                Relevance scoring with configurable half-life decay
  repository.ts           SQLite CRUD for observations, projects, preferences

src/observability/        Session observability and structured event logging
  event-store.ts          In-memory session event collection
  event-handlers.ts       Hook handlers for event/tool lifecycle
  context-monitor.ts      Token tracking and context usage monitoring
  log-writer.ts           JSON log persistence to ~/.config/opencode/logs/
  retention.ts            Time-based log pruning (30-day default)

src/skills/               Adaptive skill loading and injection
  loader.ts               Load all skill directories from assets
  adaptive-injector.ts    Stack detection, filtering, dependency ordering, token budgeting
  dependency-resolver.ts  Topological sort for skill execution order
  linter.ts               Asset validation for skill/agent/command files

src/health/               Plugin self-diagnostics
  runner.ts               Health check execution and reporting for oc_doctor

src/config.ts             Zod-validated config load/save, first-load detection, v1-v5 migration chain
src/installer.ts          Self-healing asset copier (never overwrites user files)

assets/                   Bundled markdown files copied to ~/.config/opencode/ on load
  agents/*.md             Agent definitions (YAML frontmatter + system prompt)
  commands/*.md           Slash command templates
  skills/                 Skill directories (name/SKILL.md)
```

**Dependency flow** (strictly top-down, no cycles):
`index.ts` → `tools/*` → `templates/*` + `utils/*` + `memory/*` + `skills/*` + `observability/*` → Node built-ins + `yaml`

## Key Patterns

**Tool registration:** Each tool exports a `*Core` function (testable, accepts `baseDir`) and a `tool()` wrapper (calls core with `getGlobalConfigDir()`). Follow `create-agent.ts` as the reference.

**Atomic file writes:** Creation tools use `writeFile(path, content, { flag: "wx" })` for no-clobber writes. The `wx` flag atomically fails if the file exists, avoiding TOCTOU races. The installer uses `copyFile` with `COPYFILE_EXCL` for the same purpose.

**Immutability:** Build objects declaratively with conditional spreads — never mutate after creation. Validation results use `Object.freeze()`. Return types use `readonly` arrays.

**Asset name validation:** All names must match `^[a-z0-9]+(-[a-z0-9]+)*$` (1-64 chars). Command names additionally check against `BUILT_IN_COMMANDS` set.

**Best-effort injection:** Memory and skill context injection never blocks or crashes the pipeline. All injection functions swallow errors and return empty strings on failure.

**Token budgeting:** Both memory and skill injection enforce character-per-token limits to prevent context overflow. Memory defaults to 2000-token cap; skills default to 8000-token budget.

## Constraints

- **Runtime:** Bun only — plugins run inside the OpenCode process via Bun
- **No standalone Zod install:** Use `tool.schema` (which IS Zod) for tool arg schemas. For non-tool validation, `import { z } from "zod"` works because it's a transitive dep of `@opencode-ai/plugin`
- **No `Bun.file()`/`Bun.write()`:** Use `node:fs/promises` for portability and testability
- **Model agnostic:** Never hardcode model identifiers in bundled agents. Omit the `model` field or let the config system handle it
- **Global target:** Assets always write to `~/.config/opencode/` (not project-local `.opencode/`)
- **`oc_` prefix:** All plugin tool names must start with `oc_` to avoid shadowing OpenCode built-ins
