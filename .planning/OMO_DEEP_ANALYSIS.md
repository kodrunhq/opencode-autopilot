# OH-MY-OPENAGENT (OMO) — COMPREHENSIVE DEEP-DIVE ANALYSIS

**Project**: oh-my-openagent (oh-my-opencode)  
**Version**: 3.15.0  
**Codebase Size**: 1,118 source files (non-test)  
**Architecture**: Multi-agent orchestration plugin for OpenCode  
**Key Insight**: OMO is a **production-grade agent harness** with features that autopilot lacks entirely

---

## EXECUTIVE SUMMARY

OMO is **NOT** just another plugin. It's a complete reimagining of how agents work:

1. **Discipline Agents** — Sisyphus (orchestrator), Hephaestus (deep worker), Prometheus (planner), Oracle (debugger), Librarian (search)
2. **Background Agent Manager** — Parallel task execution with concurrency control, fallback retry, circuit breaker
3. **Ralph Loop** — Self-referential autonomy: agent loops until task is 100% done
4. **Category-Based Routing** — Tasks auto-route to optimal model (quick→fast, deep→reasoning, visual→frontend)
5. **Tmux Integration** — Full interactive terminal with REPLs, debuggers, TUIs
6. **Hash-Anchored Edits** — Every line tagged with content hash; stale-line errors eliminated
7. **Skill-Embedded MCPs** — MCP servers scoped to skills, not global context bloat
8. **Context Injection** — Auto-inject AGENTS.md, README.md, rules based on directory
9. **Session Recovery** — Automatic recovery from context window limits, API failures
10. **Comprehensive Hook System** — 50+ hooks covering every lifecycle event

---

## FEATURE CATALOG

### 1. BACKGROUND AGENT MANAGER

**Location**: `/src/features/background-agent/`  
**Core Files**: `manager.ts` (2,160 LOC), `types.ts`, `spawner.ts`, `task-poller.ts`

#### Architecture

```
BackgroundManager (main orchestrator)
├── ConcurrencyManager (per-provider/model limits)
├── TaskHistory (persistent task tracking)
├── TaskPoller (polling loop for session status)
├── Spawner (creates new OpenCode sessions)
├── ErrorClassifier (categorizes failures)
├── FallbackRetryHandler (model fallback chain)
└── CircuitBreaker (prevents infinite loops)
```

#### Key Capabilities

| Feature | Implementation | Transplant Effort |
|---------|----------------|-------------------|
| **Parallel Task Execution** | `ConcurrencyManager` tracks active slots per provider/model | **MEDIUM** — Need concurrency tracking |
| **Task Persistence** | `TaskHistory` stores to disk; survives process restart | **MEDIUM** — Need SQLite schema |
| **Polling Loop** | `TaskPoller` checks session status every 500ms | **LOW** — Straightforward polling |
| **Fallback Retry** | `FallbackRetryHandler` chains model fallbacks on error | **MEDIUM** — Need fallback config |
| **Circuit Breaker** | `loop-detector.ts` detects repetitive tool use, breaks loop | **MEDIUM** — Need pattern detection |
| **Subagent Spawn Limits** | `subagent-spawn-limits.ts` enforces depth/descendant limits | **MEDIUM** — Need spawn tracking |
| **Session Cleanup** | Auto-cleanup of completed/failed tasks | **LOW** — Straightforward cleanup |

#### Entry Points

- **Launch**: `manager.launchTask(input: LaunchInput)` → spawns new session
- **Resume**: `manager.resumeTask(input: ResumeInput)` → continues existing session
- **Poll**: `manager.pollTasks()` → checks all active tasks
- **Cancel**: `manager.cancelTask(taskId)` → aborts task

#### Types

```typescript
interface BackgroundTask {
  id: string
  sessionID?: string
  parentSessionID: string
  parentMessageID: string
  description: string
  prompt: string
  agent: string
  status: "pending" | "running" | "completed" | "error" | "cancelled"
  model?: DelegatedModelConfig
  fallbackChain?: FallbackEntry[]
  attemptCount?: number
  concurrencyKey?: string
  category?: string
  spawnDepth?: number
}
```

#### What Autopilot Lacks

- ❌ No parallel task execution
- ❌ No task persistence across restarts
- ❌ No fallback retry mechanism
- ❌ No circuit breaker for infinite loops
- ❌ No subagent spawn limits

---

### 2. RALPH LOOP (AUTONOMY MECHANISM)

**Location**: `/src/hooks/ralph-loop/`  
**Core Files**: `ralph-loop-hook.ts` (90 LOC), `loop-state-controller.ts`, `completion-promise-detector.ts`

#### Architecture

```
RalphLoopHook (main entry point)
├── LoopStateController (manages loop state)
├── SessionRecovery (handles session errors)
├── EventHandler (processes session events)
├── CompletionPromiseDetector (detects when task is done)
├── VerificationFailureHandler (handles failed verifications)
└── ContinuationPromptInjector (injects loop continuation)
```

#### How It Works

1. **Start Loop**: `startLoop(sessionID, prompt, options)` initializes loop state
2. **Event Processing**: Hook listens to session events (message, tool_use, etc.)
3. **Completion Detection**: Analyzes transcript/promise to detect task completion
4. **Verification**: If verification fails, injects continuation prompt
5. **Iteration**: Loops until completion detected or max iterations reached
6. **Cleanup**: Clears state on completion or cancellation

#### Key Features

| Feature | Implementation | Transplant Effort |
|---------|----------------|-------------------|
| **Loop State Persistence** | `storage.ts` saves state to disk | **LOW** — Simple file I/O |
| **Completion Detection** | `completion-promise-detector.ts` analyzes transcript | **MEDIUM** — Regex pattern matching |
| **Verification Handling** | `pending-verification-handler.ts` detects pending checks | **MEDIUM** — Prompt analysis |
| **Continuation Injection** | `continuation-prompt-injector.ts` injects loop prompt | **LOW** — String concatenation |
| **Session Recovery** | `loop-session-recovery.ts` recovers from errors | **MEDIUM** — Error handling |
| **Timeout Handling** | `with-timeout.ts` enforces max iteration time | **LOW** — setTimeout wrapper |

#### Entry Points

```typescript
interface RalphLoopHook {
  event: (input: { event: { type: string; properties?: unknown } }) => Promise<void>
  startLoop: (sessionID: string, prompt: string, options?: RalphLoopOptions) => boolean
  cancelLoop: (sessionID: string) => boolean
  getState: () => RalphLoopState | null
}
```

#### What Autopilot Lacks

- ❌ No self-referential loop mechanism
- ❌ No completion detection
- ❌ No verification failure handling
- ❌ No loop state persistence

---

### 3. CATEGORY-BASED TASK ROUTING

**Location**: `/src/tools/delegate-task/`  
**Core Files**: `tools.ts` (256 LOC), `categories.ts`, `category-resolver.ts`, `model-selection.ts`

#### Architecture

```
DelegateTask Tool (main entry point)
├── CategoryResolver (maps category → config)
├── ModelSelection (selects model for category)
├── PromptBuilder (builds system/task prompts)
├── Executor (executes task sync/async)
├── SkillResolver (resolves skills for task)
└── SubagentResolver (maps subagent_type → agent)
```

#### Built-in Categories

| Category | Purpose | Default Model | Transplant |
|----------|---------|----------------|-----------|
| `quick` | Single-file changes, typos | Fast model (GPT-4o) | **MEDIUM** |
| `deep` | Autonomous research + execution | Reasoning model (GPT-5.4) | **MEDIUM** |
| `visual-engineering` | Frontend, UI/UX, design | Vision model (Claude) | **MEDIUM** |
| `ultrabrain` | Hard logic, architecture | Best reasoning (GPT-5.4 xhigh) | **MEDIUM** |
| Custom | User-defined categories | User-specified | **MEDIUM** |

#### Key Features

| Feature | Implementation | Transplant Effort |
|---------|----------------|-------------------|
| **Category Mapping** | `categories.ts` defines category → model mapping | **LOW** — Config-driven |
| **Model Selection** | `model-selection.ts` picks model for category | **MEDIUM** — Model resolution logic |
| **Skill Injection** | `skill-resolver.ts` loads skills for task | **MEDIUM** — Skill loading |
| **Sync/Async Execution** | `executor.ts` handles both modes | **MEDIUM** — Session creation |
| **Subagent Routing** | `subagent-resolver.ts` maps agent names | **LOW** — Lookup table |
| **Token Budgeting** | `token-limiter.ts` enforces context limits | **MEDIUM** — Token counting |

#### Entry Points

```typescript
function createDelegateTask(options: DelegateTaskToolOptions): ToolDefinition
// Returns tool with args:
// - category: string (optional)
// - subagent_type: string (optional)
// - description: string
// - prompt: string
// - run_in_background: boolean
// - load_skills: string[]
// - session_id?: string (for continuation)
```

#### What Autopilot Lacks

- ❌ No category-based routing
- ❌ No model selection per category
- ❌ No subagent type mapping
- ❌ No task delegation tool

---

### 4. TMUX INTEGRATION (INTERACTIVE TERMINAL)

**Location**: `/src/features/tmux-subagent/`  
**Core Files**: `manager.ts` (965 LOC), `decision-engine.ts`, `action-executor.ts`, `polling-manager.ts`

#### Architecture

```
TmuxSessionManager (main orchestrator)
├── PollingManager (monitors pane state)
├── DecisionEngine (decides spawn/close actions)
├── ActionExecutor (executes tmux commands)
├── PaneStateQuerier (queries pane state)
├── SessionCreatedHandler (handles new sessions)
└── SessionDeletedHandler (handles closed sessions)
```

#### Key Capabilities

| Feature | Implementation | Transplant Effort |
|---------|----------------|-------------------|
| **Session Spawning** | `spawner.ts` creates tmux sessions | **MEDIUM** — tmux command execution |
| **Pane Management** | `pane-state-parser.ts` parses pane state | **MEDIUM** — tmux output parsing |
| **Polling Loop** | `polling-manager.ts` monitors sessions | **LOW** — Polling loop |
| **Grid Planning** | `grid-planning.ts` lays out panes | **MEDIUM** — Layout algorithm |
| **Capacity Tracking** | `types.ts` tracks available panes | **LOW** — State tracking |
| **Zombie Pane Detection** | `zombie-pane.test.ts` detects stale panes | **MEDIUM** — State analysis |

#### Entry Points

```typescript
class TmuxSessionManager {
  constructor(ctx: PluginInput, tmuxConfig: TmuxConfig)
  async onSessionCreated(event: SessionCreatedEvent): Promise<void>
  async onSessionDeleted(sessionId: string): Promise<void>
  async pollSessions(): Promise<void>
  async spawnSession(title: string): Promise<string | undefined>
}
```

#### What Autopilot Lacks

- ❌ No tmux integration
- ❌ No interactive terminal support
- ❌ No pane management
- ❌ No session spawning in tmux

---

### 5. HASH-ANCHORED EDIT TOOL (HASHLINE)

**Location**: `/src/tools/hashline-edit/`  
**Core Files**: `hashline-edit.ts`, `hashline-read-enhancer/`

#### Architecture

```
HashlineEdit Tool
├── LineHasher (computes content hash per line)
├── EditValidator (validates hash before applying)
├── DiffEnhancer (enhances diff with hashes)
└── ReadEnhancer (adds hashes to read output)
```

#### How It Works

1. **Read**: Agent reads file → each line tagged with content hash
   ```
   11#VK| function hello() {
   22#XJ|   return "world";
   33#MB| }
   ```

2. **Edit**: Agent references hash when editing
   ```
   edit(path, line_id="22#XJ", new_content="return 'world';")
   ```

3. **Validate**: Before applying, verify hash matches current content
   - If hash matches → apply edit
   - If hash doesn't match → reject (file changed since read)

#### Key Features

| Feature | Implementation | Transplant Effort |
|---------|----------------|-------------------|
| **Hash Computation** | Content-based hash (not line number) | **LOW** — Hash function |
| **Edit Validation** | Verify hash before applying | **MEDIUM** — Edit tool integration |
| **Diff Enhancement** | Add hashes to diff output | **LOW** — String formatting |
| **Read Enhancement** | Add hashes to read output | **LOW** — String formatting |

#### What Autopilot Lacks

- ❌ No hash-anchored edits
- ❌ No stale-line error prevention
- ❌ No content-based line identification

---

### 6. SKILL-EMBEDDED MCPs

**Location**: `/src/features/opencode-skill-loader/` + `/src/features/skill-mcp-manager/`  
**Core Files**: `loader.ts`, `merger.ts`, `manager.ts`

#### Architecture

```
SkillLoader (discovers skills)
├── SkillDiscovery (finds skill directories)
├── SkillContentExtractor (extracts SKILL.md content)
├── SkillMerger (merges builtin + user skills)
└── SkillMCPManager (manages MCP servers)

SkillMCPManager (manages MCP lifecycle)
├── MCPConnection (stdio/HTTP connection)
├── OAuthHandler (handles OAuth flows)
├── EnvCleaner (cleans up env vars)
└── ConnectionRace (prevents race conditions)
```

#### Key Features

| Feature | Implementation | Transplant Effort |
|---------|----------------|-------------------|
| **Skill Discovery** | Finds skills in `.opencode/skills/` and `~/.config/opencode/skills/` | **MEDIUM** — Directory scanning |
| **Skill Merging** | Merges builtin + user skills with priority | **MEDIUM** — Merge logic |
| **MCP Lifecycle** | Starts/stops MCP servers on-demand | **MEDIUM** — Process management |
| **Scope Filtering** | Filters tools/resources by scope | **MEDIUM** — Permission system |
| **OAuth Support** | Handles OAuth flows for MCPs | **MEDIUM** — OAuth implementation |
| **Token Budgeting** | Limits skill context to token budget | **MEDIUM** — Token counting |

#### Entry Points

```typescript
class SkillMCPManager {
  async loadSkills(skillNames: string[]): Promise<LoadedSkill[]>
  async connectMCP(skill: LoadedSkill): Promise<MCPConnection>
  async disconnectMCP(skillName: string): Promise<void>
  async listTools(skillName: string): Promise<Tool[]>
}
```

#### What Autopilot Lacks

- ❌ No skill-embedded MCPs
- ❌ No MCP lifecycle management
- ❌ No scope filtering for MCPs
- ❌ No OAuth support for MCPs

---

### 7. CONTEXT INJECTION SYSTEM

**Location**: `/src/hooks/` (multiple hooks)  
**Key Hooks**: `directory-agents-injector/`, `directory-readme-injector/`, `rules-injector/`, `context-injector/`

#### Architecture

```
ContextInjector (main system)
├── DirectoryAgentsInjector (injects AGENTS.md)
├── DirectoryReadmeInjector (injects README.md)
├── RulesInjector (injects .sisyphus/rules/)
├── CompactionContextInjector (injects on compaction)
└── HookMessageInjector (injects via hooks)
```

#### Key Features

| Feature | Implementation | Transplant Effort |
|---------|----------------|-------------------|
| **AGENTS.md Injection** | Auto-finds and injects AGENTS.md from directory | **MEDIUM** — File discovery |
| **README.md Injection** | Auto-finds and injects README.md | **MEDIUM** — File discovery |
| **Rules Injection** | Injects .sisyphus/rules/ files | **MEDIUM** — Rule matching |
| **Hierarchical Context** | Finds context at multiple directory levels | **MEDIUM** — Directory traversal |
| **Token Budgeting** | Limits injected context to token budget | **MEDIUM** — Token counting |
| **Compaction Awareness** | Re-injects context after compaction | **MEDIUM** — Compaction hooks |

#### Entry Points

```typescript
class DirectoryAgentsInjector {
  async findAgentsFile(directory: string): Promise<string | undefined>
  async injectAgents(prompt: string, directory: string): Promise<string>
}
```

#### What Autopilot Lacks

- ❌ No automatic AGENTS.md injection
- ❌ No hierarchical context discovery
- ❌ No rules injection system
- ❌ No compaction-aware re-injection

---

### 8. SESSION RECOVERY SYSTEM

**Location**: `/src/hooks/session-recovery/`  
**Core Files**: `hook.ts`, `resume.ts`, `recover-*.ts` (multiple recovery strategies)

#### Architecture

```
SessionRecoveryHook (main hook)
├── ErrorTypeDetector (categorizes errors)
├── RecoveryStrategies:
│   ├── EmptyContentRecovery (handles empty messages)
│   ├── ThinkingBlockRecovery (fixes thinking block order)
│   ├── ToolResultRecovery (recovers missing tool results)
│   ├── UnavailableToolRecovery (handles unavailable tools)
│   └── ContextWindowRecovery (handles context limit errors)
└── MessageStorage (persists recovery state)
```

#### Key Features

| Feature | Implementation | Transplant Effort |
|---------|----------------|-------------------|
| **Error Detection** | Categorizes errors (empty, thinking, tool, context) | **MEDIUM** — Error analysis |
| **Empty Content Recovery** | Recovers from empty message responses | **MEDIUM** — Message reconstruction |
| **Thinking Block Recovery** | Fixes thinking block ordering issues | **LOW** — String manipulation |
| **Tool Result Recovery** | Recovers missing tool results | **MEDIUM** — Tool result tracking |
| **Context Window Recovery** | Handles context limit errors | **MEDIUM** — Truncation logic |
| **State Persistence** | Saves recovery state to disk | **LOW** — File I/O |

#### Entry Points

```typescript
class SessionRecoveryHook {
  async onSessionError(error: SessionError): Promise<RecoveryAction>
  async resume(sessionId: string, recoveryAction: RecoveryAction): Promise<void>
}
```

#### What Autopilot Lacks

- ❌ No session recovery system
- ❌ No error categorization
- ❌ No recovery strategies
- ❌ No context window recovery

---

### 9. DISCIPLINE AGENTS

**Location**: `/src/agents/`  
**Key Agents**: `sisyphus/`, `hephaestus/`, `prometheus/`, `oracle.ts`, `librarian.ts`, `explore.ts`

#### Agent Catalog

| Agent | Purpose | Model | Transplant |
|-------|---------|-------|-----------|
| **Sisyphus** | Main orchestrator, delegates to specialists | Claude Opus / Kimi K2.5 / GLM-5 | **HIGH** — Complex prompt |
| **Hephaestus** | Autonomous deep worker, explores codebase | GPT-5.4 | **HIGH** — Complex prompt |
| **Prometheus** | Strategic planner, interview mode | Claude Opus / Kimi K2.5 / GLM-5 | **HIGH** — Complex prompt |
| **Oracle** | Architecture/debugging specialist | Claude Opus | **MEDIUM** — Specialized prompt |
| **Librarian** | Documentation/code search specialist | Claude Opus | **MEDIUM** — Specialized prompt |
| **Explore** | Fast codebase grep specialist | GPT-4o | **LOW** — Simple grep wrapper |
| **Metis** | Plan consultant, validates plans | Claude Opus | **MEDIUM** — Specialized prompt |
| **Momus** | Critic, identifies issues | Claude Opus | **MEDIUM** — Specialized prompt |

#### Key Features

| Feature | Implementation | Transplant Effort |
|---------|----------------|-------------------|
| **Dynamic Prompts** | `dynamic-agent-prompt-builder.ts` builds prompts dynamically | **HIGH** — Complex logic |
| **Tool Categorization** | `dynamic-agent-tool-categorization.ts` categorizes tools | **MEDIUM** — Tool analysis |
| **Model-Specific Prompts** | Different prompts for GPT/Claude/Gemini | **HIGH** — Multiple variants |
| **Skill Injection** | Injects available skills into prompt | **MEDIUM** — Skill loading |
| **Category Guidance** | Guides agent on category selection | **MEDIUM** — Category docs |
| **Tool Restrictions** | Enforces tool restrictions per agent | **MEDIUM** — Permission system |

#### What Autopilot Lacks

- ❌ No Sisyphus orchestrator
- ❌ No Hephaestus deep worker
- ❌ No Prometheus planner
- ❌ No specialized agents (Oracle, Librarian, Explore)
- ❌ No dynamic prompt building

---

### 10. COMPREHENSIVE HOOK SYSTEM

**Location**: `/src/hooks/` (50+ hooks)  
**Key Hooks**: `ralph-loop/`, `atlas/`, `auto-slash-command/`, `background-notification/`, `comment-checker/`, `compaction-context-injector/`, `delegate-task-retry/`, `edit-error-recovery/`, `keyword-detector/`, `model-fallback/`, `runtime-fallback/`, `session-recovery/`, `todo-continuation-enforcer/`

#### Hook Categories

| Category | Count | Purpose |
|----------|-------|---------|
| **Autonomy** | 3 | Ralph Loop, Todo Enforcer, Keyword Detector |
| **Recovery** | 5 | Session Recovery, Edit Error, JSON Error, Model Fallback, Runtime Fallback |
| **Context** | 4 | Compaction Context, Directory Agents, Directory README, Rules Injector |
| **Notifications** | 3 | Background Notification, Session Notification, Task Toast |
| **Quality** | 3 | Comment Checker, Think Mode, Thinking Block Validator |
| **Integration** | 5 | Claude Code Hooks, Auto Slash Command, Auto Update Checker, Legacy Plugin Toast, Non-Interactive Env |
| **Optimization** | 4 | Preemptive Compaction, Context Window Monitor, Tool Output Truncator, Tool Pair Validator |
| **Specialized** | 10+ | Anthropic Context Window Recovery, Atlas, Hashline Enhancers, Interactive Bash, Keyword Detector, etc. |

#### What Autopilot Lacks

- ❌ No Ralph Loop hook
- ❌ No Todo Enforcer hook
- ❌ No Session Recovery hook
- ❌ No Compaction Context hook
- ❌ No Comment Checker hook
- ❌ No 40+ other specialized hooks

---

## TOOLS COMPARISON

### OMO Tools (17 tools)

| Tool | Purpose | Complexity |
|------|---------|-----------|
| `delegate-task` | Spawn background/sync tasks with category routing | **HIGH** |
| `background-task` | Manage background tasks (list, cancel, get status) | **MEDIUM** |
| `task` | Create/manage tasks (legacy) | **MEDIUM** |
| `call-omo-agent` | Call specific agent directly | **MEDIUM** |
| `hashline-edit` | Edit with hash-anchored lines | **MEDIUM** |
| `hashline-read` | Read with hash-anchored lines | **LOW** |
| `lsp` | LSP operations (rename, goto, references, diagnostics) | **HIGH** |
| `ast-grep` | AST-aware code search/replace | **HIGH** |
| `glob` | File pattern matching | **LOW** |
| `grep` | Content search with regex | **LOW** |
| `interactive-bash` | Interactive bash session | **MEDIUM** |
| `look-at` | Quick media file analysis | **LOW** |
| `skill` | Load/invoke skills | **MEDIUM** |
| `skill-mcp` | Invoke skill-embedded MCPs | **MEDIUM** |
| `session-manager` | List/read/search sessions | **MEDIUM** |
| `slashcommand` | Execute slash commands | **MEDIUM** |
| `shared` | Shared utilities | **LOW** |

### Autopilot Tools (0 tools)

Autopilot has **NO custom tools** — it relies entirely on OpenCode built-ins.

---

## CONFIGURATION SYSTEM

**Location**: `/src/config/schema/`  
**Core Files**: `schema.ts`, `oh-my-opencode-config.ts`, `background-task.ts`, `categories.ts`, `ralph-loop.ts`

### Config Structure

```typescript
interface OhMyOpenCodeConfig {
  // Agent overrides
  agents?: Record<string, AgentOverride>
  
  // Background task settings
  background_task?: BackgroundTaskConfig
  
  // Category definitions
  categories?: Record<string, CategoryConfig>
  
  // Ralph Loop settings
  ralph_loop?: RalphLoopConfig
  
  // Tmux settings
  tmux?: TmuxConfig
  
  // Hook configuration
  disabled_hooks?: string[]
  
  // MCP configuration
  mcp?: MCPConfig
  
  // Skills configuration
  skills?: SkillsConfig
  
  // Experimental features
  experimental?: ExperimentalConfig
}
```

### What Autopilot Lacks

- ❌ No background task configuration
- ❌ No category configuration
- ❌ No Ralph Loop configuration
- ❌ No Tmux configuration
- ❌ No skill configuration
- ❌ No MCP configuration

---

## SKILLS PROVIDED BY OMO

**Location**: `/src/features/builtin-skills/skills/`

| Skill | Purpose | MCP | Transplant |
|-------|---------|-----|-----------|
| `playwright` | Browser automation | Yes | **MEDIUM** |
| `playwright-cli` | Browser automation (CLI) | No | **MEDIUM** |
| `git-master` | Atomic commits, rebase, history search | No | **MEDIUM** |
| `dev-browser` | Browser automation with persistent state | Yes | **MEDIUM** |
| `frontend-ui-ux` | Design-first UI/UX | No | **MEDIUM** |
| `ai-slop-remover` | Remove AI-generated code smells | No | **LOW** |
| `review-work` | Post-implementation review | No | **MEDIUM** |

### What Autopilot Lacks

- ❌ No builtin skills
- ❌ No skill system at all

---

## COMMANDS PROVIDED BY OMO

**Location**: `/src/features/builtin-commands/templates/`

| Command | Purpose | Transplant |
|---------|---------|-----------|
| `/ralph-loop` | Start self-referential loop | **MEDIUM** |
| `/ulw-loop` | Ultrawork loop (continuous) | **MEDIUM** |
| `/start-work` | Interview-mode planning | **MEDIUM** |
| `/init-deep` | Generate hierarchical AGENTS.md | **MEDIUM** |
| `/refactor` | Intelligent refactoring | **MEDIUM** |
| `/remove-ai-slops` | Remove AI code smells | **LOW** |
| `/handoff` | Create context handoff | **LOW** |
| `/stop-continuation` | Stop all continuation mechanisms | **LOW** |

### What Autopilot Lacks

- ❌ No builtin commands
- ❌ No command system at all

---

## ARCHITECTURE PATTERNS

### 1. Modular Code Enforcement

OMO enforces strict modularity:
- **Single Responsibility**: Each file has ONE clear purpose
- **200 LOC Limit**: Files > 200 LOC are code smells
- **No Catch-All Files**: No `utils.ts`, `service.ts`, `helpers.ts`
- **Explicit Dependencies**: No hidden imports

**Rule File**: `.sisyphus/rules/modular-code-enforcement.md`

### 2. Type Safety

- **Zod Validation**: All configs validated with Zod
- **Strict TypeScript**: `noImplicitAny`, `strictNullChecks`
- **Type Exports**: Types exported separately from implementations

### 3. Error Handling

- **Error Categorization**: Errors classified by type (empty, thinking, tool, context)
- **Recovery Strategies**: Multiple recovery paths per error type
- **Graceful Degradation**: Best-effort injection, never crashes

### 4. Testing

- **Unit Tests**: Every module has tests
- **Integration Tests**: End-to-end tests for features
- **Test Naming**: `*.test.ts` files co-located with source

### 5. Documentation

- **AGENTS.md**: Agent definitions with system prompts
- **SKILL.md**: Skill definitions with MCP config
- **README.md**: Feature documentation
- **Inline Comments**: Sparse but meaningful

---

## WHAT AUTOPILOT NEEDS TO ADOPT OMO FEATURES

### Phase 1: Foundation (Weeks 1-2)

1. **Background Agent Manager**
   - Copy `src/features/background-agent/` structure
   - Implement `BackgroundManager` class
   - Add task persistence (SQLite)
   - Add concurrency control

2. **Category-Based Routing**
   - Copy `src/tools/delegate-task/categories.ts`
   - Implement category → model mapping
   - Add `delegate-task` tool

3. **Configuration System**
   - Copy `src/config/schema/` structure
   - Add Zod validation
   - Support JSONC parsing

### Phase 2: Autonomy (Weeks 3-4)

4. **Ralph Loop**
   - Copy `src/hooks/ralph-loop/` structure
   - Implement loop state controller
   - Add completion detection
   - Add verification handling

5. **Discipline Agents**
   - Copy `src/agents/sisyphus/` structure
   - Implement dynamic prompt building
   - Add agent-specific prompts

### Phase 3: Integration (Weeks 5-6)

6. **Skill-Embedded MCPs**
   - Copy `src/features/opencode-skill-loader/` structure
   - Implement skill discovery
   - Add MCP lifecycle management

7. **Context Injection**
   - Copy `src/hooks/directory-agents-injector/` structure
   - Implement AGENTS.md discovery
   - Add hierarchical context

### Phase 4: Polish (Weeks 7-8)

8. **Session Recovery**
   - Copy `src/hooks/session-recovery/` structure
   - Implement error categorization
   - Add recovery strategies

9. **Hash-Anchored Edits**
   - Copy `src/tools/hashline-edit/` structure
   - Implement line hashing
   - Add edit validation

10. **Tmux Integration** (Optional)
    - Copy `src/features/tmux-subagent/` structure
    - Implement session spawning
    - Add pane management

---

## TRANSPLANTABILITY ASSESSMENT

### Easy to Transplant (LOW effort)

- ✅ Configuration system (Zod schemas)
- ✅ Category definitions
- ✅ Error categorization
- ✅ Polling loops
- ✅ File I/O utilities
- ✅ String formatting utilities

### Medium Effort

- ⚠️ Background agent manager (need concurrency control)
- ⚠️ Ralph Loop (need loop state management)
- ⚠️ Skill-embedded MCPs (need MCP lifecycle)
- ⚠️ Context injection (need file discovery)
- ⚠️ Session recovery (need error handling)
- ⚠️ Discipline agents (need prompt building)

### Hard to Transplant (HIGH effort)

- ❌ Tmux integration (requires tmux knowledge)
- ❌ Hash-anchored edits (requires edit tool integration)
- ❌ Dynamic prompt building (requires agent knowledge)
- ❌ Model selection logic (requires model knowledge)

---

## CODEBASE STATISTICS

| Metric | Value |
|--------|-------|
| Total Source Files | 1,118 |
| Features | 20 |
| Hooks | 50+ |
| Tools | 17 |
| Agents | 8 |
| Skills | 7 |
| Commands | 8 |
| Test Files | 400+ |
| Lines of Code | ~150,000 |
| Package Size | ~3.5MB (dist) |

---

## KEY INSIGHTS FOR AUTOPILOT

1. **OMO is NOT a plugin — it's a complete harness replacement**
   - Autopilot is a plugin for OpenCode
   - OMO is a plugin that reimplements OpenCode's core features

2. **Modularity is enforced, not suggested**
   - `.sisyphus/rules/modular-code-enforcement.md` is a blocking rule
   - Every file must have ONE responsibility
   - 200 LOC hard limit

3. **Configuration-driven, not code-driven**
   - Categories are config, not code
   - Agents are config, not code
   - Skills are config, not code

4. **Error recovery is first-class**
   - 5+ recovery strategies for different error types
   - Session recovery hook handles most failures
   - Graceful degradation everywhere

5. **Parallel execution is built-in**
   - Background agent manager handles 5+ parallel tasks
   - Concurrency control per provider/model
   - Task persistence across restarts

6. **Context is injected, not hardcoded**
   - AGENTS.md auto-discovered and injected
   - README.md auto-discovered and injected
   - Rules auto-discovered and injected

7. **Autonomy is the goal**
   - Ralph Loop keeps agent working until done
   - Todo Enforcer yanks agent back if idle
   - Keyword Detector triggers autonomy modes

---

## RECOMMENDATIONS FOR AUTOPILOT

### Short-term (Adopt OMO patterns)

1. **Adopt modular code enforcement**
   - Create `.sisyphus/rules/modular-code-enforcement.md`
   - Enforce 200 LOC limit
   - Ban catch-all files

2. **Adopt configuration system**
   - Copy Zod schema structure
   - Support JSONC parsing
   - Add config validation

3. **Adopt error categorization**
   - Copy error classifier from session-recovery
   - Add recovery strategies
   - Implement graceful degradation

### Medium-term (Adopt key features)

4. **Adopt background agent manager**
   - Implement parallel task execution
   - Add task persistence
   - Add concurrency control

5. **Adopt Ralph Loop**
   - Implement loop state management
   - Add completion detection
   - Add verification handling

6. **Adopt category-based routing**
   - Implement category → model mapping
   - Add `delegate-task` tool
   - Add skill injection

### Long-term (Full OMO integration)

7. **Adopt discipline agents**
   - Implement Sisyphus orchestrator
   - Implement Hephaestus deep worker
   - Implement Prometheus planner

8. **Adopt skill-embedded MCPs**
   - Implement skill discovery
   - Implement MCP lifecycle
   - Implement scope filtering

9. **Adopt context injection**
   - Implement AGENTS.md discovery
   - Implement hierarchical context
   - Implement compaction awareness

---

## CONCLUSION

OMO is a **production-grade agent harness** with features that autopilot lacks entirely. The most impactful features to adopt are:

1. **Background Agent Manager** — enables parallel execution
2. **Ralph Loop** — enables autonomy
3. **Category-Based Routing** — enables intelligent delegation
4. **Configuration System** — enables flexibility
5. **Error Recovery** — enables reliability

These five features alone would transform autopilot from a basic plugin into a competitive harness.

