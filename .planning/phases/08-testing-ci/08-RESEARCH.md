# Testing & CI Research

**Researched:** 2026-04-01
**Domain:** Testing strategy, CI/CD, Bun test ecosystem
**Confidence:** HIGH

## Summary

The OpenCode Assets Plugin already has strong test coverage: 530 tests across 49 files, with 96.30% function coverage and 97.37% line coverage. Bun's built-in test runner handles unit testing well, supports coverage reporting (text + lcov), and integrates cleanly with GitHub Actions via `oven-sh/setup-bun@v2`. No CI pipeline exists yet.

The main gaps are: (1) no GitHub Actions CI at all, (2) the `tool()` wrapper functions are untested (they just call `*Core` with `getGlobalConfigDir()` -- intentionally thin, but the 66% function coverage on tool files reflects this), (3) no integration test that validates the plugin entry point returns a properly-structured `Hooks` object with all expected tools, and (4) one existing TypeScript type error in `tests/review/tool.test.ts`.

True integration testing against the OpenCode runtime is not feasible -- the `@opencode-ai/plugin` package exports types and a thin `tool()` helper, but no plugin loader or registry that could be imported in tests. The plugin is loaded by the OpenCode process itself. However, the plugin's architecture (Core functions + thin wrappers) makes this a non-issue: the Core functions ARE the integration surface and they are well-tested.

**Primary recommendation:** Add a GitHub Actions CI workflow with lint, type-check, and test+coverage steps. Fix the one existing type error. Do NOT invest in "integration tests against OpenCode" -- the current Core function testing pattern is the right strategy.

## Project Constraints (from CLAUDE.md)

- **Runtime:** Bun only -- plugins run inside the OpenCode process via Bun
- **No standalone Zod install:** Use `tool.schema` (which IS Zod) for tool arg schemas
- **No `Bun.file()`/`Bun.write()`:** Use `node:fs/promises` for portability and testability
- **Model agnostic:** Never hardcode model identifiers in bundled agents
- **Global target:** Assets always write to `~/.config/opencode/` (not project-local)
- **`oc_` prefix:** All plugin tool names must start with `oc_`

## Current State Analysis

### Test Infrastructure
| Property | Value |
|----------|-------|
| Framework | Bun test runner (built-in), Bun 1.3.11 |
| Test count | 530 tests across 49 files |
| Function coverage | 96.30% |
| Line coverage | 97.37% |
| Config file | None (bunfig.toml absent -- uses defaults) |
| Quick run command | `bun test` |
| Full run with coverage | `bun test --coverage` |
| Execution time | ~260ms |
| CI pipeline | None -- no `.github/` directory exists |

### Coverage Gaps

| File | Func % | Line % | What's Untested |
|------|--------|--------|-----------------|
| `src/tools/create-agent.ts` | 66.67 | 93.75 | `tool()` wrapper (lines 44-45, 77-78) |
| `src/tools/create-command.ts` | 66.67 | 93.10 | `tool()` wrapper |
| `src/tools/create-skill.ts` | 66.67 | 93.10 | `tool()` wrapper |
| `src/tools/confidence.ts` | 66.67 | 86.49 | `tool()` wrapper + some branches |
| `src/tools/phase.ts` | 66.67 | 89.33 | `tool()` wrapper + some branches |
| `src/tools/plan.ts` | 66.67 | 88.10 | `tool()` wrapper + some branches |
| `src/tools/state.ts` | 66.67 | 82.02 | `tool()` wrapper + several branches |
| `src/tools/orchestrate.ts` | 76.92 | 72.30 | Multiple code paths (inline review, lesson injection, handler dispatch) |
| `src/tools/forensics.ts` | 85.71 | 78.46 | Some error paths |
| `src/tools/review.ts` | 91.67 | 85.62 | Some code paths |
| `src/review/pipeline.ts` | 100.00 | 77.63 | Several code paths in dispatch logic |
| `src/orchestrator/handlers/build.ts` | 86.96 | 90.29 | Wave execution paths |
| `src/installer.ts` | 100.00 | 88.17 | Error handling paths |

### Architectural Assessment of the Untested Code

The 66.67% function coverage on tool files is **by design**. Each tool file exports two things:
1. A `*Core` function (fully tested, accepts `baseDir` parameter for temp dir injection)
2. A `tool()` wrapper (3-line glue that calls Core with `getGlobalConfigDir()`)

The wrapper is untestable without the OpenCode runtime because `tool()` from `@opencode-ai/plugin` creates a `ToolDefinition` whose `execute()` receives a `ToolContext` (sessionID, abort signal, etc.) from the runtime. Testing the wrapper would require mocking the entire OpenCode plugin framework for minimal value.

**Verdict:** The Core/wrapper split is the correct testing strategy. The wrappers are trivial glue code. Do not invest effort testing them.

### What IS Worth Adding

1. **Smoke test for plugin structure:** The existing `tests/index.test.ts` validates `plugin()` returns a `Hooks` object, but does not verify all expected tool names are present. A test asserting `Object.keys(result.tool)` contains all 11 expected `oc_*` tool names would catch registration regressions.

2. **Type checking in CI:** There is one existing TypeScript error:
   ```
   tests/review/tool.test.ts(55,55): error TS2769: No overload matches this call.
   ```
   This should be fixed and `bunx tsc --noEmit` added to CI.

3. **Coverage thresholds:** Bun supports `coverageThreshold` in `bunfig.toml`. Setting a floor prevents regression.

## Standard Stack

### Core (Already In Use)
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| Bun test runner | 1.3.11 (built-in) | Unit/integration testing | Zero config, fast, built-in mocking |
| Biome | 2.4.10 | Lint + format | Already configured, replaces ESLint+Prettier |

### CI Addition
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| `oven-sh/setup-bun@v2` | v2 | GitHub Actions Bun setup | Official action, supports version pinning + caching |
| `actions/checkout@v4` | v4 | Code checkout | Standard GitHub Actions |

### Coverage Reporting (Optional)
| Tool | Purpose | When to Use |
|------|---------|-------------|
| Bun lcov reporter | Generate lcov.info for CI services | Only if Codecov/Coveralls integration desired |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Bun test | Vitest | Vitest has richer ecosystem but adds a dep; Bun test is already working well |
| Biome | ESLint + Prettier | More plugins available but slower, more config; Biome already in place |

## Architecture Patterns

### Test Organization (Current -- Keep As-Is)
```
tests/
  index.test.ts            Plugin entry point smoke tests
  installer.test.ts        Asset installation (temp dir isolation)
  config.test.ts           Config load/save/migration
  validators.test.ts       Name validation rules
  templates.test.ts        Markdown generation (pure functions)
  create-agent.test.ts     Agent creation Core function
  create-skill.test.ts     Skill creation Core function
  create-command.test.ts   Command creation Core function
  agents/                  Agent definition tests
    config-hook.test.ts    Config hook integration
  tools/                   Tool Core function tests
    orchestrate.test.ts    Orchestrator logic
    state.test.ts          State management
  orchestrator/            Orchestrator module tests
    state.test.ts          State load/save/patch
    phase.test.ts          Phase transitions
    plan.test.ts           Task wave decomposition
  review/                  Review engine tests
    pipeline.test.ts       Review pipeline dispatch
    agents.test.ts         Review agent definitions
```

### Pattern 1: Core Function Testing (Established)
**What:** Every tool exports a `*Core(args, baseDir)` function tested with temp directories.
**When to use:** All tool tests -- inject temp dir, exercise logic, assert file output.
**Example:**
```typescript
// From tests/tools/orchestrate.test.ts -- existing pattern
let tempDir: string;
beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "orchestrate-tool-test-"));
});
afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});
test("with idea creates state and returns dispatch", async () => {
  const result = await orchestrateCore({ idea: "build a chat" }, tempDir);
  const parsed = JSON.parse(result);
  expect(parsed.action).toBe("dispatch");
});
```

### Pattern 2: Temp Directory Isolation (Established)
**What:** All filesystem-touching tests create unique temp dirs and clean up after.
**Why critical:** Tests must never touch `~/.config/opencode/` (the real global dir).
**Example:** Every test file uses `mkdtemp(join(tmpdir(), "prefix-"))` in `beforeEach`.

### Anti-Patterns to Avoid
- **Testing `tool()` wrappers directly:** Requires mocking OpenCode's ToolContext for zero value. The Core function IS the test target.
- **Snapshot testing markdown output:** Templates evolve frequently; snapshot tests would break on every content change and provide false security. Current assertion-based tests are better.
- **Mocking the filesystem globally:** Current pattern of temp dir injection is superior -- tests hit real fs operations (mkdir, writeFile with wx flag, copyFile with COPYFILE_EXCL) and catch real bugs.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CI workflow | Custom scripts for lint+test+typecheck | GitHub Actions with `oven-sh/setup-bun@v2` | Standard, maintained, caching built-in |
| Coverage reporting | Custom coverage scripts | `bunfig.toml` with `coverageThreshold` | Built into Bun, enforced automatically |
| Code formatting checks | Custom format checkers | `biome check .` (already configured) | Already in place, catches lint + format in one command |

## Integration Testing Feasibility

### Can We Test Against OpenCode's Plugin System?

**Answer: No, and we should not try.** Confidence: HIGH

**Evidence:**
- `@opencode-ai/plugin` v1.3.8 exports: `Plugin` type, `PluginInput` type, `Hooks` interface, `ToolDefinition` type, `tool()` helper function, and `ToolContext` type
- It does NOT export: a plugin loader, a tool registry, a config hook runner, or any test utilities
- The `tool()` function is a thin wrapper that adds Zod schema types -- it does not validate or register anything
- Plugin loading happens inside the OpenCode process (the main `opencode` binary imports and calls the plugin function)
- The `ToolContext` passed to `execute()` contains runtime-only values: `sessionID`, `messageID`, `abort` signal, `metadata()` callback, `ask()` for permissions

**What we CAN test (and already do):**
1. The plugin function returns a valid `Hooks`-shaped object (tests/index.test.ts)
2. All Core functions work correctly with injected temp directories
3. Config hook mutates the config object correctly (tests/agents/config-hook.test.ts)
4. The installer copies files and respects COPYFILE_EXCL (tests/installer.test.ts)

**What we CANNOT test without the OpenCode runtime:**
- Tool execution through the LLM dispatch path
- Event handling for `session.created`
- Permission prompts via `context.ask()`
- Actual plugin loading and registration

**Recommendation:** This is analogous to how VS Code extensions test: VS Code extension tests run unit tests against the extension's logic, and only use the VS Code test host for integration tests that need the full editor. For this plugin, the Core function pattern IS the correct analog. The thin `tool()` wrappers are equivalent to VS Code's `activate()` registration -- trivial glue not worth integration-testing.

## CI Workflow Recommendation

### Recommended GitHub Actions Workflow

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: "1.3.11"

      - run: bun install --frozen-lockfile

      - name: Lint and format check
        run: bun run lint

      - name: Type check
        run: bunx tsc --noEmit

      - name: Test with coverage
        run: bun test --coverage --bail 1
```

**Design decisions:**
- **Single job, not parallel:** The entire check runs in <30 seconds. Parallelizing lint/type-check/test into separate jobs adds overhead (3x setup time) for no benefit at this project's scale.
- **`--frozen-lockfile`:** Prevents CI from silently upgrading deps.
- **`--bail 1`:** Fast fail on first test failure.
- **No coverage upload:** At 97% coverage, uploading to Codecov adds complexity without value. The coverage threshold in `bunfig.toml` is sufficient.
- **Pin Bun version:** Matches local development environment (1.3.11).

### Recommended bunfig.toml

```toml
[test]
coverageThreshold = { lines = 0.90, functions = 0.90 }
coverageSkipTestFiles = true
```

**Why 90% not 97%:** Current coverage is 97%, but new features (pipeline phases PIPE-01 through PIPE-08) will add code. A 90% floor prevents major regressions while leaving room for work-in-progress code.

## Common Pitfalls

### Pitfall 1: Testing Against Real Global Config Dir
**What goes wrong:** A test accidentally writes to `~/.config/opencode/` instead of a temp dir, corrupting the developer's real config.
**Why it happens:** Forgetting to pass `baseDir` to a Core function, or calling a `tool()` wrapper directly.
**How to avoid:** Always use `*Core(args, tempDir)` in tests. Never import and call `tool()` wrappers in test files.
**Warning signs:** Tests that import `getGlobalConfigDir` directly.

### Pitfall 2: Flaky Temp Dir Cleanup
**What goes wrong:** `afterEach` cleanup fails (e.g., permission error), leaving temp dirs that accumulate.
**Why it happens:** A test creates a file with restricted permissions and doesn't restore them before cleanup.
**How to avoid:** Use `rm(tempDir, { recursive: true, force: true })` -- the `force` flag handles permission issues. Already done correctly in existing tests.
**Warning signs:** Growing `/tmp/opencode-*` directories on CI runners.

### Pitfall 3: Bun Version Drift Between Local and CI
**What goes wrong:** Tests pass locally but fail in CI (or vice versa) due to Bun version differences.
**Why it happens:** Developer upgrades Bun locally without updating CI config, or CI uses `latest`.
**How to avoid:** Pin exact Bun version in CI workflow. Document required version in CLAUDE.md.
**Warning signs:** Test failures that only occur in CI.

### Pitfall 4: Type Check vs Runtime Divergence
**What goes wrong:** `tsc --noEmit` passes but runtime behavior differs because Bun's TypeScript handling is more permissive.
**Why it happens:** Bun strips types at runtime without checking them. `tsc` checks types but may have different module resolution.
**How to avoid:** Run both in CI. Fix type errors even if tests pass.
**Warning signs:** The existing type error in `tests/review/tool.test.ts` is exactly this -- tests pass but `tsc` fails.

### Pitfall 5: COPYFILE_EXCL Race Conditions in CI
**What goes wrong:** Parallel test runs (if ever enabled) conflict on temp dirs.
**Why it happens:** Two test files create same-named temp dir.
**How to avoid:** Current pattern uses `Date.now()` or `mkdtemp` for unique dirs. Keep this pattern.

## Code Examples

### Adding a Tool Registration Smoke Test
```typescript
// tests/index.test.ts -- suggested addition
test("registers all expected tools", async () => {
  const result = await plugin(mockInput);
  const toolNames = Object.keys(result.tool ?? {});
  const expected = [
    "oc_placeholder",
    "oc_create_agent",
    "oc_create_skill",
    "oc_create_command",
    "oc_state",
    "oc_confidence",
    "oc_phase",
    "oc_plan",
    "oc_orchestrate",
    "oc_forensics",
    "oc_review",
  ];
  expect(toolNames.sort()).toEqual(expected.sort());
});
```

### bunfig.toml Coverage Configuration
```toml
[test]
coverageThreshold = { lines = 0.90, functions = 0.90 }
coverageSkipTestFiles = true
```

### Fixing the Existing Type Error
```typescript
// tests/review/tool.test.ts line 55 -- likely needs a type assertion
// Current (broken):
expect(something).toContain(value)  // where value is unknown
// Fix:
expect(something).toContain(value as string)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Jest for Bun projects | Bun's built-in test runner | Bun 1.0 (Sep 2023) | No external test dep needed |
| ESLint + Prettier | Biome | 2024 | Single tool for lint + format |
| `setup-bun@v1` | `setup-bun@v2` | 2024 | Better caching, version management |
| Manual lcov generation | `bun test --coverage-reporter=lcov` | Bun 1.1+ | Built-in, no Istanbul needed |

## Open Questions

1. **Coverage upload service?**
   - What we know: Bun generates lcov.info natively. Codecov and Coveralls both accept it.
   - What's unclear: Whether the project wants badge-driven coverage tracking.
   - Recommendation: Skip for now. The `coverageThreshold` in bunfig.toml is sufficient. Add Codecov later if desired.

2. **Should CI run on more than ubuntu-latest?**
   - What we know: Plugin targets Bun on any OS. Bun supports Linux, macOS, Windows.
   - What's unclear: Whether any users run OpenCode on Windows or macOS.
   - Recommendation: Start with ubuntu-latest only. Add matrix if Windows/macOS issues are reported.

3. **Pre-commit hooks?**
   - What we know: Biome lint and format are fast (<1s). Tests run in ~260ms.
   - What's unclear: Whether the developer wants local enforcement vs CI-only.
   - Recommendation: CI is sufficient for a solo-developer project. Add Husky/lint-staged later if team grows.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Bun | Test runner, package manager | Yes | 1.3.11 | -- |
| Biome | Lint + format | Yes (devDep) | 2.4.10 | -- |
| TypeScript (tsc) | Type checking | Yes (via bun-types) | ESNext target | -- |
| GitHub Actions | CI pipeline | Yes (GitHub repo) | -- | -- |

**Missing dependencies:** None. All required tools are available.

## Sources

### Primary (HIGH confidence)
- Local project analysis: 49 test files, `bun test --coverage` output, package.json, tsconfig.json, biome.json
- `@opencode-ai/plugin` v1.3.8 type definitions (node_modules inspection): confirmed no test utilities or plugin loader exported
- [Bun code coverage docs](https://bun.com/docs/test/coverage) -- lcov reporter, thresholds, bunfig.toml config
- [Bun CI/CD guide](https://bun.com/docs/guides/runtime/cicd) -- setup-bun action usage
- [oven-sh/setup-bun](https://github.com/oven-sh/setup-bun) -- official GitHub Action

### Secondary (MEDIUM confidence)
- VS Code extension testing patterns (conceptual analogy for plugin testing strategy)

### Tertiary (LOW confidence)
- None -- all findings verified against local project state or official docs

## Metadata

**Confidence breakdown:**
- Current test state: HIGH -- direct measurement from `bun test --coverage`
- CI workflow: HIGH -- standard GitHub Actions + official Bun action
- Integration testing feasibility: HIGH -- inspected actual `@opencode-ai/plugin` exports
- Coverage gaps: HIGH -- direct measurement from coverage report

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable -- Bun test runner is mature, CI patterns are standard)
