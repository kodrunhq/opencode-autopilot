# Phase 15: Memory System - Research

**Researched:** 2026-04-02
**Domain:** bun:sqlite, FTS5 full-text search, event-driven capture, token-budgeted injection
**Confidence:** HIGH

## Summary

Phase 15 builds a dual-scope memory system (project-level patterns + user-level preferences) using bun:sqlite with FTS5 for storage and retrieval, observability events for capture, and the `experimental.chat.system.transform` hook for injection. All storage lives in `~/.config/opencode/memory/memory.db`.

FTS5 has been **validated working** on this machine: Bun 1.3.11 bundles SQLite 3.51.2 with FTS5 compiled in. External content tables, BM25 ranking, triggers for auto-sync, and WAL mode all confirmed functional. The FTS5 validation spike (D-11 blocking prerequisite) can be satisfied immediately.

The codebase already has well-established patterns for every integration point: `SessionEventStore` + event handlers for capture, `buildMultiSkillContext` for token-budgeted injection, `configHook` for agent registration, `*Core` + `tool()` for tool registration, and atomic file writes for persistence. The memory system follows these patterns.

**Primary recommendation:** Build the memory module at `src/memory/` with SQLite repository, FTS5 search, observability subscriber, and system prompt injector -- reusing `adaptive-injector.ts` token budget math and `event-handlers.ts` subscriber pattern.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01 through D-05: Two scopes (project patterns + user preferences), project-isolated, no cross-project learning
- D-06 through D-08: ALL memory in `~/.config/opencode/memory/`, NEVER in project repo
- D-09 through D-11: bun:sqlite with FTS5, FTS5 validation spike MUST complete first
- D-12: SHA-256 hash of project root path as project key
- D-13 through D-15: Tap Phase 13 observability events, AI summarization at capture (~50 tokens), respect explicit user cues ("remember this", "forget X")
- D-16 through D-19: Relevance scoring, top-N injection, 3-layer progressive disclosure, 2000-token default budget (configurable 500-5000)
- D-20 through D-21: One tool only: oc_memory_status. No search/forget/export tools this phase
- D-22 through D-23: Start fresh (no migration), replace lesson/review memory over time
- D-24 through D-26: Must demonstrably improve over time, store only genuinely useful observations, not token-wasteful

### Claude's Discretion
- Memory schema design (exact table definitions, indexes)
- Relevance scoring algorithm details (decay formula, type weights)
- Retention policies per scope (half-life, pruning thresholds)
- How memories are injected into agent prompts (format, placement)
- How to identify what's worth memorizing vs. noise from observability events
- Observation deduplication strategy
- Whether to implement "instinct graduation" pattern (observations evolving into skills)

### Deferred Ideas (OUT OF SCOPE)
- Full memory toolset (search, forget, export)
- Smart cross-pollination across projects
- Instinct graduation (observations evolving into skills)
- Embedding-in-SQLite for semantic search
</user_constraints>

## Project Constraints (from CLAUDE.md)

- **Runtime:** Bun only -- plugins run inside OpenCode process via Bun
- **No Bun.file()/Bun.write():** Use `node:fs/promises` (but bun:sqlite is fine -- it is a Bun built-in)
- **No standalone Zod install:** Use transitive dep `import { z } from "zod"`
- **Model agnostic:** Never hardcode model identifiers
- **Global target:** Assets write to `~/.config/opencode/`
- **`oc_` prefix:** All plugin tool names start with `oc_`
- **Immutability:** Build objects declaratively with spreads, never mutate after creation
- **Tool registration:** `*Core` function (testable, accepts `baseDir`) + `tool()` wrapper
- **File organization:** Many small files, 200-400 lines typical, 800 max
- **Biome for lint/format:** `bun run lint` and `bun run format`

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| bun:sqlite | Bun 1.3.11 bundled (SQLite 3.51.2) | Database storage + FTS5 search | Zero deps, native Bun perf, synchronous API, FTS5 compiled in |
| node:crypto | Built-in | SHA-256 project key hashing | Standard library, no deps |
| zod | Transitive via @opencode-ai/plugin | Schema validation for memory records | Established project pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @opencode-ai/plugin | Existing dep | Hook registration (event, config, system.transform) | Integration points |
| @opencode-ai/sdk | Existing dep | Type definitions (Config, Event) | Type imports only |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| bun:sqlite | better-sqlite3 | Requires npm install of native bindings; bun:sqlite is zero-dep |
| FTS5 | LIKE-based search | O(n) full-table scan vs FTS5 inverted index; only if FTS5 fails |
| System prompt injection | CLAUDE.md file generation | claude-mem deprecated file-based approach in v10.6.0; less reliable |

**No additional installation needed** -- all dependencies are already available.

## Architecture Patterns

### Recommended Project Structure
```
src/memory/
  index.ts              Public API barrel export
  database.ts           SQLite database wrapper (open, close, migrate, WAL)
  schema.ts             Zod schemas for observation, preference, session records
  types.ts              TypeScript types inferred from schemas
  repository.ts         CRUD operations + FTS5 search queries
  capture.ts            Observability event subscriber, observation extraction
  summarizer.ts         AI summarization (async, best-effort, falls back to truncation)
  retrieval.ts          3-layer progressive disclosure, relevance scoring
  injector.ts           System prompt injection via experimental.chat.system.transform
  decay.ts              Time-weighted decay computation + pruning
  project-key.ts        SHA-256 project path hashing
  constants.ts          Default values, type weights, budget limits

src/tools/
  memory-status.ts      oc_memory_status tool definition (Core + wrapper pattern)
```

### Pattern 1: Database Singleton with Lazy Initialization
**What:** Single Database instance created on first access, reused across the session. WAL mode enabled on open.
**When to use:** Plugin load time -- initialize once, close on process exit.
**Example:**
```typescript
// src/memory/database.ts
import { Database } from "bun:sqlite";
import { join } from "node:path";
import { ensureDir } from "../utils/fs-helpers";
import { getGlobalConfigDir } from "../utils/paths";

const MEMORY_DIR = "memory";
const DB_FILE = "memory.db";

let db: Database | null = null;

export function getMemoryDb(): Database {
  if (db) return db;

  const memoryDir = join(getGlobalConfigDir(), MEMORY_DIR);
  // ensureDir is async but we need sync init for bun:sqlite
  // Use mkdirSync as fallback in the sync path
  const { mkdirSync } = require("node:fs");
  mkdirSync(memoryDir, { recursive: true });

  const dbPath = join(memoryDir, DB_FILE);
  db = new Database(dbPath);
  db.run("PRAGMA journal_mode=WAL");
  db.run("PRAGMA foreign_keys=ON");
  runMigrations(db);
  return db;
}

export function closeMemoryDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
```

### Pattern 2: External Content FTS5 with Triggers
**What:** FTS5 virtual table backed by the observations table via triggers for automatic sync.
**When to use:** Always -- triggers keep FTS index in sync without manual rebuild.
**Example:**
```sql
-- Main table
CREATE TABLE IF NOT EXISTS observations (
  id INTEGER PRIMARY KEY,
  project_id TEXT,
  session_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('decision','pattern','error','preference','context','tool_usage')),
  content TEXT NOT NULL,
  summary TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.5,
  access_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  last_accessed TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- FTS5 virtual table (external content, synced via triggers)
CREATE VIRTUAL TABLE IF NOT EXISTS observations_fts USING fts5(
  content, summary,
  content=observations,
  content_rowid=id
);

-- Auto-sync triggers
CREATE TRIGGER IF NOT EXISTS obs_ai AFTER INSERT ON observations BEGIN
  INSERT INTO observations_fts(rowid, content, summary)
  VALUES (new.id, new.content, new.summary);
END;

CREATE TRIGGER IF NOT EXISTS obs_ad AFTER DELETE ON observations BEGIN
  INSERT INTO observations_fts(observations_fts, rowid, content, summary)
  VALUES('delete', old.id, old.content, old.summary);
END;

CREATE TRIGGER IF NOT EXISTS obs_au AFTER UPDATE ON observations BEGIN
  INSERT INTO observations_fts(observations_fts, rowid, content, summary)
  VALUES('delete', old.id, old.content, old.summary);
  INSERT INTO observations_fts(rowid, content, summary)
  VALUES (new.id, new.content, new.summary);
END;
```

### Pattern 3: Observability Event Subscriber
**What:** Subscribe to the SessionEventStore events to extract memory-worthy observations.
**When to use:** In the event hook, after observability handler runs.
**Example:**
```typescript
// The memory capture runs as a secondary observer in the event hook
// Same pattern as observabilityEventHandler but for memory extraction
export function createMemoryCaptureHandler(deps: MemoryCaptureDeps) {
  return async (input: { readonly event: { readonly type: string; readonly [key: string]: unknown } }): Promise<void> => {
    const { event } = input;
    switch (event.type) {
      case "session.created":
        // Register session, load project context
        break;
      case "session.error":
        // Extract error pattern as observation
        break;
      case "session.deleted":
        // End-of-session: extract accumulated observations
        break;
    }
  };
}
```

### Pattern 4: System Prompt Injection via experimental.chat.system.transform
**What:** The `experimental.chat.system.transform` hook lets plugins append strings to the system prompt array.
**When to use:** For memory injection -- append relevant memories as a system prompt section.
**Example:**
```typescript
// In index.ts plugin return
"experimental.chat.system.transform": async (
  input: { sessionID?: string; model: Model },
  output: { system: string[] },
) => {
  const memoryContext = await buildMemoryContext(input.sessionID);
  if (memoryContext) {
    output.system.push(memoryContext);
  }
},
```
**Note:** This hook mutates `output.system` by design (same as `config` hook mutating `config.agent`).

### Pattern 5: Token-Budgeted Context Building (reuse from adaptive-injector)
**What:** Build memory context string within a token budget using chars-per-token estimation.
**When to use:** For memory injection formatting.
**Example:**
```typescript
const CHARS_PER_TOKEN = 4; // Same estimate as adaptive-injector.ts

function buildMemoryContext(
  observations: readonly ScoredObservation[],
  tokenBudget: number = 2000,
): string {
  const charBudget = tokenBudget * CHARS_PER_TOKEN;
  let totalChars = 0;
  const sections: string[] = [];

  // Layer 1: Search results (summaries)
  // Layer 2: Timeline context
  // Layer 3: Detail items (if budget allows)

  for (const obs of observations) {
    const line = formatObservation(obs);
    if (totalChars + line.length > charBudget) break;
    sections.push(line);
    totalChars += line.length;
  }
  // ...
}
```

### Anti-Patterns to Avoid
- **Blocking summarization:** AI summarization MUST be async and non-blocking. Fall back to truncation (first 200 chars) if model unavailable. Use `setTimeout(fn, 0)` to defer writes.
- **Storing raw transcripts:** Only store structured observations with AI summaries (~50 tokens). Never store full conversation history.
- **Unbounded growth:** Always enforce storage caps (10k observations/project, pruning on session start).
- **Mutating observation objects:** Follow project immutability pattern -- always return new objects via spread.
- **Direct FTS5 table writes:** Always write to the main `observations` table; triggers sync to FTS5 automatically.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Full-text search | Custom tokenizer + inverted index | SQLite FTS5 with BM25 ranking | FTS5 handles tokenization, stemming, ranking, index maintenance |
| Token budget math | Custom token counter | `CHARS_PER_TOKEN = 4` estimation (from adaptive-injector.ts) | Exact counting is overkill; 4 chars/token is standard approximation |
| Atomic file operations | Manual lock files | bun:sqlite WAL mode + SQLite's built-in ACID transactions | SQLite handles concurrent access, crash recovery, data integrity |
| Schema migration | Custom migration runner | Version check table + sequential SQL scripts | Simple pattern, no framework needed |
| Project path hashing | Custom hash function | `createHash('sha256')` from node:crypto | Standard library, deterministic, no collisions in practice |

**Key insight:** bun:sqlite with FTS5 handles the hard problems (search, ranking, concurrency, persistence) -- the custom code is thin orchestration on top.

## Common Pitfalls

### Pitfall 1: Blocking the Event Loop with Synchronous SQLite
**What goes wrong:** bun:sqlite API is synchronous. Long-running queries block the OpenCode event loop, causing UI freezes.
**Why it happens:** FTS5 queries over thousands of rows or batch inserts can take >5ms.
**How to avoid:** Keep queries small (LIMIT 20), defer non-critical writes with `setTimeout(fn, 0)`, only do synchronous reads for injection (which must complete before prompt). The Phase 11 architecture doc benchmarked p99 < 5ms for reads over 5000 rows.
**Warning signs:** UI stuttering during memory operations, tool execution delays.

### Pitfall 2: FTS5 External Content Table Sync
**What goes wrong:** External content FTS5 tables (content=observations) do not auto-sync. Without triggers, FTS index becomes stale.
**Why it happens:** FTS5 external content mode is a lightweight reference -- it does not monitor the source table.
**How to avoid:** Use AFTER INSERT/UPDATE/DELETE triggers on the observations table (validated working in spike). Never write directly to the FTS5 table except via triggers or manual `INSERT INTO fts(fts) VALUES('rebuild')`.
**Warning signs:** Search returning stale or missing results.

### Pitfall 3: WAL Mode File Cleanup on In-Memory Databases
**What goes wrong:** `PRAGMA journal_mode=WAL` returns "memory" for `:memory:` databases, not "wal".
**Why it happens:** In-memory databases cannot use WAL.
**How to avoid:** Always use a file-based database for production. Reserve `:memory:` for tests only.
**Warning signs:** Tests passing but production not getting WAL benefits.

### Pitfall 4: Observation Noise from High-Frequency Events
**What goes wrong:** tool_complete events fire for every tool call (~50-100 per session). Storing all as observations floods memory with noise.
**Why it happens:** Not filtering which events are memory-worthy.
**How to avoid:** Only capture decision, error, and phase_transition events from observability. Skip tool_complete, context_warning, and session_start/end. For error events, only store unique error patterns (deduplicate by errorType + truncated message).
**Warning signs:** Memory DB growing rapidly, injection context full of low-value tool execution records.

### Pitfall 5: Config Schema Migration Breaking Existing Installs
**What goes wrong:** Adding a `memory` section to pluginConfigSchema requires a v5 migration. Existing v4 configs fail validation.
**Why it happens:** Zod strict parsing rejects unknown fields.
**How to avoid:** Add memory config as an optional section with defaults. Follow the established v1->v2->v3->v4 migration chain pattern. Create migrateV4toV5 function.
**Warning signs:** "Failed to load plugin config" errors after update.

### Pitfall 6: Summarization Token Cost Spiral
**What goes wrong:** AI summarization for every observation consumes significant tokens (50-100 per call). 20 observations/session = 1000-2000 tokens of overhead.
**Why it happens:** Summarization fires on every observation capture.
**How to avoid:** Batch summarization at session end (not per-event). Summarize accumulated observations in a single model call. Fall back to truncation (first 200 chars) if model unavailable or session ends abruptly.
**Warning signs:** Unexpectedly high token usage, slow session ends.

## Code Examples

### bun:sqlite Database Creation and FTS5 (Verified on Bun 1.3.11)
```typescript
// Verified working: Bun 1.3.11, SQLite 3.51.2
import { Database } from "bun:sqlite";

const db = new Database("/path/to/memory.db");
db.run("PRAGMA journal_mode=WAL");
db.run("PRAGMA foreign_keys=ON");

// Create tables
db.run(`CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  last_updated TEXT NOT NULL
)`);

db.run(`CREATE TABLE IF NOT EXISTS observations (
  id INTEGER PRIMARY KEY,
  project_id TEXT,
  session_id TEXT NOT NULL,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.5,
  access_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  last_accessed TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
)`);

// FTS5 with external content
db.run(`CREATE VIRTUAL TABLE IF NOT EXISTS observations_fts USING fts5(
  content, summary,
  content=observations,
  content_rowid=id
)`);
```

### FTS5 Search with BM25 Ranking (Verified)
```typescript
// Search with relevance ranking
const searchResults = db.query(`
  SELECT o.id, o.type, o.summary, o.confidence, o.access_count,
         o.created_at, o.last_accessed,
         bm25(observations_fts) as fts_rank
  FROM observations_fts f
  JOIN observations o ON o.id = f.rowid
  WHERE observations_fts MATCH ?
    AND o.project_id = ?
  ORDER BY fts_rank
  LIMIT ?
`).all(searchTerm, projectId, limit);
```

### SHA-256 Project Key Generation
```typescript
import { createHash } from "node:crypto";

export function computeProjectKey(projectPath: string): string {
  return createHash("sha256").update(projectPath).digest("hex");
}
```

### Relevance Score Computation
```typescript
// Decay formula from Phase 11 architecture
export function computeRelevanceScore(
  createdAt: string,
  lastAccessed: string,
  accessCount: number,
  type: ObservationType,
  halfLifeDays: number = 90,
): number {
  const ageMs = Date.now() - new Date(lastAccessed).getTime();
  const ageDays = ageMs / (24 * 60 * 60 * 1000);

  const timeDecay = Math.exp(-ageDays / halfLifeDays);
  const frequencyWeight = Math.log2(accessCount + 1);
  const typeWeight = TYPE_WEIGHTS[type];

  return timeDecay * Math.max(frequencyWeight, 1) * typeWeight;
}

const TYPE_WEIGHTS: Record<ObservationType, number> = {
  decision: 1.5,
  pattern: 1.2,
  error: 1.0,
  preference: 0.8,
  context: 0.6,
  tool_usage: 0.4,
};
```

### System Prompt Injection Hook
```typescript
// Plugin hook for memory injection
"experimental.chat.system.transform": async (
  input: { sessionID?: string; model: { providerID: string; modelID: string } },
  output: { system: string[] },
) => {
  try {
    const memoryContext = buildMemoryInjection(input.sessionID);
    if (memoryContext) {
      output.system.push(memoryContext);
    }
  } catch {
    // Best-effort: silently skip on any error (same pattern as skill injection)
  }
},
```

### Observability Event Subscription Pattern
```typescript
// Memory capture handler registered alongside existing event handler in index.ts
const memoryCaptureHandler = createMemoryCaptureHandler({
  getDb: () => getMemoryDb(),
  projectRoot: process.cwd(),
});

// In event hook:
event: async ({ event }) => {
  // 1. Observability (existing)
  await observabilityEventHandler({ event });
  // 2. Memory capture (new -- pure observer, no side effects on session)
  await memoryCaptureHandler({ event });
  // 3. First-load toast (existing)
  // 4. Fallback handling (existing)
},
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CLAUDE.md file generation for memory | System prompt injection via hooks | claude-mem v10.6.0 (2025) | More reliable, no file management |
| Chroma vector DB for semantic search | SQLite FTS5 for keyword search | Phase 11 architecture decision | Zero dependencies, Bun-compatible |
| Lesson memory (JSON files per-project) | SQLite-backed unified memory | Phase 15 (this phase) | Cross-session persistence, full-text search |
| Review memory (JSON files per-project) | SQLite-backed unified memory | Phase 15 (this phase) | Unified store, relevance scoring |

**Deprecated/outdated:**
- File-based memory injection (CLAUDE.md): Replaced by system prompt hooks
- Lesson memory JSON format: Will be superseded (not migrated per D-22)
- Review memory JSON format: Will be superseded (not migrated per D-22)

## Open Questions

1. **Batch vs per-event summarization**
   - What we know: Per-event summarization costs 50-100 tokens each, 20 events/session = 1000-2000 tokens overhead
   - What's unclear: Whether batching at session end loses important real-time context
   - Recommendation: Batch at session end. Observations accumulate in memory with raw content, then a single summarization call compresses all at once. If session ends abruptly, fall back to truncation.

2. **User cue detection ("remember this", "forget X")**
   - What we know: D-15 requires respecting explicit user cues
   - What's unclear: How to detect these in the event stream (user messages are not directly in observability events)
   - Recommendation: Hook into `chat.message` to scan user message text for trigger phrases. Simple regex matching: `/\b(remember|note|save|store)\b.*\b(this|that|pattern|convention)\b/i` for boost, `/\b(forget|remove|delete)\b.*\b(memory|pattern|convention)\b/i` for deletion.

3. **Which observability events are worth memorizing**
   - What we know: Event types are: fallback, error, decision, model_switch, context_warning, tool_complete, phase_transition, session_start, session_end
   - Recommendation: Only capture `decision` (type: decision -> observation type: decision), `error` with unique patterns (type: error -> observation type: error), and `phase_transition` (type: phase_transition -> observation type: pattern). Skip tool_complete (noise), context_warning (transient), model_switch (operational), session_start/end (metadata only).

4. **Injection timing with experimental.chat.system.transform**
   - What we know: This hook fires before LLM calls. The `input.sessionID` identifies the session.
   - What's unclear: Whether this fires for every LLM call or just the first. If every call, memory injection should be cached per session.
   - Recommendation: Cache the built memory context per sessionID. Rebuild only on session start.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| bun:sqlite | Storage layer | Yes | SQLite 3.51.2 (Bun 1.3.11) | -- |
| FTS5 extension | Full-text search | Yes (compiled in) | Built into SQLite 3.51.2 | LIKE-based search |
| node:crypto | Project key hashing | Yes | Built-in | -- |
| experimental.chat.system.transform hook | Memory injection | Yes | @opencode-ai/plugin current | config hook agent prompt modification |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

## Sources

### Primary (HIGH confidence)
- bun:sqlite API: [Bun SQLite docs](https://bun.com/docs/runtime/sqlite) - Database class, query/run/exec methods, WAL mode
- bun:sqlite FTS5: **Validated on local machine** - Bun 1.3.11 with SQLite 3.51.2, FTS5 CREATE VIRTUAL TABLE, BM25 ranking, external content tables, triggers all working
- SQLite FTS5: [SQLite FTS5 Extension docs](https://www.sqlite.org/fts5.html) - MATCH queries, BM25, content tables, triggers
- @opencode-ai/plugin types: `node_modules/@opencode-ai/plugin/dist/index.d.ts` - Hooks interface including `experimental.chat.system.transform`
- Phase 11 Memory Architecture: `.planning/phases/11-ecosystem-research/11-MEMORY-ARCHITECTURE.md` - Schema, decay formulas, token budget math, anti-patterns
- Existing codebase patterns: `src/observability/event-handlers.ts`, `src/skills/adaptive-injector.ts`, `src/config.ts`, `src/review/memory.ts`

### Secondary (MEDIUM confidence)
- Bun v0.6.12 release notes: FTS5 enabled on Linux build ([GitHub discussion](https://github.com/oven-sh/bun/discussions/3468))
- Bun SQLite version: SQLite 3.45.0 in Bun 1.1.7 per [GitHub discussion #8177](https://github.com/oven-sh/bun/discussions/8177) (our local is 3.51.2, newer)

### Tertiary (LOW confidence)
- None -- all critical claims verified locally or via official sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - bun:sqlite + FTS5 validated locally, all deps already available
- Architecture: HIGH - follows established codebase patterns (event handlers, adaptive injector, config migration chain)
- Pitfalls: HIGH - drawn from Phase 11 architecture doc + local validation of edge cases (WAL on memory DB, FTS sync)

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (stable -- bun:sqlite API unlikely to change)
