# superpowers Deep Dive

## Metadata
- **GitHub URL:** https://github.com/obra/superpowers
- **Stars:** ~131,400
- **Last commit date:** 2026-04-02 (actively maintained)
- **Installation:** Clone/copy skills directory into `.claude/skills/`, `.opencode/skills/`, `.cursor/skills/`, or `.codex/skills/`
- **Compatible runtimes:** Claude Code, OpenCode, Cursor, Codex, Gemini CLI (via adaptor)
- **Language:** Shell/Markdown (skills are pure markdown files, hooks are JSON + shell scripts)
- **Relevance to us:** HIGH

## Architecture Overview

superpowers is a **skills-only framework** -- it has no registered tools, no TypeScript code, and no plugin entry point. It consists entirely of markdown files that teach the agent structured development methodologies. The architecture is deliberately minimal: skills are plain text instructions organized by directory, with a few commands and a single agent as orchestration surfaces.

**Structure:**
1. **Skills** (`skills/`) -- 14 directories, each containing a `SKILL.md` file with structured methodology
2. **Commands** (`commands/`) -- 3 slash commands that invoke skills as workflows
3. **Agents** (`agents/`) -- 1 agent definition (`code-reviewer.md`) for structured code review
4. **Hooks** (`hooks/`) -- Session-start hooks (JSON-based) for loading context
5. **Tests** (`tests/`) -- Validation tests for skill structure
6. **Docs** (`docs/`) -- Extended documentation and rationale

**Cross-platform packaging:**
- `.claude-plugin/` -- Claude Code plugin manifest
- `.opencode/` -- OpenCode compatibility directory
- `.codex/` -- Codex compatibility
- `.cursor-plugin/` -- Cursor compatibility

**Dependency model:** Zero runtime dependencies. Skills are loaded by the host runtime's skill discovery mechanism. No build step, no TypeScript compilation, no package installation.

## Feature Inventory

### Skills
| Name | Category | Description | Token Impact |
|------|----------|-------------|-------------|
| `brainstorming` | Design | Socratic design refinement: asks clarifying questions, explores alternatives, presents design in structured sections. Teaches Claude to THINK before coding. | ~800-1200 tokens (loaded when referenced) |
| `test-driven-development` | Quality | Strict RED-GREEN-REFACTOR cycle with anti-pattern catalog. Includes specific failure modes to avoid (writing tests after code, skipping RED, over-engineering in GREEN). | ~600-1000 tokens |
| `systematic-debugging` | Quality | Four-phase root cause analysis: (1) Reproduce, (2) Isolate, (3) Diagnose, (4) Fix with defense-in-depth. Includes tracing methodology and regression prevention. | ~700-1000 tokens |
| `writing-plans` | Workflow | Creates bite-sized tasks (2-5 min each) with exact file paths, clear acceptance criteria, and dependency ordering. Teaches task decomposition discipline. | ~500-800 tokens |
| `executing-plans` | Workflow | Batch execution with human checkpoints after each task group. Emphasizes verification-before-proceeding and explicit state tracking. | ~500-800 tokens |
| `dispatching-parallel-agents` | Workflow | Concurrent subagent workflows: task decomposition, dependency analysis, parallel dispatch patterns, result aggregation. | ~500-800 tokens |
| `requesting-code-review` | Quality | Pre-review checklist: self-review first, ensure tests pass, document what changed and why, identify areas of concern. Teaches review preparation discipline. | ~400-600 tokens |
| `receiving-code-review` | Quality | Feedback integration: categorize feedback, address blocking issues first, explain disagreements with reasoning, verify fixes. Teaches constructive review response. | ~400-600 tokens |
| `using-git-worktrees` | Git | Creates isolated development workspace on a new branch: `git worktree add`, runs setup commands, verifies test baseline passes before making changes. Ensures clean rollback. | ~500-800 tokens |
| `finishing-a-development-branch` | Git | Merge/PR decision workflow: rebase vs. merge analysis, conflict resolution strategy, PR description generation, cleanup of worktree after merge. | ~400-600 tokens |
| `subagent-driven-development` | Workflow | Two-stage review pattern: Stage 1 checks spec compliance (does it do what was asked?), Stage 2 checks code quality (is it done well?). Prevents quality shortcuts. | ~500-800 tokens |
| `verification-before-completion` | Quality | Explicit "did you actually check it works" gate: run the thing, verify the output, check edge cases, confirm the original issue is resolved. Prevents premature "done" claims. | ~300-500 tokens |
| `writing-skills` | Meta | Meta-skill for creating new skills: structure requirements, naming conventions, content guidelines, testing expectations. Enables community contribution. | ~400-600 tokens |
| `using-superpowers` | Meta | System introduction: explains the framework, how to invoke skills, which skills exist, recommended workflow combinations. | ~300-500 tokens |

### Commands
| Name | What It Does | Arguments |
|------|-------------|-----------|
| `/brainstorm` | Invokes the brainstorming skill for a design topic | Topic/problem description ($ARGUMENTS) |
| `/write-plan` | Invokes the writing-plans skill to create a structured plan | Feature/task description ($ARGUMENTS) |
| `/execute-plan` | Invokes the executing-plans skill to execute a plan file | Plan file path ($ARGUMENTS) |

### Hooks
| Event Type | What It Automates | Implementation |
|-----------|-------------------|---------------|
| `session-start` | Loads superpowers skills context into the session | JSON config (`hooks.json`) pointing to session-start scripts |

Note: superpowers hooks are minimal. The framework relies on the host runtime's native skill loading rather than complex hook automation.

### Agents
| Name | Role | Mode | Model Assignment |
|------|------|------|-----------------|
| `code-reviewer` | Structured code review with superpowers methodology | Primary | Model-agnostic |

### Tools
| Name | Purpose | Schema |
|------|---------|--------|
| N/A | superpowers has no registered tools | N/A |

superpowers is purely a skills framework. It does not register any tools with the host runtime.

### Memory / State
| Mechanism | Storage | Retrieval Pattern | Token Cost |
|-----------|---------|-------------------|------------|
| Skill context | Filesystem (SKILL.md files) | Loaded by host runtime skill discovery | ~300-1200 tokens per skill |
| Plan files | Filesystem (markdown) | Referenced by `/execute-plan` command | ~500-2000 tokens per plan |

superpowers has no persistent memory system. State is maintained through plan files and the host runtime's session context.

## Architecture Patterns

1. **Skills as methodology transfer:** Each skill is a structured document that teaches Claude a specific methodology. The agent reads the skill and applies the methodology to the current task. This is more sustainable than prompt engineering individual agents.
2. **Zero-dependency design:** No TypeScript, no npm packages, no build step. Pure markdown that works across any runtime that supports skill files. This maximizes portability and minimizes maintenance.
3. **Composable skills:** Skills can be combined (e.g., use brainstorming to design, then TDD to implement, then verification to confirm). The framework does not enforce a fixed pipeline.
4. **Anti-pattern catalogs:** Skills include explicit "what NOT to do" sections alongside "what to do." This prevents the common failure mode where agents follow the happy path but ignore failure modes.
5. **Human checkpoints:** The executing-plans skill explicitly includes human verification points. This balances automation with oversight.
6. **Bite-sized tasks:** Writing-plans enforces 2-5 minute task granularity. This prevents the common failure mode of over-ambitious plans that stall mid-execution.

## Strengths

- **Brainstorming skill** is the single most impactful capability in the entire ecosystem. It teaches Claude to ask questions and explore design alternatives BEFORE writing code. No other competitor has anything comparable. With 131k+ stars, adoption proves demand.
- **Zero-dependency portability** -- works across Claude Code, OpenCode, Cursor, Codex, and Gemini with zero configuration. This is the most portable framework in the ecosystem.
- **TDD skill with anti-patterns** is more prescriptive and effective than generic "write tests first" instructions. The explicit anti-pattern catalog (writing tests after code, skipping RED, etc.) addresses common agent failure modes.
- **Git worktrees skill** enables isolated development environments with clean test baselines. This is unique in the ecosystem -- most agents work in the main branch.
- **Verification-before-completion** is a simple but powerful pattern. It addresses the #1 complaint about AI coding agents: they declare "done" without actually checking if the thing works.
- **Community adoption** (131k+ stars, forks for Cursor, Codex, Gemini) validates the skills-only approach. Users want methodology, not more tools.
- **Systematic debugging** with four-phase analysis is more structured than any competitor's debugging approach.

## Weaknesses / Concerns

- **No tools or hooks** -- superpowers cannot automate anything. It can only teach methodology through text. No file operations, no git automation, no state persistence.
- **No memory system** -- skills are stateless. There is no way to track what was learned, what plans were executed, or what patterns emerged across sessions.
- **Single agent** -- only one agent definition (code-reviewer). The framework relies on the host runtime's default agent for everything else.
- **No quality enforcement** -- skills are suggestions, not guardrails. The agent can ignore skill instructions without any automated check. Compare to OMO's hooks that enforce behavior.
- **No language-specific skills** -- skills are generic (TDD, debugging, planning). They don't include language-specific patterns (e.g., Go idioms, React patterns, Rust safety).
- **Limited commands** -- only 3 commands. Many useful skill invocations require the user to manually reference the skill rather than having a convenient command shortcut.
- **No diagnostics** -- no way to check if skills are loaded correctly, no health command, no status reporting.
- **Token cost of skill loading** -- if all 14 skills are loaded at session start, that is ~8,000-12,000 tokens of context consumed before any work begins. The framework has no selective loading mechanism.

## Relevance to Our Plugin

### Features We Should Adopt (with rationale)
- **Brainstorming skill (CRITICAL):** This is the single most impactful gap in our plugin. A brainstorming skill that teaches Claude to ask clarifying questions, explore alternatives, and present structured design options before coding. Per D-09, this is the #1 priority.
- **TDD skill with anti-pattern catalog:** Our plugin has no TDD guidance. A structured TDD skill with explicit anti-patterns (based on superpowers' proven model) would complement our review engine.
- **Systematic debugging skill:** A four-phase debugging methodology skill. This would work alongside our `oc_forensics` tool, providing the "how to think about debugging" layer that the tool's "analyze what went wrong" layer lacks.
- **Verification-before-completion skill:** A lightweight pre-completion checklist. This complements our review engine by catching the "did you actually run it?" failure mode.
- **Git worktrees skill:** Isolated development workflow. Our plugin does not currently address branch/workspace management.
- **Writing-plans skill:** While our orchestrator handles pipeline planning internally, a user-facing planning skill for ad-hoc work would fill the gap between "use the full pipeline" and "just start coding."
- **Anti-pattern documentation pattern:** Including "what NOT to do" in every skill. This is a structural pattern we should adopt across all our skills.

### Features We Should Skip (with rationale)
- **Zero-dependency architecture:** We are a TypeScript plugin with tools and hooks. Going pure-markdown would sacrifice our tool registration, config hook injection, and runtime capabilities.
- **Single agent model:** We already have 14 agents for pipeline orchestration. Reducing to 1 agent is backwards for our use case.
- **No-enforcement approach:** We should go further than superpowers by combining skills (methodology) with hooks (enforcement). Skills teach how; hooks verify compliance.
- **Human checkpoint pattern in executing-plans:** Our orchestrator is designed for autonomous execution. Human checkpoints are appropriate for superpowers' simpler model but conflict with our autopilot value proposition.

### Opportunities to Do Better
- **Skills + tools integration:** superpowers' skills are text-only. Our skills can reference our tools (e.g., the TDD skill can invoke `oc_review` after the GREEN phase, the debugging skill can invoke `oc_forensics`). This is a strictly better experience.
- **Selective skill loading:** We can implement context-aware skill injection via our config hook, loading only relevant skills per task type. superpowers loads everything at session start.
- **Language-specific skill stacks:** superpowers has generic skills. We can build language-specific variants (TypeScript TDD, Go debugging, React patterns) that are more actionable. ECC does this -- we should too, but curated rather than exhaustive.
- **Skill + hook enforcement:** Pair each skill with optional hook enforcement. The TDD skill teaches methodology; a `tool.execute.before` hook can warn if code is written before tests exist. superpowers cannot do this.
- **Memory-backed skills:** Our Phase 15 memory system can track which skills were applied, their outcomes, and adapt recommendations over time. superpowers has no learning capability.
