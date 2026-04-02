# Phase 14: Skills & Commands - Research

**Researched:** 2026-04-02
**Domain:** Methodology skills, language-pattern skills, slash commands, adaptive skill loading, composable skill chains
**Confidence:** HIGH

## Summary

Phase 14 is the largest phase in the project (22 features across 14a + 14b), delivering methodology skills, language-specific pattern skills, companion slash commands, adaptive skill loading infrastructure, composable skill chains with dependency resolution, and an asset markdown linter. The research confirms that all infrastructure needed to implement these features already exists in the codebase -- `detectStackTags` for project fingerprinting, `skill-injection.ts` for prompt injection, the installer for asset distribution, and the `*Core` + `tool()` registration pattern for new tools.

The critical insight is the two-pattern split: (1) skills and thin-wrapper commands are pure markdown assets requiring no TypeScript code, while (2) utility commands (`/update-docs`, `/stocktake`) and infrastructure features (adaptive loading, dependency resolution) require new TypeScript modules. The existing `coding-standards` skill (327 lines) and `quick.md` command (thin wrapper) serve as exact templates for the first pattern. The `create-agent.ts` tool pattern serves as the template for the second.

**Primary recommendation:** Batch plans by delivery type -- pure markdown asset batches (skills + thin commands) first to maximize feature velocity, then TypeScript infrastructure batches (adaptive loading, dependency resolution, tool backends) that build on the established asset patterns.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Full 14a + 14b scope -- all 22 features ship in Phase 14
- **D-02:** 14a (15 features): 3 CRITICAL skills, 4 HIGH skills, 3 MEDIUM skills, 2 HIGH commands, 3 MEDIUM commands
- **D-03:** 14b (7 features): adaptive skill loading (HIGH), TypeScript/Bun patterns skill (HIGH), Go/Python/Rust pattern skills (3x MEDIUM), composable skill chains (MEDIUM), asset markdown linter (MEDIUM)
- **D-04:** Subdivide into ~6 plans (3 for 14a, 3 for 14b)
- **D-05:** Methodology skills are 200-400 lines each with step-by-step workflows, anti-pattern catalogs, and explicit failure modes
- **D-06:** Language-specific skills are 200-300 lines covering patterns + testing + idioms
- **D-07:** Skills reference existing tools directly (oc_review, oc_forensics, etc.)
- **D-08:** All skills follow existing SKILL.md format with YAML frontmatter in `assets/skills/<name>/SKILL.md`
- **D-09:** Adaptive loading reuses `detectStackTags` from `src/review/stack-gate.ts` and `skill-injection.ts` pattern
- **D-10:** User never manages skill lists manually -- detection is automatic
- **D-11:** Skills declare stack tags in SKILL.md frontmatter (`stacks: [typescript, bun]`)
- **D-12:** Skills declare dependencies via `requires: [skill-name]` in SKILL.md frontmatter
- **D-13:** Dependency resolution at injection time with cycle detection and token budget enforcement
- **D-14:** Formal dependency resolution, not just prose references
- **D-15:** Skill-invoking commands are thin wrappers -- load matching skill and pass $ARGUMENTS
- **D-16:** Utility commands get dedicated TypeScript tool backends with Zod schemas
- **D-17:** Asset markdown linter integrated into /stocktake

### Claude's Discretion
- Priority ordering of features within plans
- Exact content of each skill (guided by competitor analysis from Phase 11 research)
- How to batch features into the ~6 plans
- Implementation details of dependency resolution algorithm

### Deferred Ideas (OUT OF SCOPE)
None -- all 22 features remain in scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

Phase 14 has no formal requirement IDs in REQUIREMENTS.md. Requirements are defined by Phase 11 gap matrix gap IDs:

| Gap ID | Description | Research Support |
|--------|-------------|------------------|
| SK-01 | Brainstorming / creative design skill (CRITICAL) | superpowers Socratic design refinement pattern, 131k+ stars validation |
| SK-02 | TDD workflow skill (CRITICAL) | superpowers RED-GREEN-REFACTOR with anti-pattern catalog, ECC tdd-workflow |
| SK-03 | Systematic debugging skill (CRITICAL) | superpowers 4-phase root cause analysis, complements oc_forensics |
| SK-04 | Verification-before-completion skill (HIGH) | superpowers lightweight pre-completion checklist |
| SK-05 | Git worktrees / isolated workspace skill (HIGH) | superpowers unique ecosystem contribution |
| SK-06 | Plan writing skill (HIGH) | superpowers bite-sized tasks with file paths |
| SK-07 | Plan executing skill (HIGH) | superpowers batch execution with verification |
| SK-08 | Code review skills (MEDIUM) | superpowers requesting + receiving review methodology |
| SK-09 | TypeScript/Bun patterns skill (HIGH) | ECC backend-patterns + bun-runtime combined |
| SK-10 | Go patterns skill (MEDIUM) | ECC golang-patterns reference |
| SK-11 | Python patterns skill (MEDIUM) | ECC python-patterns reference |
| SK-12 | Rust patterns skill (MEDIUM) | ECC rust coding standards reference |
| SK-13 | Strategic compaction skill (MEDIUM) | ECC strategic-compact skill |
| SK-16/NV-01 | Adaptive skill loading via project fingerprinting (HIGH) | detectStackTags + skill-injection.ts reuse |
| SK-17/NV-05 | Composable skill chains with dependency resolution (MEDIUM) | Novel -- no competitor has formal dependency resolution |
| SK-18 | E2E testing patterns skill (MEDIUM) | ECC e2e-testing skill reference |
| CM-02/DX-04 | /update-docs command (HIGH) | ECC /update-docs, GSD /gsd:docs-update |
| CM-03/DX-03 | /stocktake command (HIGH) | ECC /skill-health + /skill-stocktake |
| CM-06 | /tdd command (MEDIUM) | ECC /tdd, thin wrapper to SK-02 |
| CM-07 | /write-plan command (MEDIUM) | superpowers /write-plan, thin wrapper to SK-06 |
| CM-08 | /brainstorm command (MEDIUM) | superpowers /brainstorm, thin wrapper to SK-01 |
| DX-05 | Asset markdown linter integrated into /stocktake (MEDIUM) | ECC /skill-health + /harness-audit |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| yaml | 2.x (already installed) | Parse SKILL.md YAML frontmatter for `stacks` and `requires` fields | Already used in templates; consistent frontmatter handling |
| @opencode-ai/plugin | Already installed | Tool registration with `tool()` and `tool.schema` (Zod) | Plugin API for oc_update_docs and oc_stocktake |
| node:fs/promises | Built-in | Read skill files, write assets | Per CLAUDE.md: no Bun.file()/Bun.write() |
| node:path | Built-in | Path construction for skill/command directories | Standard Node utility |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod (via @opencode-ai/plugin) | Transitive dep | Validate tool arguments for oc_update_docs, oc_stocktake | Per CLAUDE.md constraint |

No new dependencies needed. Everything required is already installed.

## Architecture Patterns

### Recommended Project Structure (New Files)
```
assets/
  skills/
    brainstorming/SKILL.md          # SK-01 (CRITICAL)
    tdd-workflow/SKILL.md           # SK-02 (CRITICAL)
    systematic-debugging/SKILL.md   # SK-03 (CRITICAL)
    verification/SKILL.md           # SK-04 (HIGH)
    git-worktrees/SKILL.md          # SK-05 (HIGH)
    plan-writing/SKILL.md           # SK-06 (HIGH)
    plan-executing/SKILL.md         # SK-07 (HIGH)
    code-review/SKILL.md            # SK-08 (MEDIUM)
    strategic-compaction/SKILL.md   # SK-13 (MEDIUM)
    e2e-testing/SKILL.md            # SK-18 (MEDIUM)
    typescript-patterns/SKILL.md    # SK-09 (HIGH)
    go-patterns/SKILL.md            # SK-10 (MEDIUM)
    python-patterns/SKILL.md        # SK-11 (MEDIUM)
    rust-patterns/SKILL.md          # SK-12 (MEDIUM)
  commands/
    brainstorm.md                   # CM-08 (thin wrapper)
    tdd.md                          # CM-06 (thin wrapper)
    write-plan.md                   # CM-07 (thin wrapper)
    update-docs.md                  # CM-02 (invokes oc_update_docs)
    stocktake.md                    # CM-03 (invokes oc_stocktake)

src/
  tools/
    update-docs.ts                  # oc_update_docs tool backend
    stocktake.ts                    # oc_stocktake tool backend
  skills/
    loader.ts                       # Skill frontmatter parser + loader
    dependency-resolver.ts          # Topological sort with cycle detection
    adaptive-injector.ts            # detectStackTags -> filter skills -> inject
    linter.ts                       # Asset markdown linter (YAML + structure)
```

### Pattern 1: Methodology Skill (SKILL.md Format)
**What:** A 200-400 line markdown file with YAML frontmatter and structured methodology sections
**When to use:** For every methodology skill (brainstorming, TDD, debugging, etc.)
**Example:**
```yaml
---
name: tdd-workflow
description: Strict RED-GREEN-REFACTOR TDD methodology with anti-pattern catalog
stacks: []
requires: []
---

# TDD Workflow

## When to Use
[conditions for activation]

## The RED-GREEN-REFACTOR Cycle

### Phase 1: RED (Write a Failing Test)
[step-by-step methodology]

### Phase 2: GREEN (Make It Pass)
[step-by-step methodology]

### Phase 3: REFACTOR (Clean Up)
[step-by-step methodology]

## Anti-Pattern Catalog

### Anti-Pattern: Writing Tests After Code
**What goes wrong:** [description]
**Instead:** [correct approach]

## Integration with Our Tools
- After GREEN: invoke `oc_review` for quick quality check
- After REFACTOR: verify test still passes

## Failure Modes
[explicit failure modes and recovery]
```

### Pattern 2: Language-Specific Skill (Stack-Gated)
**What:** A 200-300 line skill with `stacks` field in frontmatter for adaptive loading
**When to use:** For TypeScript, Go, Python, Rust pattern skills
**Example:**
```yaml
---
name: typescript-patterns
description: TypeScript and Bun runtime patterns, testing, and idioms
stacks:
  - typescript
  - bun
requires:
  - coding-standards
---

# TypeScript Patterns
[language-specific content]
```

### Pattern 3: Thin Command Wrapper
**What:** A command markdown file that passes $ARGUMENTS to a skill invocation
**When to use:** For /brainstorm, /tdd, /write-plan
**Reference:** `assets/commands/quick.md` (existing pattern)
**Example:**
```yaml
---
description: Start a brainstorming session with Socratic design refinement
---
Use the brainstorming skill to explore the following topic through Socratic questioning.
Ask clarifying questions, explore alternatives, and present a structured design.

$ARGUMENTS
```

### Pattern 4: Tool-Backed Command
**What:** A command markdown file that invokes a TypeScript tool backend
**When to use:** For /update-docs, /stocktake
**Reference:** `assets/commands/quick.md` -> `src/tools/quick.ts` pattern
**Example:**
```yaml
---
description: Audit all installed skills, commands, and agents
---
Invoke the `oc_stocktake` tool to audit all installed assets.

$ARGUMENTS
```

### Pattern 5: Tool Registration (Core + Wrapper)
**What:** Testable `*Core` function + `tool()` wrapper
**When to use:** For oc_update_docs and oc_stocktake
**Reference:** `src/tools/create-agent.ts`
**Example:**
```typescript
export async function stocktakeCore(args: StocktakeArgs, baseDir: string): Promise<string> {
  // Core logic (testable with custom baseDir)
}

export const ocStocktake = tool({
  description: "Audit installed skills, commands, and agents",
  args: { /* Zod schema */ },
  async execute(args) {
    return stocktakeCore(args, getGlobalConfigDir());
  },
});
```

### Pattern 6: Adaptive Skill Loading
**What:** On plugin load, detect project stack -> parse skill frontmatter -> filter by stacks field -> inject matching skills into context
**When to use:** Phase 14b adaptive loading feature
**Implementation approach:**
1. Extend `detectStackTags` to also check manifest files (package.json, go.mod, Cargo.toml, pyproject.toml) in the project root -- currently only detects from file extensions in git diffs
2. Parse YAML frontmatter from all installed SKILL.md files to read `stacks` and `requires` fields
3. Filter skills where at least one tag in the skill's `stacks` array matches detected project tags (skills with empty `stacks` are always loaded -- same logic as review agent `relevantStacks`)
4. Resolve dependency ordering via topological sort on `requires` field
5. Inject ordered skill content via extended `buildSkillContext` (multi-skill version)

### Pattern 7: Dependency Resolution
**What:** Topological sort with cycle detection and token budget enforcement
**When to use:** At skill injection time when skills declare `requires`
**Algorithm:**
1. Build adjacency graph from `requires` fields
2. Detect cycles via DFS with visited/in-stack tracking -- fail gracefully (skip cycle participants, log warning)
3. Topological sort produces injection order (dependencies first)
4. Accumulate token estimates per skill; stop injection when budget is exceeded
5. Budget enforcement uses a configurable max (e.g., 8000 tokens for all skills combined)

### Anti-Patterns to Avoid
- **Skill content in TypeScript code:** Skills are markdown files in `assets/skills/`, never embedded in TypeScript. The installer handles distribution.
- **Complex skill selection logic:** Keep the `stacks` matching simple (any-match, same as `relevantStacks` in review agents). Do not build a sophisticated scoring system.
- **Mutating skill content during injection:** Skill content should be read, sanitized, and injected as-is. Use existing `sanitizeTemplateContent` for template injection prevention.
- **Loading all skills at session start:** Only load skills matching detected project stacks. Empty `stacks` field means "always load" (methodology skills). Non-empty `stacks` means "load only when matching" (language skills).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter parsing | Custom regex parser | `yaml` package (already installed) | Edge cases with multi-line strings, special chars |
| Stack detection from files | New detection system | Extend existing `detectStackTags` | Already handles 12 extension types + frameworks |
| Skill content sanitization | New sanitizer | `sanitizeTemplateContent` from `src/review/sanitize.ts` | Prevents template injection, already tested |
| Asset installation | New installer | Existing `installAssets()` in `src/installer.ts` | Automatically handles new skill directories + COPYFILE_EXCL |
| Tool arg validation | Manual validation | `tool.schema` (Zod) via `@opencode-ai/plugin` | Per CLAUDE.md constraint |
| Topological sort | Complex graph library | Simple DFS-based implementation (~50 lines) | The dependency graph is small (14 skills max); no need for a library |

**Key insight:** The installer automatically picks up new skill directories added to `assets/skills/`. No installer code changes are needed for new skills -- just add the directory and SKILL.md file.

## Common Pitfalls

### Pitfall 1: detectStackTags Only Works on Git Diff Files
**What goes wrong:** The current `detectStackTags` only analyzes file paths from `git diff`. For adaptive skill loading, we need to detect the project stack from the project root (manifest files), not from a diff.
**Why it happens:** `detectStackTags` was built for the review engine which receives changed file paths, not for whole-project detection.
**How to avoid:** Create a new function (e.g., `detectProjectStackTags`) that reads the project root for manifest files (package.json, go.mod, Cargo.toml, pyproject.toml, requirements.txt) in addition to using the extension-based detection. Reuse the existing tag mappings but add manifest-file detection.
**Warning signs:** Skills not loading when expected; only loading after a review that touches the right file types.

### Pitfall 2: Skill Frontmatter Schema Drift
**What goes wrong:** New frontmatter fields (`stacks`, `requires`) added to shipped skills but not to the skill template or creation tool, leading to user-created skills missing these fields.
**Why it happens:** The `generateSkillMarkdown` template in `src/templates/skill-template.ts` and the `oc_create_skill` tool don't know about the new fields.
**How to avoid:** Update `SkillTemplateInput` to include optional `stacks` and `requires` fields. Update `oc_create_skill` tool schema to accept them. The linter (in /stocktake) should also validate these fields.
**Warning signs:** User-created skills never match adaptive loading.

### Pitfall 3: Token Budget Explosion from Multi-Skill Injection
**What goes wrong:** Loading 5-6 skills at 300 lines each = ~10,000-15,000 tokens before any work begins.
**Why it happens:** No cap on total skill injection.
**How to avoid:** Enforce a total token budget (configurable, default ~8000 tokens) across all injected skills. Stop injecting once budget is reached. Priority: methodology skills (always loaded) first, then stack-specific skills.
**Warning signs:** Sessions starting slowly; context window filling up before meaningful work.

### Pitfall 4: Circular Skill Dependencies
**What goes wrong:** Skill A requires B, B requires A. Dependency resolver infinite loops or crashes.
**Why it happens:** No cycle detection in dependency graph.
**How to avoid:** Implement cycle detection in the topological sort. When a cycle is detected, skip all skills in the cycle and log a warning. Never crash.
**Warning signs:** Plugin hangs on load; stack overflow errors.

### Pitfall 5: Installer Doesn't Overwrite Existing Skills
**What goes wrong:** Updated skill content in a new plugin version doesn't reach users who already have the old version installed.
**Why it happens:** The installer uses `copyIfMissing` (COPYFILE_EXCL) which skips files that already exist.
**How to avoid:** This is by design -- user customizations are preserved. For critical skill updates, use the `FORCE_UPDATE_ASSETS` mechanism already in the installer. For normal updates, document that users can delete and reinstall. The /stocktake command should detect version drift between bundled and installed skills.
**Warning signs:** Users running outdated skill versions; /stocktake showing version mismatches.

### Pitfall 6: Manifest File Detection Requires Filesystem Access
**What goes wrong:** `detectProjectStackTags` needs to read the project root but doesn't have the project path.
**Why it happens:** The skill injection currently runs in the config hook which receives the Config object but not the project root.
**How to avoid:** Use `process.cwd()` which is already used elsewhere in `index.ts` (e.g., `query: { directory: process.cwd() }`). Alternatively, pass the project root through the hook chain.
**Warning signs:** Detection always returns empty tags; skills never load adaptively.

## Code Examples

### Frontmatter Parsing for Skills
```typescript
import { parse } from "yaml";
import { readFile } from "node:fs/promises";

interface SkillFrontmatter {
  readonly name: string;
  readonly description: string;
  readonly stacks: readonly string[];
  readonly requires: readonly string[];
}

export function parseSkillFrontmatter(content: string): SkillFrontmatter | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  
  const parsed = parse(match[1]) as Record<string, unknown>;
  return {
    name: typeof parsed.name === "string" ? parsed.name : "",
    description: typeof parsed.description === "string" ? parsed.description : "",
    stacks: Array.isArray(parsed.stacks) ? parsed.stacks.filter((s): s is string => typeof s === "string") : [],
    requires: Array.isArray(parsed.requires) ? parsed.requires.filter((s): s is string => typeof s === "string") : [],
  };
}
```

### Manifest-Based Stack Detection
```typescript
import { access } from "node:fs/promises";
import { join } from "node:path";

const MANIFEST_TAGS: Record<string, readonly string[]> = {
  "package.json": ["javascript"],     // Check devDeps for typescript, bun, etc.
  "tsconfig.json": ["typescript"],
  "bunfig.toml": ["bun", "typescript"],
  "go.mod": ["go"],
  "Cargo.toml": ["rust"],
  "pyproject.toml": ["python"],
  "requirements.txt": ["python"],
  "Pipfile": ["python"],
  "Gemfile": ["ruby"],
};

export async function detectProjectStackTags(projectRoot: string): Promise<readonly string[]> {
  const tags = new Set<string>();
  
  await Promise.all(
    Object.entries(MANIFEST_TAGS).map(async ([manifest, manifestTags]) => {
      try {
        await access(join(projectRoot, manifest));
        for (const tag of manifestTags) tags.add(tag);
      } catch {
        // File doesn't exist -- skip
      }
    })
  );
  
  return [...tags];
}
```

### Topological Sort with Cycle Detection
```typescript
export function resolveDependencyOrder(
  skills: ReadonlyMap<string, { requires: readonly string[] }>
): { ordered: readonly string[]; cycles: readonly string[] } {
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const ordered: string[] = [];
  const cycles: string[] = [];

  function visit(name: string): void {
    if (inStack.has(name)) {
      cycles.push(name);
      return;
    }
    if (visited.has(name)) return;
    
    inStack.add(name);
    visited.add(name);
    
    const skill = skills.get(name);
    if (skill) {
      for (const dep of skill.requires) {
        if (skills.has(dep)) visit(dep);
      }
    }
    
    inStack.delete(name);
    ordered.push(name);
  }

  for (const name of skills.keys()) {
    visit(name);
  }

  return { ordered, cycles };
}
```

### Stocktake Tool Core (Asset Audit)
```typescript
// Pattern: *Core function + tool() wrapper per CLAUDE.md
export async function stocktakeCore(
  args: { readonly lint?: boolean },
  baseDir: string
): Promise<string> {
  // 1. List all installed skills, commands, agents
  // 2. Classify as built-in vs user-created (compare against bundled assets)
  // 3. If lint enabled (default true), validate YAML frontmatter + structure
  // 4. Detect conflicts and duplicates
  // 5. Return formatted audit report
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single skill always loaded | Adaptive loading via project fingerprinting | Phase 14 | Only relevant skills consume context |
| Skills as standalone docs | Skills with dependency declarations | Phase 14 | Dependency resolution ensures prerequisites loaded first |
| Manual skill management | Auto-detection + auto-injection | Phase 14 | Zero-config skill loading |
| Generic coding standards only | Language-specific pattern skills | Phase 14 | More actionable guidance per stack |
| No asset validation | /stocktake with integrated linter | Phase 14 | Users can verify asset health |

## Open Questions

1. **Token budget for multi-skill injection**
   - What we know: Current single-skill injection has a 2048-char cap. superpowers estimates 8,000-12,000 tokens for all 14 skills. ECC warns about 10,000-20,000 token overhead.
   - What's unclear: What is the right default cap for multi-skill injection?
   - Recommendation: Start with 8,000 tokens total. Make configurable. Methodology skills (always-load) get priority over stack-specific skills.

2. **How to detect Bun specifically vs generic TypeScript**
   - What we know: `bunfig.toml` presence indicates Bun. But many Bun projects don't have bunfig.toml.
   - What's unclear: Whether to check `package.json` for `"bun"` in engines/devDependencies.
   - Recommendation: Check for `bunfig.toml` OR `bun.lockb` file. Both are strong Bun signals. Fall back to `tsconfig.json` for generic TypeScript.

3. **Skill content authoring: where does the methodology come from?**
   - What we know: superpowers (131k+ stars) and ECC (132k+ stars) provide proven skill patterns. Phase 11 research documented competitor approaches in detail.
   - What's unclear: Exact content of each skill is at Claude's discretion per CONTEXT.md.
   - Recommendation: Use superpowers as primary reference for methodology skills (brainstorming, TDD, debugging, verification, git worktrees, plan writing/executing). Use ECC as primary reference for language skills and strategic compaction. All skills reference our tools (oc_review, oc_forensics, etc.) for ecosystem cohesion.

4. **Update-docs: how to detect documentation drift**
   - What we know: ECC's /update-docs analyzes git diff and updates relevant docs. GSD has /gsd:docs-update.
   - What's unclear: Exact detection mechanism for which docs are affected by which code changes.
   - Recommendation: Use `git diff --name-only` to find changed source files, then scan for markdown files that reference those modules/paths. Present findings to the agent for update generation.

## Project Constraints (from CLAUDE.md)

- **Runtime:** Bun only -- no Node-specific APIs unless they're in Bun's compatibility layer
- **No standalone Zod install:** Use `tool.schema` for tool arg schemas, `import { z } from "zod"` for non-tool validation
- **No Bun.file()/Bun.write():** Use `node:fs/promises` for all file I/O
- **Model agnostic:** Never hardcode model identifiers in skills or commands
- **Global target:** Assets write to `~/.config/opencode/` (not project-local)
- **`oc_` prefix:** All tool names start with `oc_`
- **Immutability:** Build objects with conditional spreads, never mutate after creation
- **Atomic writes:** Use `writeFile` with `wx` flag for new files, `copyFile` with COPYFILE_EXCL for installer
- **File size limits:** 200-400 lines target, 800 max per CLAUDE.md and coding-standards
- **Tool pattern:** Each tool exports `*Core` function (testable) + `tool()` wrapper

## Sources

### Primary (HIGH confidence)
- `assets/skills/coding-standards/SKILL.md` -- Reference skill format (327 lines, YAML frontmatter pattern)
- `assets/commands/quick.md` -- Thin command wrapper pattern (4 lines)
- `assets/commands/review-pr.md` -- Rich command template pattern (50 lines)
- `src/review/stack-gate.ts` -- `detectStackTags` and `applyStackGate` implementations
- `src/orchestrator/skill-injection.ts` -- Current single-skill injection with sanitization
- `src/installer.ts` -- Asset installer with COPYFILE_EXCL and directory traversal
- `src/templates/skill-template.ts` -- Skill generation template with YAML frontmatter
- `src/templates/command-template.ts` -- Command generation template
- `src/tools/create-agent.ts` -- *Core + tool() registration pattern reference
- `src/index.ts` -- Plugin entry showing all current tool registrations

### Secondary (MEDIUM confidence)
- `.planning/phases/11-ecosystem-research/research/02-superpowers-deep-dive.md` -- superpowers skill patterns (131k+ stars)
- `.planning/phases/11-ecosystem-research/research/04-ecc-deep-dive.md` -- ECC skill and command patterns (132k+ stars)
- `.planning/phases/11-ecosystem-research/11-AGENT-VERDICT.md` -- Skills > agents verdict with assessment
- `.planning/phases/11-ecosystem-research/11-GAP-MATRIX.md` -- 73 gaps, 22 assigned to Phase 14
- `.planning/phases/11-ecosystem-research/11-PHASE-SCOPES.md` -- Phase 14a/14b feature lists

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all patterns exist in codebase
- Architecture: HIGH -- extends existing patterns (stack-gate, skill-injection, installer)
- Pitfalls: HIGH -- identified from direct code inspection of existing implementations
- Skill content: MEDIUM -- exact methodology content is at implementer's discretion guided by competitor analysis

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (stable -- no fast-moving external dependencies)
