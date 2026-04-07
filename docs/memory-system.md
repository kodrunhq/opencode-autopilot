# Memory System

The OpenCode Autopilot memory system provides persistent, intelligent context that makes the plugin smarter over time. It captures meaningful observations — user preferences, architectural decisions, project facts, mistakes, and workflow rules — and injects them into future sessions so the AI assistant builds on accumulated knowledge.

## Design Philosophy

The V2 memory system is **tool-based, not regex-based**. Instead of pattern-matching user prompts for preference-like strings (the V1 approach), V2 delegates memory curation to the AI model itself. The model decides what is worth remembering and calls explicit tools to save, search, and forget memories. This produces higher-quality, semantically meaningful memories.

## Memory Kinds

Every memory belongs to exactly one of five kinds, listed here in injection priority order (highest first):

| Kind | Weight | Description |
|------|--------|-------------|
| `mistake` | 1.5 | Errors to avoid — failed approaches, misunderstood APIs, footguns |
| `workflow_rule` | 1.4 | Process requirements — "always run tests before PR", "deploy to staging first" |
| `decision` | 1.3 | Architectural and tooling choices with rationale |
| `project_fact` | 1.1 | Tech stack, conventions, project structure |
| `preference` | 1.0 | User likes/dislikes — coding style, tool choices, communication preferences |

## Scopes and Statuses

**Scopes:**
- `project` — Specific to a single repository. Scoped by project identity (derived from git remote or directory path).
- `user` — Applies globally across all projects.

**Statuses:**
- `active` — Currently used for context injection.
- `superseded` — Replaced by a newer memory (linked via `supersedes_memory_id`).
- `rejected` — Soft-deleted via `oc_memory_forget`.

## Tools

The model interacts with memory through three tools:

### `oc_memory_save`

Saves a new memory or merges into an existing duplicate.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `kind` | enum | Yes | One of: `preference`, `decision`, `project_fact`, `mistake`, `workflow_rule` |
| `content` | string (1-4000) | Yes | Full memory content with enough context for future sessions |
| `summary` | string (1-500) | Yes | One-line summary (displayed during injection) |
| `reasoning` | string (max 1000) | No | Why this is worth remembering |
| `tags` | string[] (max 10) | No | Categorization tags (e.g., `["typescript", "testing"]`) |
| `scope` | enum | No | `project` or `user` (default: `user`) |

The tool automatically captures the current session ID for provenance tracking.

### `oc_memory_search`

Searches memories using FTS5 full-text search, scoped by project.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Search query |
| `scope` | enum | No | `project`, `user`, or `all` (default: `all`) |
| `limit` | number | No | Max results (default: 10) |

### `oc_memory_forget`

Soft-deletes a memory by setting its status to `rejected`.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `textId` | string | Yes | The memory's unique text identifier |

## Deduplication

When saving a memory, the system checks for existing duplicates using Jaccard bigram overlap:

1. **Normalize** both the new content and existing memories (lowercase, strip punctuation, collapse whitespace).
2. **Compute** bigram overlap (Jaccard index) between the new content and each active memory of the same kind and scope.
3. If overlap >= **0.6** (configurable via `DEDUP_JACCARD_THRESHOLD`), the new content is **merged** into the existing memory rather than creating a duplicate.
4. Dedup is **kind-aware** — a `decision` and a `workflow_rule` with similar text are kept separate.

### Merge Behavior

When a duplicate is found:
- **Confidence** is raised to the maximum of old and new values.
- **Content** is replaced only if the new content is substantially different (overlap < 0.85); otherwise the longer version is kept.
- **Evidence** is added as a new `memory_evidence` row (deduplicated by statement hash).
- **Evidence count** is incremented only when the evidence insert succeeds (not on hash collision).

## Evidence Tracking

Each memory maintains an evidence trail — a list of statements that support it, each with:
- A SHA-256 hash of the statement (for dedup via `UNIQUE(memory_id, statement_hash)`)
- The session ID where the statement was captured
- A confidence score
- A creation timestamp

Evidence count only increments when a genuinely new statement is recorded, preventing drift from repeated saves of identical content.

## Database Schema

Memory is stored in SQLite via `bun:sqlite`. Three tables form the V2 schema:

### `memories`

The primary table storing all memory records.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | Auto-increment row ID |
| `text_id` | TEXT UNIQUE | UUID-based external identifier |
| `project_id` | TEXT | FK to `projects(id)`, null for user-scope |
| `kind` | TEXT | One of the 5 memory kinds |
| `scope` | TEXT | `project` or `user` |
| `content` | TEXT | Full memory content |
| `summary` | TEXT | One-line summary for injection display |
| `reasoning` | TEXT | Why this memory was saved |
| `confidence` | REAL | 0.0-1.0, default 0.8 |
| `evidence_count` | INTEGER | Number of supporting evidence statements |
| `tags` | TEXT | JSON array of tag strings |
| `source_session` | TEXT | Session ID where the memory was first created |
| `status` | TEXT | `active`, `superseded`, or `rejected` |
| `supersedes_memory_id` | TEXT | Links to the memory this one replaced |
| `access_count` | INTEGER | How many times injected into sessions |
| `created_at` | TEXT | ISO 8601 creation timestamp |
| `last_updated` | TEXT | ISO 8601 last modification timestamp |
| `last_accessed` | TEXT | ISO 8601 last injection timestamp |

### `memory_evidence`

Supporting statements for each memory.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT PK | UUID |
| `memory_id` | INTEGER FK | References `memories(id)` with CASCADE delete |
| `session_id` | TEXT | Session where statement was captured |
| `statement` | TEXT | The original statement text |
| `statement_hash` | TEXT | SHA-256 hash for dedup |
| `confidence` | REAL | Statement-level confidence |
| `created_at` | TEXT | ISO 8601 timestamp |

Constraint: `UNIQUE(memory_id, statement_hash)` — prevents duplicate evidence.

### `memories_fts`

FTS5 virtual table for full-text search over `content`, `summary`, and `tags`.

```sql
CREATE VIRTUAL TABLE memories_fts USING fts5(
  content, summary, tags,
  content=memories, content_rowid=id
);
```

## System Prompt Injection

Memory context is injected into the model via the `experimental.chat.system.transform` hook.

### V2/V1 Selection Logic

1. Check if the `memories` table exists in the database.
2. If yes, attempt V2 retrieval (from `memories` table).
3. If V2 returns empty, fall back to V1 retrieval (from `observations`/`preferences`/`lessons` tables).
4. If the `memories` table doesn't exist, use V1 directly.

This ensures the memory instructions block (which teaches the model about `oc_memory_save`) is always injected when V2 is available, even with zero memories — bootstrapping the system from the very first session.

### Kind-Priority Injection

V2 retrieval groups memories by kind and displays them in weight order:

1. **Mistakes to Avoid** (weight 1.5)
2. **Workflow Rules** (weight 1.4)
3. **Decisions** (weight 1.3)
4. **Preferences** (weight 1.0)
5. **Project Facts** (weight 1.1)

Within each group, memories are sorted by `last_updated` descending.

### Memory Instructions Block

When V2 is active, the injected context includes instructions telling the model when to call `oc_memory_save`:
- User states a preference or correction
- A decision is made about architecture, tooling, or workflow
- A project fact is discovered (tech stack, conventions, structure)
- A mistake is identified that should be avoided
- The user establishes a workflow rule
- The user explicitly says "remember this"

The model is instructed to NOT save trivial or transient information.

### Token Budgeting

- Default budget: **2,000 tokens** (configurable via `memory.injectionBudget`).
- Conversion: 4 characters per token.
- Memories are injected in priority order until the budget is exhausted.
- The instructions block is appended only if budget permits.

### Best-Effort Guarantee

Memory injection is designed to never block or crash the session. All injection errors are caught silently and logged as warnings. If retrieval fails, the session continues with an empty memory context.

### Caching

Memory context is retrieved once per session and cached by session ID. The cache is invalidated when a new memory is saved (via `invalidateMemoryCache`).

## V1 Backward Compatibility

The V1 system (observations, preferences, lessons) remains intact for backward compatibility. Projects that haven't yet accumulated V2 memories will continue using V1 retrieval until their first `oc_memory_save` call populates the `memories` table.

### V1 Migration

On plugin load, a one-time migration converts confirmed V1 `preference_records` into V2 `memories`:
- Only `confirmed` preferences are migrated (not `candidate`).
- Global preferences become `user`-scoped memories.
- Project preferences become `project`-scoped memories.
- Dedup is checked before each insert to avoid duplicating preferences already saved as V2 memories.

## Configuration Options

Memory behavior can be tuned in the plugin configuration:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `memory.enabled` | boolean | `true` | Enable or disable the memory system |
| `memory.injectionBudget` | number (500-5000) | `2000` | Maximum tokens allocated for memory injection |
| `memory.decayHalfLifeDays` | number (7-365) | `90` | V1 only: days until an observation loses half its relevance |

---
[Documentation Index](README.md)
