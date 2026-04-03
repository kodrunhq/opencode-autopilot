# Phase 22: Production Hardening - Research

**Researched:** 2026-04-03
**Domain:** Plugin resilience, language detection, diagnostics, code quality hooks
**Confidence:** HIGH

## Summary

Phase 22 comprises four orthogonal workstreams that harden the plugin for production use. All four build on well-established patterns already in the codebase -- config migration chains, health check composition, manifest-based stack detection, and PostToolUse hook registration. No new dependencies are required.

The mock fallback test mode (HARD-01) extends the existing `oc_mock_fallback` tool and config system with a `fallback.testMode` field and a v6 migration. Context-aware commands (HARD-02) reuse `detectProjectStackTags()` to inject a `$LANGUAGE` variable into four command prompts. Skill-aware doctor (HARD-03) adds three new health checks to the existing `checks.ts` / `runner.ts` infrastructure. The anti-slop comment hook (HARD-04) registers a new PostToolUse hook in `index.ts` that scans edited code files for AI comment bloat patterns.

**Primary recommendation:** Implement as four independent workstreams. Each follows existing patterns closely -- the primary risk is in the anti-slop hook's false-positive rate, which is mitigated by the warn-only default (D-12).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Activation via config flag only. Add a `fallback.testMode` field to plugin config with a v6 migration. User enables via `oc_configure` CLI. No runtime toggle tool.
- **D-02:** Simulate all four failure scenarios: rate limit (429), quota exceeded, service unavailable (503), and malformed response.
- **D-03:** Deterministic sequence triggering. Config specifies an ordered list of failure types. Each model call hits the next failure in sequence, then cycles. Predictable and reproducible.
- **D-04:** Implementation builds on existing `src/orchestrator/fallback/error-classifier.ts` patterns and `fallback-manager.ts` state machine. The mock layer intercepts before real API calls when testMode is active.
- **D-05:** Inject detected language via a `$LANGUAGE` variable into command prompts, similar to how `$ARGUMENTS` works today.
- **D-06:** Four commands become language-aware: `oc-tdd`, `oc-review-pr`, `oc-brainstorm`, `oc-write-plan`.
- **D-07:** Stack detection reuses `detectProjectStackTags()` from `src/skills/adaptive-injector.ts`.
- **D-08:** Skill diagnostics show a per-stack summary: detected stacks and how many skills matched/loaded for each.
- **D-09:** Memory DB health check: verify SQLite DB file exists and is readable, report observation count and last-captured date.
- **D-10:** Command accessibility check: verify each expected command .md file exists AND parse YAML frontmatter to verify description and argument-hint are present.
- **D-11:** New checks added to `src/health/checks.ts` following the existing `HealthResult` pattern with `Object.freeze()`.
- **D-12:** Warn only -- print a warning with offending lines when slop comments are detected. Non-blocking.
- **D-13:** Detection via a curated regex pattern list matching common AI comment slop.
- **D-14:** Fires on all code file types (.ts, .tsx, .js, .jsx, .py, .go, .rs, .java, .cs, .rb, .cpp, .c, .h). Skips non-code files.
- **D-15:** Implemented as a PostToolUse hook registered in `src/index.ts` alongside existing hooks.

### Claude's Discretion
- Exact regex patterns for the anti-slop list (within the "obvious comments + sycophantic language" scope)
- How `$LANGUAGE` variable is resolved and injected (hook vs inline in injection layer)
- Comment syntax detection per language (single-line // vs # vs --)
- Config v6 schema for testMode (exact field structure and defaults)
- How mock failures integrate with the existing fallback state machine
- Doctor output formatting (table vs list)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HARD-01 | Mock/fail-forced fallback test mode accessible from CLI configure, simulates rate-limit, timeout, quota-exceeded, malformed | Config v6 migration pattern (v1-v5 chain exists), mock-provider.ts already generates deterministic errors, FallbackManager.handleError() is the interception point |
| HARD-02 | Context-aware commands auto-detect project language from files instead of requiring per-language variants | `detectProjectStackTags()` already handles 15 manifest files + extension patterns, `$ARGUMENTS` substitution pattern in command prompts is the template |
| HARD-03 | Doctor extended with skill-aware diagnostics (skill loading per detected stack, memory DB health, command accessibility) | `HealthResult` type + `Object.freeze()` pattern in checks.ts, `runHealthChecks()` uses `Promise.allSettled`, `loadAllSkills()` and `getMemoryDb()` provide data sources |
| HARD-04 | Anti-slop comment hook prevents AI-generated comment bloat, configurable via profiles | PostToolUse hook registration in index.ts `tool.execute.after`, regex pattern matching pattern from error-classifier.ts |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| bun:sqlite | built-in | Memory DB health queries | Already used in memory/database.ts |
| node:fs/promises | built-in | File access checks, command verification | Project constraint: no Bun.file() |
| zod | transitive | Config v6 schema validation | Already used for all config schemas |
| yaml | ^2.x | Command frontmatter parsing | Already used in skills/loader.ts |

### Supporting
No new dependencies required. All four workstreams use existing project infrastructure.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Regex-based slop detection | AST-based comment extraction | Overkill for v1 warn-only mode; regex is fast, deterministic, easy to extend |
| Config-based testMode | Runtime toggle tool | D-01 explicitly locks to config-only activation |

**Installation:** No new packages needed.

## Architecture Patterns

### Recommended Project Structure
```
src/
  config.ts                    # Add v6 schema + migration (testMode field)
  index.ts                     # Register anti-slop PostToolUse hook
  health/
    checks.ts                  # Add skillHealthCheck, memoryHealthCheck, commandHealthCheck
    runner.ts                  # Register 3 new checks in runHealthChecks
    types.ts                   # No changes needed (HealthResult already sufficient)
  orchestrator/fallback/
    fallback-config.ts         # Extend with testMode sub-schema
    fallback-manager.ts        # Add mock interception when testMode active
    mock-interceptor.ts        # NEW: Deterministic sequence mock layer
  hooks/
    anti-slop.ts               # NEW: PostToolUse hook for comment bloat detection
    slop-patterns.ts           # NEW: Curated regex patterns + comment syntax map
  utils/
    language-resolver.ts       # NEW: $LANGUAGE resolution from detectProjectStackTags
  assets/commands/
    oc-tdd.md                  # Add $LANGUAGE reference
    oc-review-pr.md            # Add $LANGUAGE reference
    oc-brainstorm.md           # Add $LANGUAGE reference
    oc-write-plan.md           # Add $LANGUAGE reference
```

### Pattern 1: Config v6 Migration
**What:** Add `testMode` to fallback config with a v5-to-v6 migration function.
**When to use:** Every config schema change.
**Example:**
```typescript
// In fallback-config.ts
export const testModeSchema = z.object({
  enabled: z.boolean().default(false),
  sequence: z.array(z.enum(["rate_limit", "quota_exceeded", "service_unavailable", "malformed"]))
    .default([]),
});

// In config.ts — v6 schema extends v5 with testMode in fallback
const pluginConfigSchemaV6 = z.object({
  version: z.literal(6),
  // ... all v5 fields ...
  fallback: fallbackConfigSchemaV6.default(fallbackDefaultsV6), // includes testMode
});

function migrateV5toV6(v5Config: PluginConfigV5): PluginConfig {
  return {
    version: 6 as const,
    ...v5Config,
    fallback: { ...v5Config.fallback, testMode: { enabled: false, sequence: [] } },
  };
}
```

### Pattern 2: Mock Interceptor (Deterministic Sequence)
**What:** A stateful interceptor that cycles through a configured failure sequence.
**When to use:** When testMode.enabled is true and sequence is non-empty.
**Example:**
```typescript
// src/orchestrator/fallback/mock-interceptor.ts
export class MockInterceptor {
  private index = 0;
  constructor(private readonly sequence: readonly MockFailureMode[]) {}

  next(): MockFailureMode {
    const mode = this.sequence[this.index % this.sequence.length];
    this.index++;
    return mode;
  }

  reset(): void { this.index = 0; }
}
```

### Pattern 3: Health Check Addition
**What:** New async functions returning `Object.freeze()`d `HealthResult` objects.
**When to use:** Extending doctor diagnostics.
**Example:**
```typescript
// In health/checks.ts
export async function skillHealthCheck(projectRoot: string): Promise<HealthResult> {
  const tags = await detectProjectStackTags(projectRoot);
  const allSkills = await loadAllSkills(join(getGlobalConfigDir(), "skills"));
  const filtered = filterSkillsByStack(allSkills, tags);
  
  return Object.freeze({
    name: "skill-loading",
    status: "pass" as const,
    message: `Detected stacks: [${tags.join(", ")}], ${filtered.size}/${allSkills.size} skills matched`,
    details: Object.freeze([...filtered.keys()]),
  });
}
```

### Pattern 4: PostToolUse Anti-Slop Hook
**What:** Hook fires after file-editing tools, scans written content for AI comment patterns.
**When to use:** After `write`, `edit`, or similar tool executions that modify code files.
**Example:**
```typescript
// In hooks/anti-slop.ts
export function createAntiSlopHandler(options: { showToast: SdkOperations["showToast"] }) {
  return async (
    hookInput: { tool: string; sessionID: string; args: unknown },
    output: { title: string; output: string; metadata: unknown },
  ) => {
    // Only fire on file-writing tools
    const filePath = extractFilePath(hookInput.args);
    if (!filePath || !isCodeFile(filePath)) return;
    
    // Read file content and scan for slop patterns
    const findings = scanForSlopComments(content, filePath);
    if (findings.length > 0) {
      await options.showToast("Anti-Slop Warning", formatFindings(findings), "warning");
    }
  };
}
```

### Pattern 5: $LANGUAGE Variable Injection
**What:** Resolve project language tags and substitute `$LANGUAGE` in command prompts.
**When to use:** Before command prompt is sent to the model.
**Example:**
```typescript
// The simplest approach: resolve at command execution time
// Commands reference $LANGUAGE which gets resolved alongside $ARGUMENTS
// In the injection layer or a pre-command hook:
const tags = await detectProjectStackTags(process.cwd());
const language = tags.length > 0 ? tags.join(", ") : "unknown";
// Replace $LANGUAGE in the command prompt text
```

### Anti-Patterns to Avoid
- **Mutating FallbackManager state directly in mock mode:** Use the same plan-then-commit pattern. The mock interceptor generates errors that flow through handleError() normally.
- **Reading entire files for slop detection:** Only read file content when the tool output indicates a code file was written. Use the tool args to get the file path.
- **Blocking on health checks:** All new health checks must follow the Promise.allSettled pattern. A failing skill loader must not crash the doctor report.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter parsing | Custom regex parser | `yaml` package (already a dependency) | Edge cases with multiline values, escaping |
| Stack detection | New manifest scanning | `detectProjectStackTags()` from adaptive-injector.ts | Already handles 15 manifest files + extension patterns (D-07) |
| Error shape generation | New mock error builders | `createMockError()` from mock-provider.ts | Already generates correct shapes for all 5 failure modes |
| Config validation | Manual field checking | Zod schemas with `.default()` | Consistent with entire config system |

**Key insight:** Every subsystem this phase touches has a well-established pattern. The research confirms zero hand-rolling is needed -- extend existing modules, not replace them.

## Common Pitfalls

### Pitfall 1: testMode Intercepting Non-Fallback Calls
**What goes wrong:** Mock interceptor fires on ALL model calls including health checks, observability, or memory capture.
**Why it happens:** testMode intercepts at too broad a scope.
**How to avoid:** Interceptor must ONLY fire in the fallback path (inside `FallbackManager.handleError` or the event handler that calls it). The mock generates errors that flow through the normal fallback pipeline -- it does NOT replace the model call itself.
**Warning signs:** Tests pass but real sessions break because non-chat model calls get intercepted.

### Pitfall 2: Anti-Slop Hook Reading Stale File Content
**What goes wrong:** Hook reads file content from disk but the tool already has the content in its output.
**Why it happens:** PostToolUse fires after the tool completes. The output often contains the written content or diff.
**How to avoid:** Extract content from `output.output` or `hookInput.args` when possible. Only fall back to reading from disk if the tool output does not contain the file content.
**Warning signs:** Hook reports false negatives because it reads pre-edit content from a race condition.

### Pitfall 3: $LANGUAGE Resolution Timing
**What goes wrong:** `detectProjectStackTags()` is async and requires filesystem access. If called at the wrong time (e.g., during system prompt injection), it can slow down every message.
**Why it happens:** Stack detection does ~15 `access()` calls + 1 `readdir()`.
**How to avoid:** Cache the result per session or per plugin load. Stack detection is deterministic for a given project root -- it does not change during a session.
**Warning signs:** Noticeable latency on every command invocation.

### Pitfall 4: Memory DB Health Check Opening a New Connection
**What goes wrong:** Health check calls `getMemoryDb()` which creates a singleton. If the DB does not exist yet, it creates one (side effect during a diagnostic).
**Why it happens:** `getMemoryDb()` has create-on-first-access semantics.
**How to avoid:** For health checks, use `access()` to verify the DB file exists and `new Database(path, { readonly: true })` or a raw file stats check. Do NOT call `getMemoryDb()` from a health check.
**Warning signs:** Running `oc_doctor` before any memory capture creates an empty database file.

### Pitfall 5: Command Frontmatter Parsing Divergence
**What goes wrong:** Health check parses command frontmatter differently from how OpenCode parses it.
**Why it happens:** OpenCode uses its own YAML parser; the health check uses the `yaml` package.
**How to avoid:** Keep validation minimal -- check that `---` block exists, extract `description`, verify it is non-empty. Do not try to fully replicate OpenCode's parsing.
**Warning signs:** Health check reports "pass" but OpenCode fails to load the command.

### Pitfall 6: Config v6 Migration Breaking v5 Configs
**What goes wrong:** v5 configs that were valid fail to parse after the v6 migration is added.
**Why it happens:** The migration chain tries v6 first, fails, tries v5, migrates -- but the v5 schema changes if not carefully preserved.
**How to avoid:** Preserve the exact v5 schema as `pluginConfigSchemaV5` (internal, for migration). The v6 schema is the new current. Follow the exact pattern of v4->v5 migration.
**Warning signs:** Existing tests for `loadConfig()` fail after adding v6.

## Code Examples

### Mock Interceptor Integration Point
```typescript
// In the event handler or FallbackManager.handleError path:
// When testMode is active, instead of waiting for a real error,
// the mock interceptor generates the next error in sequence.
// The generated error flows through classifyErrorType() and isRetryableError()
// exactly as a real error would.

// The interception point is in the event handler that detects model errors.
// When testMode.enabled, the handler calls mockInterceptor.next() to get the
// failure mode, then createMockError(mode) to generate the error object,
// then feeds it to manager.handleError(sessionID, mockError).
```

### Comment Syntax Map
```typescript
// Per-language comment detection for anti-slop hook
const COMMENT_PATTERNS: Readonly<Record<string, RegExp>> = Object.freeze({
  "//": /^\s*\/\/\s*(.+)/,        // JS, TS, Java, C#, Go, Rust, C, C++
  "#": /^\s*#\s*(.+)/,            // Python, Ruby
  "--": /^\s*--\s*(.+)/,          // SQL, Haskell, Lua
});

// File extension to comment style mapping
const EXT_COMMENT_STYLE: Readonly<Record<string, string>> = Object.freeze({
  ".ts": "//", ".tsx": "//", ".js": "//", ".jsx": "//",
  ".java": "//", ".cs": "//", ".go": "//", ".rs": "//",
  ".c": "//", ".cpp": "//", ".h": "//",
  ".py": "#", ".rb": "#",
});
```

### Anti-Slop Regex Patterns (Recommended)
```typescript
// Curated list targeting obvious AI comment bloat
// These patterns match against extracted comment TEXT (not full lines)
const SLOP_PATTERNS: readonly RegExp[] = Object.freeze([
  // Obvious/redundant comments
  /^increment\s+.*\s+by\s+\d+$/i,
  /^decrement\s+.*\s+by\s+\d+$/i,
  /^set\s+\w+\s+to\s+/i,
  /^return\s+the\s+(result|value|data)/i,
  /^(?:this|the)\s+(?:function|method|class)\s+(?:does|will|is used to|handles)/i,
  /^(?:initialize|init)\s+(?:the\s+)?(?:variable|value|state)/i,
  /^loop\s+(?:through|over)\s+/i,
  /^check\s+if\s+/i,
  /^import\s+(?:the\s+)?(?:necessary|required|needed)/i,
  /^define\s+(?:the\s+)?(?:interface|type|class|function)/i,
  
  // Sycophantic/marketing language
  /\belegantly?\b/i,
  /\brobust(?:ly|ness)?\b/i,
  /\bcomprehensive(?:ly)?\b/i,
  /\bseamless(?:ly)?\b/i,
  /\blever(?:age|aging)\b/i,
  /\bpowerful\b/i,
  /\bsophisticated\b/i,
  /\bstate[\s-]of[\s-]the[\s-]art\b/i,
  /\bcutting[\s-]edge\b/i,
  /\bbest[\s-]practice[s]?\b/i,
]);
```

### Health Check Registration
```typescript
// In runner.ts — extend the Promise.allSettled array
const settled = await Promise.allSettled([
  configHealthCheck(options?.configPath),
  agentHealthCheck(options?.openCodeConfig ?? null),
  assetHealthCheck(options?.assetsDir, options?.targetDir),
  // New checks for Phase 22
  skillHealthCheck(options?.projectRoot ?? process.cwd()),
  memoryHealthCheck(),
  commandHealthCheck(options?.targetDir),
]);

const fallbackNames = [
  "config-validity", "agent-injection", "asset-directories",
  "skill-loading", "memory-db", "command-accessibility",
];
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual per-language command variants | $LANGUAGE variable injection | Phase 22 | Single command template adapts to any detected language |
| Error classification only (oc_mock_fallback) | Full mock interception with sequence cycling | Phase 22 | Enables end-to-end fallback chain testing without hitting APIs |
| 3 health checks (config, agents, assets) | 6 health checks (+skills, memory, commands) | Phase 22 | Comprehensive self-diagnostics covering all subsystems |
| No code quality hooks | Anti-slop PostToolUse hook | Phase 22 | Prevents AI comment bloat at write time |

## Open Questions

1. **PostToolUse Hook Input Shape**
   - What we know: `tool.execute.after` in index.ts receives `hookInput` with tool name, sessionID, callID, args; and `output` with title, output, metadata.
   - What's unclear: Whether `args` reliably contains the file path for all file-writing tools (write_file, edit_file, etc.), or if the path is only in the output.
   - Recommendation: Inspect both `args` and `output` for file path extraction. The tool name itself (e.g., `write_file`, `edit`) hints at which field contains the path.

2. **$LANGUAGE Injection Mechanism**
   - What we know: Commands use `$ARGUMENTS` which is resolved by OpenCode itself before sending to the model.
   - What's unclear: Whether OpenCode resolves custom variables like `$LANGUAGE` or if the plugin must handle substitution.
   - Recommendation: Use `experimental.chat.system.transform` or a command-level pre-hook to substitute `$LANGUAGE` before the prompt reaches the model. If OpenCode only resolves `$ARGUMENTS`, the plugin must do its own substitution. As a fallback, embed language context as a preamble rather than a variable.

3. **Anti-Slop False Positive Rate**
   - What we know: Regex-based detection will have false positives (e.g., "robust" in a legitimate security context).
   - What's unclear: How frequently users will see false warnings.
   - Recommendation: Start with a conservative pattern list (obvious redundant comments only). Sycophantic language patterns should be more specific (e.g., only flag when the word appears in a comment, not in code). D-12 (warn-only) mitigates this.

## Sources

### Primary (HIGH confidence)
- `src/config.ts` -- v1-v5 migration chain pattern, Zod schema composition
- `src/orchestrator/fallback/error-classifier.ts` -- RETRYABLE_ERROR_PATTERNS, classifyErrorType()
- `src/orchestrator/fallback/fallback-manager.ts` -- handleError() flow, session state management
- `src/orchestrator/fallback/fallback-config.ts` -- fallbackConfigSchema structure
- `src/observability/mock/mock-provider.ts` -- createMockError() for all 5 failure modes
- `src/observability/mock/types.ts` -- MockFailureMode, FAILURE_MODES
- `src/health/checks.ts` -- configHealthCheck, agentHealthCheck, assetHealthCheck patterns
- `src/health/runner.ts` -- runHealthChecks with Promise.allSettled
- `src/health/types.ts` -- HealthResult, HealthReport interfaces
- `src/skills/adaptive-injector.ts` -- detectProjectStackTags(), MANIFEST_TAGS, EXT_MANIFEST_TAGS
- `src/skills/loader.ts` -- loadAllSkills(), parseSkillFrontmatter()
- `src/memory/database.ts` -- getMemoryDb(), initMemoryDb()
- `src/memory/repository.ts` -- getObservationsByProject() for count queries
- `src/index.ts` -- Plugin entry, hook registration, tool.execute.after handler
- `assets/commands/oc-tdd.md` -- Current command template with $ARGUMENTS
- `assets/commands/oc-review-pr.md` -- More complex command with $ARGUMENTS

### Secondary (MEDIUM confidence)
- OpenCode plugin hook documentation (tool.execute.after input/output shape inferred from index.ts usage)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all patterns verified in codebase
- Architecture: HIGH -- all four workstreams follow existing patterns with clear extension points
- Pitfalls: HIGH -- identified from direct code reading, especially singleton DB behavior and hook timing

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (stable codebase, no external dependency changes)
