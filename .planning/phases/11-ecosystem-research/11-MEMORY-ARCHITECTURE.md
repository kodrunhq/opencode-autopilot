# Memory Architecture Recommendation for Phase 15

## Executive Summary

Build a unified memory+learning system using bun:sqlite with FTS5 for storage, observation-based capture (not raw transcripts), 3-layer progressive disclosure for retrieval, config hook injection for delivery, and time-weighted decay for lifecycle management. Avoid Chroma vector DB (Python dependency, incompatible with Bun runtime) and file-based memory (CLAUDE.md generation, less reliable than system prompt injection). The key differentiator over competitors: integrate claude-mem's memory retrieval with ECC's instinct learning into a single system where observations evolve into skills -- neither competitor has this.

## Competitor Memory Pattern Analysis

### claude-mem Approach
- **Storage:** SQLite for structured data (sessions, observations, summaries, timeline, FTS5 indexes) + Chroma vector DB for semantic/embedding-based search. v10.6.3 is current.
- **Capture:** Observation-based via 6 lifecycle hooks (SessionStart, UserPromptSubmit, PostToolUse, Stop, SessionEnd, Smart Install). Captures typed observations (decisions, patterns, errors, preferences, context, tool usage) with timestamps and project context.
- **Retrieval:** 3-layer progressive disclosure: Layer 1 Search (~50-100 tokens, titles/summaries), Layer 2 Timeline (~100-300 tokens, chronological session history), Layer 3 Details (~500-1000 tokens, full observation content). Agent controls depth. Achieves 10x token savings vs full injection.
- **Injection:** v10.6.0+ uses `before_prompt_build` hook for system prompt injection. Previously used CLAUDE.md file generation (deprecated as less reliable).
- **Strengths:** Progressive disclosure is the gold standard for token-efficient retrieval. Observation-based capture filters signal from noise. AI compression reduces storage and retrieval costs. Mature system (v10.6.3) with proven architecture.
- **Weaknesses:** Chroma dependency requires Python server or native bindings (incompatible with Bun-only constraint). No decay/relevance scoring (observations persist indefinitely). No learning system (stores but does not extract patterns or score confidence). Project-scoped only (no cross-project knowledge). Limited query beyond keyword + semantic search.

### ECC Instinct System
- **Extraction:** `/learn` captures all patterns mid-session; `/learn-eval` applies quality gating with confidence scoring to filter noise. Patterns are extracted from code review findings, debugging sessions, and workflow observations.
- **Confidence scoring:** Each pattern scored on frequency (how often), impact (did it improve outcomes), consistency (holds across contexts), recency (recent scores higher). Only high-confidence patterns persist.
- **Evolution:** `/evolve` clusters related instincts into full skills when multiple patterns accumulate in the same domain. This is instinct graduation -- temporary patterns become permanent methodology.
- **Pruning:** `/prune` cleans up expired or low-confidence patterns. Prevents unbounded growth of the instinct store.
- **Strengths:** Confidence scoring prevents noise accumulation. Evolution pathway (instinct to skill) gives patterns a graduation path. Pruning prevents growth bombs. Quality gating (/learn-eval vs /learn) gives users choice between aggressive and conservative learning.
- **Weaknesses:** No memory recall (stores patterns, not session context). No semantic search (keyword/domain matching only). No cross-project sharing by default. Evolution requires manual trigger (/evolve). No timeline navigation or progressive disclosure.

### Our Existing Memory (lesson memory, review memory)
- **What we have today:**
  - Lesson memory (`src/pipeline/learning/`): Captures institutional memory with 4 domain categories (architecture, testing, review, planning). Has decay mechanism. Session-scoped (does not persist across sessions to external storage).
  - Review memory (`src/review/memory.ts`): Per-project review findings, false positives, project profile. Used by review engine for context.
  - Confidence ledger: Per-decision tracking with confidence scores.
  - Decision log: Timestamped autonomous decisions with rationale.
- **What it lacks for cross-session persistence:**
  - No external storage (no SQLite, no filesystem persistence beyond session)
  - No retrieval mechanism for previous session data
  - No injection of historical context into new sessions
  - No confidence scoring on lesson entries
  - No skill promotion pathway

## Recommended Architecture

### Storage Layer
- **Technology:** bun:sqlite (Bun's built-in SQLite module)
- **Why bun:sqlite:** Zero dependencies, native Bun performance, synchronous API, no npm install required. Faster than better-sqlite3 in Bun benchmarks.
- **Why not Chroma:** Chroma requires a Python server (separate process) or embedded mode (Python bindings). Neither is compatible with our Bun-only runtime constraint. The complexity and dependency overhead is not justified when SQLite FTS5 covers keyword search effectively.
- **Why not better-sqlite3:** Works in Bun via native addon compatibility but requires npm install of native bindings. bun:sqlite is built in and requires nothing.
- **Schema outline:**

```sql
-- Core tables
CREATE TABLE projects (
  id TEXT PRIMARY KEY,           -- hash of project path
  path TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  conventions TEXT,              -- JSON: detected conventions
  tech_stack TEXT,               -- JSON: detected languages/frameworks
  last_updated TEXT NOT NULL     -- ISO timestamp
);

CREATE TABLE observations (
  id INTEGER PRIMARY KEY,        -- rowid alias (required for FTS5 content_rowid mapping)
  uuid TEXT NOT NULL UNIQUE,     -- UUID for external references (indexed)
  project_id TEXT,               -- NULL for user-level observations
  session_id TEXT NOT NULL,
  type TEXT NOT NULL,            -- 'decision' | 'pattern' | 'error' | 'preference' | 'context' | 'tool_usage'
  content TEXT NOT NULL,         -- original content
  summary TEXT NOT NULL,         -- AI-compressed summary
  confidence REAL DEFAULT 0.5,  -- 0.0-1.0 confidence score
  access_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,      -- ISO timestamp
  last_accessed TEXT NOT NULL,   -- ISO timestamp (for decay refresh)
  relevance_score REAL DEFAULT 1.0, -- computed: time-decay * frequency * type-weight
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,           -- UUID
  project_id TEXT,
  start_time TEXT NOT NULL,
  end_time TEXT,
  summary TEXT,                  -- AI-compressed session summary
  token_count INTEGER DEFAULT 0,
  tool_count INTEGER DEFAULT 0,
  phase_count INTEGER DEFAULT 0,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE preferences (
  id TEXT PRIMARY KEY,           -- UUID
  key TEXT NOT NULL UNIQUE,      -- e.g., 'coding_style', 'commit_format'
  value TEXT NOT NULL,
  confidence REAL DEFAULT 0.5,
  source_session TEXT,
  created_at TEXT NOT NULL,
  last_updated TEXT NOT NULL
);

-- Full-text search
-- Note: content_rowid=id works because id is INTEGER PRIMARY KEY (rowid alias).
-- The TEXT uuid column is for external references; FTS5 maps via the integer rowid.
CREATE VIRTUAL TABLE observations_fts USING fts5(
  content, summary,
  content=observations,
  content_rowid=id
);
```

- **Full-text search:** SQLite FTS5 virtual table on observations.content and observations.summary. Handles keyword search, ranking, and tokenization with zero external dependencies.
- **Concurrency:** Enable WAL mode on database open (`PRAGMA journal_mode=WAL`) for concurrent read access. Write contention is mitigated by the observation that writes are session-lifecycle events (session start/end), not real-time -- low contention by design. WAL mode allows readers to proceed without blocking on writers, which matters when memory injection reads overlap with background observation writes.
- **Location:** `~/.config/opencode/memory/memory.db`
- **Migrations:** SQL migration files in the plugin package, run on first access and version upgrades. Same pattern as claude-mem's migration system.

### Runtime Safety

`bun:sqlite` exposes a synchronous API -- every `db.query()`, `db.run()`, and `db.exec()` call blocks the thread until SQLite returns. Plugin hooks (`session.created`, `tool.execute.after`, cleanup handlers) are async event handlers running inside the OpenCode event loop. Blocking that loop degrades OpenCode responsiveness (delayed UI updates, stalled tool execution).

**Why this is acceptable with mitigation:**

1. **Typical SQLite query latency is ~0.1-1ms.** For the operations this system performs (single-row inserts, FTS5 searches over thousands of rows, PRAGMA reads), blocking for <1ms is imperceptible. The OpenCode event loop tolerates short synchronous work (e.g., JSON.parse, schema validation) without user-visible degradation.

2. **Non-critical writes can be deferred.** Observation persistence, access_count increments, and decay score updates are fire-and-forget. Wrap these in `setTimeout(fn, 0)` to push them to the next microtask, keeping the current hook handler fast. Only session-start reads (memory injection) need to be synchronous -- and they must complete before the session begins anyway.

3. **If `bun:sqlite` proves too slow,** `better-sqlite3` with an async wrapper (worker thread) is the fallback. This adds an npm dependency but preserves the synchronous-looking API via `Comlink` or `worker_threads` message passing.

**MANDATORY: Phase 15 benchmark spike.** Before any schema design work, implement a benchmark that:
- Creates a database with 5,000 observations and FTS5 index
- Measures p50/p95/p99 latency for: single insert, FTS5 search (top 10), relevance-scored query (ORDER BY composite score LIMIT 20)
- Runs inside an async context simulating a plugin hook handler
- Pass criteria: p99 < 5ms for reads, p99 < 10ms for writes
- If criteria not met: evaluate `better-sqlite3` with worker thread, re-benchmark, decide before proceeding

### Capture Layer
- **What to capture:** Decisions, patterns, errors, preferences, conventions, tool usage patterns. NOT raw transcripts, NOT full conversation history.
- **How to capture:** Observation-based -- structured types with timestamps, project context, and session ID. Each observation has a type field for filtering.
- **When to capture:**
  - `session.created` hook: Register session start, load project context
  - `tool.execute.after` hook: Capture significant tool outputs (review findings, orchestrator decisions)
  - Session end (via hook or cleanup): Extract session observations, generate AI summary, persist
- **AI summarization:** Compress observations before storage using the session's active model. Target 50-100 token summaries per observation. Track compression ratio. Summarization is best-effort (failure silently falls back to truncated content, never blocks the session).
- **Observation deduplication:** Before persisting, check for existing observations with similar content (FTS5 match score > threshold). If duplicate found, increment access_count and refresh last_accessed instead of creating new record.

### Retrieval Layer
- **3-layer progressive disclosure** (adapted from claude-mem):
  - **Layer 1 (Search):** FTS5 keyword search + relevance scoring. Returns observation summaries with IDs, types, timestamps, and confidence scores. Cost: ~50-100 tokens per query. Used for: "Do I have relevant memories for this task?"
  - **Layer 2 (Timeline):** Chronological view of sessions for a project with compressed summaries. Cost: ~200-500 tokens. Used for: "What did I do last session? When did we decide X?"
  - **Layer 3 (Details):** Full observation content with context and related observations. Cost: ~500-1000 tokens per item. Used for: "Give me the full details of that authentication decision."
- **Token budget:** Hard cap of 2000 tokens per session injection (configurable in plugin config as `memory.injectionBudget`). Layer 1 always fits. Layer 2 loaded if budget allows. Layer 3 only on explicit agent request.
- **Relevance scoring:** Composite score: `time_decay * frequency_weight * type_weight`
  - Time decay: `e^(-age_days / half_life)` where half_life defaults to 90 days
  - Frequency weight: `log2(access_count + 1)` (diminishing returns on repeated access)
  - Type weight: decisions (1.5) > patterns (1.2) > errors (1.0) > preferences (0.8) > context (0.6) > tool_usage (0.4)

### Injection Layer
- **Mechanism:** Config hook system prompt injection. We already have this pattern from skill injection in Phase 10 -- extending it for memory injection is a natural addition.
- **When:** `session.created` hook fires. Memory injection runs after skill injection but before the first user message.
- **What to inject:** Top-N relevant observations for current project, filtered by relevance_score > threshold and capped by token budget. Format: structured markdown section with observation summaries and project context.
- **Injection format:**
```markdown
## Project Memory (auto-injected)
**Project:** {project_name}
**Last session:** {last_session_date}

### Key Decisions
- {decision_summary_1} (confidence: {score})
- {decision_summary_2} (confidence: {score})

### Patterns
- {pattern_summary_1}

### Recent Errors (resolved)
- {error_summary_1}
```
- **Graceful degradation:** If memory DB is missing, corrupted, or empty, injection silently skips. Memory is additive, never blocking.

### Decay / Lifecycle
- **Time-based decay:** Observations lose relevance_score over time. Formula: `e^(-age_days / half_life)` where half_life is configurable (default 90 days). An observation at 90 days old has ~37% of its original relevance.
- **Access-based refresh:** Accessing an observation (Layer 3 detail retrieval or explicit reference) resets its last_accessed timestamp and increments access_count, effectively boosting its relevance score.
- **Confidence-based pruning:** Observations below confidence threshold (default 0.2) after decay are candidates for pruning.
- **Manual pruning:** `/memory-prune` command for explicit cleanup. Shows what will be removed before executing.
- **Storage cap:** Maximum 10,000 observations per project. When exceeded, lowest-relevance observations pruned first. User-level preferences table has no cap (small dataset).
- **Automatic cleanup:** On session start, prune observations where `relevance_score * confidence < 0.1`. This runs as a background operation, non-blocking.

### Scopes (per Phase 15 requirements)
- **Project-level:** Coding conventions, architecture decisions, codebase patterns, error resolutions. Stored per project path (projects.path as key). Injected only when working in that project.
- **User-level:** Workflow preferences, communication style, tool preferences, coding style preferences. Stored in preferences table (no project_id). Injected into every session regardless of project.

### Token Budget Math

Concrete token accounting for the 2000-token default injection budget:

| Component | Token Range | Notes |
|-----------|------------|-------|
| Layer 1 (search results) | 50-100 tokens x N results | Summaries with ID, type, timestamp, confidence |
| Layer 2 (timeline context) | 200-500 tokens total | Chronological session list with compressed summaries |
| Layer 3 (full details) | 500-1000 tokens per item | Full observation content + related observations |
| Injection format overhead | ~100 tokens | Markdown headers, project name, last session date |

**Budget allocation for default 2000-token cap:**

- Overhead: 100 tokens
- Layer 1 (5 results): 250-500 tokens
- Layer 2 (timeline): 200-500 tokens
- Layer 3 (1 item): 500-1000 tokens
- **Total: 1050-2100 tokens**

This means the default budget comfortably fits Layer 1 + Layer 2 + 1 Layer 3 item in the typical case (850-1700 tokens with overhead). In the worst case (all ranges at maximum), Layer 3 is truncated or omitted.

**Overflow strategy:** If multiple Layer 3 items are needed (e.g., user asks "show me all auth decisions"), inject Layer 2 summaries only. Layer 3 detail is provided on explicit follow-up request via a memory retrieval tool, not via injection.

**Configurable cap:** Exposed in plugin settings as `memory.injectionBudget`:
- Default: 2000 tokens
- Range: 500-5000 tokens
- At 500: Layer 1 only (3-4 results) + overhead. Minimal memory footprint.
- At 5000: Layer 1 + Layer 2 + up to 4 Layer 3 items. Rich context but significant prompt budget consumption.

## What to Avoid

| Anti-Pattern | Why | Alternative |
|-------------|-----|-------------|
| Chroma/vector DB | Python dependency, requires separate server, incompatible with Bun-only constraint | SQLite FTS5 for keyword search. If semantic search needed later, compute embeddings via AI model and store as BLOBs in SQLite. |
| Raw transcript storage | Token-wasteful (10x+ more tokens than observation-based), captures noise alongside signal | Observation-based capture with structured types and AI compression |
| Unbounded growth | Memory stores without decay become context bombs that degrade agent performance over time | Time-weighted decay (90-day half-life) + storage cap (10k per project) + pruning |
| File-based memory (CLAUDE.md) | Less reliable than system prompt injection. claude-mem deprecated this in v10.6.0 | Config hook system prompt injection (proven pattern) |
| Complex embedding models | Runtime dependency, token cost for embedding generation, latency at query time | FTS5 keyword search (zero dependencies, fast, production-grade) |
| Background worker/supervisor | Over-engineered for plugin context. Adds process management complexity | Async operations within plugin lifecycle (non-blocking writes, best-effort summarization) |
| Blocking summarization | AI summarization during capture can block the session if model is slow or unavailable | Best-effort summarization: async, non-blocking, falls back to content truncation |

## BLOCKING PREREQUISITE: FTS5 Validation Spike

Phase 15 MUST begin with this validation spike before any schema design work proceeds.

**Spike script requirements:**
1. Create a `bun:sqlite` database in a temp directory
2. Execute `CREATE VIRTUAL TABLE test_fts USING fts5(title, content)`
3. Insert 3-5 sample rows with realistic observation content
4. Execute a `MATCH` query: `SELECT * FROM test_fts WHERE test_fts MATCH 'sample query'`
5. Verify results are returned and ranked by BM25

**If FTS5 IS supported:** Proceed with the planned architecture (FTS5 virtual tables, MATCH queries, BM25 ranking). Record the bun:sqlite version and SQLite version (`SELECT sqlite_version()`) in the Phase 15 implementation notes.

**If FTS5 is NOT supported:** Fall back to LIKE-based search with manual tokenization:
- Split query into tokens, build `WHERE content LIKE '%token1%' AND content LIKE '%token2%'` clauses
- Implement manual relevance scoring: count token matches, weight by position (title > content), apply same type-weight multipliers
- Performance impact: LIKE queries are O(n) full-table scans vs FTS5's inverted index. Acceptable for <10k observations per project. Add a `CREATE INDEX idx_observations_type ON observations(type)` to help filtered queries.
- This fallback is functional but slower. Re-evaluate FTS5 support on each Bun version upgrade.

**This spike must complete and pass before any schema design, migration code, or capture/retrieval implementation begins.**

## Open Questions for Phase 15

1. **Token cost of AI summarization during capture.** Compressing each observation requires a model call (~50-100 tokens input, ~30-50 tokens output). For a session producing 10-20 observations, this is 500-2000 tokens of summarization overhead. This should be async and non-blocking. If model is unavailable, fall back to truncation (first 100 chars of content as summary).

2. **Optimal decay half-life.** 90 days is a starting default. In practice, some projects are worked on daily (short half-life appropriate) while others are revisited monthly (long half-life appropriate). Consider per-project configurable half-life, or adaptive half-life based on session frequency.

3. **Embedding-in-SQLite for semantic search.** If FTS5 keyword search proves insufficient (users searching for conceptual queries that do not match keywords), a future enhancement could compute embeddings via the AI model, store as BLOBs in SQLite, and compute cosine similarity in JavaScript at query time. This is feasible for moderate stores (thousands of observations) without Chroma.

## Migration Path from Existing Memory

Our plugin already has memory-like systems that should be preserved and migrated:

- **Lesson memory** (`src/pipeline/learning/`): Lessons with domain categorization and decay map to observations with `type: 'pattern'` and domain metadata. Existing lesson entries can be migrated to the observations table on first Phase 15 load. The decay mechanism already validates the decay pattern.

- **Review memory** (`src/review/memory.ts`): Per-project review findings, false positives, and project profiles map to observations with `type: 'error'` (findings), `type: 'pattern'` (false positives as negative patterns), and `type: 'context'` (project profile). Migration preserves existing review data.

- **Confidence ledger** (`src/orchestrator/confidence/`): Decision confidence scores inform the confidence field on migrated observations. The ledger itself remains separate (it serves the orchestrator, not memory) but its scoring patterns inform the memory system's confidence scoring.

- **Decision log** (`src/orchestrator/decision-log/`): Timestamped decisions map directly to observations with `type: 'decision'`. Decision log remains the primary decision record; memory stores summaries for cross-session context.

- **Both keep working during migration:** New memory system is additive. Existing lesson memory and review memory continue to function in-session. The SQLite-based memory system adds cross-session persistence on top. Migration is lazy (runs on first access after Phase 15 deployment), non-blocking, and idempotent.

### Migration Discovery Mechanism

On plugin load, the migration system discovers existing memory files through a concrete scan:

1. **Scan known project paths.** Read the OpenCode config (`~/.config/opencode/opencode.json` or equivalent) to find project directories the user has worked in. For each project path, check for:
   - `{project}/.opencode/lesson-memory.json` (or the path used by `src/pipeline/learning/`)
   - `{project}/.opencode/review-memory.json` (or the path used by `src/review/memory.ts`)
   - `{project}/.opencode/confidence-ledger.json`
   - `{project}/.opencode/decision-log.json`

2. **Migration is opt-in.** Present discovered files to the user with a summary: "Found 3 projects with existing memory data (42 lessons, 18 review findings). Migrate to persistent memory?" The user chooses which projects to migrate.

3. **Migration status tracking.** Store migration state in the global memory DB:
   ```sql
   CREATE TABLE migrations (
     project_path TEXT NOT NULL,
     source_type TEXT NOT NULL,    -- 'lesson' | 'review' | 'confidence' | 'decision'
     source_file TEXT NOT NULL,    -- absolute path to migrated file
     migrated_at TEXT NOT NULL,    -- ISO timestamp
     record_count INTEGER NOT NULL,
     PRIMARY KEY (project_path, source_type)
   );
   ```
   Migration runs once per project per source type. Re-running migration for an already-migrated project/source is a no-op (idempotent by primary key check).
