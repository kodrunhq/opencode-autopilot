# Phase 13: Session Observability - Research

**Researched:** 2026-04-02
**Domain:** Plugin observability (structured logging, token tracking, decision replay, context monitoring, TUI output, mock provider)
**Confidence:** HIGH

## Summary

Phase 13 adds a full observability layer to the opencode-autopilot plugin. The codebase is well-positioned for this: the plugin SDK exposes rich event types (30+ event types including `session.created`, `session.error`, `session.compacted`, `message.updated`), `AssistantMessage` already carries per-message `tokens` (input, output, reasoning, cache) and `cost` fields, and the `Model` type includes `cost` (per-token pricing) and `limit.context` (context window size). The existing `event` hook handler pattern in `src/index.ts` is the proven integration point, and the `*Core + tool()` wrapper pattern is the established tool registration approach.

The primary technical challenge is designing a lightweight in-memory event bus that accumulates per-session events without blocking the plugin's critical path, then flushes to JSON files in `~/.config/opencode/logs/` at session end or periodically. The secondary challenge is context window monitoring -- the SDK provides `Model.limit.context` (total context size) but not a live "tokens used so far" counter; we must infer utilization from accumulated `AssistantMessage.tokens` across the session.

**Primary recommendation:** Build a `src/observability/` module with an in-memory `SessionEventStore` (per-session event array + aggregate counters), tap existing event/chat.message/tool.execute.after hooks to collect events, flush to JSON on `session.deleted`/`session.idle`, and expose data via three new tools (`oc_logs`, `oc_session_stats`, `oc_pipeline_report`).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Two-tier logging: structured JSON events + human-readable session summaries generated from them
- **D-02:** Structured events capture each discrete occurrence: fallback triggers, errors, autopilot decisions, model switches, with timestamp, context, and outcome
- **D-03:** Session summaries are generated from structured events -- one summary per session
- **D-04:** Fallback events -- which model failed, which tried next, success/failure
- **D-05:** Error events -- classified by the existing error classifier (retryable, terminal, model-specific)
- **D-06:** Autopilot decision events -- every autonomous decision with rationale
- **D-07:** Model switch events -- when a model override happens
- **D-08:** Logs persist in `~/.config/opencode/logs/`
- **D-09:** NOT in the project directory -- user-scoped
- **D-10:** Structured events as JSON files (one per session)
- **D-11:** Session summaries as human-readable markdown
- **D-12:** Time-based: auto-prune logs older than 30 days (configurable)
- **D-13:** Retention period configurable in plugin settings
- **D-14:** Pruning runs on plugin load (non-blocking)
- **D-15:** Rich TUI dashboard accessible via `/logs` command
- **D-16:** List sessions, view detail, search/filter events, time-based filtering
- **D-17:** Session timeline, error highlighting, filterable columns
- **D-18:** Implemented as `oc_logs` tool
- **D-19:** Configurable failure mode: rate limit, quota exceeded, timeout, malformed response
- **D-20:** Failure type configurable per-test, not random
- **D-21:** Integrates with existing fallback chain for end-to-end validation
- **D-22:** Usable for automated tests and manual exploration
- **D-23:** Per-session totals: total input/output tokens, broken down by pipeline phase
- **D-24:** Low overhead -- aggregate counters, not per-call logging
- **D-25:** Token summary appears as a section in the TUI dashboard session detail view
- **D-26:** Cost estimates based on model pricing (if available from provider metadata)
- **D-27:** Each autonomous decision captured with: what was decided, why, confidence level
- **D-28:** Format: `{ decision, rationale, confidence, phase, agent, timestamp }` -- compact, actionable
- **D-29:** `/pipeline-report` command shows post-session summary
- **D-30:** Read-only report -- no interactive replay or what-if overrides
- **D-31:** `/session-stats` command -- token counts, tool breakdown, duration, cost per session
- **D-32:** `/pipeline-report` command -- post-run decision trace with phase-by-phase breakdown
- **D-33:** Both implemented as `oc_` tools following existing pattern
- **D-34:** Emit structured event when context hits 80% utilization
- **D-35:** Show toast warning: "Context at 82% -- consider compacting"
- **D-36:** Non-blocking, informational -- toast fires once at threshold, not repeatedly
- **D-37:** Reuse existing fallback error classifier -- pipe classification output into event log
- **D-38:** No new classification system -- existing categories (retryable, terminal, model-specific) are sufficient
- **D-39:** Per tool.execute.after: tool name, invocation count, duration (ms), success/failure
- **D-40:** Aggregated per session -- not raw per-call logs
- **D-41:** Feeds into /session-stats command and dashboard
- **D-42:** Post-session analysis report with strategic guidance
- **D-43:** Generates from structured events
- **D-44:** TUI-compatible context utilization display
- **D-45:** Shows current token budget and subsystem allocation

### Claude's Discretion
- JSON event schema design (field names, nesting, versioning)
- TUI dashboard layout and interaction patterns
- Mock provider registration with OpenCode's provider system
- Session ID generation strategy
- Whether summaries are generated on-demand or eagerly after session end
- How context monitoring hooks into OpenCode's session events
- Token counting mechanism (provider metadata vs estimate)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| node:fs/promises | built-in | Log file I/O (read, write, readdir, unlink) | Project constraint: no Bun.file/Bun.write |
| node:path | built-in | Path construction for log directory | Already used throughout project |
| node:crypto | built-in | randomBytes for atomic temp file names | Established pattern in config.ts |
| zod | transitive | Event schema validation, config v5 schema | Project constraint: use transitive dep from @opencode-ai/plugin |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| yaml | workspace | Markdown frontmatter in summary files | Already in project for agent templates |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom JSON event files | SQLite/bun:sqlite | Overkill for Phase 13; Phase 15 memory uses SQLite. JSON files are simpler, human-readable, and sufficient for session-scoped data |
| In-memory Map for event storage | External logger (winston/pino) | No external deps needed; plugin runs in-process; Map with flush-on-idle is lightweight and testable |
| Manual token counting | External tiktoken | Not needed; SDK `AssistantMessage.tokens` provides exact counts from the provider |

**Installation:**
```bash
# No new dependencies required. All functionality uses built-in Node modules and existing project deps.
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  observability/
    types.ts              # Event types, session log schema, aggregate types
    event-store.ts        # In-memory per-session event accumulator
    event-emitter.ts      # Typed emit functions (emitFallback, emitError, emitDecision, etc.)
    token-tracker.ts      # Per-session token/cost aggregation from message.updated events
    context-monitor.ts    # Context utilization tracking + threshold toast
    log-writer.ts         # Flush events to JSON files, write markdown summaries
    log-reader.ts         # Read/search/filter persisted session logs
    retention.ts          # Time-based pruning on plugin load
    index.ts              # Module barrel export
  observability/mock/
    mock-provider.ts      # Configurable failure-mode mock for fallback testing
    types.ts              # Mock provider config types
  tools/
    logs.ts               # oc_logs tool (TUI dashboard)
    session-stats.ts      # oc_session_stats tool
    pipeline-report.ts    # oc_pipeline_report tool
```

### Pattern 1: In-Memory Event Store with Flush-on-Idle
**What:** A `SessionEventStore` class holds per-session event arrays in a `Map<sessionID, SessionEvents>`. Events are appended in-memory during the session. On `session.idle` or `session.deleted`, the store flushes to disk as a JSON file.
**When to use:** Always -- this is the core logging mechanism.
**Why:** Avoids per-event disk I/O (D-24 low overhead). The existing `FallbackManager` already uses the same per-session Map pattern with init/cleanup lifecycle.
**Example:**
```typescript
// Source: Pattern derived from src/orchestrator/fallback/fallback-manager.ts
interface SessionEvents {
  readonly sessionID: string;
  readonly startedAt: string;
  readonly events: ObservabilityEvent[];
  readonly tokens: TokenAggregate;
  readonly toolMetrics: Map<string, ToolMetric>;
}

class SessionEventStore {
  private readonly sessions: Map<string, SessionEvents> = new Map();

  initSession(sessionID: string): void {
    this.sessions.set(sessionID, {
      sessionID,
      startedAt: new Date().toISOString(),
      events: [],
      tokens: createEmptyAggregate(),
      toolMetrics: new Map(),
    });
  }

  appendEvent(sessionID: string, event: ObservabilityEvent): void {
    const session = this.sessions.get(sessionID);
    if (!session) return;
    session.events.push(event);
  }

  // Flush returns the data and removes from memory
  flush(sessionID: string): SessionEvents | undefined {
    const session = this.sessions.get(sessionID);
    if (session) this.sessions.delete(sessionID);
    return session;
  }
}
```

### Pattern 2: Token Tracking via message.updated Events
**What:** The `AssistantMessage` type in the SDK already carries `tokens: { input, output, reasoning, cache: { read, write } }` and `cost: number`. We intercept `message.updated` events to accumulate these per session.
**When to use:** For D-23 through D-26 (token/cost tracking).
**Why:** Zero estimation needed. The SDK provides exact provider-reported token counts and pre-calculated cost.
**Example:**
```typescript
// Source: @opencode-ai/sdk AssistantMessage type (node_modules/@opencode-ai/sdk/dist/gen/types.gen.d.ts lines 98-127)
interface TokenAggregate {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalCost: number;          // Sum of AssistantMessage.cost
  messageCount: number;
}

function accumulateTokens(current: TokenAggregate, msg: AssistantMessage): TokenAggregate {
  return {
    inputTokens: current.inputTokens + msg.tokens.input,
    outputTokens: current.outputTokens + msg.tokens.output,
    reasoningTokens: current.reasoningTokens + msg.tokens.reasoning,
    cacheReadTokens: current.cacheReadTokens + msg.tokens.cache.read,
    cacheWriteTokens: current.cacheWriteTokens + msg.tokens.cache.write,
    totalCost: current.totalCost + msg.cost,
    messageCount: current.messageCount + 1,
  };
}
```

### Pattern 3: Context Window Monitoring via Accumulated Tokens
**What:** Context utilization is inferred by summing input tokens from all `message.updated` events in the session and comparing against `Model.limit.context`. When utilization crosses 80%, emit a structured event and fire a toast (once).
**When to use:** For D-34 through D-36 (context monitoring).
**Why:** The SDK does not provide a live "context tokens used" counter. However, `AssistantMessage.tokens.input` reflects the full context sent to the model at each turn. The latest `message.updated` event's `tokens.input` value is the best proxy for current context utilization.
**Example:**
```typescript
// Source: @opencode-ai/sdk Model.limit.context and AssistantMessage.tokens.input
function checkContextUtilization(
  latestInputTokens: number,
  contextLimit: number,
  alreadyWarned: boolean,
): { utilization: number; shouldWarn: boolean } {
  const utilization = latestInputTokens / contextLimit;
  return {
    utilization,
    shouldWarn: utilization >= 0.80 && !alreadyWarned,
  };
}
```

### Pattern 4: Tool Output as Structured JSON (TUI Rendering)
**What:** Plugin tools render output by returning a JSON string from `execute()`. The LLM then formats this for the user. There is no direct TUI widget rendering from server-side plugins.
**When to use:** For all three new tools (oc_logs, oc_session_stats, oc_pipeline_report).
**Why:** Server-side plugins (our plugin type) return strings from tool execute. The TUI plugin API (tui.d.ts) is for TUI-side plugins only. Our tools follow the same pattern as `oc_doctor` -- return JSON with a `displayText` field for human-readable formatting.
**Example:**
```typescript
// Source: src/tools/doctor.ts lines 69-99
export async function sessionStatsCore(sessionID?: string): Promise<string> {
  const data = await readSessionLog(sessionID ?? "latest");
  if (!data) return JSON.stringify({ action: "error", message: "No session log found" });

  return JSON.stringify({
    action: "session_stats",
    sessionID: data.sessionID,
    duration: computeDuration(data),
    tokens: data.tokens,
    toolBreakdown: formatToolMetrics(data.toolMetrics),
    cost: data.tokens.totalCost,
    displayText: buildStatsDisplayText(data),
  });
}
```

### Pattern 5: Mock Provider as a Test Utility (Not a Real Provider)
**What:** A mock provider module that simulates API failures deterministically. Not registered as a real OpenCode provider, but used in tests by injecting error objects into the `FallbackManager.handleError` path.
**When to use:** For D-19 through D-22 (mock provider for fallback testing).
**Why:** The OpenCode plugin SDK has no `provider.register()` API. Plugins cannot register custom providers -- the `PluginInput.client.provider.list()` is read-only. Instead, the mock provider creates error objects that match the SDK's error types (ApiError, ProviderAuthError, etc.) and feeds them to the fallback system's error classifier.
**Example:**
```typescript
// Source: Error types from @opencode-ai/sdk/dist/gen/types.gen.d.ts lines 62-97
type MockFailureMode = "rate_limit" | "quota_exceeded" | "timeout" | "malformed" | "service_unavailable";

function createMockError(mode: MockFailureMode): unknown {
  switch (mode) {
    case "rate_limit":
      return { name: "APIError", data: { message: "Rate limit exceeded", statusCode: 429, isRetryable: true } };
    case "quota_exceeded":
      return { name: "APIError", data: { message: "Quota exceeded", statusCode: 402, isRetryable: true } };
    case "timeout":
      return { name: "APIError", data: { message: "Request timeout", statusCode: 504, isRetryable: true } };
    case "malformed":
      return { name: "UnknownError", data: { message: "Malformed response from model" } };
    case "service_unavailable":
      return { name: "APIError", data: { message: "Service unavailable", statusCode: 503, isRetryable: true } };
  }
}
```

### Anti-Patterns to Avoid
- **Per-event disk writes:** Never write to disk on every event. Accumulate in memory, flush on session end. Per-event writes would create I/O contention and violate D-24 (low overhead).
- **Blocking the event handler:** All log I/O must be non-blocking (fire-and-forget with `.catch()`). The event hook must return quickly -- the fallback system already depends on it.
- **Mutating shared state from multiple hooks:** The event store must be the single source of truth. The event hook, chat.message hook, and tool.execute.after hook all feed into it, but only one (the event store's append method) modifies state.
- **Estimating tokens when exact data is available:** `AssistantMessage` already has exact token counts and cost. Do not use tiktoken or character-based estimation.
- **Building a real LLM provider:** The plugin SDK cannot register providers. The mock provider is a test utility, not a runtime provider.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token counting | Custom tokenizer or character estimator | `AssistantMessage.tokens` from SDK | SDK provides exact provider-reported counts. Estimators are inaccurate across models |
| Error classification | New classifier for observability | Existing `classifyErrorType()` from `src/orchestrator/fallback/error-classifier.ts` | D-37/D-38 explicitly require reusing the existing classifier |
| Cost calculation | Per-model pricing lookup table | `AssistantMessage.cost` from SDK | SDK provides pre-calculated cost per message |
| Context window limit | Hardcoded model limits | `Model.limit.context` from SDK | Varies by model; SDK has accurate values per provider |
| Session ID | Custom UUID generator | Use `sessionID` from SDK events | Every event already carries the OpenCode session ID |
| Atomic file writes | Manual temp-file-rename | Existing pattern in `config.ts` (randomBytes + rename) | Proven pattern used by config.ts, state.ts, lesson-memory.ts |
| Config migration | Standalone migration logic | Extend existing v1->v2->v3->v4 chain to v5 | D-12/D-13 require config for retention settings |

**Key insight:** The OpenCode SDK is remarkably data-rich. `AssistantMessage` carries exact `tokens` (5 fields), `cost`, `modelID`, `providerID`, `time.created`, and `time.completed`. `Session` carries `time.created`, `time.updated`, and `time.compacting`. The observability system is primarily about collecting, storing, and presenting data that already exists in SDK events -- not generating new measurements.

## Common Pitfalls

### Pitfall 1: Attempting to Register a Custom Provider
**What goes wrong:** Trying to use the plugin API to register a mock LLM provider for fallback testing. The plugin SDK has no `provider.register()` method.
**Why it happens:** D-19 says "configurable failure mode" and the user's specific idea says "dummy model inserted in the providers." But the SDK API is read-only for providers.
**How to avoid:** Build the mock provider as a test utility that generates error objects matching SDK error types (`ApiError`, `ProviderAuthError`, etc.) and feeds them into the existing `FallbackManager.handleError()` path. For manual testing, expose via an `oc_mock_fallback` tool that triggers a simulated error on the current session.
**Warning signs:** Import errors from `@opencode-ai/sdk` when trying to call provider registration.

### Pitfall 2: Blocking the Event Handler with Synchronous I/O
**What goes wrong:** Writing log files synchronously inside the `event` hook, causing the fallback system (which shares the same hook) to stall.
**Why it happens:** Natural inclination to persist events immediately for durability.
**How to avoid:** All event processing is in-memory (Map append). Disk flush happens only on `session.idle` or `session.deleted`, and uses fire-and-forget (`flush().catch()`). The event handler's hot path is a Map lookup + array push -- sub-microsecond.
**Warning signs:** Increased latency in fallback response times after adding observability.

### Pitfall 3: Overcomplicating Context Utilization Tracking
**What goes wrong:** Trying to track exact "tokens consumed" by summing all messages, tool calls, system prompts, etc.
**Why it happens:** "Context window" seems like it needs exact accounting.
**How to avoid:** Use the latest `AssistantMessage.tokens.input` value as the context utilization proxy. This is the actual token count sent to the model and includes everything (system prompt, conversation history, tool results). Compare against `Model.limit.context`. This is approximate but sufficient for an 80% threshold warning.
**Warning signs:** Complex token arithmetic that tries to reconstruct context from individual parts.

### Pitfall 4: Losing Events When Sessions End Abruptly
**What goes wrong:** A session is forcefully terminated (user quits, process crash) before the `session.deleted` flush fires.
**Why it happens:** The `session.deleted` event is not guaranteed to fire on ungraceful exits.
**How to avoid:** Implement a secondary flush trigger: on `session.idle` (fires when the LLM finishes responding), flush accumulated events to disk. This means most events are persisted within seconds of occurring, not just at session end. Additionally, the `session.compacted` event is a good intermediate flush point.
**Warning signs:** Empty or missing log files for sessions that were interrupted.

### Pitfall 5: Event Handler Registration Order
**What goes wrong:** The observability event handler interferes with the fallback event handler because both process the same event types (session.error, message.updated).
**Why it happens:** Both systems need to react to the same events.
**How to avoid:** The observability handler is a pure observer -- it reads event data and appends to the store. It never modifies `output`, never calls SDK methods that change session state, and never returns early in a way that prevents the fallback handler from running. Structure the event hook as: (1) observability collect (2) fallback handle. Both run unconditionally.
**Warning signs:** Fallback failures after adding observability hooks.

### Pitfall 6: Config v5 Migration Breaking Existing Configs
**What goes wrong:** Adding a v5 config schema with logging settings breaks the v4 migration chain.
**Why it happens:** The migration chain is v1->v2->v3->v4. Adding v5 requires a new migration function and updating the load order.
**How to avoid:** Follow the exact pattern of `migrateV3toV4`: create `migrateV4toV5` that spreads existing v4 fields and adds `logging` with defaults. Update `loadConfig` to try v5 first, then fall back to v4 migration. Test the full chain: v1->v2->v3->v4->v5.
**Warning signs:** Existing users losing their config on upgrade.

### Pitfall 7: Log File Size Growth
**What goes wrong:** Session log files grow unbounded for long sessions (e.g., multi-hour orchestrator runs that generate hundreds of events).
**Why it happens:** Every fallback attempt, tool call, decision, and error is logged as a separate event.
**How to avoid:** D-40 says "aggregated per session, not raw per-call logs." For tool metrics, store aggregates (count, total duration, success count) not individual invocations. For events, keep the event array but set a per-session cap (e.g., 500 events). A typical orchestrator run generates ~50-100 events; 500 provides generous headroom. Estimated file size: 50-200 events * ~200 bytes each = 10-40KB per session.
**Warning signs:** Log files exceeding 1MB for a single session.

## Code Examples

### SDK Event Types Available for Observability (Verified)
```typescript
// Source: @opencode-ai/sdk/dist/gen/types.gen.d.ts

// Events we tap for observability:
// 1. session.created  -> Initialize session event store
// 2. session.error    -> Capture error events (D-05)
// 3. session.idle     -> Flush events to disk (intermediate)
// 4. session.deleted  -> Final flush + cleanup
// 5. session.compacted -> Log compaction event, intermediate flush
// 6. message.updated  -> Token counting (D-23-26), context monitoring (D-34-36)

// AssistantMessage carries all the data we need:
type AssistantMessage = {
  tokens: {
    input: number;
    output: number;
    reasoning: number;
    cache: { read: number; write: number };
  };
  cost: number;                    // Pre-calculated by SDK
  modelID: string;
  providerID: string;
  time: { created: number; completed?: number };
};

// Model type gives us context limit for monitoring:
type Model = {
  limit: { context: number; output: number };
  cost: { input: number; output: number; cache: { read: number; write: number } };
};
```

### Event Schema Design (Recommended)
```typescript
// Observability event discriminated union
type ObservabilityEvent =
  | { type: "fallback"; timestamp: string; sessionID: string;
      failedModel: string; nextModel: string; errorType: ErrorType; success: boolean }
  | { type: "error"; timestamp: string; sessionID: string;
      errorType: ErrorType; message: string; model?: string; retryable: boolean }
  | { type: "decision"; timestamp: string; sessionID: string;
      phase: string; agent: string; decision: string; rationale: string; confidence: string }
  | { type: "model_switch"; timestamp: string; sessionID: string;
      fromModel: string; toModel: string; reason: string }
  | { type: "context_warning"; timestamp: string; sessionID: string;
      utilization: number; contextLimit: number; inputTokens: number }
  | { type: "tool_complete"; timestamp: string; sessionID: string;
      tool: string; durationMs: number; success: boolean }
  | { type: "phase_transition"; timestamp: string; sessionID: string;
      fromPhase: string; toPhase: string; confidence?: string }
  | { type: "session_start"; timestamp: string; sessionID: string }
  | { type: "session_end"; timestamp: string; sessionID: string;
      durationMs: number; totalCost: number };
```

### Session Log File Structure (Recommended)
```typescript
// Stored at ~/.config/opencode/logs/{sessionID}.json
interface SessionLog {
  readonly schemaVersion: 1;
  readonly sessionID: string;
  readonly startedAt: string;       // ISO 8601
  readonly endedAt: string | null;  // ISO 8601 or null if incomplete
  readonly tokens: {
    readonly input: number;
    readonly output: number;
    readonly reasoning: number;
    readonly cacheRead: number;
    readonly cacheWrite: number;
    readonly totalCost: number;
    readonly messageCount: number;
  };
  readonly toolMetrics: ReadonlyArray<{
    readonly tool: string;
    readonly invocations: number;
    readonly totalDurationMs: number;
    readonly successCount: number;
    readonly failureCount: number;
  }>;
  readonly events: ReadonlyArray<ObservabilityEvent>;
  readonly decisions: ReadonlyArray<{
    readonly timestamp: string;
    readonly phase: string;
    readonly agent: string;
    readonly decision: string;
    readonly rationale: string;
    readonly confidence: string;
  }>;
}
```

### Hook Integration Pattern (How to Extend src/index.ts)
```typescript
// Source: Pattern from src/index.ts lines 142-188

// In the plugin function, after fallback subsystem init:
const eventStore = new SessionEventStore();

// Extend the event handler:
return {
  event: async ({ event }) => {
    // 1. Observability: collect (pure observer, no side effects on session)
    await observabilityEventHandler(eventStore, event);

    // 2. First-load toast (existing)
    if (event.type === "session.created" && isFirstLoad(config)) { /* ... */ }

    // 3. Fallback handling (existing)
    if (fallbackConfig.enabled) {
      await fallbackEventHandler({ event });
    }
  },

  // Extend tool.execute.after:
  "tool.execute.after": async (hookInput, output) => {
    // 1. Observability: record tool metrics
    eventStore.recordToolExecution(hookInput.sessionID, hookInput.tool, /* duration */);

    // 2. Fallback (existing)
    if (fallbackConfig.enabled) {
      await toolExecuteAfterHandler(hookInput, output);
    }
  },
};
```

### Config v5 Migration Pattern
```typescript
// Source: Pattern from src/config.ts migrateV3toV4

const loggingConfigSchema = z.object({
  enabled: z.boolean().default(true),
  retentionDays: z.number().min(1).max(365).default(30),
  maxEventsPerSession: z.number().min(50).max(5000).default(500),
});

const loggingDefaults = loggingConfigSchema.parse({});

// V5 schema adds logging settings
const pluginConfigSchemaV5 = z.object({
  version: z.literal(5),
  configured: z.boolean(),
  groups: z.record(z.string(), groupModelAssignmentSchema).default({}),
  overrides: z.record(z.string(), agentOverrideSchema).default({}),
  orchestrator: orchestratorConfigSchema.default(orchestratorDefaults),
  confidence: confidenceConfigSchema.default(confidenceDefaults),
  fallback: fallbackConfigSchema.default(fallbackDefaults),
  logging: loggingConfigSchema.default(loggingDefaults),
});

function migrateV4toV5(v4Config: PluginConfigV4): PluginConfigV5 {
  return {
    ...v4Config,
    version: 5 as const,
    logging: loggingDefaults,
  };
}
```

### Retention Pruning Pattern
```typescript
// Source: Pattern from src/orchestrator/lesson-memory.ts (prune on load)
import { readdir, unlink, stat } from "node:fs/promises";

async function pruneOldLogs(logsDir: string, retentionDays: number): Promise<number> {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  let pruned = 0;
  try {
    const files = await readdir(logsDir);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const filePath = join(logsDir, file);
      const stats = await stat(filePath);
      if (stats.mtimeMs < cutoff) {
        await unlink(filePath);
        pruned++;
      }
    }
  } catch (error) {
    if (!isEnoentError(error)) throw error;
    // Directory doesn't exist yet -- nothing to prune
  }
  return pruned;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual console.log debugging | Structured JSON event logging | This phase | Users get full post-session visibility |
| No token tracking | SDK-provided exact token counts | Already in SDK | No estimation needed; AssistantMessage.tokens is authoritative |
| Raw decision log in pipeline state | Observability events + pipeline report command | This phase | Decisions are queryable, filterable, and persist across sessions |
| No context monitoring | Context utilization via Model.limit.context + tokens.input | This phase | Users warned before hitting context limits |

**Deprecated/outdated:**
- None for this domain. This is new functionality.

## Key SDK API Surface (Verified from Type Definitions)

### Events Available via `event` Hook
| Event Type | Properties | Observability Use |
|------------|-----------|-------------------|
| `session.created` | `info: Session` (id, projectID, title, time) | Init event store for session |
| `session.error` | `sessionID, error` (typed union of 5 error types) | Capture classified errors (D-05) |
| `session.idle` | `sessionID` | Intermediate flush trigger |
| `session.deleted` | `info: Session` | Final flush + cleanup |
| `session.compacted` | `sessionID` | Log compaction event, intermediate flush |
| `session.status` | `sessionID, status` (idle/retry/busy) | Track session lifecycle |
| `message.updated` | `info: Message` (AssistantMessage with tokens/cost) | Token counting (D-23-26) |
| `command.executed` | `name, sessionID, arguments, messageID` | Track command usage |

### Data Available on AssistantMessage (via message.updated)
| Field | Type | Use |
|-------|------|-----|
| `tokens.input` | number | Context utilization proxy, total input tracking |
| `tokens.output` | number | Output token tracking |
| `tokens.reasoning` | number | Reasoning token tracking |
| `tokens.cache.read` | number | Cache read tracking |
| `tokens.cache.write` | number | Cache write tracking |
| `cost` | number | Pre-calculated cost (D-26) |
| `modelID` | string | Which model generated this message |
| `providerID` | string | Which provider was used |
| `time.created` | number | Message start time |
| `time.completed` | number | Message end time (for duration) |

### Data Available on Model (via provider.list)
| Field | Type | Use |
|-------|------|-----|
| `limit.context` | number | Context window size for monitoring (D-34) |
| `cost.input` | number | Per-token input cost |
| `cost.output` | number | Per-token output cost |

### Hooks Available for Integration
| Hook | Input | Output (Mutable) | Use |
|------|-------|-------------------|-----|
| `event` | `{ event: Event }` | None (void) | Primary event collection |
| `tool.execute.after` | `{ tool, sessionID, callID, args }` | `{ title, output, metadata }` | Tool metrics (D-39-41) |
| `chat.message` | `{ sessionID, agent, model }` | `{ message, parts }` | Model tracking (already used by fallback) |
| `experimental.session.compacting` | `{ sessionID }` | `{ context[], prompt? }` | Pre-compaction state save |

### SDK Client Methods Available
| Method | Returns | Use |
|--------|---------|-----|
| `client.session.messages({ path: { id } })` | `Message[]` | Read session messages for analysis |
| `client.provider.list()` | `Provider[]` with `models: { [key]: Model }` | Get Model.limit.context for monitoring |
| `client.tui.showToast({ body })` | void | Context warning toast (D-35) |

## Open Questions

1. **Tool execution duration measurement**
   - What we know: `tool.execute.after` fires after tool completion. The hook input has `tool`, `sessionID`, `callID`, `args` but no `startTime`.
   - What's unclear: There is no `tool.execute.before` hook currently registered by our plugin (only `tool.execute.after`). We would need to also register `tool.execute.before` to capture start time.
   - Recommendation: Register `tool.execute.before` hook to record start timestamps in the event store (keyed by `callID`). Then in `tool.execute.after`, compute duration as `now - startTime`. The `tool.execute.before` hook exists in the SDK types (line 196 of index.d.ts).

2. **Session model discovery for context limit**
   - What we know: We need `Model.limit.context` to compute utilization. The model info is available from `client.provider.list()`.
   - What's unclear: The provider list is fetched once on plugin load (for the configure wizard). We need to map `AssistantMessage.modelID` + `providerID` to the correct `Model` entry.
   - Recommendation: Cache the provider list result (already done in `setAvailableProviders`). Expose a lookup function: `getModelByID(providerID, modelID) -> Model | undefined`. Fall back to a conservative default limit (200K tokens) if model not found.

3. **Summary generation timing (Claude's discretion)**
   - What we know: D-03 says summaries generated from structured events, D-11 says markdown format.
   - What's unclear: Generate eagerly on session end, or lazily when user requests via `/logs`?
   - Recommendation: Generate lazily (on-demand) when the user views session detail via `oc_logs`. This avoids unnecessary computation for sessions the user never reviews. The structured JSON log is the source of truth; the markdown summary is a presentation layer.

4. **Pipeline phase tracking for per-phase token breakdown (D-23)**
   - What we know: D-23 wants tokens "broken down by pipeline phase." The orchestrator runs in a single session with sequential phases.
   - What's unclear: How to attribute a `message.updated` event to a specific pipeline phase. The event does not carry phase information.
   - Recommendation: The observability event store should track the "current pipeline phase" as state, updated by `phase_transition` events (emitted from the orchestrator handlers). Token accumulation for a message is attributed to whatever phase is "current" at the time.

## Project Constraints (from CLAUDE.md)

- **Runtime: Bun only** -- all new code runs inside the OpenCode process via Bun
- **No standalone Zod install** -- use `import { z } from "zod"` (transitive dep)
- **No Bun.file()/Bun.write()** -- use `node:fs/promises` for all I/O
- **Model agnostic** -- no hardcoded model identifiers
- **Global target** -- logs write to `~/.config/opencode/logs/` (D-08, D-09)
- **`oc_` prefix** -- new tools: `oc_logs`, `oc_session_stats`, `oc_pipeline_report`
- **Immutability** -- build objects with spreads, freeze validation results, `readonly` arrays
- **Atomic file writes** -- temp-file + rename pattern for log persistence
- **Tool pattern** -- `*Core` function (testable, accepts baseDir/options) + `tool()` wrapper
- **Top-down dependency flow** -- `index.ts -> tools/* -> observability/* -> utils/* -> node built-ins`
- **Files < 800 lines** -- split observability module across focused files
- **No console.log in production** -- use structured events instead

## Sources

### Primary (HIGH confidence)
- `@opencode-ai/sdk` type definitions (`node_modules/@opencode-ai/sdk/dist/gen/types.gen.d.ts`) -- Event types, AssistantMessage.tokens, Model.limit.context, Model.cost, Session type, all error types
- `@opencode-ai/plugin` type definitions (`node_modules/@opencode-ai/plugin/dist/index.d.ts`) -- Hooks interface (event, tool.execute.after, tool.execute.before, chat.message, experimental.session.compacting), Plugin/Config types
- `src/index.ts` -- Current hook registration pattern, event handler structure, fallback integration
- `src/orchestrator/fallback/` -- FallbackManager pattern (per-session Map, init/cleanup lifecycle), error classifier, event handler factory
- `src/config.ts` -- Config migration chain (v1-v4), atomic write pattern, Zod schema pattern
- `src/tools/doctor.ts` -- Tool registration pattern (*Core + tool() wrapper)
- `src/orchestrator/schemas.ts` -- Decision entry schema (reusable for D-27/D-28)

### Secondary (MEDIUM confidence)
- `src/health/` -- Health check runner pattern (Promise.allSettled for independent checks)
- `src/orchestrator/lesson-memory.ts` -- Prune-on-load pattern (reusable for D-14)
- `src/utils/fs-helpers.ts` -- ensureDir, isEnoentError utilities

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all dependencies are built-in Node modules or existing project deps. No new packages needed
- Architecture: HIGH -- patterns directly derived from existing codebase (FallbackManager, config migration, tool registration). SDK types verified from source
- Pitfalls: HIGH -- identified from direct code reading (event handler ordering, provider API limitations, I/O blocking risks). Mock provider constraint verified from SDK types
- Token tracking: HIGH -- SDK AssistantMessage.tokens and cost fields verified from type definitions
- Context monitoring: MEDIUM -- using tokens.input as proxy for context utilization is approximate; the 80% threshold approach is sound but the exact input tokens may not equal total context consumed (system prompt, tool definitions are separate)
- Mock provider: MEDIUM -- confirmed SDK has no provider.register(); alternative approach (error injection) is validated against existing error classifier

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (stable -- SDK types unlikely to change within 30 days)
