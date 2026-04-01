# Phase 9: Model Fallback Integration - Research

**Researched:** 2026-04-01
**Domain:** OpenCode plugin event system, model fallback state machines, error classification, message replay
**Confidence:** HIGH

## Summary

This phase integrates per-agent model fallback from the `opencode-runtime-fallback` plugin (MIT, 0.2.3) into our single plugin. The external plugin has ~80 commits of battle-tested error classification, TTFT timeout, cooldown/recovery, compaction-aware fallback, and subagent result sync. Rather than depending on it as a separate plugin (which creates hook registration order race conditions on the shared event bus), we absorb its proven logic into our orchestrator's execution flow.

The integration has two distinct layers: (1) **error classification and fallback state machine** -- pure functions that determine if an error is retryable and which model to try next, portable as-is; (2) **event handling, message replay, and session management** -- tightly coupled to OpenCode's plugin hook API (`event`, `chat.message`, `tool.execute.after`), which must be rewritten to operate within our orchestrator's tool-based dispatch loop instead of as standalone hook handlers.

**Primary recommendation:** Absorb `error-classifier.ts`, `fallback-state.ts`, and `message-replay.ts` as direct ports (pure functions, no side effects). Rewrite the event handler, chat-message handler, and auto-retry orchestration as a new `src/orchestrator/fallback/` module that integrates with our existing `processHandlerResult` loop in `tools/orchestrate.ts`. The `chat.message` hook on the plugin is the model override mechanism -- we must register it alongside our existing `config` and `event` hooks.

## Project Constraints (from CLAUDE.md)

- **Runtime:** Bun only -- plugins run inside the OpenCode process
- **No standalone Zod install:** Use transitive `z` from `@opencode-ai/plugin`
- **No `Bun.file()`/`Bun.write()`:** Use `node:fs/promises`
- **Model agnostic:** Never hardcode model identifiers in bundled agents
- **Global target:** Assets write to `~/.config/opencode/`
- **`oc_` prefix:** All plugin tool names must start with `oc_`
- **Immutability:** Build objects with spreads, never mutate after creation
- **Atomic writes:** Use temp-file-then-rename pattern
- **Dependency flow:** Strictly top-down, no cycles

## Standard Stack

### Core (already in project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @opencode-ai/plugin | 1.3.8 | Plugin hooks, tool registration, SDK client access | Required runtime |
| @opencode-ai/sdk | (transitive) | Session API: abort, messages, promptAsync, summarize, command | All session operations |
| zod | (transitive) | Schema validation for fallback config and state | Project pattern |

### New Dependencies Required

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | -- | -- | No new dependencies needed |

The opencode-fallback plugin's only dependency is `jsonc-parser` (for config file parsing with comments). We do NOT need this -- our plugin already has its own config system (`src/config.ts`) with Zod validation. Fallback config will be added as a new section in `pluginConfigSchema`.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Absorbing opencode-fallback | Depending on it as npm peer | Hook registration order races during autonomous runs; two plugins fighting over `chat.message` and `event` hooks |
| Pure function ports | Full module ports with side effects | Pure functions are testable in isolation; side-effect-laden modules need the full OpenCode runtime to test |

## Architecture Patterns

### Recommended Project Structure

```
src/orchestrator/fallback/
  error-classifier.ts    # Ported from opencode-fallback: isRetryableError, classifyErrorType, etc.
  fallback-state.ts      # Ported from opencode-fallback: createFallbackState, planFallback, commitFallback, etc.
  message-replay.ts      # Ported from opencode-fallback: replayWithDegradation, filterPartsByTier
  fallback-config.ts     # New Zod schema for fallback settings, integrated into pluginConfigSchema
  fallback-manager.ts    # New: orchestrator-integrated fallback loop (replaces event-handler + auto-retry)
  types.ts               # Types for fallback domain (ported + new)
  index.ts               # Barrel export
```

### Pattern 1: Pure Function Ports (error-classifier, fallback-state, message-replay)

**What:** Direct port of the opencode-fallback pure functions with only stylistic changes (immutability, no mutation of state objects, Biome formatting).

**When to use:** For any module from opencode-fallback that is a pure function (input -> output, no side effects, no `ctx.client` calls).

**Key adaptation:** The opencode-fallback `fallback-state.ts` MUTATES the FallbackState object directly (`state.currentModel = ...`). Our port MUST convert these to immutable spread-based updates to match our project's immutability constraint. The `planFallback` function is already pure (returns a plan without mutation) -- that is the correct pattern. `commitFallback` and `prepareFallback` mutate and must be rewritten as pure transformers.

```typescript
// ORIGINAL (opencode-fallback) -- MUTATES state
export function commitFallback(state: FallbackState, plan: FallbackPlan): boolean {
  if (state.currentModel !== plan.failedModel) return false;
  state.fallbackIndex = plan.newFallbackIndex;
  state.failedModels.set(plan.failedModel, Date.now());
  state.attemptCount++;
  state.currentModel = plan.newModel;
  return true;
}

// OUR PORT -- immutable, returns new state
export function commitFallback(
  state: Readonly<FallbackState>,
  plan: FallbackPlan,
): { readonly committed: boolean; readonly state: FallbackState } {
  if (state.currentModel !== plan.failedModel) {
    return { committed: false, state: { ...state } };
  }
  return {
    committed: true,
    state: {
      ...state,
      fallbackIndex: plan.newFallbackIndex,
      failedModels: new Map([...state.failedModels, [plan.failedModel, Date.now()]]),
      attemptCount: state.attemptCount + 1,
      currentModel: plan.newModel,
      pendingFallbackModel: undefined,
    },
  };
}
```

### Pattern 2: Chat.message Hook for Model Override

**What:** The `chat.message` hook is the ONLY mechanism to change which model processes a message. When OpenCode is about to send a message to a model, this hook fires with `input.model` and `output.message.model`. By mutating `output.message.model`, the plugin redirects the request to a different provider/model.

**When to use:** This hook MUST be registered on the plugin to enable the model override. It runs synchronously before the LLM call.

**Critical insight from opencode-fallback:** The `chat.message` hook is the "model swap" point. When our fallback manager decides to switch models, it updates the fallback state's `currentModel`. The `chat.message` hook then reads this state and overrides `output.message.model` to the fallback model's providerID/modelID. This is NOT optional -- without this hook, session.promptAsync alone cannot change the model.

```typescript
// In src/index.ts, the plugin return must include:
"chat.message": async (input, output) => {
  await chatMessageHandler(input, output);
},
```

### Pattern 3: Event-Driven Error Detection

**What:** The `event` hook receives ALL session events. The fallback system listens for specific event types to detect errors and trigger fallback:

| Event Type | What It Means | Fallback Action |
|------------|---------------|-----------------|
| `session.error` | Model returned an error | Check retryability, plan + execute fallback |
| `session.status` (type: "retry") | Provider is auto-retrying (rate limit) | Intercept if retry delay > timeout, trigger immediate fallback |
| `session.idle` | Session went idle | Detect silent model failure (no first token received) |
| `session.compacted` | Compaction completed | Clear fallback tracking state |
| `message.updated` (role: assistant, error present) | Assistant message has error content | Check retryability, plan + execute fallback |
| `message.part.delta` / `session.diff` | Activity from model | Mark first token received (cancels TTFT timeout) |

**When to use:** Always -- this is how model failures are detected in real time.

### Pattern 4: Fallback State Machine Transitions

**What:** The fallback state machine from opencode-fallback:

```
                         +-----------+
                         | NO_STATE  |
                         +-----+-----+
                               |
                    first error detected
                               |
                         +-----v-----+
                    +----+ PRIMARY   +----+
                    |    | (original)|    |
                    |    +-----+-----+    |
                    |          |          |
                error       cooldown    manual
              (retryable)   expires     model
                    |          |        change
                    |    +-----v-----+    |
                    +--->+ FALLBACK  +<---+
                         | (chain)   |    reset
                         +-----+-----+
                               |
                    all models exhausted
                    OR max attempts reached
                               |
                         +-----v-----+
                         | EXHAUSTED |
                         +-----------+
```

State fields:
- `originalModel`: The model the session started with
- `currentModel`: The model currently being used (may differ after fallback)
- `fallbackIndex`: Position in the fallback chain (-1 = primary)
- `failedModels`: Map<model, timestamp> -- models in cooldown
- `attemptCount`: Total fallback attempts so far
- `pendingFallbackModel`: Model that will be used on next prompt (set between plan and commit)

Key transitions:
1. `planFallback()` -- Pure: reads state + config, returns plan or failure. Does NOT mutate.
2. `commitFallback()` -- Applies plan to state AFTER successful dispatch. Prevents partial state if dispatch fails.
3. `recoverToOriginal()` -- Checks if primary model cooldown expired, resets to primary.
4. Manual model change (detected in `chat.message`) -- Resets state to treat new model as primary.

### Pattern 5: Integration with Our Orchestrator

**What:** Our orchestrator dispatches subagents via `DispatchResult` (action: "dispatch"/"dispatch_multi"). The orchestrator agent (oc-orchestrator) reads these instructions and calls the named subagent. If the subagent call fails (model error), the fallback system intercepts at the event/hook level -- NOT at the tool level.

**Architecture decision:** Fallback operates BELOW the orchestrator's dispatch loop. The orchestrator does not know about fallback. It dispatches "call oc-researcher" and gets back a result. If the model fails mid-execution, the fallback system (via event hooks) detects it, aborts the failed request, and replays on a fallback model. The orchestrator sees the final result from whichever model succeeded.

This is the correct architecture because:
1. Each subagent runs in its own session. The fallback state is per-session.
2. The orchestrator agent is itself running on a model. If THAT model fails, the same fallback system handles it.
3. No changes to the orchestrator dispatch logic are needed.

```
oc_orchestrate tool
  -> processHandlerResult
    -> returns DispatchResult{action: "dispatch", agent: "oc-researcher"}
      -> orchestrator agent calls @oc-researcher
        -> OpenCode creates session, sends to model
          -> model fails (429)
            -> event hook detects session.error
            -> fallback manager: plan -> abort -> replay on fallback model
            -> chat.message hook overrides model
            -> session continues with fallback model
        -> result returned to orchestrator agent
      -> orchestrator agent calls oc_orchestrate(result=...)
```

### Anti-Patterns to Avoid

- **Intercepting at the tool level:** Do NOT try to catch model failures in the `oc_orchestrate` tool's try/catch. Model failures happen asynchronously in the session event stream, not as synchronous exceptions in tool execution.
- **Per-phase fallback chains:** The fallback chain is per-agent (or global), NOT per-pipeline-phase. The orchestrator does not manage which model a subagent uses.
- **Mutating FallbackState directly:** Port all state transitions to immutable spread-based updates.
- **Blocking the event loop:** The event handler and chat.message handler are `async` but must complete quickly. Long-running operations (abort + delay + replay) must be carefully managed with locks (sessionRetryInFlight) to prevent duplicate dispatches.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Error classification | Custom regex list for model errors | Port `error-classifier.ts` from opencode-fallback | 80 commits of edge cases: nested error objects, status code extraction from message text, auto-retry signal detection, content-based error detection |
| Fallback state machine | Ad-hoc model switching | Port `fallback-state.ts` from opencode-fallback | Cooldown tracking, plan-then-commit pattern, snapshot/restore for rollback, max attempts, recovery to original |
| Message replay | Simple re-send | Port `message-replay.ts` with 3-tier degradation | Tier 1 (all parts), Tier 2 (text+images), Tier 3 (text only) -- maximizes compatibility across providers that reject tool_call parts |
| Race condition guards | Hope for the best | Port the lock mechanism (sessionRetryInFlight, sessionAwaitingFallbackResult) | Both `session.error` and `message.updated` fire for the same failure simultaneously. Without locks, two handlers plan + commit + dispatch, creating duplicate replays |
| TTFT timeout | No timeout | Port the TTFT mechanism from opencode-fallback | Models can silently hang (accept request, produce nothing). Without TTFT, the session is stuck forever. Once streaming starts, timeout is cancelled |
| Compaction fallback | Ignore compaction failures | Port compaction-aware path | `/compact` failures need `session.summarize` (not `promptAsync`). Compaction messages contain parts that promptAsync rejects. This is the #1 edge case users hit |

## Common Pitfalls

### Pitfall 1: Dual Event Handler Race

**What goes wrong:** Both `session.error` and `message.updated` fire for the same model failure. Without a lock, both handlers plan a fallback, both commit state, both dispatch replays -- producing duplicate requests to the fallback model.

**Why it happens:** OpenCode emits multiple events per failure. The events arrive as microtasks that interleave during `await` points.

**How to avoid:** Use `sessionRetryInFlight` Set as a lock. First handler to `add(sessionID)` wins. Others check `has(sessionID)` and bail. Lock acquired BEFORE any `await`.

**Warning signs:** "Skipping stale autoRetryWithFallback" in logs, duplicate toast notifications, fallback attempt count jumping by 2+.

### Pitfall 2: Self-Abort Suppression

**What goes wrong:** When the fallback manager aborts the current request (to replay on a new model), OpenCode fires a `MessageAbortedError` session.error. The handler treats this as a new failure and triggers ANOTHER fallback.

**Why it happens:** `session.abort()` is asynchronous. The abort error event arrives after the abort returns but before the replay dispatch.

**How to avoid:** Track `sessionSelfAbortTimestamp`. When a `MessageAbortedError` arrives within 2 seconds of a self-initiated abort, suppress it.

**Warning signs:** Rapid-fire fallback chains where every model "fails" immediately, attempt count reaching max within milliseconds.

### Pitfall 3: Chat.message Hook Resets Fallback State

**What goes wrong:** The fallback manager dispatches `session.promptAsync` with the fallback model. This triggers the `chat.message` hook. The hook sees the model mismatch (requested model != state.currentModel) and thinks the user manually changed models -- resetting fallback state.

**Why it happens:** The `chat.message` hook cannot distinguish user-initiated model changes from plugin-initiated replays.

**How to avoid:** Check `sessionRetryInFlight`, `sessionAwaitingFallbackResult`, and `sessionCompactionInFlight` flags in the `chat.message` handler. If any are set, the model change is plugin-initiated -- skip the reset.

**Warning signs:** Fallback chain breaks after 1 attempt, state shows `attemptCount: 0` after a successful fallback.

### Pitfall 4: Empty Subagent Results (Task Tool Sync)

**What goes wrong:** When a subagent (child session) model fails, OpenCode returns an empty `<task_result></task_result>` to the parent agent. The parent treats this as a successful but empty response.

**Why it happens:** The child session's model error is handled by fallback (abort + replay), but the parent's `task` tool call already returned before the fallback completed.

**How to avoid:** Use `tool.execute.after` hook to intercept empty task results. Extract child session ID, wait for the child's fallback to complete (via `session.idle` event or polling), then replace the empty output with the actual response.

**Warning signs:** Orchestrator receiving empty strings as subagent results, "No replayable non-assistant message" errors in child sessions.

### Pitfall 5: Stale Error Events from Previous Models

**What goes wrong:** After switching from model A to model B, a delayed error event from model A arrives. The handler treats it as a failure of model B and triggers an unnecessary fallback to model C.

**Why it happens:** Event delivery is asynchronous and not strictly ordered. Model A's error can arrive after model B is already streaming.

**How to avoid:** Compare the event's model field against `state.currentModel`. If they don't match AND the event model is already in `failedModels`, suppress the event.

**Warning signs:** Fallback chain advancing even when the current model is working fine.

### Pitfall 6: Compaction Uses Different Replay Path

**What goes wrong:** When `/compact` fails, the fallback system tries `session.promptAsync` to replay -- but compaction messages have `type: "compaction"` parts that `promptAsync` rejects.

**Why it happens:** Compaction is not a regular chat message. It has its own API surface (`session.summarize`).

**How to avoid:** Detect `agent: "compaction"` in the event. Use `session.summarize` (with fallback model's providerID/modelID) instead of `session.promptAsync`. Before summarizing, delete the failed compaction messages from the session so they don't get re-processed.

**Warning signs:** "promptAsync rejected" errors after compaction failure, compaction retrying on the same failed model.

### Pitfall 7: Plugin Hook Registration Order

**What goes wrong:** If our plugin's `chat.message` hook runs AFTER another plugin's hook, the model override may be overwritten. If it runs BEFORE, the other plugin may see the wrong model.

**Why it happens:** OpenCode fires hooks in plugin registration order. With two plugins, order is unpredictable.

**How to avoid:** This is WHY we absorb the fallback logic into our single plugin. One plugin, one `chat.message` handler, no race. This is a locked architectural decision from the stakeholder analysis.

**Warning signs:** N/A -- we prevent this by design.

### Pitfall 8: Immutability Port Mismatch

**What goes wrong:** The opencode-fallback code mutates `FallbackState` objects directly (`state.currentModel = newModel`). If we port functions without converting to immutable updates, we break our project's invariant.

**Why it happens:** The original plugin was not designed with immutability constraints.

**How to avoid:** Every function that modifies `FallbackState` must be rewritten as a pure function that returns a new state object. Use the `planFallback` + `commitFallback` split pattern (plan is already pure, commit must be made pure).

**Warning signs:** Biome lint errors for mutable operations, test failures from shared state between test cases.

## Code Examples

### Error Classification (direct port pattern)

```typescript
// Source: opencode-fallback/error-classifier.ts
// Port directly with no functional changes. These are pure functions.

export const RETRYABLE_ERROR_PATTERNS: readonly RegExp[] = Object.freeze([
  /rate.?limit/i,
  /too.?many.?requests/i,
  /quota.?exceeded/i,
  /quota.?protection/i,
  /key.?limit.?exceeded/i,
  /usage\s+limit\s+has\s+been\s+reached/i,
  /service.?unavailable/i,
  /overloaded/i,
  /temporarily.?unavailable/i,
  /try.?again/i,
  /credit.*balance.*too.*low/i,
  /insufficient.?(?:credits?|funds?|balance)/i,
  /(?:^|\s)429(?:\s|$)/,
  /(?:^|\s)503(?:\s|$)/,
  /(?:^|\s)529(?:\s|$)/,
]);

export function isRetryableError(
  error: unknown,
  retryOnErrors: readonly number[],
  userPatterns?: readonly string[],
): boolean {
  const statusCode = extractStatusCode(error, retryOnErrors);
  const message = getErrorMessage(error);
  const errorType = classifyErrorType(error);

  if (errorType === "missing_api_key" || errorType === "model_not_found") return true;
  if (statusCode && retryOnErrors.includes(statusCode)) return true;
  if (RETRYABLE_ERROR_PATTERNS.some((pattern) => pattern.test(message))) return true;

  if (userPatterns) {
    for (const patternStr of userPatterns) {
      try {
        const re = new RegExp(patternStr, "i");
        if (re.test(message)) return true;
      } catch { /* Invalid regex -- skip */ }
    }
  }

  return false;
}
```

### Fallback Config Schema (new, integrated into our config)

```typescript
// Source: new code, modeled on opencode-fallback/constants.ts DEFAULT_CONFIG
import { z } from "zod";

export const fallbackConfigSchema = z.object({
  enabled: z.boolean().default(true),
  retryOnErrors: z.array(z.number()).default([401, 402, 429, 500, 502, 503, 504]),
  retryableErrorPatterns: z.array(z.string().max(256)).max(50).default([]),
  maxFallbackAttempts: z.number().min(1).max(100).default(10),
  cooldownSeconds: z.number().min(0).max(3600).default(60),
  timeoutSeconds: z.number().min(0).max(300).default(30),
  notifyOnFallback: z.boolean().default(true),
});

// Pre-compute defaults for Zod v4 nested default compatibility
const fallbackDefaults = fallbackConfigSchema.parse({});

// Then in pluginConfigSchemaV3:
// fallback: fallbackConfigSchema.default(fallbackDefaults),
```

### Chat.message Handler (integration pattern)

```typescript
// Source: adapted from opencode-fallback/chat-message-handler.ts
// Key difference: we read fallback state from a manager, not raw Maps

export function createChatMessageHandler(
  fallbackManager: FallbackManager,
) {
  return async (
    input: { sessionID: string; model?: { providerID: string; modelID: string } },
    output: { message: { model?: { providerID: string; modelID: string } }; parts: unknown[] },
  ): Promise<void> => {
    const state = fallbackManager.getSessionState(input.sessionID);
    if (!state) return;

    // Skip if plugin is actively managing a fallback dispatch
    if (fallbackManager.isDispatchInFlight(input.sessionID)) return;

    // Auto-recovery check
    const recovered = fallbackManager.tryRecoverToOriginal(input.sessionID);
    if (recovered) return;

    // If not on fallback model, nothing to override
    if (state.currentModel === state.originalModel) return;

    // Override the outgoing model to the fallback model
    const [providerID, ...modelParts] = state.currentModel.split("/");
    if (providerID && modelParts.length > 0) {
      output.message.model = {
        providerID,
        modelID: modelParts.join("/"),
      };
    }
  };
}
```

### Plugin Entry Integration (src/index.ts additions)

```typescript
// The plugin's return object must add chat.message and update event:

return {
  tool: { /* existing tools */ },
  event: async ({ event }) => {
    // Existing session.created handler...

    // NEW: Fallback event handling
    await fallbackEventHandler({ event });
  },
  config: configHook,
  "chat.message": async (input, output) => {
    await chatMessageHandler(input, output);
  },
  "tool.execute.after": async (input, output) => {
    await toolExecuteAfterHandler(input, output);
  },
};
```

## OpenCode Plugin API Surface (Reference)

### Hooks Available (from @opencode-ai/plugin 1.3.8)

| Hook | Input | Output | Purpose |
|------|-------|--------|---------|
| `event` | `{ event: Event }` | void | ALL events: session.*, message.*, etc. |
| `config` | `Config` (mutable) | void | Register agents, modify config |
| `chat.message` | `{ sessionID, agent?, model? }` | `{ message: UserMessage, parts: Part[] }` | Override model, modify message before LLM call |
| `tool.execute.after` | `{ tool, sessionID, callID, args }` | `{ title, output, metadata }` | Intercept tool outputs (for subagent sync) |
| `chat.params` | model, provider, message | temperature, topP, etc. | Modify LLM parameters |

### SDK Client Session API (used by fallback)

| Method | Purpose |
|--------|---------|
| `session.abort({ path: { id } })` | Abort in-flight request |
| `session.messages({ path: { id }, query: { directory } })` | Get session messages for replay |
| `session.promptAsync({ path: { id }, body: { model, parts, agent? }, query: { directory } })` | Replay message with new model |
| `session.summarize({ path: { id }, body: { providerID, modelID }, query: { directory } })` | Compaction fallback |
| `session.command({ path: { id }, body: { command, arguments, model? } })` | Command dispatch |
| `session.get({ path: { id } })` | Get session status |
| `tui.showToast({ body: { title, message, variant, duration } })` | User notification |

### Event Types Relevant to Fallback

| Event | Properties | Significance |
|-------|-----------|--------------|
| `session.error` | sessionID, error, model?, agent? | Primary error detection |
| `session.status` | sessionID, status: {type: "retry", attempt, message, next} | Provider auto-retry detection |
| `session.idle` | sessionID | Silent failure detection / completion detection |
| `session.compacted` | sessionID | Compaction success cleanup |
| `message.updated` | info: {sessionID, role, error?, model?, agent?}, parts | Error in assistant message, auto-retry signal |
| `message.part.delta` | info: {sessionID, model?} | Activity detection for TTFT |
| `session.created` | info: {id, parentID?} | Track parent-child for subagent sync |
| `session.deleted` | info: {id} | Cleanup session state |

## Per-Agent Fallback Model Resolution

The opencode-fallback plugin resolves fallback models in a 2-tier hierarchy:

1. **Per-agent** (from agent config in opencode.json): `agent.coder.fallback_models: ["openai/gpt-5.4"]`
2. **Global** (from plugin config): `fallback_models: ["anthropic/claude-sonnet-4-5"]`

Per-agent always wins. The resolution reads `agentConfigs` passed via the `config` hook. Our plugin already registers agents via `configHook` -- we need to also READ agent configs from the same hook to know which agents have `fallback_models` configured.

**Critical detail:** The AgentConfig type (`@opencode-ai/sdk`) has `[key: string]: unknown` -- meaning `fallback_models` is valid as an extra field on any agent config. Users add it directly to their `opencode.json` agent blocks.

## Concurrency Model

The fallback system manages concurrency through these mechanisms:

| Mechanism | Type | Purpose |
|-----------|------|---------|
| `sessionRetryInFlight` | Set<sessionID> | Lock: only one handler can plan+dispatch per session |
| `sessionAwaitingFallbackResult` | Set<sessionID> | Flag: a replay has been dispatched, awaiting result |
| `sessionFirstTokenReceived` | Map<sessionID, boolean> | TTFT tracking: true once model starts streaming |
| `sessionSelfAbortTimestamp` | Map<sessionID, number> | Suppress self-inflicted MessageAbortedError |
| `sessionFallbackTimeouts` | Map<sessionID, timer> | TTFT timeout timers |
| `sessionCompactionInFlight` | Set<sessionID> | Suppress stale errors during compaction |
| `sessionParentID` | Map<sessionID, string or null> | Parent-child mapping for subagent sync |
| `sessionLastMessageTime` | Map<sessionID, number> | Activity tracking for subagent timeout reset |
| `sessionIdleResolvers` | Map<sessionID, callbacks[]> | Promise resolvers for idle detection |

All of these are per-session Maps/Sets. For our integration, they should be encapsulated in a `FallbackManager` class that owns session lifecycle.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Monolithic prepareFallback (plan+commit in one call) | Split planFallback + commitFallback (plan is pure, commit only after dispatch succeeds) | Recent commits | Prevents partial state when dispatch fails |
| Direct state mutation | Plan-then-commit pattern | Recent commits | Enables rollback, prevents race conditions |
| session.command for compaction fallback | session.summarize | Recent commits | summarize handles cleanup internally, no manual message deletion needed (though message cleanup is still done as defense-in-depth) |
| Ignore stale errors | Check errorModel against failedModels Map | Recent commits | Prevents infinite retry loops from delayed error events |

**Key versions:**
- opencode-fallback: 0.2.3 (latest as of 2026-03-30)
- @opencode-ai/plugin: 1.3.8 (our current version)
- @opencode-ai/sdk: transitive via plugin

## Open Questions

1. **Per-agent fallback_models config format**
   - What we know: OpenCode's AgentConfig allows `[key: string]: unknown` extra fields. Users add `fallback_models` directly to agent blocks in `opencode.json`.
   - What's unclear: Whether our `configHook` receives the full agent config INCLUDING user-added extra fields like `fallback_models`, or only the fields we registered.
   - Recommendation: Test this empirically in the first task. The `configHook` receives the raw `Config` object from OpenCode, which should include all user-defined fields. If it does not, we need to read `opencode.json` directly (which opencode-fallback does as a fallback).

2. **Plugin client availability**
   - What we know: The `PluginInput` provides `client: ReturnType<typeof createOpencodeClient>`. The opencode-fallback plugin uses `ctx.client.session.*` extensively.
   - What's unclear: Whether our plugin currently stores `input.client` from the plugin function. Our current `index.ts` ignores `_input`.
   - Recommendation: Store `input.client` from the plugin entry function and pass it to the fallback manager. This is needed for `session.abort`, `session.messages`, `session.promptAsync`, `session.summarize`, and `tui.showToast`.

3. **Config schema version migration**
   - What we know: Our config is at v2 (`pluginConfigSchemaV2`). Adding fallback config requires a v3 migration.
   - What's unclear: How many users have existing v2 configs.
   - Recommendation: Follow the existing v1->v2 migration pattern. Create v3 schema with fallback defaults. Auto-migrate on load.

## Environment Availability

Step 2.6: SKIPPED (no external dependencies identified). This phase is code/config-only changes using existing project dependencies.

## Sources

### Primary (HIGH confidence)
- opencode-fallback source code (all .ts files read via GitHub API) -- error-classifier.ts, fallback-state.ts, message-replay.ts, auto-retry.ts, event-handler.ts, message-update-handler.ts, chat-message-handler.ts, config-reader.ts, subagent-result-sync.ts, logger.ts, types.ts, constants.ts, index.ts
- @opencode-ai/plugin 1.3.8 type definitions (dist/index.d.ts) -- Hooks interface with all available hooks
- @opencode-ai/sdk type definitions (dist/gen/types.gen.d.ts) -- Event union type, AgentConfig, Session types, SessionPromptAsync, SessionSummarize
- Our project source code (src/tools/orchestrate.ts, src/orchestrator/*, src/agents/*, src/config.ts, src/index.ts)

### Secondary (MEDIUM confidence)
- opencode-fallback README.md -- feature documentation and configuration reference
- opencode-fallback package.json -- version 0.2.3, MIT license, dependencies

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All dependencies verified from actual installed packages
- Architecture: HIGH - Full source code of both our project and opencode-fallback read and understood
- Pitfalls: HIGH - All 8 pitfalls derived from actual source code analysis of opencode-fallback's race condition guards, lock mechanisms, and edge case handling
- Integration points: MEDIUM - The chat.message hook behavior and client availability need empirical validation

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable -- OpenCode plugin API changes infrequently)
