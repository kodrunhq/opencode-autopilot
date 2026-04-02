# oh-my-openagent (OMO) Deep Dive

## Metadata
- **GitHub URL:** https://github.com/code-yeongyu/oh-my-openagent
- **Stars:** ~46,800
- **Last commit date:** 2026-04-02 (actively maintained)
- **Installation:** npm package, registered as OpenCode plugin in `opencode.json`
- **Compatible runtimes:** OpenCode (primary), Claude Code (via compatibility layers)
- **Language:** TypeScript (Bun runtime)
- **Relevance to us:** MEDIUM

## Architecture Overview

OMO (formerly oh-my-opencode) is a **full-featured OpenCode plugin** with the broadest automation surface in the ecosystem. It registers 11 agents via config hook, provides 26+ tools, 70+ hooks, skills, commands, and MCP integrations. The architecture is organized around a Greek mythology-themed agent system with sophisticated task routing.

**Key architectural layers:**
1. **Plugin entry** (`src/index.ts`) -- Registers tools, hooks, and agent configurations
2. **Agent system** (`src/agents/`) -- 11 named agents with dynamic prompt building, category-based model routing
3. **Tool system** (`src/tools/`) -- 17+ tool directories covering AST-grep, LSP, background tasks, hashline edits, interactive bash, session management
4. **Hook system** (`src/hooks/`) -- 70+ hooks covering session lifecycle, error recovery, context management, UI automation, workflow enforcement
5. **Feature modules** (`src/features/`) -- Background agents, boulder state, built-in commands/skills, context injection, task management, tmux integration
6. **Plugin config** (`src/plugin-config.ts`, `src/plugin-state.ts`) -- Runtime configuration and state management
7. **MCP integration** (`src/mcp/`) -- OAuth, skill MCP manager
8. **CLI** (`src/cli/`, `bin/`) -- Companion CLI tools
9. **OpenCode assets** (`.opencode/`) -- Commands, skills, background tasks

**Dependency model:** Plugin entry -> agent system + tool system + hook system -> feature modules -> shared utilities. The agent system uses a dynamic prompt builder (`dynamic-agent-prompt-builder.ts`) that assembles agent prompts based on task context, category, and model capabilities.

## Feature Inventory

### Skills
| Name | Category | Description | Token Impact |
|------|----------|-------------|-------------|
| `github-triage` | Workflow | GitHub issue and PR triage methodology | ~500-800 tokens |
| `pre-publish-review` | Quality | Pre-publish review checklist for packages | ~400-600 tokens |
| `work-with-pr` | Git | PR-based development workflow | ~500-800 tokens |
| `work-with-pr-workspace` | Git | PR workspace management with isolated environments | ~500-800 tokens |

### Commands
| Name | What It Does | Arguments |
|------|-------------|-----------|
| `/get-unpublished-changes` | Lists changes since last publish | -- |
| `/omomomo` | OMO meta-command (system status and help) | -- |
| `/publish` | Publish package with pre-publish review | -- |
| `/remove-deadcode` | Identifies and removes dead code from codebase | -- |
| `/doctor` | Diagnostics command: verifies plugin health, config, agent registration, model availability | -- |

### Hooks
| Event Type | What It Automates | Implementation |
|-----------|-------------------|---------------|
| `agent-usage-reminder` | Reminds user which agent to use for current task type | TypeScript hook |
| `anthropic-context-window-limit-recovery` | Recovers from context window limit errors with Anthropic models | TypeScript hook |
| `anthropic-effort` | Adjusts Anthropic effort/thinking settings | TypeScript hook |
| `atlas` | Atlas todo orchestrator integration hooks | TypeScript hook |
| `auto-slash-command` | Auto-detects and suggests slash commands based on user intent | TypeScript hook |
| `auto-update-checker` | Checks for OMO updates on session start | TypeScript hook |
| `background-notification` | Notifies user of background agent completion | TypeScript hook |
| `bash-file-read-guard` | Prevents excessive file reads via bash | TypeScript hook |
| `category-skill-reminder` | Reminds about available skills per task category | TypeScript hook |
| `comment-checker` | Prevents "AI slop" in code comments (overly verbose, obvious, or sycophantic comments) | TypeScript hook |
| `compaction-context-injector` | Injects critical context before compaction | TypeScript hook |
| `compaction-todo-preserver` | Preserves todo state across compaction events | TypeScript hook |
| `context-window-monitor` | Monitors context utilization and warns at thresholds | TypeScript hook |
| `delegate-task-retry` | Retries failed delegated tasks with error recovery | TypeScript hook |
| `directory-agents-injector` | Injects agents from directory configurations | TypeScript hook |
| `directory-readme-injector` | Injects README context from directories | TypeScript hook |
| `edit-error-recovery` | Recovers from file edit errors (stale content, wrong line) | TypeScript hook |
| `empty-task-response-detector` | Detects and recovers from empty task responses | TypeScript hook |
| `hashline-edit-diff-enhancer` | Enhances diffs with hashline context for clearer reviews | TypeScript hook |
| `hashline-read-enhancer` | Adds hash-based line IDs to file reads for precise editing | TypeScript hook |
| `interactive-bash-session` | Manages interactive bash sessions with tmux | TypeScript hook |
| `json-error-recovery` | Recovers from JSON parsing errors in tool responses | TypeScript hook |
| `keyword-detector` | Detects keywords triggering specific workflows | TypeScript hook |
| `legacy-plugin-toast` | Shows migration toasts for legacy plugin users | TypeScript hook |
| `model-fallback` | Falls back to alternative models on failure | TypeScript hook |
| `no-hephaestus-non-gpt` | Prevents Hephaestus agent from using non-GPT models | TypeScript hook |
| `no-sisyphus-gpt` | Prevents Sisyphus from using GPT models (forces Claude) | TypeScript hook |
| `non-interactive-env` | Adapts behavior for non-interactive environments | TypeScript hook |
| `preemptive-compaction` | Triggers compaction before context window overflow | TypeScript hook |
| `preemptive-compaction-degradation-monitor` | Monitors performance degradation after compaction | TypeScript hook |
| `preemptive-compaction-no-text-tail` | Prevents text-tail artifacts during compaction | TypeScript hook |
| `prometheus-md-only` | Restricts Prometheus agent to markdown-only output | TypeScript hook |
| `question-label-truncator` | Truncates overly verbose question labels | TypeScript hook |
| `ralph-loop` | Ralph error-recovery loop automation | TypeScript hook |
| `read-image-resizer` | Resizes images before reading to reduce token cost | TypeScript hook |
| `rules-injector` | Injects context rules into agent prompts | TypeScript hook |
| `runtime-fallback` | Runtime-level fallback for system errors | TypeScript hook |
| `session-notification` | Session lifecycle notifications (start, end, errors) | TypeScript hook |
| `session-recovery` | Recovers from various session failure modes (missing tool results, thinking block violations, empty history, context limit) | TypeScript hook |
| `session-todo-status` | Tracks and displays todo completion status | TypeScript hook |
| `sisyphus-junior-notepad` | Notepad for Sisyphus Junior agent task tracking | TypeScript hook |
| `start-work` | Initializes work context on session start | TypeScript hook |
| `stop-continuation-guard` | Prevents premature session stopping | TypeScript hook |
| `task-reminder` | Reminds about pending tasks | TypeScript hook |
| `task-resume-info` | Provides context for resuming interrupted tasks | TypeScript hook |
| `tasks-todowrite-disabler` | Disables TodoWrite tool when not needed | TypeScript hook |
| `think-mode` | Controls thinking/reasoning mode | TypeScript hook |
| `thinking-block-validator` | Validates thinking blocks for correctness | TypeScript hook |
| `todo-continuation-enforcer` | Enforces todo completion before allowing new work | TypeScript hook |
| `todo-description-override` | Overrides todo descriptions with better formatting | TypeScript hook |
| `tool-output-truncator` | Truncates overly large tool outputs to prevent context overflow | TypeScript hook |
| `tool-pair-validator` | Validates tool usage patterns (e.g., read before edit) | TypeScript hook |
| `unstable-agent-babysitter` | Monitors and recovers from unstable agent behavior | TypeScript hook |
| `webfetch-redirect-guard` | Guards against redirect loops in web fetch operations | TypeScript hook |
| `write-existing-file-guard` | Prevents accidental overwrite of existing files | TypeScript hook |

### Agents
| Name | Role | Mode | Model Assignment |
|------|------|------|-----------------|
| Sisyphus | Primary orchestrator -- routes tasks, manages workflow | Primary | Claude (category: ultrabrain) |
| Hephaestus | Deep worker for complex implementation tasks | Subagent | GPT (category: deep) |
| Prometheus | Strategic planner and architect | Subagent | Category-specific |
| Oracle | Architecture analysis and debugging | Subagent | Category-specific |
| Librarian | Documentation lookup and generation | Subagent | Category: writing |
| Explore | Code search and navigation | Subagent | Category: quick |
| Multimodal-Looker | Image/vision analysis | Subagent | Category: visual-engineering |
| Metis | Pre-planning intent analysis (IntentGate) | Subagent | Category: quick |
| Momus | Plan reviewer and critic | Subagent | Category-specific |
| Atlas | Todo-based task orchestrator | Subagent | Category-specific |
| Sisyphus-Junior | Lightweight task executor for delegated work | Subagent | Category: quick |

### Tools
| Name | Purpose | Schema |
|------|---------|--------|
| `ast-grep` | Pattern-aware code search across 25 languages using AST analysis | Language, pattern, path |
| `background-task` | Spawn and manage background agent tasks | Task description, agent |
| `call-omo-agent` | Explicitly call a specific OMO agent by name | Agent name, task |
| `delegate-task` | Delegate task to optimal agent based on category | Task description |
| `glob` | File pattern matching | Pattern, path |
| `grep` | Content search with regex | Pattern, path, options |
| `hashline-edit` | Hash-anchored line editing (LINE#ID validation prevents stale-line errors) | File, line ID, content |
| `interactive-bash` | Interactive bash session management via tmux | Command, session |
| `look-at` | Image/screenshot analysis | Image path |
| `lsp/diagnostics` | LSP diagnostics (errors, warnings) for a file | File path |
| `lsp/find-references` | LSP find all references to a symbol | File, position |
| `lsp/goto-definition` | LSP go to definition of a symbol | File, position |
| `lsp/rename` | LSP rename symbol across codebase | File, position, new name |
| `session-manager` | Manage sessions (create, list, switch) | Action, session ID |
| `skill` | Invoke an OMO skill by name | Skill name |
| `skill-mcp` | Invoke MCP-backed skills | Skill name, args |
| `slashcommand` | Execute a slash command programmatically | Command name, args |
| `task` | Task management (create, complete, list) | Action, task details |

### Memory / State
| Mechanism | Storage | Retrieval Pattern | Token Cost |
|-----------|---------|-------------------|------------|
| Boulder state | Filesystem (JSON) | Loaded on session start, persists across sessions | ~200-500 tokens |
| Session state | In-memory + filesystem | Session lifecycle hooks | ~100-300 tokens |
| Task/todo state | Filesystem | Todo hooks load and persist | ~200-500 tokens |
| Agent delegation history | In-memory | Used for retry and recovery | ~100-300 tokens |
| Context injection state | In-memory | Compaction hooks preserve critical state | ~200-500 tokens |

## Architecture Patterns

1. **Category-based model routing:** Tasks are classified into categories (ultrabrain, deep, artistry, quick, writing, visual-engineering) and routed to optimal models per category. This is sophisticated but conflicts with model-agnostic design.
2. **IntentGate pattern:** Before task classification, the Metis agent analyzes true user intent. This prevents misrouting when user phrasing is ambiguous.
3. **Dynamic prompt building:** Agent prompts are assembled dynamically based on task context, model capabilities, and available tools. Not static markdown files.
4. **Hash-anchored editing:** LINE#ID content validation on file edits prevents stale-line errors. This is a unique precision improvement over standard line-number-based editing.
5. **Session recovery suite:** Multiple recovery hooks handle specific failure modes: missing tool results, thinking block violations, empty history, context limit overflow, JSON errors, edit errors.
6. **Preemptive compaction:** Context window monitoring with preemptive compaction before overflow, including state preservation and degradation monitoring after compaction.
7. **Background agent execution:** Tasks can be delegated to background agents with configurable concurrency, completion notifications, and error recovery.
8. **Hook-driven automation:** With 70+ hooks, nearly every aspect of the development workflow is automated -- from context injection to error recovery to UI enhancement.

## Strengths

- **Error recovery is the most comprehensive in the ecosystem.** Session recovery hooks handle 10+ distinct failure modes (missing tool results, thinking blocks, empty history, context limits, JSON errors, edit errors, redirect loops, unstable agents). No competitor matches this breadth of error handling.
- **Doctor command** provides instant diagnostics for plugin health, agent registration, model availability, and configuration correctness. This is a high-value UX feature that most competitors lack.
- **Comment checker** prevents AI-generated comment bloat ("AI slop"). This addresses a real pain point that users notice immediately.
- **Hash-anchored editing** (LINE#ID validation) prevents stale-line errors that plague standard line-number editing. This is a genuine precision improvement.
- **IntentGate** (Metis agent analyzing user intent before task routing) is a sophisticated UX pattern that reduces misrouting.
- **Preemptive compaction** with state preservation and degradation monitoring is more sophisticated than any competitor's compaction handling.
- **Background agent execution** with configurable concurrency enables genuine parallelism within a session.
- **Context window monitoring** with configurable thresholds provides real-time awareness of context utilization.

## Weaknesses / Concerns

- **Prompt injection concerns:** OMO has documented prompt injection vulnerabilities. The dynamic prompt builder and rules injector accept external input that could be manipulated. This is a cautionary pattern -- any feature that assembles prompts from external sources must be carefully sanitized.
- **Model-specific routing conflicts with model-agnostic design.** Category-to-model mapping (Hephaestus requires GPT, Sisyphus requires Claude) violates model-agnostic principles. Users with limited provider access cannot use all agents.
- **Hook sprawl:** 70+ hooks create significant runtime overhead. Each session event triggers a cascade of hook evaluations. The cumulative token and latency cost is substantial.
- **Agent naming obscures function.** Greek mythology names (Sisyphus, Hephaestus, Prometheus, Oracle, Metis, Momus, Atlas) require memorization. Users cannot intuit agent capabilities from names.
- **LSP/AST tools require deep system integration.** LSP requires a running language server; AST-grep requires external tooling. These add heavy dependencies.
- **Tmux dependency** for interactive bash sessions and background agents assumes tmux is installed and accessible, which is not universal.
- **Complexity overhead:** The combination of 11 agents, 18+ tools, and 70+ hooks creates a learning curve that may overwhelm users seeking simple assistance.
- **Security risk from rules-injector and directory-agents-injector:** These hooks load configuration from the filesystem, which could be manipulated in untrusted repositories.

## Relevance to Our Plugin

### Features We Should Adopt (with rationale)
- **Doctor/diagnostics command (Phase 12 quick win):** A `/doctor` command that verifies plugin registration, agent injection, config validity, and tool availability. High UX value, low implementation cost.
- **Comment checker hook (Phase 17):** A `tool.execute.after` hook that checks edited files for AI-generated comment bloat. Addresses a real user pain point.
- **Context window monitoring (Phase 13):** Monitor context utilization via session events and warn when approaching limits. We have fallback handling but no proactive context monitoring.
- **Session recovery patterns (selective adoption):** OMO's error recovery for JSON errors, edit failures, and context overflow are worth studying. We should adopt the PATTERNS, not the implementation (our hook surface is different).
- **Preemptive compaction awareness (Phase 17):** Using `experimental.session.compacting` to preserve critical state before compaction.

### Features We Should Skip (with rationale)
- **Category-based model routing:** Conflicts with our model-agnostic constraint. Our fallback system handles model failures; we should not route by category.
- **IntentGate (Metis agent):** Adds latency and complexity. Our orchestrator already analyzes user intent in its initial phase.
- **LSP/AST tools:** Deep system integration outside our plugin scope. OpenCode may add native LSP support; we should not duplicate.
- **Tmux integration:** Infrastructure dependency, not appropriate for a plugin.
- **70+ hooks:** Hook sprawl creates maintenance burden. We should add hooks selectively with clear value per hook.
- **Hash-anchored editing:** Interesting but requires modifying the file reading/editing pipeline, which is OpenCode's responsibility, not ours.
- **Background agent execution:** Useful but complex. Our orchestrator dispatch handles parallelism differently.
- **Greek mythology agent naming:** Our agent naming (oc-researcher, oc-planner, oc-implementer) is more intuitive.

### Opportunities to Do Better
- **Simpler diagnostics:** OMO's doctor command is good but buried. Our diagnostics should be proactive -- surface issues via hooks (e.g., `session.created` hook checks config validity, warns if agents are missing).
- **Targeted error recovery:** Instead of 70+ hooks, we can achieve similar recovery with 5-10 well-designed hooks that cover the most common failure modes. Quality over quantity.
- **Model-agnostic everything:** Where OMO restricts agents to specific models, our agents work with any model. This is a strict improvement for users with varied provider access.
- **Security-first hook design:** Where OMO has prompt injection risks from rules-injector and directory-agents-injector, our hooks should validate and sanitize all external input. This is a differentiation opportunity.
