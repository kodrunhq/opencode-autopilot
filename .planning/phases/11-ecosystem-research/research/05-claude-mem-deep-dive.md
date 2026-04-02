# claude-mem Deep Dive

## Metadata
- **GitHub URL:** https://github.com/thedotmack/claude-mem
- **Stars:** ~44,500
- **Last commit date:** 2026-04-02 (actively maintained)
- **Installation:** Claude Code plugin (npm install, `.claude-plugin/` manifest), companion MCP server
- **Compatible runtimes:** Claude Code (primary)
- **Language:** TypeScript
- **Version:** v10.6.3 (mature, actively versioned)
- **Relevance to us:** CRITICAL

## Architecture Overview

claude-mem is a **dedicated memory system** for AI coding sessions. It captures session activity via lifecycle hooks, compresses observations with AI summarization, stores in SQLite + Chroma vector DB, and injects relevant context back into future sessions via a 3-layer progressive disclosure system. The architecture is purpose-built for a single concern: making the agent remember what it did before.

**Key architectural layers:**

1. **Plugin layer** (`plugin/`) -- Claude Code plugin hooks, skills, modes, UI components
   - Hooks (`plugin/hooks/`) -- Lifecycle hook registration (JSON-based)
   - Skills (`plugin/skills/`) -- 5 skill directories (do, make-plan, mem-search, smart-explore, timeline-report)
   - Modes (`plugin/modes/`) -- 32 localized mode configurations + specialized modes (law-study, email-investigation)
   - UI (`plugin/ui/`) -- TUI components for memory display
2. **SDK layer** (`src/sdk/`) -- Parser, prompts, API surface
3. **Services layer** (`src/services/`) -- Core business logic
   - SQLite service (`src/services/sqlite/`) -- Database, migrations, observations, sessions, summaries, timeline, transactions
   - Context service (`src/services/context/`) -- ContextBuilder, ContextConfigLoader, ObservationCompiler, TokenCalculator, section formatters
   - Domain service (`src/services/domain/`) -- ModeManager, domain types
   - Infrastructure (`src/services/infrastructure/`) -- External service integrations
   - Integrations (`src/services/integrations/`) -- Third-party connections
   - Queue (`src/services/queue/`) -- Background processing queue
   - Smart file read (`src/services/smart-file-read/`) -- AST-powered file reading
   - Sync service (`src/services/sync/`) -- Cross-device synchronization
   - Transcripts (`src/services/transcripts/`) -- Session transcript processing
   - Worker service (`src/services/worker-service.ts`) -- Background worker management
4. **Hooks layer** (`src/hooks/`) -- Hook response handling
5. **Supervisor** (`src/supervisor/`) -- Process supervision for background workers
6. **CLI** (`src/cli/`) -- Command-line interface for management
7. **Server** (`src/services/server/`) -- MCP server for memory tools
8. **Types** (`src/types/`) -- Shared type definitions
9. **Utils** (`src/utils/`) -- Shared utilities

**Dependency model:** Plugin layer -> SDK layer -> Services layer -> SQLite + Chroma. The plugin hooks capture data, the SDK parses and prompts, the services layer handles storage/retrieval/context building.

## Feature Inventory

### Skills
| Name | Category | Description | Token Impact |
|------|----------|-------------|-------------|
| `mem-search` | Memory | Search through stored memories by keyword, semantic similarity, or project context | ~50-100 tokens (query) + ~200-500 tokens (results) |
| `smart-explore` | Navigation | AST-powered code navigation with 6-12x lower token cost than full file reads. Reads function signatures and structure, not full bodies. | ~100-300 tokens per exploration |
| `timeline-report` | Analysis | Generates narrative project journey documents from session timeline data | ~500-1500 tokens (full report) |
| `make-plan` | Workflow | Planning methodology with memory context integration | ~300-500 tokens |
| `do` | Workflow | Task execution with memory-informed context | ~200-400 tokens |

### Commands
| Name | What It Does | Arguments |
|------|-------------|-----------|
| `/timeline-report` | Generate a narrative report of project history from stored timeline data | Date range, project filter |

### Hooks
| Event Type | What It Automates | Implementation |
|-----------|-------------------|---------------|
| SessionStart | Loads relevant memories and injects into session context via 3-layer progressive disclosure | JSON hook config -> plugin handler |
| UserPromptSubmit | Captures user prompts as observations with project context | JSON hook config -> plugin handler |
| PostToolUse | Captures tool usage patterns and results as structured observations | JSON hook config -> plugin handler |
| Stop | Captures session summary and final state when session ends | JSON hook config -> plugin handler |
| SessionEnd | Full session summary generation, observation extraction, AI compression | JSON hook config -> plugin handler |
| Smart Install | Auto-detects first run and performs initial configuration | JSON hook config -> plugin handler |

### Agents
| Name | Role | Mode | Model Assignment |
|------|------|------|-----------------|
| N/A | claude-mem does not define custom agents | -- | -- |

claude-mem operates through hooks and MCP tools, not through custom agents. The host runtime's default agent interacts with memory via skills and tools.

### Tools (via MCP Server)
| Name | Purpose | Schema |
|------|---------|--------|
| `mem_search` | Search stored memories by query (keyword + semantic) | Query string, project filter, date range |
| `mem_timeline` | Retrieve session timeline (chronological session history) | Project filter, date range, limit |
| `mem_get_observations` | Get specific observations by ID or filter | Observation IDs, type filter, project |
| `mem_smart_explore` | AST-powered code navigation with minimal token cost | File path, depth, filter |

### Memory / State
| Mechanism | Storage | Retrieval Pattern | Token Cost |
|-----------|---------|-------------------|------------|
| Observations | SQLite (structured) + Chroma (vector embeddings) | 3-layer progressive disclosure | Layer 1: ~50-100 tokens, Layer 3: ~500-1000 tokens |
| Sessions | SQLite (session metadata, timestamps, project context) | Timeline query | ~100-300 tokens per session summary |
| Summaries | SQLite (AI-compressed session summaries) | Relevance-weighted injection | ~200-500 tokens per summary |
| Pending messages | SQLite (PendingMessageStore) | Queue-based processing | Background (no session cost) |
| Timeline | SQLite (chronological event log) | Timeline query with date filters | ~100-300 tokens per timeline segment |
| FTS5 indexes | SQLite (full-text search) | Keyword search | ~0 tokens (search index, not injected) |
| Vector embeddings | Chroma (semantic search) | Similarity search | ~0 tokens (search index, not injected) |

## 3-Layer Progressive Disclosure Pattern (Detailed)

The 3-layer progressive disclosure system is claude-mem's most important architectural contribution. It solves the fundamental tension between "remember everything" and "don't waste tokens."

### Layer 1: Search (~50-100 tokens)
- **What it returns:** Brief search results -- observation titles, timestamps, confidence scores, and relevance indicators.
- **When used:** Every session start (automatic injection), and when the agent calls `mem_search`.
- **Token cost:** Minimal. Just enough to know what memories exist and their relevance.
- **Purpose:** Let the agent decide what is worth loading in detail.

### Layer 2: Timeline (~100-300 tokens)
- **What it returns:** Chronological session timeline with session summaries, project milestones, and key decision points.
- **When used:** When the agent needs temporal context ("what did I do last session?", "when did we decide X?").
- **Token cost:** Moderate. Compressed session summaries, not full transcripts.
- **Purpose:** Provide temporal orientation and session continuity.

### Layer 3: Details (~500-1000 tokens)
- **What it returns:** Full observation content with context, reasoning, and related observations.
- **When used:** When the agent specifically requests details for a relevant observation from Layer 1/2 results.
- **Token cost:** Higher but targeted. Only fetched for observations the agent determined are relevant.
- **Purpose:** Full context for specific memories the agent needs.

### Why This Matters
The 3-layer pattern achieves **10x token savings** compared to injecting all memories at session start. Instead of loading every observation (potentially thousands of tokens), the agent starts with a lightweight search index (Layer 1), navigates to relevant timeframes (Layer 2), and only loads full details (Layer 3) for specific observations it needs.

This is the **gold standard** for token-efficient memory retrieval in the ecosystem.

## Storage Architecture (Detailed)

### SQLite Schema
claude-mem uses SQLite as the primary structured store with these key tables:

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `sessions` | Session metadata | id, project, start_time, end_time, summary, token_count |
| `observations` | Captured observations | id, session_id, type, content, summary, timestamp, project, confidence |
| `summaries` | AI-compressed session summaries | id, session_id, content, compression_ratio, created_at |
| `pending_messages` | Queue for background processing | id, content, status, retry_count, created_at |
| `timeline` | Chronological event log | id, session_id, event_type, content, timestamp |
| `transactions` | Transaction management | id, status, created_at |

**Migrations** (`src/services/sqlite/migrations/`) manage schema evolution across versions.

### FTS5 Indexes
Full-text search indexes on observation content and summaries enable fast keyword search without loading all records. FTS5 is SQLite's built-in full-text search engine -- no external dependency.

### Chroma Vector DB
Chroma provides semantic/vector search for conceptual queries ("memories about authentication" even if the word "authentication" is not in the observation). Requires external Chroma server or embedded mode.

### Observation Types
| Type | What It Captures | Example |
|------|-----------------|---------|
| Decision | Design and implementation decisions | "Chose JWT over session cookies for auth" |
| Pattern | Recurring code/workflow patterns | "Always validate input before DB write" |
| Error | Errors encountered and solutions | "CORS error resolved by adding origin header" |
| Preference | User/project preferences | "Prefer functional style over OOP" |
| Context | Project context and conventions | "Uses monorepo with Turborepo" |
| Tool usage | Tool invocation patterns | "Uses oc_review after every implementation" |

## Bun Compatibility Assessment

### SQLite: Fully Compatible
- **bun:sqlite** is Bun's built-in SQLite module with native performance. It provides synchronous API compatible with most SQLite operations.
- **better-sqlite3** (used by claude-mem) also works in Bun via native addon compatibility.
- **FTS5 is supported** in both bun:sqlite and better-sqlite3.
- **Migration pattern** is portable -- SQL migrations work identically in any SQLite binding.
- **Recommendation:** Use `bun:sqlite` for zero-dependency SQLite in our plugin. It is faster than better-sqlite3 in Bun and requires no npm install.

### Chroma: Compatibility Risk
- **Chroma requires a running server** (Python-based) or embedded mode (Python bindings). Neither is natural in a Bun TypeScript plugin.
- **chromadb npm client** communicates with a Chroma server via HTTP. This works in Bun but requires users to run a Chroma server separately.
- **Embedded Chroma** requires Python runtime, which conflicts with our Bun-only constraint.
- **Recommendation:** AVOID Chroma dependency for Phase 15. Start with SQLite FTS5 for keyword search. If semantic search is needed, evaluate pure-JS embedding solutions (e.g., compute embeddings via the AI model and store in SQLite) rather than requiring an external vector database.

### Alternative: Embedding-in-SQLite Pattern
Instead of Chroma, we could:
1. Use the AI model to generate embeddings for observations (small embedding models are fast)
2. Store embedding vectors as BLOB in SQLite
3. Compute cosine similarity in JavaScript at query time
4. This eliminates the Chroma dependency while preserving semantic search capability
5. Performance is acceptable for moderate memory stores (thousands of observations, not millions)

## Architecture Patterns

1. **Progressive disclosure (3-layer):** Most token-efficient memory retrieval in the ecosystem. Search (lightweight) -> Timeline (moderate) -> Details (full). Agent controls depth.
2. **AI compression:** Observations are summarized by AI before storage. This reduces both storage size and retrieval token cost. The compression ratio is tracked per summary.
3. **Observation-based capture:** Structured observations (decisions, patterns, errors, preferences) rather than raw chat transcripts. This captures WHAT MATTERS, not everything.
4. **System prompt injection:** v10.6.0+ injects relevant memories into the system prompt via `before_prompt_build` hook. This is more reliable than file-based approaches (e.g., generating CLAUDE.md).
5. **Background processing queue:** Observation compression and indexing happen in background workers, not blocking the session. The pending message store manages retry and ordering.
6. **Mode system:** 32 localized modes + specialized modes (law-study, email-investigation) adapt the memory system's behavior to specific domains. Study modes use specialized observation types (case holdings, doctrine synthesis for law-study).
7. **Hybrid search:** SQLite FTS5 (keyword) + Chroma (semantic). Covers both exact-match queries ("that JWT bug") and conceptual queries ("authentication issues").

## Strengths

- **3-layer progressive disclosure** is the gold standard for token-efficient memory. 10x savings compared to full injection. No competitor matches this precision of token budget control.
- **Observation-based capture** with structured types (decisions, patterns, errors, preferences) captures meaningful signal, not noise. This is strictly better than raw transcript storage.
- **AI compression** of observations reduces storage and retrieval costs while preserving semantic content. The compression ratio tracking enables quality monitoring.
- **System prompt injection** via hooks is more reliable than file-based memory (CLAUDE.md generation). claude-mem moved away from file-based injection in v10.6.0, validating this approach.
- **Smart Explore** (AST-powered code navigation) achieves 6-12x lower token cost for code reading. This is a significant efficiency improvement.
- **Mode system** with 32 languages and specialized modes (law-study) demonstrates memory system adaptability to different domains.
- **Endless mode** enables ~1000 tool uses vs ~50 (20x increase) through biomimetic memory patterns. This extends productive session length dramatically.
- **Timeline reports** generate narrative project journey documents, providing human-readable project history.
- **Mature versioning** (v10.6.3) indicates a stable, well-iterated system. The CHANGELOG shows systematic improvement over many releases.

## Weaknesses / Concerns

- **Chroma dependency** is the biggest concern. Requiring a Python-based vector database server adds significant complexity and conflicts with Bun-only runtimes. Not all users can or will run a Chroma server.
- **No decay/relevance scoring:** claude-mem lacks strong decay mechanisms. Old observations persist indefinitely unless manually cleaned. Over time, the memory store grows unbounded. ECC's instinct system has better pruning.
- **No learning system:** claude-mem remembers but does not learn. It stores observations but does not extract patterns, score confidence, or evolve observations into reusable knowledge. Compare ECC's instinct extraction.
- **Claude Code only:** The plugin targets Claude Code specifically. OpenCode compatibility is not provided, meaning we cannot use it as-is. Patterns must be re-implemented.
- **Heavy infrastructure:** Plugin + MCP server + SQLite + Chroma + background workers + supervisor is a complex stack for a memory system. Our plugin must be simpler.
- **Background worker complexity:** The worker-service, supervisor, and queue system add operational complexity. For a plugin running inside OpenCode, a simpler approach (async writes, no separate workers) may be more appropriate.
- **No cross-project sharing:** Memories are project-scoped. There is no mechanism for sharing observations across projects (e.g., "this TypeScript pattern works well" should be available in all TypeScript projects).
- **Limited query capabilities:** Search is keyword (FTS5) + semantic (Chroma). There is no structured query (e.g., "all decisions about authentication made in the last week") without Chroma.

## Relevance to Our Plugin

### Features We Should Adopt (with rationale)
- **3-layer progressive disclosure (Phase 15, CRITICAL):** This is the foundation for our memory system. Layer 1 for lightweight search results, Layer 2 for timeline navigation, Layer 3 for full details. Our implementation should use this exact pattern.
- **Observation-based capture (Phase 15):** Structured observation types (decisions, patterns, errors, preferences, context). Our Phase 15 memory capture should use typed observations, not raw transcripts.
- **AI compression (Phase 15):** Compress observations with AI summarization before storage. Track compression ratio for quality monitoring.
- **System prompt injection (Phase 15):** Inject relevant memories via config hook at session start. We already have the config hook pattern for agent injection; extending it for memory injection is natural.
- **SQLite storage with FTS5 (Phase 15):** Use `bun:sqlite` for zero-dependency storage with full-text search. FTS5 covers keyword search without external dependencies.
- **Smart Explore concept (Phase 14):** AST-powered code navigation that reads structure, not full files. Could be implemented as a skill or tool.
- **Timeline reports (Phase 14):** Generate narrative project history. Useful for understanding what happened across sessions.

### Features We Should Skip (with rationale)
- **Chroma vector DB:** External dependency that conflicts with Bun-only constraint. Start with FTS5; add embedding-in-SQLite if semantic search proves necessary.
- **MCP server architecture:** Our plugin operates via hooks and tools, not as a separate MCP server. Memory should be integrated into the plugin, not a separate process.
- **Background worker/supervisor:** Too complex for a plugin. Use async operations within the plugin lifecycle instead.
- **32 localized modes:** Mode system is specific to claude-mem's multi-language UX. Our memory system should be language-agnostic internally.
- **Endless mode:** Biomimetic memory for extended sessions is interesting but complex. Defer to post-v3.0 after basic memory is proven.
- **Mode-specific observation types (law-study):** Specialized observation types for non-development domains are outside our scope.

### Opportunities to Do Better
- **Integrated memory + learning:** claude-mem remembers (observations) but does not learn (patterns). ECC learns (instincts) but does not remember (sessions). Our Phase 15 system should do BOTH: capture observations (memory) AND extract patterns with confidence scoring (learning). This is the unified system neither competitor has built.
- **Decay and relevance scoring:** Where claude-mem has no decay, our system should have time-weighted relevance (our existing lesson memory already has this pattern) combined with usage-based boosting (frequently accessed memories stay relevant longer).
- **Cross-project knowledge:** User-level memories (preferences, patterns) should be shared across all projects. Project-level memories (conventions, decisions) stay project-scoped. This two-tier scoping is better than claude-mem's project-only approach.
- **Simpler storage:** `bun:sqlite` with FTS5 gives us structured storage + keyword search with zero external dependencies. If semantic search is needed, compute embeddings via the AI model and store as BLOBs in SQLite. No Chroma required.
- **Automatic capture via hooks:** Where claude-mem captures via 6 specific hooks, we can capture via our existing event hook (`session.created`, `session.compacted`, `tool.execute.after`) without adding new hook types.
- **Token budget enforcement:** claude-mem's 3-layer pattern is excellent but lacks explicit token budget caps. Our system should enforce a configurable maximum token budget for memory injection (e.g., "never inject more than 2000 tokens of memory context").
