# Stack Research

**Domain:** OpenCode AI Plugin — v4.0 Production Quality Milestone
**Researched:** 2026-04-03
**Confidence:** HIGH

## Executive Summary

The v4.0 milestone requires **zero new npm dependencies**. Every feature — mock/fail-forced fallback testing, QA playbook infrastructure, coding standards expansion, command namespace prefixing, and agent expansion — is achievable with the existing stack. The project already has the mock provider infrastructure (`src/observability/mock/`), the skill YAML frontmatter system with adaptive injection, and the config hook agent registration pattern. New work is content authoring (markdown skills/agents/commands), config schema extensions, and wiring — not library adoption.

## Current Stack (Unchanged for v4.0)

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Bun | 1.3.11 | Runtime, test runner, package manager | Required by OpenCode plugin spec; native TS execution |
| TypeScript | ^6.0.2 | Type safety | Already in use; `--noEmit` check in prepublishOnly |
| @opencode-ai/plugin | ^1.3.8 (peer >=1.3.0) | Plugin API (tools, hooks, config) | The only way to register tools/hooks/agents in OpenCode |
| yaml | ^2.8.3 | YAML frontmatter parsing for linter and templates | Covers all skill/agent/command YAML needs |
| zod | (transitive via @opencode-ai/plugin) | Schema validation for tool args and config | Available as `import { z } from "zod"`; no separate install needed |
| Biome | ^2.4.10 (dev) | Lint + format | Already configured; covers all new TS files |
| @inquirer/select, checkbox, confirm, search | ^5-6.x | Interactive CLI prompts | Used by oc_configure wizard |
| mitt | ^3.0.1 | Typed event emitter | Already installed from v2.0; used by orchestrator lifecycle events |

## v4.0 Feature Stack Analysis

### 1. Mock/Fail-Forced Fallback Testing Mode

**New dependencies needed:** NONE

The mock infrastructure already exists and is complete:
- `src/observability/mock/types.ts` — 5 failure modes (`rate_limit`, `quota_exceeded`, `timeout`, `malformed`, `service_unavailable`)
- `src/observability/mock/mock-provider.ts` — `createMockError()` generates frozen error objects matching SDK error shapes
- `src/tools/mock-fallback.ts` — `oc_mock_fallback` tool registered and functional
- `src/orchestrator/fallback/error-classifier.ts` — `classifyErrorType()` and `isRetryableError()` already consume mock errors

**What's missing is wiring, not libraries:**
1. A config flag (`fallback.mockMode: MockFailureMode | false`) in the Zod config schema — extend existing `src/config.ts`
2. A hook in `FallbackManager` event handler that injects `createMockError(mode)` when mockMode is active
3. An `oc_configure` wizard section to toggle mock mode via existing `@inquirer/select`
4. The `oc_mock_fallback` tool needs "enable/disable" subcommands (currently only "list" and single-shot classification)

**Why no mocking library:** The mock provider IS the mocking library. `createMockError()` produces deterministic frozen objects that exactly match the shapes consumed by the error classifier. Adding sinon, vitest mocks, or testdouble would duplicate existing purpose-built code.

### 2. Manual QA Playbook Infrastructure

**New dependencies needed:** NONE

A QA playbook is structured markdown content, not an executable test suite. The infrastructure needed:

| Asset | Type | Purpose |
|-------|------|---------|
| `assets/commands/oc-qa.md` | Command | Entry point: runs structured QA verification |
| `assets/skills/qa-methodology/SKILL.md` | Skill | Injects QA best practices into system prompt when loaded |

**Pattern:** The playbook is a command file with `$ARGUMENTS` support. The command body contains structured test scripts organized by feature area:
- **Setup verification:** config loads, assets installed, health checks pass
- **Tool verification:** each `oc_*` tool called with known inputs, outputs validated
- **Agent verification:** each agent invoked via Task, responses checked for quality signals
- **Pipeline flow:** full orchestration run with known codebase, output matches expectations
- **Edge cases:** missing config, corrupt state, concurrent sessions

The AI executing the command IS the test runner. No Playwright, no Jest, no test framework needed for QA playbooks.

**What NOT to add:** Do not add any test framework or test runner for QA. The `bun test` runner handles unit/integration tests. QA playbooks are human-readable and AI-executable checklists.

### 3. Coding Standards Expansion (OOP, Abstraction, Design Principles)

**New dependencies needed:** NONE

Coding standards are pure markdown content in the adaptive skill system. The expansion adds new skill directories — zero code changes to the injection pipeline.

**New skills to author:**

| Skill Directory | Content Focus | `stacks` Tag | `requires` |
|----------------|--------------|--------------|------------|
| `oop-patterns/SKILL.md` | SOLID principles, composition over inheritance, encapsulation, polymorphism, interface segregation | `[]` (all languages) | `["coding-standards"]` |
| `abstraction-layers/SKILL.md` | Repository pattern, service layers, adapter pattern, dependency inversion, hexagonal architecture | `[]` (all languages) | `["coding-standards"]` |
| `java-patterns/SKILL.md` | Java-specific OOP idioms, Spring conventions, records, sealed classes, streams | `["java"]` | `["oop-patterns"]` |
| `csharp-patterns/SKILL.md` | C# patterns, LINQ, async/await, nullable refs, record types, minimal APIs | `["csharp"]` | `["oop-patterns"]` |
| `security-standards/SKILL.md` | Input sanitization, secrets management, OWASP top 10, auth patterns | `[]` (all languages) | `["coding-standards"]` |
| `api-design/SKILL.md` | REST conventions, error response format, pagination, versioning | `[]` (all languages) | `["coding-standards"]` |

**Why existing infrastructure is sufficient:**

1. **Stack detection** (`adaptive-injector.ts:detectProjectStackTags`) — already reads `package.json`, `tsconfig.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`, etc. Add Java/C# manifest detection (`pom.xml` -> `["java"]`, `*.csproj` -> `["csharp"]`) with a small code change to `MANIFEST_TAGS`
2. **Skill filtering** (`filterSkillsByStack`) — methodology skills with `stacks: []` always load; language skills filter by detected tags
3. **Dependency ordering** (`dependency-resolver.ts`) — topological sort already handles `requires` chains (e.g., `java-patterns` requires `oop-patterns` requires `coding-standards`)
4. **Token budgeting** (`buildMultiSkillContext`) — default 8000-token budget (32,000 chars) accommodates 5-8 additional skills. Each skill section averages 2000-4000 chars, so the budget handles the expansion without increase
5. **System prompt injection** (`experimental.chat.system.transform` hook) — already wired in `src/index.ts`

**Pattern for OOP/abstraction skills:** Write as opinionated DO/DON'T rules matching the existing `coding-standards/SKILL.md` format. The AI treats skill content as instructions. Each section: principle name, rationale, code examples in pseudocode (language-agnostic) or target language (language-specific skills).

**Small code change needed:** Add Java/C# manifest detection to `MANIFEST_TAGS` in `adaptive-injector.ts`:
```typescript
"pom.xml": ["java"],
"build.gradle": ["java"],
"*.csproj": ["csharp"],  // requires glob or directory scan
"Directory.Build.props": ["csharp"],
```

### 4. Command Namespace Prefixing (oc-*)

**New dependencies needed:** NONE

This is a file rename + validation update:

| Current Name | New Name | Notes |
|-------------|----------|-------|
| `brainstorm.md` | `oc-brainstorm.md` | |
| `new-agent.md` | `oc-new-agent.md` | |
| `new-command.md` | `oc-new-command.md` | |
| `new-skill.md` | `oc-new-skill.md` | |
| `oc-configure.md` | REMOVED | CLI-only per PROJECT.md |
| `quick.md` | `oc-quick.md` | |
| `review-pr.md` | `oc-review-pr.md` | |
| `stocktake.md` | `oc-stocktake.md` | |
| `tdd.md` | `oc-tdd.md` | |
| `update-docs.md` | `oc-update-docs.md` | |
| `write-plan.md` | `oc-write-plan.md` | |

**Code changes:**
- `src/tools/create-command.ts` — enforce `oc-` prefix in `validateCommandName`
- `src/utils/validators.ts` — update `BUILT_IN_COMMANDS` set with new names
- Grep all agent system prompts for hardcoded command references (e.g., `/brainstorm` -> `/oc-brainstorm`)

### 5. Agent Expansion to Competitive Parity

**New dependencies needed:** NONE

oh-my-openagent (main competitor) has 11 specialized agents with 8 task categories. This project currently has 5 standard agents + pipeline agents. New agents follow the existing `AgentConfig` pattern in `src/agents/`.

**Agents to add:**

| Agent | Mode | Group | Purpose |
|-------|------|-------|---------|
| `debugger` | subagent | coding | Systematic debugging with hypothesis-driven investigation |
| `security-reviewer` | subagent | review | Security-focused code review (OWASP, auth, injection) |
| `refactorer` | subagent | coding | Extract-method, rename, simplify refactoring |
| `test-writer` | subagent | coding | TDD-focused test generation |
| `planner` | subagent | planning | Detailed implementation planning (distinct from pipeline plan phase) |
| `architect` | subagent | planning | System design and architecture decisions |

All are `Readonly<AgentConfig>` objects with `Object.freeze()`, registered via `registerAgents()` in `configHook()`. Zero new dependencies.

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Any mocking library (sinon, testdouble, vitest mock) | Mock provider already built in `src/observability/mock/` with 5 failure modes | Existing `createMockError()` + `MockFailureMode` types |
| Any test runner for QA playbooks (Playwright, Jest) | QA playbooks are AI-executable markdown checklists | Command file + skill injection |
| AST parsing libraries (ts-morph, jscodeshift) | OOP standards enforced via prompt injection, not static analysis | Skill markdown files injected into system prompt |
| Documentation generators (typedoc, jsdoc) | QA playbooks are hand-authored markdown | Direct markdown authoring in `assets/` |
| Additional YAML libraries | `yaml@^2.8.3` handles all parsing needs | Already installed |
| Template engines (handlebars, mustache, ejs) | Templates are pure TS functions returning strings | Existing pattern in `src/templates/` |
| Agent frameworks (LangChain, Mastra, ADK-TS) | Agents are markdown prompts + AgentConfig objects; OpenCode IS the runtime | Config hook registration |
| Markdown linting libraries (markdownlint, remark-lint) | Skill/agent/command linting already handled by `src/skills/linter.ts` | Existing YAML frontmatter linter |

## Installation

```bash
# No new dependencies for v4.0
# The entire milestone is content authoring + wiring changes
```

## Integration Points for v4.0

### Mock Fallback Mode

```
src/config.ts (extend Zod schema)
  --> Add fallback.mockMode: z.union([z.literal(false), z.enum(FAILURE_MODES)])

src/orchestrator/fallback/ (existing FallbackManager)
  --> Check config.fallback.mockMode on error events
  --> If active, inject createMockError(mode) from src/observability/mock/

src/tools/configure.ts (existing oc_configure)
  --> Add "Mock Fallback Mode" section to wizard using @inquirer/select

src/tools/mock-fallback.ts (existing oc_mock_fallback)
  --> Add "enable <mode>" and "disable" subcommands to toggle at runtime
```

### Coding Standards Skills

```
assets/skills/<new-dir>/SKILL.md (new files)
  --> Discovered automatically by src/skills/loader.ts
  --> Filtered by src/skills/adaptive-injector.ts:filterSkillsByStack()
  --> Ordered by src/skills/dependency-resolver.ts
  --> Injected via experimental.chat.system.transform hook

src/skills/adaptive-injector.ts (small change)
  --> Add Java/C# manifest detection to MANIFEST_TAGS
```

### QA Playbook

```
assets/commands/oc-qa.md (new command file)
  --> YAML frontmatter with description and $ARGUMENTS
  --> Structured sections: Setup, Tools, Agents, Pipeline, Edge Cases

assets/skills/qa-methodology/SKILL.md (optional supporting skill)
  --> Injects QA mindset when loaded
```

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| @opencode-ai/plugin ^1.3.8 | Bun 1.3.x | Config hook API stable since 1.3.0 |
| yaml ^2.8.3 | All YAML 1.2 | Handles all frontmatter parsing |
| TypeScript ^6.0.2 | Biome ^2.4.10 | Both support latest TS syntax |
| zod (transitive) | @opencode-ai/plugin >=1.3.0 | Always available via plugin dep |

## Confidence Assessment

| Claim | Confidence | Basis |
|-------|------------|-------|
| Zero new dependencies needed | HIGH | Audited all 5 features against codebase; every integration point exists |
| Mock provider sufficient for fallback testing | HIGH | Code reviewed `mock-provider.ts`, `error-classifier.ts`, `mock-fallback.ts` |
| Skill system handles OOP/abstraction enforcement | HIGH | Code reviewed adaptive-injector.ts; dependency ordering, stack filtering, token budgeting operational |
| QA playbook needs no test framework | HIGH | Playbooks are AI-executable markdown, not automated test suites |
| Command rename is safe | MEDIUM | Need to grep agent prompts for hardcoded command references during implementation |
| Competitive parity benchmark (11 agents) | MEDIUM | Based on WebSearch for oh-my-openagent; may have changed |
| Token budget (8000) sufficient for expanded skills | MEDIUM | ~5-8 skills fit; may need monitoring if all methodology skills load simultaneously |

## Sources

- **Codebase audit:** `src/observability/mock/`, `src/skills/adaptive-injector.ts`, `src/agents/index.ts`, `src/tools/mock-fallback.ts`, `src/skills/linter.ts`, `assets/skills/coding-standards/SKILL.md` (HIGH confidence)
- [oh-my-openagent GitHub](https://github.com/code-yeongyu/oh-my-openagent) — competitor agent count and architecture (MEDIUM confidence)
- [OpenCode Skills documentation](https://opencode.ai/docs/skills) — skill format specification (HIGH confidence)
- [OpenCode Plugins documentation](https://opencode.ai/docs/plugins/) — plugin API reference (HIGH confidence)
- [OpenCode Agents documentation](https://opencode.ai/docs/agents/) — agent configuration, modes, Task dispatch (HIGH confidence)

---
*Stack research for: OpenCode Autopilot v4.0 Production Quality*
*Researched: 2026-04-03*
