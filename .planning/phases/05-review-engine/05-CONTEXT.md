# Phase 5: Review Engine - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Standalone multi-agent code review engine. Users invoke `oc_review` to get findings from 6+ specialist agents, cross-verified, red-teamed, and auto-fixed. Works independently of the orchestrator AND integrates as a BUILD-phase stage.

Requirements: REVW-01, REVW-02, REVW-03, REVW-04, REVW-05, REVW-06, REVW-07, REVW-08, REVW-09, REVW-10, REVW-11

</domain>

<decisions>
## Implementation Decisions

### Review Agent Architecture (REVW-03)
- **D-01:** Review specialist agents are an INTERNAL REGISTRY only. They are NOT injected via configHook. Users never see them in @ autocomplete. Only the review tool knows about and dispatches them.
- **D-02:** Each agent is a TypeScript object: `{ name, description, prompt, relevantStacks, severityFocus }`. The prompt is a template string that receives the diff/file content as context. No markdown files, no OpenCode AgentConfig -- pure internal data structures.
- **D-03:** Agent registry lives in `src/review/agents/` with one file per agent (e.g., `logic-auditor.ts`, `security-auditor.ts`). An `index.ts` barrel exports all agents as a readonly array.

### Team Lead Selection (REVW-02, REVW-05)
- **D-04:** Two-pass deterministic selection. No LLM involved in agent picking.
  - Pass 1 (stack gate): File-based detection scans project root for markers (package.json, Cargo.toml, go.mod, pyproject.toml, file extensions). Eliminates agents whose `relevantStacks` don't match.
  - Pass 2 (diff heuristic): Analyzes changed file patterns to boost agents whose focus matches (e.g., security agent boosted if auth/ files changed, test agent boosted if test files are absent).
- **D-05:** Stack detection is pure TypeScript using `node:fs/promises` -- scan for marker files and changed file extensions. No shell scripts, no external tools.

### Review Pipeline Flow (REVW-04, REVW-06, REVW-07, REVW-08)
- **D-06:** 4-stage pipeline:
  - Stage 1: Parallel specialist dispatch (selected agents run concurrently on the diff/files)
  - Stage 2: Cross-verification (each agent sees all other agents' findings, can upgrade severity or add new findings)
  - Stage 3: Red team + product thinker (adversarial final pass + UX journey check)
  - Stage 4: Fix cycle (auto-fix CRITICAL/HIGH, re-verify affected agents)
  Each stage's output feeds into the next as context.

### Fix Cycle (REVW-09)
- **D-07:** Auto-fix + re-verify, MAX 1 CYCLE. Apply fixes for CRITICAL/HIGH findings automatically. Re-run only the agents whose findings were fixed to verify no regressions. Remaining issues reported as-is. No multi-cycle oscillation risk.

### Standalone Invocation (REVW-01, REVW-10)
- **D-08:** `oc_review` registered tool. Accepts scope options and returns consolidated report as JSON. Can be called by orchestrator BUILD phase AND by users directly.
- **D-09:** Scope options: `staged` (default), `unstaged`, `branch` (diff vs main), `all` (staged + unstaged), `directory` (review all files in a path). Plus optional file filter pattern.

### Severity Format (REVW-04)
- **D-10:** Standardized finding format: `{ file, line, severity: CRITICAL|HIGH|MEDIUM|LOW, agent, finding, suggestion }`. Zod schema validates all findings before aggregation.

### Consolidated Report (REVW-10)
- **D-11:** Report groups findings by file, sorted by severity within each file. Includes total counts per severity, list of agents that ran, and scope that was reviewed. Output is JSON (tool response) -- pretty formatting is the caller's responsibility.

### Per-Project Memory (REVW-11)
- **D-12:** Review findings, false positive markers, and project profile stored at `.opencode-assets/review-memory.json`. Zod-validated. Updated after each review run. Used to suppress known false positives and track recurring issues.

### Carrying Forward from Phase 4
- **D-13:** `node:fs/promises` for all I/O (no Bun.file())
- **D-14:** Zod for all schema validation
- **D-15:** `Object.freeze()` + `Readonly<T>` for immutable configs
- **D-16:** `*Core` + `tool()` wrapper for tools
- **D-17:** Config hook for agent injection (but NOT for review agents -- only for orchestrator-level agents)
- **D-18:** `.opencode-assets/` for per-project artifacts

### Claude's Discretion
- Exact prompts for each of the 6+ review agents
- Internal module structure within `src/review/`
- How cross-verification and red team agents receive prior findings (inline vs file reference)
- Which 6 universal agents to include (research suggested: logic, security, quality, test coverage, silent failure, contract/type)
- How the fix cycle determines which fixes to apply vs skip
- Whether findings deduplication is needed across agents

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source Plugin Reference (Port From)
- `/home/joseibanez/develop/projects/claude-ace/agents/team-lead.md` -- Team lead agent selection pattern
- `/home/joseibanez/develop/projects/claude-ace/agents/logic-auditor.md` -- Logic auditor prompt reference
- `/home/joseibanez/develop/projects/claude-ace/agents/security-auditor.md` -- Security auditor prompt reference
- `/home/joseibanez/develop/projects/claude-ace/agents/code-quality-auditor.md` -- Quality auditor prompt reference
- `/home/joseibanez/develop/projects/claude-ace/agents/test-interrogator.md` -- Test coverage auditor prompt reference
- `/home/joseibanez/develop/projects/claude-ace/agents/silent-failure-hunter.md` -- Silent failure auditor prompt reference
- `/home/joseibanez/develop/projects/claude-ace/agents/contract-verifier.md` -- Contract/type verifier prompt reference
- `/home/joseibanez/develop/projects/claude-ace/agents/red-team.md` -- Red team adversarial pass reference
- `/home/joseibanez/develop/projects/claude-ace/agents/product-thinker.md` -- Product thinker UX pass reference
- `/home/joseibanez/develop/projects/claude-ace/references/severity-definitions.md` -- Severity level definitions
- `/home/joseibanez/develop/projects/claude-ace/references/finding-format.md` -- Finding output format
- `/home/joseibanez/develop/projects/claude-ace/references/stack-gate.md` -- Stack detection patterns

### Existing Codebase (Build On)
- `src/orchestrator/schemas.ts` -- Extend with review-specific schemas (finding, report)
- `src/tools/orchestrate.ts` -- Dispatch pattern reference for review tool
- `src/agents/index.ts` -- Config hook pattern (NOT for review agents, but reference)
- `src/agents/pr-reviewer.ts` -- Existing single-agent reviewer (may be replaced/upgraded)

### Research
- `.planning/research/FEATURES.md` -- Ace feature mapping (which agents are essential vs nice-to-have)
- `.planning/research/ARCHITECTURE.md` -- Review engine integration architecture
- `.planning/research/PITFALLS.md` -- Agent cascade bomb risk, dispatch budget

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/orchestrator/schemas.ts` -- Extend with reviewFindingSchema, reviewReportSchema
- `src/orchestrator/confidence.ts` -- Pattern for append-only data structures (apply to findings)
- `src/utils/paths.ts` -- getProjectArtifactDir() for review memory storage
- `src/utils/fs-helpers.ts` -- ensureDir for review output directories
- `src/tools/orchestrate.ts` -- Tool-returns-instruction pattern (adapt for review dispatch)

### Established Patterns
- Tool registration: `*Core` + `tool()` wrapper (all Phase 4 tools follow this)
- Zod validation on every read/write (state.ts, config.ts)
- Atomic file writes with tmp+rename (state.ts, config.ts)
- Immutable data structures with spreads and Object.freeze

### Integration Points
- `src/index.ts` -- Register oc_review tool
- `src/orchestrator/schemas.ts` -- Add review finding/report schemas
- `.opencode-assets/review-memory.json` -- Per-project review memory

</code_context>

<specifics>
## Specific Ideas

- The ace agents have battle-tested prompts (30 agents, thousands of reviews). Port the LOGIC of the 6 essential agents' prompts, not the exact markdown. Adapt for the TypeScript object format.
- The review tool should use the same Agent dispatch mechanism that the orchestrator uses -- but internally, not through configHook. The tool orchestrates the 4-stage pipeline deterministically.
- Stack detection should be fast -- no parsing package.json contents, just checking file existence for the marker files.
- The fix cycle should not re-run ALL agents -- only the ones whose specific findings were addressed.

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 05-review-engine*
*Context gathered: 2026-03-31*
