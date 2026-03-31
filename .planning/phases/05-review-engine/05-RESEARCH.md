# Phase 5: Review Engine - Research

**Researched:** 2026-03-31
**Domain:** Multi-agent code review engine (internal registry, deterministic selection, 4-stage pipeline)
**Confidence:** HIGH

## Summary

Phase 5 builds a standalone multi-agent code review engine as an internal subsystem of the opencode-assets plugin. The review engine has no dependency on the orchestrator pipeline for standalone use -- users invoke `oc_review` directly to get findings from specialist agents. The architecture follows all decisions locked in CONTEXT.md: internal agent registry (not configHook), TypeScript objects for agent definitions, two-pass deterministic selection (stack gate + diff heuristic), 4-stage pipeline (parallel dispatch, cross-verification, red team + product thinker, fix cycle), and per-project memory at `.opencode-assets/review-memory.json`.

The primary source material is the claude-ace repository (30 review agents, 8-phase pipeline). Phase 5 ports the **logic and behavioral contracts** of 8 essential agents (6 universal specialists + red team + product thinker) into TypeScript objects with inline prompt templates. The team-lead selection mechanism becomes a pure TypeScript function -- no LLM involved in agent picking. All shell scripts (detect-stack.sh, classify-changes.sh) are replaced by TypeScript functions using `node:fs/promises` and `node:child_process` for git operations.

**Primary recommendation:** Build bottom-up: schemas first, then stack detection, then agent registry, then selection logic, then the 4-stage pipeline, then the `oc_review` tool, then per-project memory. Each layer is independently testable.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Review specialist agents are an INTERNAL REGISTRY only. They are NOT injected via configHook. Users never see them in @ autocomplete. Only the review tool knows about and dispatches them.
- D-02: Each agent is a TypeScript object: `{ name, description, prompt, relevantStacks, severityFocus }`. The prompt is a template string that receives the diff/file content as context. No markdown files, no OpenCode AgentConfig -- pure internal data structures.
- D-03: Agent registry lives in `src/review/agents/` with one file per agent (e.g., `logic-auditor.ts`, `security-auditor.ts`). An `index.ts` barrel exports all agents as a readonly array.
- D-04: Two-pass deterministic selection. No LLM involved in agent picking. Pass 1 (stack gate): File-based detection scans project root for markers. Pass 2 (diff heuristic): Analyzes changed file patterns to boost agents.
- D-05: Stack detection is pure TypeScript using `node:fs/promises` -- scan for marker files and changed file extensions. No shell scripts, no external tools.
- D-06: 4-stage pipeline: Stage 1 parallel specialist dispatch, Stage 2 cross-verification, Stage 3 red team + product thinker, Stage 4 fix cycle.
- D-07: Auto-fix + re-verify, MAX 1 CYCLE. Apply fixes for CRITICAL/HIGH findings automatically. Re-run only the agents whose findings were fixed.
- D-08: `oc_review` registered tool. Accepts scope options and returns consolidated report as JSON.
- D-09: Scope options: `staged` (default), `unstaged`, `branch` (diff vs main), `all` (staged + unstaged), `directory` (review all files in a path). Plus optional file filter pattern.
- D-10: Standardized finding format: `{ file, line, severity: CRITICAL|HIGH|MEDIUM|LOW, agent, finding, suggestion }`. Zod schema validates all findings before aggregation.
- D-11: Report groups findings by file, sorted by severity within each file. Includes total counts per severity, list of agents that ran, and scope that was reviewed. Output is JSON.
- D-12: Review findings, false positive markers, and project profile stored at `.opencode-assets/review-memory.json`. Zod-validated. Updated after each review run.
- D-13: `node:fs/promises` for all I/O (no Bun.file())
- D-14: Zod for all schema validation
- D-15: `Object.freeze()` + `Readonly<T>` for immutable configs
- D-16: `*Core` + `tool()` wrapper for tools
- D-17: Config hook for agent injection (but NOT for review agents -- only for orchestrator-level agents)
- D-18: `.opencode-assets/` for per-project artifacts

### Claude's Discretion
- Exact prompts for each of the 6+ review agents
- Internal module structure within `src/review/`
- How cross-verification and red team agents receive prior findings (inline vs file reference)
- Which 6 universal agents to include (research suggested: logic, security, quality, test coverage, silent failure, contract/type)
- How the fix cycle determines which fixes to apply vs skip
- Whether findings deduplication is needed across agents

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REVW-01 | User can invoke the review engine standalone | `oc_review` tool with `*Core` + `tool()` wrapper pattern; scope arg schema |
| REVW-02 | Team lead analyzes stack and diff to select agents | Two-pass deterministic selection: stack detection + diff heuristic functions |
| REVW-03 | At least 6 universal review agents ship by default | 6 agents: logic-auditor, security-auditor, code-quality-auditor, test-interrogator, silent-failure-hunter, contract-verifier; prompts ported from ace |
| REVW-04 | Agents dispatch in parallel with standardized severity format | Finding schema with Zod; pipeline returns dispatch instructions for parallel execution |
| REVW-05 | Stack-gated selection excludes irrelevant agents | Stack gate table from ace; file-based marker detection in TypeScript |
| REVW-06 | Cross-verification pass after parallel review | Stage 2: each agent receives all findings as context, can upgrade severity or add new |
| REVW-07 | Red team agent runs as final adversarial pass | Stage 3: red-team agent receives all findings from Stages 1-2, hunts inter-domain gaps |
| REVW-08 | Product thinker traces user journeys after technical review | Stage 3: product-thinker agent runs alongside red-team, checks CRUD completeness |
| REVW-09 | Fix cycle auto-applies fixes and re-verifies | Stage 4: max 1 cycle, fix CRITICAL/HIGH only, re-run affected agents only |
| REVW-10 | Consolidated report groups findings by file with severity | Report schema: grouped by file, sorted by severity, includes totals and agent list |
| REVW-11 | Per-project memory stores findings and false positives | `.opencode-assets/review-memory.json` with Zod schema, updated after each run |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Runtime:** Bun only -- no build step needed
- **No standalone Zod install:** `import { z } from "zod"` (transitive dep of `@opencode-ai/plugin`)
- **No `Bun.file()`/`Bun.write()`:** Use `node:fs/promises`
- **Model agnostic:** Never hardcode model identifiers in agents
- **`oc_` prefix:** All tool names start with `oc_`
- **Immutability:** Build objects with spreads, `Object.freeze()`, `Readonly<T>`, `readonly` arrays
- **Tool pattern:** `*Core` + `tool()` wrapper per CLAUDE.md
- **File size:** 200-400 lines typical, 800 max
- **Functions:** <50 lines each
- **No mutation:** Spread-based updates only
- **Atomic writes:** tmp-file-then-rename for state files

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | transitive via @opencode-ai/plugin | Schema validation for findings, reports, memory | Already used throughout codebase; D-14 mandates it |
| node:fs/promises | built-in | File I/O for stack detection, memory persistence | D-13, D-05 mandate it |
| node:child_process | built-in | Git diff/status commands for scope resolution | Needed for `git diff`, `git diff --cached`, `git diff main...HEAD` |
| node:path | built-in | Path construction for project scanning | Already used throughout codebase |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @opencode-ai/plugin | existing dep | Tool registration (`tool()` function) | For `oc_review` tool wrapper |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| node:child_process for git | simple-git npm package | Adds a dependency; project prefers zero new runtime deps |
| Manual stack detection | detect-stack bash script | D-05 prohibits shell scripts |

**Installation:**
No new dependencies needed. All functionality uses Node built-ins and existing transitive deps.

## Architecture Patterns

### Recommended Module Structure
```
src/review/
  agents/                    # Agent definitions (D-03)
    logic-auditor.ts         # ReviewAgent object
    security-auditor.ts
    code-quality-auditor.ts
    test-interrogator.ts
    silent-failure-hunter.ts
    contract-verifier.ts
    red-team.ts              # Stage 3 agent
    product-thinker.ts       # Stage 3 agent
    index.ts                 # Barrel: exports REVIEW_AGENTS readonly array
  schemas.ts                 # Zod schemas: finding, report, memory, review-agent
  stack-detection.ts         # detectProjectStack(): pure TS file scanning
  diff-resolver.ts           # getDiff(scope, filter): wraps git commands
  selection.ts               # selectAgents(stack, diff): two-pass deterministic
  pipeline.ts                # runReview(): 4-stage pipeline orchestrator
  cross-verification.ts      # buildCrossVerificationPrompts()
  fix-cycle.ts               # applyFixes() + re-verify logic
  report.ts                  # buildReport(): aggregate findings into structured output
  memory.ts                  # loadMemory(), saveMemory(): per-project persistence
src/tools/
  review.ts                  # oc_review tool: *Core + tool() wrapper
```

### Pattern 1: Internal Agent Registry (NOT configHook)

**What:** Review agents are TypeScript objects in an internal array, never exposed to OpenCode's agent system.
**When:** All review agent definitions.
**Why:** D-01 mandates this. Users must not see review agents in @ autocomplete.

```typescript
// src/review/agents/logic-auditor.ts
import type { ReviewAgent } from "../schemas";

export const logicAuditor: Readonly<ReviewAgent> = Object.freeze({
  name: "logic-auditor",
  description: "Audits business logic correctness, edge cases, boundary conditions",
  relevantStacks: [], // empty = universal, runs on all stacks
  severityFocus: ["CRITICAL", "HIGH"],
  prompt: `You are the Logic Auditor. Verify that the changed code does what it claims to do.

## Instructions
Analyze the following diff for logic errors:
- Trace every changed function line by line
- Check loop termination and off-by-one errors
- Check boundary correctness (< vs <=)
- Check null/undefined on every property access
- Check async/await correctness

## Output
For each finding, output JSON:
{ "file": "path", "line": 42, "severity": "HIGH", "agent": "logic-auditor", "finding": "...", "suggestion": "..." }

If no findings: { "findings": [] }

## Diff to Review
{{DIFF}}`,
});
```

### Pattern 2: Two-Pass Deterministic Selection

**What:** TypeScript function that selects agents without LLM involvement.
**When:** Before pipeline dispatch (D-04).
**Why:** Eliminates a team-lead agent dispatch, saves tokens, makes selection reproducible.

```typescript
// src/review/selection.ts
interface SelectionResult {
  readonly selected: readonly ReviewAgent[];
  readonly excluded: readonly { agent: string; reason: string }[];
}

export function selectAgents(
  stack: ProjectStack,
  diffAnalysis: DiffAnalysis,
  allAgents: readonly ReviewAgent[],
): SelectionResult {
  // Pass 1: Stack gate -- eliminate agents whose relevantStacks don't overlap
  const stackFiltered = allAgents.filter(
    (agent) =>
      agent.relevantStacks.length === 0 || // universal
      agent.relevantStacks.some((s) => stack.detectedStacks.includes(s)),
  );

  // Pass 2: Diff heuristic -- boost/include based on changed file patterns
  // Security agent boosted if auth/ or .env files changed
  // Test agent boosted if test files are absent for changed source files
  const scored = stackFiltered.map((agent) => ({
    agent,
    score: computeDiffRelevance(agent, diffAnalysis),
  }));

  // All stack-passing agents run (no threshold) -- the stack gate is the filter
  return {
    selected: scored.map((s) => s.agent),
    excluded: allAgents
      .filter((a) => !stackFiltered.includes(a))
      .map((a) => ({ agent: a.name, reason: `Stack gate: ${a.relevantStacks.join(",")} not in project` })),
  };
}
```

### Pattern 3: Pipeline Stage Returns Dispatch Instructions

**What:** The review pipeline returns structured instructions for the caller to dispatch agents. The tool itself does NOT dispatch agents.
**When:** Every pipeline stage.
**Why:** Tools cannot call the Agent tool in OpenCode. The calling agent (orchestrator or user) must dispatch.

```typescript
// src/review/pipeline.ts
interface ReviewStageResult {
  readonly stage: "dispatch" | "cross-verify" | "red-team" | "fix" | "complete";
  readonly agents?: readonly { name: string; prompt: string }[];
  readonly report?: ReviewReport;
}
```

### Pattern 4: Finding Schema with Zod

**What:** Every finding is validated through a Zod schema before aggregation.
**When:** After every agent returns findings (D-10).

```typescript
// src/review/schemas.ts
export const severitySchema = z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]);

export const reviewFindingSchema = z.object({
  file: z.string().max(512),
  line: z.number().int().nonnegative(),
  severity: severitySchema,
  agent: z.string().max(64),
  finding: z.string().max(4096),
  suggestion: z.string().max(4096),
});

export const reviewReportSchema = z.object({
  scope: z.string().max(128),
  agentsRan: z.array(z.string().max(64)).readonly(),
  findings: z.array(reviewFindingSchema).readonly(),
  summary: z.object({
    CRITICAL: z.number().int().nonnegative(),
    HIGH: z.number().int().nonnegative(),
    MEDIUM: z.number().int().nonnegative(),
    LOW: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  }),
  reviewedAt: z.string().max(128),
});
```

### Anti-Patterns to Avoid

- **Injecting review agents via configHook:** D-01 prohibits this. Review agents are internal implementation details, invisible to users.
- **LLM-based agent selection:** D-04 mandates deterministic selection. No team-lead agent dispatch. The selection is a pure function.
- **Unbounded fix cycles:** D-07 caps at MAX 1 CYCLE. Never allow oscillation.
- **Shell scripts for stack detection:** D-05 mandates pure TypeScript. No `detect-stack.sh`.
- **Monolithic pipeline function:** The pipeline has 4 distinct stages. Each stage should be a separate function that receives prior stage output and returns dispatch instructions. Do not put all 4 stages in one function.
- **Mutating findings arrays:** All findings collections must be readonly arrays built with spreads.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schema validation | Custom validation functions | Zod schemas (D-14) | Type inference, parse/safeParse, max length constraints |
| Git diff parsing | Custom diff parser | `execSync`/`execFile` with `git diff` flags | Git's own diff formatting handles all edge cases |
| Atomic file writes | Manual tmp+rename | Existing pattern from `state.ts` (tmp + `rename()`) | Battle-tested in Phase 4 code |
| JSON serialization | Custom serializer | `JSON.stringify`/`JSON.parse` + Zod parse | Bidirectional validation already established |
| Finding deduplication | Complex dedup algorithm | Simple Map keyed on `${file}:${line}:${agent}` | Findings from different agents at same location are valid (different perspectives) |

## Common Pitfalls

### Pitfall 1: Agent Cascade Bomb (from PITFALLS.md Pitfall 8)
**What goes wrong:** Fix cycle dispatches agents, which find new issues, which trigger more fixes. Even with MAX 1 CYCLE, if Stage 4 re-runs all agents instead of only affected ones, token cost explodes.
**Why it happens:** Not tracking which agents' findings were fixed.
**How to avoid:** D-07 specifies re-run ONLY agents whose specific findings were addressed. Track a `fixedByAgent` set during fix application. Only re-dispatch those agents.
**Warning signs:** More than 8 agent dispatches in the fix cycle.

### Pitfall 2: Token Budget Explosion from Prompt Concatenation
**What goes wrong:** Cross-verification (Stage 2) passes ALL prior findings to EVERY agent. With 6 agents each producing 5 findings, that's 30 findings injected into 6 prompts = 180 finding-copies plus the original diff in each prompt.
**Why it happens:** Naive approach concatenates everything.
**How to avoid:** Use the condensed summary format from ace's finding-format.md for cross-verification: `[AGENT] [SEVERITY] [FILE:LINE] Title -- one-line description`. This reduces each finding to ~100 chars instead of ~500 chars.
**Warning signs:** Cross-verification prompts exceeding 8K tokens each.

### Pitfall 3: Git Diff Output Parsing Fragility
**What goes wrong:** Diff output varies by git version, config (diff.noprefix, diff.mnemonicPrefix), and file encoding. Binary files produce different output. Renamed files have special format.
**Why it happens:** Assuming uniform `git diff` output.
**How to avoid:** Use `--no-color --no-ext-diff` flags. For file lists, use `git diff --name-only` separately from content diff. Handle binary files by checking `--stat` output for "Bin" markers. Use `--diff-filter=ACMRT` to exclude deleted files when reviewing content.
**Warning signs:** Agent receives garbled or truncated diff content.

### Pitfall 4: Stack Detection False Positives
**What goes wrong:** A `package.json` in a subdirectory is detected as "this is a Node project" even if the main project is Python. A `go.sum` file from a vendored dependency triggers Go detection.
**Why it happens:** Scanning too deep into the file tree.
**How to avoid:** Only scan project root level (depth 1). Check for `package.json`, `Cargo.toml`, `go.mod`, `pyproject.toml`, `requirements.txt` at project root. Do not recurse into `node_modules/`, `vendor/`, or subdirectories.
**Warning signs:** Go-specific agents selected for a TypeScript project.

### Pitfall 5: Memory File Unbounded Growth
**What goes wrong:** Review memory at `.opencode-assets/review-memory.json` grows with every review run. After 50 runs, loading memory into agent prompts consumes substantial tokens.
**Why it happens:** Append-only design without pruning.
**How to avoid:** Cap findings history at 100 entries. When saving, keep only the most recent 100. Cap false positives at 50 entries. Include a `lastReviewedAt` timestamp and prune entries older than 30 days on load.
**Warning signs:** Memory file exceeding 50KB.

### Pitfall 6: Finding JSON Parsing from Agent Output
**What goes wrong:** Agents return findings as text (not structured JSON). LLM output may include markdown formatting, code blocks, explanatory text before/after JSON.
**Why it happens:** LLMs don't reliably output pure JSON.
**How to avoid:** Extract JSON from agent output using a robust extraction: look for `[{` or `{"findings"` patterns, try `JSON.parse()`, fall back to regex extraction of individual finding objects. Validate every extracted finding through the Zod schema. Discard unparseable findings with a warning.
**Warning signs:** Valid findings lost because extraction failed.

## Code Examples

### Stack Detection (Pure TypeScript)

```typescript
// src/review/stack-detection.ts
import { access } from "node:fs/promises";
import { join } from "node:path";

const STACK_MARKERS: ReadonlyArray<{ readonly file: string; readonly stack: string }> = Object.freeze([
  { file: "package.json", stack: "node" },
  { file: "tsconfig.json", stack: "typescript" },
  { file: "Cargo.toml", stack: "rust" },
  { file: "go.mod", stack: "go" },
  { file: "pyproject.toml", stack: "python" },
  { file: "requirements.txt", stack: "python" },
  { file: "Gemfile", stack: "ruby" },
  { file: "pom.xml", stack: "java" },
  { file: "build.gradle", stack: "java" },
  { file: ".csproj", stack: "dotnet" },
]);

export interface ProjectStack {
  readonly detectedStacks: readonly string[];
  readonly markerFiles: readonly string[];
}

export async function detectProjectStack(projectRoot: string): Promise<ProjectStack> {
  const detected: string[] = [];
  const markers: string[] = [];

  const checks = STACK_MARKERS.map(async ({ file, stack }) => {
    try {
      await access(join(projectRoot, file));
      return { stack, file, exists: true };
    } catch {
      return { stack, file, exists: false };
    }
  });

  const results = await Promise.all(checks);

  for (const result of results) {
    if (result.exists) {
      if (!detected.includes(result.stack)) {
        detected.push(result.stack);
      }
      markers.push(result.file);
    }
  }

  return Object.freeze({ detectedStacks: detected, markerFiles: markers });
}
```

### Diff Resolution (Git Commands)

```typescript
// src/review/diff-resolver.ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type ReviewScope = "staged" | "unstaged" | "branch" | "all" | "directory";

export interface DiffResult {
  readonly scope: ReviewScope;
  readonly diff: string;
  readonly files: readonly string[];
}

export async function getDiff(
  scope: ReviewScope,
  projectRoot: string,
  options?: { filter?: string; directory?: string },
): Promise<DiffResult> {
  const baseArgs = ["--no-color", "--no-ext-diff"];
  let diffArgs: string[];
  let nameArgs: string[];

  switch (scope) {
    case "staged":
      diffArgs = ["diff", "--cached", ...baseArgs];
      nameArgs = ["diff", "--cached", "--name-only"];
      break;
    case "unstaged":
      diffArgs = ["diff", ...baseArgs];
      nameArgs = ["diff", "--name-only"];
      break;
    case "branch":
      diffArgs = ["diff", "main...HEAD", ...baseArgs];
      nameArgs = ["diff", "main...HEAD", "--name-only"];
      break;
    case "all":
      diffArgs = ["diff", "HEAD", ...baseArgs];
      nameArgs = ["diff", "HEAD", "--name-only"];
      break;
    case "directory":
      diffArgs = ["diff", "--cached", ...baseArgs, "--", options?.directory ?? "."];
      nameArgs = ["diff", "--cached", "--name-only", "--", options?.directory ?? "."];
      break;
  }

  const [diffResult, nameResult] = await Promise.all([
    execFileAsync("git", diffArgs, { cwd: projectRoot, maxBuffer: 10 * 1024 * 1024 }),
    execFileAsync("git", nameArgs, { cwd: projectRoot, maxBuffer: 1024 * 1024 }),
  ]);

  let files = nameResult.stdout.trim().split("\n").filter(Boolean);
  if (options?.filter) {
    const pattern = new RegExp(options.filter);
    files = files.filter((f) => pattern.test(f));
  }

  return Object.freeze({
    scope,
    diff: diffResult.stdout,
    files,
  });
}
```

### Review Memory Schema

```typescript
// Part of src/review/schemas.ts
export const falsePositiveSchema = z.object({
  file: z.string().max(512),
  line: z.number().int().nonnegative(),
  agent: z.string().max(64),
  finding: z.string().max(4096),
  markedAt: z.string().max(128),
});

export const reviewMemorySchema = z.object({
  schemaVersion: z.literal(1),
  projectProfile: z.object({
    stacks: z.array(z.string().max(64)),
    lastDetectedAt: z.string().max(128),
  }),
  recentFindings: z.array(reviewFindingSchema).max(100),
  falsePositives: z.array(falsePositiveSchema).max(50),
  lastReviewedAt: z.string().max(128).nullable(),
});
```

### Tool Registration Pattern

```typescript
// src/tools/review.ts
import { tool } from "@opencode-ai/plugin";
import { getProjectArtifactDir } from "../utils/paths";

export async function reviewCore(
  args: { scope?: string; filter?: string; directory?: string; findings?: string },
  projectRoot: string,
): Promise<string> {
  // Pipeline logic here
  // Returns JSON string with dispatch instructions or final report
}

export const ocReview = tool({
  description:
    "Run multi-agent code review. Provide scope (staged|unstaged|branch|all|directory) to start, or findings from dispatched agents to advance the pipeline. Returns JSON with action (dispatch|complete|error).",
  args: {
    scope: tool.schema
      .enum(["staged", "unstaged", "branch", "all", "directory"])
      .optional()
      .describe("Review scope. Default: staged"),
    filter: tool.schema.string().optional().describe("Regex pattern to filter files"),
    directory: tool.schema.string().optional().describe("Directory path for directory scope"),
    findings: tool.schema
      .string()
      .optional()
      .describe("JSON findings from previously dispatched review agents"),
  },
  async execute(args) {
    return reviewCore(args, process.cwd());
  },
});
```

## Agent Prompt Design

### Universal Agents (6 Core -- REVW-03)

Based on ace source analysis, these 6 agents cover the widest bug classes with no stack-specific requirements:

| Agent | Domain | Severity Focus | Key Prompt Elements (from ace) |
|-------|--------|---------------|-------------------------------|
| logic-auditor | Business logic correctness | CRITICAL, HIGH | Trace every function, check loops/boundaries/null/async |
| security-auditor | OWASP, secrets, injection | CRITICAL, HIGH | Hardcoded secrets, input validation, parameterized queries, auth checks |
| code-quality-auditor | Readability, modularity | MEDIUM, LOW | Function length, file size, nesting depth, duplication, naming |
| test-interrogator | Test adequacy | HIGH, MEDIUM | Assertion quality, tautological tests, over-mocking, behavioral coverage |
| silent-failure-hunter | Error handling | HIGH, MEDIUM | Empty catches, catch-log-only, optional chaining masking, generic catch-all |
| contract-verifier | API boundary integrity | CRITICAL, HIGH | Both sides of every API boundary, shape/method/URL agreement |

### Stage 3 Agents (2 Sequenced)

| Agent | Domain | Key Prompt Elements |
|-------|--------|-------------------|
| red-team | Adversarial gap-hunting | Reads ALL prior findings, hunts inter-domain gaps, concurrency, user abuse |
| product-thinker | UX completeness | User journey tracing, CRUD completeness, escape hatches, empty states |

### Prompt Template Design

Each agent prompt follows this structure:
1. **Role** -- one-line identity statement
2. **Instructions** -- what to analyze and how (from ace agent rules)
3. **Output format** -- JSON finding format (D-10)
4. **Diff placeholder** -- `{{DIFF}}` replaced at dispatch time
5. **Prior findings placeholder** -- `{{PRIOR_FINDINGS}}` for Stage 2-3 (condensed format)
6. **Memory placeholder** -- `{{MEMORY}}` for false positive suppression

### Prompt Size Budget

Target: each agent prompt should be 500-800 tokens BEFORE diff injection. The ace agents average 200-400 lines of markdown; the TypeScript object prompts must be compressed to the essential behavioral contract. Key compression strategies:
- Remove the "Hard Gates" framing (enforce via TypeScript logic, not prompt)
- Remove tool permission instructions (not applicable -- agents don't use tools in this architecture)
- Remove output format examples (use a single JSON schema reference)
- Keep the specific rules/checks that define each agent's expertise

## Stack Gate Reference (from ace)

### Gated Agents (stack-specific, potentially added later)

| Agent | Required Stacks | When to Add |
|-------|----------------|-------------|
| react-patterns-auditor | react, nextjs | When React projects are common users |
| go-idioms-auditor | go | When Go projects are common users |
| python-django-auditor | django, fastapi | When Django/FastAPI projects are common |
| rust-safety-auditor | rust | When Rust projects are common |
| state-mgmt-auditor | react, vue, svelte, angular | When frontend frameworks are common |
| type-soundness | typescript, kotlin, rust, go | Consider for v2.1 -- useful for TS projects |

### Ungated Agents (always allowed -- the 6 universals + red-team + product-thinker)

All 8 agents in this phase are universal. None require stack gating. The `relevantStacks` field is empty for all of them, meaning they pass the stack gate for every project. The stack gate infrastructure exists for future gated agents.

## Diff Heuristic Boosting

Pass 2 of selection analyzes changed file patterns. For the 8 universal agents, all pass both gates. The diff heuristic becomes more useful when stack-specific agents are added later. For now, implementation should:

1. Detect changed file categories: `auth/`, `test/`, `*.test.*`, `*.spec.*`, `.env`, `api/`, `routes/`
2. Record these categories in the `DiffAnalysis` object
3. Future stack-specific agents can use these categories for boosting
4. The 6 universal agents always run regardless of diff content

## Cross-Verification Design (Stage 2)

**Input:** All Stage 1 findings from all agents (condensed format).
**Process:** Each agent receives:
- The original diff (same as Stage 1)
- A condensed summary of ALL other agents' findings (not its own)
- Instruction: "Review these findings. You may: (1) UPGRADE severity of another agent's finding with justification, (2) ADD a new finding you missed in Stage 1 after seeing others' perspectives, (3) Report no changes."

**Output:** Same finding schema, with `source: "cross-verification"` field.

**Token budget:** Condensed findings use 1-line format: `[agent] [severity] [file:line] title -- description`. At ~100 chars per finding, 30 findings = ~3000 chars = ~750 tokens. Acceptable overhead per agent.

## Fix Cycle Design (Stage 4)

**Decision: Which findings to fix?**
- Only CRITICAL and HIGH severity findings
- Only findings with actionable `suggestion` fields
- Skip findings where suggestion is vague ("consider refactoring")
- Skip findings on files not in the current diff scope (don't fix pre-existing issues)

**Decision: Which agents to re-run?**
- Track `fixedByAgent: Set<string>` during fix application
- Only re-dispatch agents in that set
- Re-dispatch with the updated diff (after fixes applied)

**Max 1 cycle (D-07):**
- After re-verify, report remaining findings as-is
- Never enter a second fix cycle
- If re-verify finds new CRITICAL issues, report them but do not attempt to fix

## Findings Deduplication

**Recommendation: Minimal deduplication.** Findings from different agents at the same file:line are NOT duplicates -- they represent different perspectives. Deduplicate only when:
- Same agent produces identical finding in Stage 1 and cross-verification
- Key: `${agent}:${file}:${line}:${severity}`
- Keep the higher severity version

## Pipeline State Machine

The `oc_review` tool is stateless between invocations. Each call either starts a new review or advances the pipeline based on provided findings. The pipeline state is implicit in the arguments:

| Call | Args | Action |
|------|------|--------|
| 1st | `{ scope: "staged" }` | Detect stack, select agents, return dispatch instructions |
| 2nd | `{ findings: "[...stage1 results...]" }` | Build cross-verification prompts, return dispatch instructions |
| 3rd | `{ findings: "[...stage2 results...]" }` | Build red-team + product-thinker prompts, return dispatch instructions |
| 4th | `{ findings: "[...stage3 results...]" }` | Aggregate all findings, determine if fix cycle needed, return fix instructions or final report |
| 5th (if fixes) | `{ findings: "[...fix re-verify results...]" }` | Aggregate final findings, return complete report |

**Important:** The tool must track pipeline stage. Options:
1. **Stateful:** Store pipeline state in `.opencode-assets/current-review.json` (cleared on completion)
2. **Stateless:** Encode stage in the response, caller passes it back

**Recommendation:** Stateful approach. Store minimal state (stage number, selected agents, accumulated findings) in a temp file. The tool reads it on each invocation. Cleared on completion or timeout.

## State of the Art

| Old Approach (ace) | New Approach (Phase 5) | Impact |
|--------------------|------------------------|--------|
| Team-lead as LLM agent | Deterministic TS function | Saves 1 agent dispatch per review, reproducible |
| 30 agents in catalog | 8 universal agents | Focused, lower overhead, expandable |
| Shell script stack detection | TypeScript file scanning | Testable, no bash dependency |
| Markdown finding format | JSON with Zod validation | Machine-parseable, type-safe |
| 3 convergence cycles | MAX 1 fix cycle | Prevents cascade bomb |
| Agent prompts as markdown files | TS objects with template strings | Inline, importable, testable |
| `~/.claude/ace/<project-key>/` memory | `.opencode-assets/review-memory.json` | Single project artifact dir |

## Open Questions

1. **How does the calling agent dispatch multiple review agents in parallel?**
   - What we know: The `oc_review` tool returns dispatch instructions with agent names and prompts. The calling agent/orchestrator must use OpenCode's Agent tool to dispatch.
   - What's unclear: Whether OpenCode's Agent tool supports parallel dispatch (multiple concurrent agent calls). If not, sequential dispatch works but is slower.
   - Recommendation: Design the dispatch instruction format to support parallel dispatch. If sequential is required at runtime, the instructions still work -- just dispatched one at a time.

2. **How large can diffs be before agents struggle?**
   - What we know: Ace used a 3000-line diff threshold for chunking. LLM context windows vary by model.
   - What's unclear: The exact token budget per agent in OpenCode's runtime.
   - Recommendation: If diff exceeds 3000 lines, chunk by file and dispatch multiple rounds. Log a warning. For v1, accept the limitation and document it.

3. **Should the fix cycle use the same Agent dispatch or apply fixes directly?**
   - What we know: D-07 says "auto-fix" which implies the review tool applies fixes.
   - What's unclear: Whether the tool should generate fix code itself or dispatch an implementer agent.
   - Recommendation: Return fix instructions (file, line, suggested change) for the calling agent to apply. The review tool is read-only; fixes are applied externally. This keeps the tool's permission model clean.

## Sources

### Primary (HIGH confidence)
- `/home/joseibanez/develop/projects/claude-ace/agents/logic-auditor.md` -- Logic auditor prompt, rules, output format
- `/home/joseibanez/develop/projects/claude-ace/agents/security-auditor.md` -- Security auditor prompt, OWASP checks
- `/home/joseibanez/develop/projects/claude-ace/agents/code-quality-auditor.md` -- Quality auditor prompt, quantitative checks
- `/home/joseibanez/develop/projects/claude-ace/agents/test-interrogator.md` -- Test interrogator prompt, tautological test detection
- `/home/joseibanez/develop/projects/claude-ace/agents/silent-failure-hunter.md` -- Silent failure hunter prompt, error handling rules
- `/home/joseibanez/develop/projects/claude-ace/agents/contract-verifier.md` -- Contract verifier prompt, boundary integrity rules
- `/home/joseibanez/develop/projects/claude-ace/agents/red-team.md` -- Red team prompt, adversarial attack vectors
- `/home/joseibanez/develop/projects/claude-ace/agents/product-thinker.md` -- Product thinker prompt, UX anti-pattern checklist
- `/home/joseibanez/develop/projects/claude-ace/references/severity-definitions.md` -- Severity level definitions (Critical/Warning/Nitpick)
- `/home/joseibanez/develop/projects/claude-ace/references/finding-format.md` -- Finding output format with condensed cross-verification format
- `/home/joseibanez/develop/projects/claude-ace/references/stack-gate.md` -- Stack gate rules, gated vs ungated agents
- `/home/joseibanez/develop/projects/claude-ace/agents/team-lead.md` -- Team lead selection protocol (ported to deterministic TS)

### Secondary (HIGH confidence -- existing codebase)
- `src/orchestrator/schemas.ts` -- Existing Zod schema patterns for extending
- `src/orchestrator/state.ts` -- Atomic write pattern (tmp + rename)
- `src/tools/orchestrate.ts` -- Tool-returns-instruction pattern, `*Core` + `tool()` wrapper
- `src/agents/index.ts` -- configHook pattern (reference for what NOT to do for review agents)
- `src/utils/paths.ts` -- `getProjectArtifactDir()` for memory storage path
- `src/utils/fs-helpers.ts` -- `ensureDir`, `fileExists`, `isEnoentError` utilities
- `src/config.ts` -- Zod schema migration pattern, atomic config save
- `.planning/research/PITFALLS.md` -- Agent cascade bomb risk, token budget explosion
- `.planning/research/ARCHITECTURE.md` -- Review pipeline data flow, module structure

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all Node built-ins and existing transitive deps
- Architecture: HIGH -- module structure follows existing patterns, all decisions locked in CONTEXT.md
- Pitfalls: HIGH -- derived from direct ace source analysis and existing PITFALLS.md research
- Agent prompts: MEDIUM -- prompt compression from ace's verbose format requires experimentation to find optimal balance

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (stable domain, no external API dependencies)
