# OMO → AUTOPILOT TRANSPLANT ROADMAP

**Status**: Ready for implementation  
**Priority**: HIGH — These features would transform autopilot  
**Effort**: 8-12 weeks for full adoption

---

## QUICK REFERENCE: WHAT TO STEAL FROM OMO

### 🔴 CRITICAL (Do First)

1. **Background Agent Manager** (`/src/features/background-agent/`)
   - **Why**: Enables parallel task execution (5+ agents at once)
   - **Effort**: 2-3 weeks
   - **Files to Copy**: `manager.ts`, `types.ts`, `spawner.ts`, `task-poller.ts`, `concurrency.ts`
   - **Dependencies**: SQLite, OpenCode SDK
   - **Impact**: 10x productivity boost

2. **Ralph Loop** (`/src/hooks/ralph-loop/`)
   - **Why**: Enables autonomy (agent loops until done)
   - **Effort**: 1-2 weeks
   - **Files to Copy**: `ralph-loop-hook.ts`, `loop-state-controller.ts`, `completion-promise-detector.ts`
   - **Dependencies**: Hook system, session events
   - **Impact**: Eliminates manual intervention

3. **Category-Based Routing** (`/src/tools/delegate-task/`)
   - **Why**: Enables intelligent task delegation
   - **Effort**: 1 week
   - **Files to Copy**: `categories.ts`, `category-resolver.ts`, `model-selection.ts`
   - **Dependencies**: Model resolution, config system
   - **Impact**: 3x faster task completion

### 🟡 HIGH PRIORITY (Do Second)

4. **Configuration System** (`/src/config/schema/`)
   - **Why**: Enables flexible, user-driven configuration
   - **Effort**: 1 week
   - **Files to Copy**: `schema.ts`, `oh-my-opencode-config.ts`, Zod schemas
   - **Dependencies**: Zod, JSONC parser
   - **Impact**: Enables all other features

5. **Session Recovery** (`/src/hooks/session-recovery/`)
   - **Why**: Handles errors gracefully
   - **Effort**: 2 weeks
   - **Files to Copy**: `hook.ts`, `recover-*.ts`, `error-classifier.ts`
   - **Dependencies**: Hook system, error handling
   - **Impact**: 99% uptime

6. **Context Injection** (`/src/hooks/directory-agents-injector/`)
   - **Why**: Auto-injects AGENTS.md, README.md, rules
   - **Effort**: 1 week
   - **Files to Copy**: `directory-agents-injector/`, `directory-readme-injector/`, `rules-injector/`
   - **Dependencies**: File discovery, token budgeting
   - **Impact**: 2x context efficiency

### 🟢 NICE TO HAVE (Do Third)

7. **Skill-Embedded MCPs** (`/src/features/opencode-skill-loader/`)
   - **Why**: Scoped MCP servers, no context bloat
   - **Effort**: 2 weeks
   - **Files to Copy**: `loader.ts`, `merger.ts`, `skill-mcp-manager/`
   - **Dependencies**: MCP SDK, process management
   - **Impact**: Cleaner context

8. **Hash-Anchored Edits** (`/src/tools/hashline-edit/`)
   - **Why**: Eliminates stale-line errors
   - **Effort**: 1 week
   - **Files to Copy**: `hashline-edit.ts`, `hashline-read-enhancer/`
   - **Dependencies**: Edit tool integration
   - **Impact**: 99% edit success rate

9. **Discipline Agents** (`/src/agents/`)
   - **Why**: Specialized agents for different tasks
   - **Effort**: 3-4 weeks
   - **Files to Copy**: `sisyphus/`, `hephaestus/`, `prometheus/`, `oracle.ts`, `librarian.ts`
   - **Dependencies**: Agent system, dynamic prompts
   - **Impact**: 5x task completion rate

---

## IMPLEMENTATION PHASES

### Phase 1: Foundation (Weeks 1-2)

**Goal**: Get basic background execution working

```
Week 1:
  - Copy configuration system (Zod schemas)
  - Add JSONC parsing
  - Create config validation

Week 2:
  - Copy background agent manager structure
  - Implement task persistence (SQLite)
  - Implement concurrency control
```

**Deliverable**: Can spawn 1 background task

### Phase 2: Autonomy (Weeks 3-4)

**Goal**: Enable self-referential loops

```
Week 3:
  - Copy Ralph Loop structure
  - Implement loop state controller
  - Add completion detection

Week 4:
  - Add verification handling
  - Add session recovery
  - Test end-to-end
```

**Deliverable**: Agent loops until task is done

### Phase 3: Intelligence (Weeks 5-6)

**Goal**: Enable intelligent task routing

```
Week 5:
  - Copy category-based routing
  - Implement category → model mapping
  - Add delegate-task tool

Week 6:
  - Add skill injection
  - Add token budgeting
  - Test with multiple categories
```

**Deliverable**: Tasks auto-route to optimal model

### Phase 4: Resilience (Weeks 7-8)

**Goal**: Handle errors gracefully

```
Week 7:
  - Copy session recovery system
  - Implement error categorization
  - Add recovery strategies

Week 8:
  - Add context injection
  - Add compaction awareness
  - Test error scenarios
```

**Deliverable**: 99% uptime, auto-recovery

### Phase 5: Polish (Weeks 9-12)

**Goal**: Add remaining features

```
Week 9-10:
  - Copy skill-embedded MCPs
  - Implement MCP lifecycle
  - Add scope filtering

Week 11:
  - Copy hash-anchored edits
  - Implement line hashing
  - Add edit validation

Week 12:
  - Copy discipline agents
  - Implement dynamic prompts
  - Add agent-specific tuning
```

**Deliverable**: Full OMO feature parity

---

## FILE-BY-FILE TRANSPLANT GUIDE

### Background Agent Manager

```
Source: /src/features/background-agent/
Target: src/features/background-agent/

Files to copy:
  ✓ manager.ts (2,160 LOC) — Main orchestrator
  ✓ types.ts — Type definitions
  ✓ spawner.ts — Session spawning
  ✓ task-poller.ts — Polling loop
  ✓ concurrency.ts — Concurrency control
  ✓ error-classifier.ts — Error categorization
  ✓ fallback-retry-handler.ts — Fallback retry
  ✓ loop-detector.ts — Circuit breaker
  ✓ subagent-spawn-limits.ts — Spawn limits
  ✓ task-history.ts — Task persistence
  ✓ session-idle-event-handler.ts — Idle detection
  ✓ session-status-classifier.ts — Status tracking

Dependencies:
  - @opencode-ai/plugin
  - @opencode-ai/sdk
  - bun:sqlite (for task persistence)
  - node:path, node:fs/promises

Modifications needed:
  - Update import paths
  - Adapt to autopilot's SDK version
  - Add autopilot-specific logging
```

### Ralph Loop

```
Source: /src/hooks/ralph-loop/
Target: src/hooks/ralph-loop/

Files to copy:
  ✓ ralph-loop-hook.ts (90 LOC) — Main hook
  ✓ loop-state-controller.ts — State management
  ✓ completion-promise-detector.ts — Completion detection
  ✓ pending-verification-handler.ts — Verification handling
  ✓ continuation-prompt-injector.ts — Prompt injection
  ✓ session-event-handler.ts — Event handling
  ✓ storage.ts — State persistence
  ✓ types.ts — Type definitions

Dependencies:
  - Hook system
  - Session events
  - File I/O

Modifications needed:
  - Update hook registration
  - Adapt to autopilot's event system
  - Update prompt templates
```

### Category-Based Routing

```
Source: /src/tools/delegate-task/
Target: src/tools/delegate-task/

Files to copy:
  ✓ tools.ts (256 LOC) — Tool definition
  ✓ categories.ts — Category definitions
  ✓ category-resolver.ts — Category resolution
  ✓ model-selection.ts — Model selection
  ✓ executor.ts — Task execution
  ✓ prompt-builder.ts — Prompt building
  ✓ skill-resolver.ts — Skill resolution
  ✓ types.ts — Type definitions

Dependencies:
  - Background agent manager
  - Model resolution
  - Skill system

Modifications needed:
  - Update category definitions
  - Adapt to autopilot's model list
  - Update prompt templates
```

### Configuration System

```
Source: /src/config/schema/
Target: src/config/schema/

Files to copy:
  ✓ schema.ts — Main schema
  ✓ oh-my-opencode-config.ts — Config interface
  ✓ background-task.ts — Background task config
  ✓ categories.ts — Category config
  ✓ ralph-loop.ts — Ralph Loop config
  ✓ agent-names.ts — Agent name validation
  ✓ fallback-models.ts — Fallback model config

Dependencies:
  - zod
  - jsonc-parser

Modifications needed:
  - Update config paths
  - Add autopilot-specific options
  - Update validation rules
```

### Session Recovery

```
Source: /src/hooks/session-recovery/
Target: src/hooks/session-recovery/

Files to copy:
  ✓ hook.ts — Main hook
  ✓ resume.ts — Resume logic
  ✓ recover-empty-content-message-sdk.ts
  ✓ recover-thinking-block-order.ts
  ✓ recover-tool-result-missing.ts
  ✓ recover-unavailable-tool.ts
  ✓ error-classifier.ts — Error categorization
  ✓ storage.ts — State persistence

Dependencies:
  - Hook system
  - Session events
  - File I/O

Modifications needed:
  - Update error detection patterns
  - Adapt recovery strategies
  - Update prompt templates
```

### Context Injection

```
Source: /src/hooks/directory-agents-injector/
Target: src/hooks/directory-agents-injector/

Files to copy:
  ✓ hook.ts — Main hook
  ✓ injector.ts — Injection logic
  ✓ finder.ts — File discovery
  ✓ storage.ts — Cache storage

Also copy:
  ✓ /src/hooks/directory-readme-injector/
  ✓ /src/hooks/rules-injector/

Dependencies:
  - Hook system
  - File I/O
  - Token budgeting

Modifications needed:
  - Update file discovery paths
  - Adapt to autopilot's directory structure
  - Update token budgeting
```

---

## TESTING STRATEGY

### Unit Tests (Week 1-2)

```typescript
// Test background agent manager
describe('BackgroundManager', () => {
  it('should spawn a task', async () => {})
  it('should poll task status', async () => {})
  it('should handle task completion', async () => {})
  it('should handle task errors', async () => {})
  it('should enforce concurrency limits', async () => {})
})

// Test Ralph Loop
describe('RalphLoop', () => {
  it('should start a loop', () => {})
  it('should detect completion', () => {})
  it('should handle verification failure', () => {})
  it('should persist state', () => {})
})

// Test category routing
describe('CategoryRouting', () => {
  it('should resolve category to model', () => {})
  it('should select correct model', () => {})
  it('should inject skills', () => {})
})
```

### Integration Tests (Week 3-4)

```typescript
// Test end-to-end background execution
describe('BackgroundExecution', () => {
  it('should spawn and complete a task', async () => {})
  it('should handle multiple parallel tasks', async () => {})
  it('should recover from errors', async () => {})
})

// Test Ralph Loop with real session
describe('RalphLoopIntegration', () => {
  it('should loop until completion', async () => {})
  it('should handle verification failures', async () => {})
})
```

### E2E Tests (Week 5-6)

```typescript
// Test full workflow
describe('E2E', () => {
  it('should spawn task with category', async () => {})
  it('should loop until done', async () => {})
  it('should recover from errors', async () => {})
  it('should inject context', async () => {})
})
```

---

## RISK MITIGATION

### Risk 1: Breaking Changes

**Mitigation**:
- Feature-flag new functionality
- Keep old behavior as fallback
- Gradual rollout to users

### Risk 2: Performance Degradation

**Mitigation**:
- Profile before/after
- Add performance tests
- Monitor in production

### Risk 3: Compatibility Issues

**Mitigation**:
- Test with multiple OpenCode versions
- Maintain backward compatibility
- Document breaking changes

### Risk 4: Complexity Explosion

**Mitigation**:
- Enforce modular code (200 LOC limit)
- Add comprehensive tests
- Document architecture

---

## SUCCESS CRITERIA

### Phase 1 (Foundation)
- [ ] Background task execution works
- [ ] Task persistence works
- [ ] Concurrency control works
- [ ] 90% test coverage

### Phase 2 (Autonomy)
- [ ] Ralph Loop works
- [ ] Completion detection works
- [ ] Verification handling works
- [ ] 90% test coverage

### Phase 3 (Intelligence)
- [ ] Category routing works
- [ ] Model selection works
- [ ] Skill injection works
- [ ] 90% test coverage

### Phase 4 (Resilience)
- [ ] Error recovery works
- [ ] Context injection works
- [ ] 99% uptime in testing
- [ ] 90% test coverage

### Phase 5 (Polish)
- [ ] All features working
- [ ] Full test coverage
- [ ] Documentation complete
- [ ] Ready for production

---

## ESTIMATED TIMELINE

| Phase | Duration | Effort | Deliverable |
|-------|----------|--------|-------------|
| 1 | 2 weeks | 80 hours | Background execution |
| 2 | 2 weeks | 80 hours | Autonomy |
| 3 | 2 weeks | 80 hours | Intelligence |
| 4 | 2 weeks | 80 hours | Resilience |
| 5 | 4 weeks | 160 hours | Polish + features |
| **Total** | **12 weeks** | **480 hours** | **Full OMO parity** |

---

## NEXT STEPS

1. **Review this roadmap** with team
2. **Prioritize features** based on impact
3. **Create implementation plan** for Phase 1
4. **Set up testing infrastructure**
5. **Begin Phase 1 implementation**

---

## QUESTIONS?

- **What's the highest-impact feature?** → Background Agent Manager
- **What's the easiest to implement?** → Configuration System
- **What's the most critical?** → Ralph Loop (enables autonomy)
- **What should we do first?** → Configuration System (enables everything else)

