# OpenCode Autopilot Plugin Improvement Implementation Plan

## Executive Summary

This plan addresses the 6 major gaps identified between `opencode-autopilot` and `oh-my-openagent` (omo). The goal is to achieve parity or superiority in UX, performance, and autonomous workflow quality through systematic implementation of enforcement mechanisms, observability fixes, and performance optimizations.

## Goals

1. **Hash-anchored edits enforced**: System-level enforcement of hash-anchored edits for parallel safety (target: 60%+ success rate from 6.7%)
2. **Accurate cost tracking**: Fix `totalCost: 0` bug and implement per-agent cost aggregation
3. **Proper phase organization**: Implement runId-scoped phase directories to prevent cross-run contamination
4. **Intent route enforcement**: System-level gate ensuring `oc_route` is called before `oc_orchestrate`
5. **Todo sidebar integration**: Connect `todowrite` tool to OpenCode's persistent right sidebar
6. **Wave parallelism**: Parallelize BUILD phase execution for 3-5x speed improvement

## Phase 1: Critical Bug Fixes & Core Enforcement (Week 1-2)

### Wave 1: Foundation (No Dependencies)

**Task 1.1: Fix cost tracking bug in event-handlers.ts**
- **Files**: `src/observability/event-handlers.ts`, `src/observability/event-store.ts`
- **Action**: Update line 224 to read `session.tokens.totalCost` instead of hardcoded `0`. Add proper session duration calculation.
- **Verification**: Unit test showing session_end event contains accurate totalCost. Integration test with mock token accumulation.
- **Done**: Session summaries show non-zero costs matching actual token usage.

**Task 1.2: Fix phase directory scoping**
- **Files**: `src/orchestrator/artifacts.ts`, `src/orchestrator/handlers/*.ts`
- **Action**: Remove `LEGACY_RUN_ID` constant, ensure all phase operations use `{runId}/{phase}` structure. Update artifact path generation.
- **Verification**: Phase directories created as `phases/run_{uuid}/{phase}/`. Multiple runs don't overwrite artifacts.
- **Done**: Historical phase analysis works across runs with proper isolation.

**Task 1.3: Implement basic hash-anchored edit enforcement**
- **Files**: `src/tools/hashline-edit.ts`, `src/index.ts`, `src/config.ts`
- **Action**: Add configuration flag `hashline_edit.enabled` (default: true). Implement tool interceptor that blocks built-in `edit` for key agents (`oc-implementer` in PARALLEL mode).
- **Verification**: Unit test shows `oc-implementer` rejects built-in edit calls. Integration test shows concurrent edits use hashline tool.
- **Done**: Edit success rate >30% in test scenarios.

### Wave 2: Enhanced Enforcement (Depends on Wave 1)

**Task 1.4: Implement read enhancement hook**
- **Files**: `src/hooks/hashline-read-enhancer.ts`, `src/index.ts`
- **Action**: Create hook that auto-annotates `read` tool output with LINE#ID hashes. Integrate with OpenCode hook system.
- **Verification**: Read output includes line anchors. Agents receive hashed content without manual prompting.
- **Done**: All file reads include hash anchors when hashline editing is enabled.

**Task 1.5: Add tool-level permission model**
- **Files**: `src/config.ts`, `src/agents/pipeline/*.ts`, `src/index.ts`
- **Action**: Extend permission system to support tool whitelisting. Create `edit_hashing: "allow"` vs `edit_plain: "deny"` categories.
- **Verification**: Agent config validation rejects conflicting permissions. Tool calls filtered at runtime.
- **Done**: Key agents cannot access built-in edit tool when hashline editing is enforced.

## Phase 2: Core UX Improvements & Performance (Week 2-3)

### Wave 1: Intent System (No Dependencies)

**Task 2.1: Implement intent gate system**
- **Files**: `src/routing/intent-gate.ts`, `src/tools/orchestrate.ts`, `src/index.ts`
- **Action**: Create system that intercepts `oc_orchestrate` calls and requires prior `oc_route` classification. Cache intent per message.
- **Verification**: `oc_orchestrate` rejects calls without intent classification. Research queries trigger specialist workflow, not pipeline.
- **Done**: Intent classification accuracy >95% in test scenarios.

**Task 2.2: Create oc_route tool with intent classification**
- **Files**: `src/tools/route.ts`, `src/routing/intent-classifier.ts`
- **Action**: Implement `oc_route` tool that classifies user intent using LLM. Returns intent type and routing decision.
- **Verification**: Tool correctly classifies sample queries. Returns valid routing decisions.
- **Done**: All 9 intent types supported with appropriate routing.

**Task 2.3: Integrate intent gate with pipeline**
- **Files**: `src/tools/orchestrate.ts`, `src/orchestrator/handlers/*.ts`
- **Action**: Modify pipeline to accept intent parameter. Adjust phase behavior based on intent (e.g., research intent skips BUILD).
- **Verification**: Pipeline respects intent routing. Research-only queries don't invoke full implementation pipeline.
- **Done**: Intent-driven workflow selection fully operational.

### Wave 2: Performance Optimization (Depends on Phase 1)

**Task 2.4: Implement wave-based parallel execution**
- **Files**: `src/orchestrator/handlers/build.ts`, `src/orchestrator/handlers/build-utils.ts`
- **Action**: Refactor BUILD phase to execute tasks in parallel waves. Add concurrency control with configurable maxParallelTasks.
- **Verification**: Tasks in same wave execute concurrently. Dependencies respected across waves.
- **Done**: BUILD phase speed improved 3-5x with wave parallelism.

**Task 2.5: Add Oracle verification gate**
- **Files**: `src/orchestrator/handlers/build.ts`, `src/review/oracle-gate.ts`
- **Action**: Create mandatory Oracle review for critical changes. Block progression on CRITICAL findings.
- **Verification**: Critical changes require Oracle approval. Non-critical findings generate fix instructions.
- **Done**: Quality gate prevents low-quality code from progressing.

**Task 2.6: Implement subagent cost aggregation**
- **Files**: `src/observability/event-handlers.ts`, `src/observability/token-tracker.ts`, `src/background/*.ts`
- **Action**: Track token usage for subagents and aggregate to parent session. Add per-agent cost breakdown.
- **Verification**: Session summary shows per-agent costs. Subagent costs bubble up correctly.
- **Done**: Complete cost visibility with agent-level granularity.

## Phase 3: UX Polish & Advanced Features (Week 3-4)

### Wave 1: Todo Integration (No Dependencies)

**Task 3.1: Implement todo sidebar integration**
- **Files**: `src/ux/todo-sidebar.ts`, `src/index.ts`, `src/tools/todowrite.ts`
- **Action**: Create integration with OpenCode's right sidebar todo system. Persist todos across sessions.
- **Verification**: Todos appear in sidebar. Persist across session boundaries.
- **Done**: 100% todo visibility in sidebar.

**Task 3.2: Enhance todo management API**
- **Files**: `src/tools/todowrite.ts`, `src/ux/todo-sidebar.ts`
- **Action**: Extend todo tool with sidebar sync. Add completion tracking, priority sorting, filtering.
- **Verification**: Todo operations sync with sidebar in real-time. All CRUD operations supported.
- **Done**: Full-featured todo management with sidebar integration.

**Task 3.3: Add session recovery improvements**
- **Files**: `src/recovery/*.ts`, `src/orchestrator/state.ts`
- **Action**: Enhance state persistence across interruptions. Add checkpoint system for long-running tasks.
- **Verification**: Pipeline resumes correctly after interruption. Checkpoints preserve progress.
- **Done**: Robust session recovery with minimal data loss.

### Wave 2: Advanced Observability (Depends on Phase 2)

**Task 3.4: Implement enhanced session analytics**
- **Files**: `src/observability/session-analytics.ts`, `src/ux/session-summary.ts`
- **Action**: Add detailed analytics: token trends, tool usage patterns, phase duration analysis.
- **Verification**: Analytics show actionable insights. Performance bottlenecks identifiable.
- **Done**: Comprehensive session analytics dashboard.

**Task 3.5: Add cost display in UX**
- **Files**: `src/ux/cost-display.ts`, `src/index.ts`, `src/observability/event-handlers.ts`
- **Action**: Display real-time cost estimates in UI. Add cost warnings for expensive operations.
- **Verification**: Users see cost estimates before confirmation. Warnings trigger for high-cost operations.
- **Done**: Proactive cost visibility and management.

**Task 3.6: Performance monitoring and optimization**
- **Files**: `src/observability/performance-monitor.ts`, `src/orchestrator/handlers/*.ts`
- **Action**: Add performance metrics collection. Identify and optimize bottlenecks.
- **Verification**: Performance metrics collected. Optimization opportunities identified.
- **Done**: Continuous performance improvement cycle established.

## Detailed Task Breakdown

### Task 1.1: Fix cost tracking bug

**Files:**
- `src/observability/event-handlers.ts` (line 224 fix)
- `src/observability/event-store.ts` (add duration calculation)
- `tests/observability/event-handlers.test.ts` (unit tests)
- `tests/observability/integration.test.ts` (integration tests)

**Implementation:**
```typescript
// In event-handlers.ts session.deleted handler
case "session.deleted": {
  const sessionId = extractSessionId(properties);
  if (!sessionId) return;
  
  const session = eventStore.getSession(sessionId);
  const totalCost = session?.tokens?.totalCost || 0;
  const startedAt = new Date(session?.startedAt || Date.now());
  const durationMs = Date.now() - startedAt.getTime();
  
  eventStore.appendEvent(sessionId, {
    type: "session_end",
    timestamp: new Date().toISOString(),
    sessionId,
    durationMs,
    totalCost,  // ✅ Use accumulated value
  });
  // ... rest of handler
}
```

**Verification:**
- `bun test tests/observability/event-handlers.test.ts`
- Manual test: Run session, verify non-zero cost in summary

### Task 1.2: Fix phase directory scoping

**Files:**
- `src/orchestrator/artifacts.ts` (remove LEGACY_RUN_ID)
- `src/orchestrator/handlers/*.ts` (update all phase handlers)
- `tests/orchestrator/artifacts.test.ts` (unit tests)

**Implementation:**
```typescript
// Remove LEGACY_RUN_ID constant
// Update getPhaseDir to always use runId
export function getPhaseDir(artifactDir: string, phase: Phase, runId: string): string {
  return join(artifactDir, "phases", runId, phase);
}

// Update all phase handlers to pass runId
export const handleBuild: PhaseHandler = async (state, artifactDir, result?, context?) => {
  const phaseDir = await ensurePhaseDir(artifactDir, "BUILD", state.runId);
  // ...
};
```

**Verification:**
- `bun test tests/orchestrator/artifacts.test.ts`
- Manual test: Run pipeline twice, verify separate phase directories

### Task 1.3: Basic hash-anchored edit enforcement

**Files:**
- `src/config.ts` (add hashline_edit config)
- `src/index.ts` (tool interceptor hook)
- `src/tools/hashline-edit.ts` (enhance error messages)
- `tests/tools/hashline-edit.test.ts` (enforcement tests)

**Implementation:**
```typescript
// In config schema
hashline_edit: z.object({
  enabled: z.boolean().default(true),
  enforce_for_agents: z.array(z.string()).default(["oc-implementer", "autopilot"]),
}),

// In index.ts tool.execute.before hook
if (config.hashline_edit.enabled && 
    config.hashline_edit.enforce_for_agents.includes(agentName) &&
    toolName === "edit") {
  return {
    error: `Use oc_hashline_edit instead. Built-in edit disabled for parallel safety.`
  };
}
```

**Verification:**
- `bun test tests/tools/hashline-edit.test.ts`
- Integration test: Run parallel tasks, verify 0 built-in edit calls

### Task 2.1: Intent gate system

**Files:**
- `src/routing/intent-gate.ts` (core gate logic)
- `src/tools/orchestrate.ts` (gate integration)
- `tests/routing/intent-gate.test.ts` (unit tests)

**Implementation:**
```typescript
// Intent gate class
class IntentGate {
  private intentCache = new Map<string, IntentClassification>();
  
  requireIntent(messageId: string): IntentClassification | null {
    const intent = this.intentCache.get(messageId);
    if (!intent) {
      throw new Error("Call oc_route first to classify intent");
    }
    return intent;
  }
  
  cacheIntent(messageId: string, intent: IntentClassification) {
    this.intentCache.set(messageId, intent);
  }
}

// In oc_orchestrate tool
const intent = intentGate.requireIntent(context.messageId);
if (!intent) {
  return "Error: Call oc_route first to classify intent";
}
```

**Verification:**
- `bun test tests/routing/intent-gate.test.ts`
- Manual test: Try oc_orchestrate without oc_route, verify rejection

### Task 2.4: Wave-based parallel execution

**Files:**
- `src/orchestrator/handlers/build.ts` (refactor for parallelism)
- `src/orchestrator/handlers/build-utils.ts` (enhance parallel dispatch)
- `tests/orchestrator/build-parallel.test.ts` (parallel execution tests)

**Implementation:**
```typescript
// Enhanced buildParallelDispatch
export async function buildParallelDispatch(
  pendingTasks: readonly Task[],
  wave: number,
  effectiveTasks: readonly Task[],
  buildProgress: Readonly<BuildProgress>,
  artifactDir: string,
  runId?: string,
  maxParallel: number = DEFAULT_MAX_PARALLEL_TASKS,
): Promise<DispatchResult> {
  // Dispatch up to maxParallel tasks concurrently
  const tasksToDispatch = pendingTasks.slice(0, maxParallel);
  
  if (tasksToDispatch.length > 1) {
    return {
      action: "dispatch_multi",
      agents: await Promise.all(tasksToDispatch.map(task => ({
        agent: AGENT_NAMES.BUILD,
        prompt: await buildTaskPrompt(task, artifactDir, runId, "PARALLEL"),
        taskId: task.id,
        resultKind: "task_completion" as const,
      }))),
      // ...
    };
  }
}
```

**Verification:**
- `bun test tests/orchestrator/build-parallel.test.ts`
- Performance test: Measure BUILD phase duration with/without parallelism

### Task 3.1: Todo sidebar integration

**Files:**
- `src/ux/todo-sidebar.ts` (sidebar integration)
- `src/tools/todowrite.ts` (enhanced todo tool)
- `tests/ux/todo-sidebar.test.ts` (integration tests)

**Implementation:**
```typescript
// Todo sidebar manager
class TodoSidebarManager {
  private todos: Todo[] = [];
  
  async syncWithSidebar() {
    // Use OpenCode SDK to update sidebar
    await window.opencode?.updateSidebar?.({
      type: "todos",
      items: this.todos.map(todo => ({
        id: todo.id,
        text: todo.content,
        status: todo.status,
        priority: todo.priority,
      }))
    });
  }
  
  async addTodo(todo: Todo) {
    this.todos.push(todo);
    await this.syncWithSidebar();
  }
}
```

**Verification:**
- Manual test: Create todo, verify appears in sidebar
- Persistence test: Restart session, verify todos persist

## Dependencies Map

```
Phase 1 Wave 1 (Foundation):
  1.1 Cost tracking bug fix
  1.2 Phase directory scoping
  1.3 Basic hash enforcement

Phase 1 Wave 2 (Enhanced Enforcement):
  1.4 Read enhancement hook (depends on 1.3)
  1.5 Tool-level permissions (depends on 1.3)

Phase 2 Wave 1 (Intent System):
  2.1 Intent gate system
  2.2 oc_route tool
  2.3 Intent-pipeline integration (depends on 2.1, 2.2)

Phase 2 Wave 2 (Performance):
  2.4 Wave parallelism (depends on Phase 1)
  2.5 Oracle verification gate
  2.6 Subagent cost aggregation (depends on 1.1)

Phase 3 Wave 1 (Todo Integration):
  3.1 Todo sidebar integration
  3.2 Todo management API (depends on 3.1)
  3.3 Session recovery improvements

Phase 3 Wave 2 (Advanced Observability):
  3.4 Enhanced session analytics (depends on Phase 2)
  3.5 Cost display in UX (depends on 1.1, 2.6)
  3.6 Performance monitoring (depends on 2.4)
```

## Success Metrics

### Quantitative Targets:
1. **Edit success rate**: >60% (from 6.7%)
2. **Intent accuracy**: >95% correct workflow selection
3. **Build speed**: 3-5x faster with wave parallelism
4. **Cost tracking accuracy**: 100% accurate per-session costs
5. **Todo visibility**: 100% sidebar integration coverage

### Qualitative Targets:
1. Users report "faster, more reliable" experience
2. No "why doesn't this work?" questions about missing todos/costs
3. Positive feedback on automatic workflow selection
4. Reduced user intervention needed

## Risk Assessment & Mitigation

### High Risk Items:
1. **SDK Dependencies**: Todo sidebar integration may require OpenCode SDK changes
   - **Mitigation**: Feature flag, fallback to current behavior
2. **Backward Compatibility**: Tool interception may break existing agent behavior
   - **Mitigation**: Configuration opt-out, gradual rollout
3. **Performance Overhead**: Intent Gate adds latency to every user message
   - **Mitigation**: Async classification, caching, performance monitoring

### Medium Risk Items:
1. **Complexity**: Wave parallelism increases system complexity
   - **Mitigation**: Thorough testing, circuit breakers, rollback plan
2. **Data Migration**: Phase directory restructuring requires migration
   - **Mitigation**: Migration script, backward compatibility mode

## Testing Strategy

### Unit Tests:
- Each task includes unit tests for core logic
- Mock dependencies for isolation
- Test edge cases and error conditions

### Integration Tests:
- Test interactions between components
- Verify data flow across system boundaries
- Test configuration variations

### End-to-End Tests:
- Full pipeline execution tests
- Performance benchmarking
- User scenario simulations

### Manual Verification:
- UX testing for new features
- Performance validation in real scenarios
- Compatibility testing with existing workflows

## Rollout Plan

### Phase 1 (Week 1-2):
- Deploy critical bug fixes (1.1, 1.2)
- Enable hash enforcement with feature flag (1.3)
- Monitor for regressions

### Phase 2 (Week 2-3):
- Roll out intent gate (2.1-2.3) with opt-in
- Enable wave parallelism (2.4) with conservative concurrency limits
- Deploy Oracle gate (2.5) for critical changes only

### Phase 3 (Week 3-4):
- Release todo sidebar integration (3.1-3.2)
- Enable advanced observability features (3.4-3.6)
- Gather user feedback, iterate

## Conclusion

This implementation plan systematically addresses the 6 major gaps between `opencode-autopilot` and `oh-my-openagent`. By focusing on enforcement mechanisms, observability fixes, and performance optimizations, we can achieve parity or superiority in all key metrics. The phased approach minimizes risk while delivering incremental value at each stage.

The plan is ambitious but achievable within 4 weeks, with each phase building on the previous to create a cohesive, high-quality implementation that brings the plugin to production-grade reliability and performance.