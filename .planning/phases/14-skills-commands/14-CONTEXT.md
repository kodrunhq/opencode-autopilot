# Phase 14: Skills & Commands - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement all 22 high-priority skills and commands identified by Phase 11 gap matrix, subdivided into 14a (core methodology skills + commands) and 14b (language-specific stacks + skill infrastructure). This is the largest phase in the project — expect ~6 plans.

</domain>

<decisions>
## Implementation Decisions

### Scope
- **D-01:** Full 14a + 14b scope — all 22 features ship in Phase 14
- **D-02:** 14a (15 features): 3 CRITICAL skills (brainstorming, TDD, debugging), 4 HIGH skills (verification, git worktrees, plan writing, plan executing), 3 MEDIUM skills (code review, strategic compaction, E2E testing), 2 HIGH commands (/update-docs, /stocktake), 3 MEDIUM commands (/tdd, /brainstorm, /write-plan)
- **D-03:** 14b (7 features): adaptive skill loading (HIGH), TypeScript/Bun patterns skill (HIGH), Go/Python/Rust pattern skills (3x MEDIUM), composable skill chains (MEDIUM), asset markdown linter integrated into /stocktake (MEDIUM)
- **D-04:** Subdivide into ~6 plans (3 for 14a, 3 for 14b) to keep each plan at ~3-4 features

### Skill format & depth
- **D-05:** Methodology skills (TDD, debugging, brainstorming, verification, git worktrees, plan writing, plan executing) are full methodology — 200-400 lines each with step-by-step workflows, anti-pattern catalogs, and explicit failure modes
- **D-06:** Language-specific skills (TypeScript, Go, Python, Rust) are 200-300 lines covering patterns + testing + idioms with framework-specific guidance
- **D-07:** Skills reference our existing tools directly (oc_review for verification, oc_forensics for debugging, etc.) — cohesive ecosystem, not standalone methodology
- **D-08:** All skills follow existing SKILL.md format with YAML frontmatter in `assets/skills/<name>/SKILL.md`

### Adaptive skill loading (SK-16/NV-01)
- **D-09:** Auto-detect project stack via manifest files on plugin load and inject matching skills into config via config hook — reuse existing `detectStackTags` from `src/review/stack-gate.ts` and `skill-injection.ts` pattern
- **D-10:** User never manages skill lists manually — detection is automatic
- **D-11:** Skills declare their required stack tags in SKILL.md frontmatter (e.g., `stacks: [typescript, bun]`) for the loading system to match against

### Composable skill chains (SK-17/NV-05)
- **D-12:** Skills can declare dependencies via `requires: [skill-name]` in SKILL.md frontmatter
- **D-13:** Dependency resolution at injection time with cycle detection and token budget enforcement
- **D-14:** Implementation is formal — not just prose references

### Command design patterns
- **D-15:** Skill-invoking commands (/tdd, /brainstorm, /write-plan) are thin wrappers — load matching skill and pass $ARGUMENTS. Skill contains all methodology
- **D-16:** Utility commands (/update-docs, /stocktake) get dedicated TypeScript tool backends (oc_update_docs, oc_stocktake) with Zod schemas — consistent with existing tool registration pattern
- **D-17:** Asset markdown linter (DX-05) is integrated into /stocktake — validates YAML frontmatter, required fields, structure correctness as part of the audit

### Claude's Discretion
- Priority ordering of features within plans
- Exact content of each skill (guided by competitor analysis from Phase 11 research)
- How to batch features into the ~6 plans
- Implementation details of dependency resolution algorithm

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 11 research (primary scope input)
- `.planning/phases/11-ecosystem-research/11-GAP-MATRIX.md` — Full gap table with 73 gaps, priority ratings, and phase assignments
- `.planning/phases/11-ecosystem-research/11-PHASE-SCOPES.md` — Phase 14a and 14b feature lists with gap ID mappings
- `.planning/phases/11-ecosystem-research/research/02-superpowers-deep-dive.md` — Brainstorming skill reference (131k+ stars validates approach)
- `.planning/phases/11-ecosystem-research/research/04-ecc-deep-dive.md` — ECC skill patterns (tdd-workflow, verification-loop, golang-patterns, etc.)
- `.planning/phases/11-ecosystem-research/11-AGENT-VERDICT.md` — Skills > agents verdict justifying this approach

### Existing skill/command patterns (must follow)
- `assets/skills/coding-standards/SKILL.md` — Reference skill format (327 lines, YAML frontmatter, actionable content)
- `assets/commands/quick.md` — Thin command wrapper pattern (passes $ARGUMENTS to tool)
- `assets/commands/review-pr.md` — Rich command template pattern (multi-step workflow)
- `src/templates/skill-template.ts` — Skill generation template
- `src/templates/command-template.ts` — Command generation template

### Existing infrastructure to reuse
- `src/review/stack-gate.ts` — `detectStackTags()` and `applyStackGate()` for project fingerprinting
- `src/orchestrator/skill-injection.ts` — Skill injection pattern into dispatch prompts
- `src/installer.ts` — Asset installer (copies bundled assets to `~/.config/opencode/`)
- `src/utils/validators.ts` — Asset name validation (`^[a-z0-9]+(-[a-z0-9]+)*$`)

### Plugin architecture
- `CLAUDE.md` — Architecture overview, tool registration pattern, dependency flow

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `detectStackTags()` in `src/review/stack-gate.ts` — detects project tech stack from file extensions and manifest files (package.json, go.mod, Cargo.toml, etc.). Reuse for adaptive skill loading.
- `applyStackGate()` in `src/review/stack-gate.ts` — filters items by detected stack tags. Adapt for skill filtering.
- `injectSkillContent()` in `src/orchestrator/skill-injection.ts` — reads and injects skill content into prompts. Extend for multi-skill injection with dependency ordering.
- Skill template (`src/templates/skill-template.ts`) — generates SKILL.md with proper frontmatter
- Command template (`src/templates/command-template.ts`) — generates command markdown
- Asset installer (`src/installer.ts`) — automatically copies new assets on plugin load

### Established Patterns
- Skills are directories: `assets/skills/<name>/SKILL.md` with YAML frontmatter
- Commands are files: `assets/commands/<name>.md` with YAML frontmatter
- Tools follow `*Core` function + `tool()` wrapper pattern (see `create-agent.ts`)
- Config hook injects agents and skills at plugin load time
- All state updates are immutable (spread-based, never mutate)

### Integration Points
- `assets/skills/` — new skill directories go here (14 new skills planned)
- `assets/commands/` — new command files go here (5 new commands planned)
- `src/tools/` — new tool backends for /update-docs and /stocktake
- `src/index.ts` — register new tools in plugin entry
- `src/installer.ts` — may need updates for new skill directories
- `src/review/stack-gate.ts` — extend or extract for skill-level stack gating

</code_context>

<specifics>
## Specific Ideas

- Brainstorming skill inspired by superpowers' Socratic design refinement (131k+ stars)
- TDD skill with explicit anti-pattern catalog (writing tests after code, skipping RED, over-engineering in GREEN)
- Debugging skill with 4-phase root cause analysis (reproduce, isolate, diagnose, fix)
- Skills should reference our tools directly — e.g., verification skill references oc_review, debugging skill references oc_forensics
- Language skills modeled after ECC's golang-patterns / rust-patterns depth
- Commands that invoke skills are thin wrappers like `/quick` → `oc_quick`

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. All 22 features from gap matrix remain in scope.

</deferred>

---

*Phase: 14-skills-commands*
*Context gathered: 2026-04-02*
