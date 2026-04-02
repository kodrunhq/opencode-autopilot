# everything-claude-code (ECC) Deep Dive

## Metadata
- **GitHub URL:** https://github.com/affaan-m/everything-claude-code
- **Stars:** ~132,600
- **Last commit date:** 2026-04-02 (actively maintained)
- **Installation:** Clone/copy into project directory, or use as OpenCode/Cursor/Codex plugin. Plugin packaging for OpenCode via `.opencode/` directory.
- **Compatible runtimes:** Claude Code (primary), OpenCode, Cursor, Codex, Gemini, Kiro, Trae, CodeBuddy
- **Language:** JavaScript/TypeScript + Markdown
- **Relevance to us:** CRITICAL

## Architecture Overview

ECC is the **largest and most feature-rich agent harness** in the ecosystem. It operates as a four-layer system spanning agents, skills, rules, and hooks, with additional layers for enterprise features, research tools, and a continuous learning system called "instincts." The architecture targets 9+ runtimes simultaneously via separate directory structures.

**Architectural layers:**

1. **Agents layer** (`.opencode/prompts/agents/`) -- 24 agent definitions (OpenCode), 36+ across all runtimes
   - Planning: planner, architect
   - Code quality: code-reviewer, security-reviewer, refactor-cleaner
   - Language-specific: go-reviewer, rust-reviewer, python-reviewer, cpp-reviewer, java-reviewer, kotlin-reviewer, database-reviewer
   - Language-specific build: build-error-resolver, go-build-resolver, rust-build-resolver, cpp-build-resolver, java-build-resolver, kotlin-build-resolver
   - Testing: tdd-guide, e2e-runner, loop-operator
   - Documentation: doc-updater, docs-lookup
   - Meta: harness-optimizer
2. **Skills layer** (`.agents/skills/`, `.claude/skills/`) -- 30 skill directories with SKILL.md files organized by category
3. **Rules layer** (`.claude/rules/`) -- Guardrails and language-specific coding rules
4. **Commands layer** (`commands/`, `.opencode/commands/`) -- 68 (Claude Code) / 34 (OpenCode) slash commands
5. **Tools layer** (`.opencode/tools/`) -- 8 deterministic TypeScript tools
6. **Hooks/Plugins layer** (`.opencode/plugins/`) -- Script-based hooks with profile system
7. **Instinct/Learning system** (`.claude/homunculus/`) -- Continuous learning with extraction, evaluation, evolution, and pruning
8. **Enterprise layer** (`.claude/enterprise/`) -- Team and organizational features
9. **Research layer** (`.claude/research/`) -- Research-first development tools

**Dependency model:** Each runtime directory (`.claude/`, `.opencode/`, `.cursor/`, `.codex/`, `.gemini/`, `.kiro/`, `.trae/`, `.codebuddy/`) contains a self-contained subset of the framework. The core content lives in `.claude/` and `.agents/` with duplication/adaptation for other runtimes.

## Feature Inventory

### Skills (Organized by Category)

**Workflow Skills:**
| Name | Category | Description | Token Impact |
|------|----------|-------------|-------------|
| `tdd-workflow` | Quality | Strict TDD methodology with RED-GREEN-REFACTOR, anti-patterns, and verification | ~600-1000 tokens |
| `verification-loop` | Quality | Continuous verification loop: build, test, verify, report | ~400-600 tokens |
| `eval-harness` | Quality | Evaluation harness for measuring agent/tool effectiveness | ~500-800 tokens |
| `strategic-compact` | Context | Strategic compaction methodology: what to preserve, what to discard, timing | ~400-600 tokens |
| `e2e-testing` | Testing | End-to-end testing patterns with Playwright/Cypress | ~500-800 tokens |
| `dmux-workflows` | Workflow | Multi-agent workflow patterns | ~400-600 tokens |
| `deep-research` | Research | Research-first development methodology | ~500-800 tokens |
| `exa-search` | Research | Exa web search integration patterns | ~300-500 tokens |
| `documentation-lookup` | Docs | Documentation retrieval and lookup patterns | ~300-500 tokens |

**Language/Framework Skills:**
| Name | Category | Description | Token Impact |
|------|----------|-------------|-------------|
| `backend-patterns` | Backend | Backend development patterns (Node.js, Express, Fastify) | ~600-1000 tokens |
| `frontend-patterns` | Frontend | Frontend patterns (React, Vue, Svelte, Next.js) | ~600-1000 tokens |
| `bun-runtime` | Runtime | Bun-specific patterns and best practices | ~400-600 tokens |
| `nextjs-turbopack` | Framework | Next.js with Turbopack-specific patterns | ~400-600 tokens |
| `api-design` | API | API design patterns (REST, GraphQL) | ~500-800 tokens |
| `mcp-server-patterns` | MCP | MCP server development patterns | ~500-800 tokens |
| `claude-api` | API | Claude API usage patterns | ~400-600 tokens |
| `coding-standards` | Standards | Cross-language coding standards | ~500-800 tokens |

**Security Skills:**
| Name | Category | Description | Token Impact |
|------|----------|-------------|-------------|
| `security-review` | Security | Security review methodology (OWASP, dependency audit, secret scanning) | ~500-800 tokens |

**Content/Business Skills:**
| Name | Category | Description | Token Impact |
|------|----------|-------------|-------------|
| `article-writing` | Content | Article writing methodology and patterns | ~400-600 tokens |
| `content-engine` | Content | Content production pipeline | ~500-800 tokens |
| `market-research` | Business | Market research methodology | ~400-600 tokens |
| `investor-materials` | Business | Investor deck and materials creation | ~400-600 tokens |
| `investor-outreach` | Business | Investor outreach workflow | ~400-600 tokens |
| `frontend-slides` | Presentation | Slide deck creation with frontend tools | ~400-600 tokens |
| `brand-voice` | Content | Brand voice consistency | ~300-500 tokens |
| `crosspost` | Content | Multi-platform content distribution | ~300-500 tokens |

**Specialized Skills:**
| Name | Category | Description | Token Impact |
|------|----------|-------------|-------------|
| `fal-ai-media` | Media | FAL.ai media generation integration | ~400-600 tokens |
| `video-editing` | Media | Video editing workflow patterns | ~400-600 tokens |
| `x-api` | Social | X/Twitter API integration patterns | ~300-500 tokens |
| `everything-claude-code` | Meta | ECC framework usage guide | ~500-800 tokens |

### Commands (Organized by Category)

**Core Workflow:**
| Name | What It Does | Arguments |
|------|-------------|-----------|
| `/plan` | Create structured implementation plan | Feature description |
| `/tdd` | Start TDD workflow (RED-GREEN-REFACTOR) | Feature/test target |
| `/code-review` | Trigger multi-agent code review | File/PR target |
| `/build-fix` | Diagnose and fix build errors | Error context |
| `/refactor-clean` | Refactor and clean code | Target scope |
| `/verify` | Verification loop: build + test + check | -- |
| `/checkpoint` | Save state checkpoint | -- |
| `/orchestrate` | Multi-phase orchestration pipeline | Task description |
| `/quality-gate` | Run quality gate checks | -- |

**Learning/Instinct System:**
| Name | What It Does | Arguments |
|------|-------------|-----------|
| `/learn` | Extract patterns from current session mid-session | -- |
| `/learn-eval` | Quality-gated learning: extract, evaluate, score confidence, persist only high-signal patterns | -- |
| `/instinct-status` | View accumulated instincts (learned patterns) | -- |
| `/instinct-import` | Import instincts from exported file (portability across machines) | File path |
| `/instinct-export` | Export instincts for backup or sharing | File path |
| `/evolve` | Cluster related instincts into full skills (instinct graduation) | -- |
| `/prune` | Clean up expired or low-confidence patterns | -- |

**Testing:**
| Name | What It Does | Arguments |
|------|-------------|-----------|
| `/e2e` | Run end-to-end tests | Test target |
| `/test-coverage` | Analyze test coverage | -- |

**Language-Specific:**
| Name | What It Does | Arguments |
|------|-------------|-----------|
| `/go-build` | Go build fix | Error context |
| `/go-review` | Go-specific code review | File target |
| `/go-test` | Go test runner | Test target |
| `/rust-build` | Rust build fix | Error context |
| `/rust-review` | Rust-specific code review | File target |
| `/rust-test` | Rust test runner | Test target |
| `/cpp-build` | C++ build fix | Error context |
| `/cpp-review` | C++ code review | File target |
| `/cpp-test` | C++ test runner | Test target |
| `/kotlin-build` | Kotlin build fix | Error context |
| `/kotlin-review` | Kotlin code review | File target |
| `/kotlin-test` | Kotlin test runner | Test target |
| `/python-review` | Python code review | File target |

**Documentation:**
| Name | What It Does | Arguments |
|------|-------------|-----------|
| `/update-docs` | Sync documentation with code changes | -- |
| `/update-codemaps` | Update code structure maps | -- |
| `/docs` | Documentation lookup | Topic |

**Session/State:**
| Name | What It Does | Arguments |
|------|-------------|-----------|
| `/sessions` | List and manage sessions | -- |
| `/save-session` | Save current session state | -- |
| `/resume-session` | Resume saved session | Session ID |

**Multi-Execution:**
| Name | What It Does | Arguments |
|------|-------------|-----------|
| `/multi-plan` | Multi-agent planning | Task description |
| `/multi-execute` | Multi-agent execution | Plan reference |
| `/multi-backend` | Multi-agent backend development | Feature description |
| `/multi-frontend` | Multi-agent frontend development | Feature description |
| `/multi-workflow` | Multi-agent workflow orchestration | Workflow description |
| `/loop-start` | Start autonomous loop | Task description |
| `/loop-status` | Check autonomous loop status | -- |

**Meta/Infrastructure:**
| Name | What It Does | Arguments |
|------|-------------|-----------|
| `/skill-create` | Create new skill from template | Skill name |
| `/skill-health` | Audit installed skills for correctness | -- |
| `/eval` | Run evaluation harness | Eval target |
| `/harness-audit` | Audit agent harness configuration | -- |
| `/model-route` | Configure model routing preferences | Model config |
| `/setup-pm` | Set up project management integration | PM tool |
| `/projects` | Multi-project management | -- |
| `/rules-distill` | Distill verbose rules into concise format | -- |
| `/prompt-optimize` | Optimize agent prompts | Agent target |
| `/promote` | Promote instinct to skill | Instinct ID |

### Hooks
| Event Type | What It Automates | Implementation |
|-----------|-------------------|---------------|
| SessionStart | Load prior context, inject instincts, restore state | Script-based (`.opencode/plugins/ecc-hooks.ts`) |
| SessionEnd | Save state, extract patterns, capture session metadata | Script-based |
| pre-compact | Save verification state, preserve critical context before compaction | Script-based |
| suggest-compact | Analyze context and recommend strategic compaction | Script-based |
| evaluate-session | Extract patterns from completed sessions for instinct system | Script-based |
| file.edited | Auto-format trigger, lint check | Via tools (format-code.ts, lint-check.ts) |
| tool.execute.after | Security audit, coverage check | Via tools (security-audit.ts, check-coverage.ts) |

**Hook Profiles:**
| Profile | What It Includes | Use Case |
|---------|-----------------|----------|
| `minimal` | SessionStart only (context loading) | Low-overhead development |
| `standard` | SessionStart + SessionEnd + pre-compact | Standard development workflow |
| `strict` | All hooks + evaluate-session + suggest-compact | Maximum automation and learning |

### Agents
| Name | Role | Mode | Model Assignment |
|------|------|------|-----------------|
| planner | Implementation planning and task decomposition | Subagent | Model-agnostic |
| architect | System design and architecture decisions | Subagent | Model-agnostic |
| code-reviewer | Multi-dimensional code review | Subagent | Model-agnostic |
| security-reviewer | Security-focused review (OWASP, secrets, injection) | Subagent | Model-agnostic |
| refactor-cleaner | Dead code removal and refactoring | Subagent | Model-agnostic |
| tdd-guide | TDD methodology enforcement | Subagent | Model-agnostic |
| e2e-runner | End-to-end test execution | Subagent | Model-agnostic |
| loop-operator | Autonomous loop management | Subagent | Model-agnostic |
| build-error-resolver | General build error diagnosis and fix | Subagent | Model-agnostic |
| go-build-resolver | Go-specific build error resolution | Subagent | Model-agnostic |
| go-reviewer | Go-specific code review | Subagent | Model-agnostic |
| rust-build-resolver | Rust-specific build error resolution | Subagent | Model-agnostic |
| rust-reviewer | Rust-specific code review | Subagent | Model-agnostic |
| cpp-build-resolver | C++ build error resolution | Subagent | Model-agnostic |
| cpp-reviewer | C++ code review | Subagent | Model-agnostic |
| java-build-resolver | Java build error resolution | Subagent | Model-agnostic |
| java-reviewer | Java code review | Subagent | Model-agnostic |
| kotlin-build-resolver | Kotlin build error resolution | Subagent | Model-agnostic |
| kotlin-reviewer | Kotlin code review | Subagent | Model-agnostic |
| python-reviewer | Python code review | Subagent | Model-agnostic |
| database-reviewer | Database schema and query review | Subagent | Model-agnostic |
| doc-updater | Documentation generation and sync | Subagent | Model-agnostic |
| docs-lookup | Documentation retrieval | Subagent | Model-agnostic |
| harness-optimizer | Agent harness self-optimization | Subagent | Model-agnostic |

### Tools (OpenCode)
| Name | Purpose | Schema |
|------|---------|--------|
| `changed-files` | List files changed in current git diff | Ref, path filter |
| `check-coverage` | Run and report test coverage | Test command, threshold |
| `format-code` | Auto-format code files | File paths, formatter |
| `git-summary` | Generate git change summary | Ref range |
| `lint-check` | Run linting checks | File paths, config |
| `run-tests` | Execute test suite | Test command, filter |
| `security-audit` | Run security audit checks | Target scope |

### Memory / State
| Mechanism | Storage | Retrieval Pattern | Token Cost |
|-----------|---------|-------------------|------------|
| Instinct system | Filesystem (`.claude/homunculus/instincts/`) | Loaded at SessionStart, filtered by relevance | ~200-800 tokens per session |
| Session state | Filesystem (checkpoint files) | Manual via `/resume-session` | ~500-1500 tokens |
| Learned patterns | Filesystem (instinct files with confidence scores) | Confidence-weighted injection at session start | ~100-500 tokens |
| Project profile | Filesystem (CLAUDE.md augmentation) | Loaded automatically | ~200-500 tokens |

## Instinct/Continuous Learning System (Detailed)

The instinct system is ECC's most innovative feature. It implements a complete learning lifecycle:

### Architecture

1. **Extraction** (`/learn`, `/learn-eval`): During or after a session, patterns are extracted from the conversation. `/learn` captures all patterns; `/learn-eval` applies quality gating with confidence scoring to filter noise.

2. **Confidence scoring**: Each extracted pattern receives a confidence score based on:
   - Frequency (how often the pattern appeared)
   - Impact (did applying the pattern improve outcomes?)
   - Consistency (does the pattern hold across different contexts?)
   - Recency (recent patterns score higher)

3. **Persistence**: High-confidence patterns are stored as instinct files in `.claude/homunculus/instincts/`. Each instinct has metadata: creation date, confidence score, domain, usage count, last used date.

4. **Injection**: At session start, relevant instincts are loaded and injected into the agent's context. Relevance is determined by project type, task type, and recency.

5. **Evolution** (`/evolve`): When multiple related instincts accumulate in the same domain, they can be clustered and promoted into a full skill. This is instinct graduation -- temporary patterns become permanent methodology.

6. **Pruning** (`/prune`): Low-confidence, unused, or expired instincts are cleaned up. This prevents unbounded growth of the instinct store.

7. **Portability** (`/instinct-import`, `/instinct-export`): Instincts can be exported and imported across machines, enabling knowledge sharing between team members or environments.

### What Makes It Work
- **Confidence scoring prevents noise accumulation.** Without it, every observation becomes an instinct and context bloats.
- **Evolution pathway (instinct -> skill)** gives patterns a graduation path. Instincts are temporary; skills are permanent.
- **Pruning prevents unbounded growth.** Memory systems without decay become context bombs.
- **Quality gating (`/learn-eval` vs `/learn`)** gives users choice between aggressive and conservative learning.

### Limitations
- **Token cost of injection:** Even with relevance filtering, instinct injection adds context overhead at every session start.
- **No semantic search:** Instincts are matched by domain/keyword, not semantic similarity. This can miss relevant instincts or include irrelevant ones.
- **No cross-project learning by default:** Instincts are per-project. `/instinct-export/import` enables manual sharing but there is no automatic cross-project knowledge transfer.
- **Evolution requires manual trigger:** `/evolve` must be run explicitly. There is no automatic detection of "this instinct should become a skill."

## Architecture Patterns

1. **Multi-runtime targeting:** A single content repository adapted for 9+ runtimes via separate directory structures. Maximizes reach at the cost of duplication.
2. **Skills as reusable methodology:** Skills encapsulate development methodologies (TDD, debugging, planning) that compose with any agent. This is the proven pattern for methodology transfer.
3. **Language-specific skill stacks:** Not one generic "coding-standards" skill but framework+testing+security per language ecosystem. This provides more actionable guidance.
4. **Hook profiles (minimal/standard/strict):** Users choose automation intensity. This prevents the "too many hooks" problem by making it opt-in.
5. **Commands as skill invocations:** Most commands simply invoke a skill or agent with a specific context. Commands are the UX surface; skills are the implementation.
6. **Deterministic tools for deterministic tasks:** TypeScript tools for git-summary, changed-files, format-code, lint-check, test-coverage. These are deterministic operations that benefit from code execution rather than LLM interpretation.
7. **Instinct lifecycle:** Extract -> score -> persist -> inject -> evolve -> prune. A complete learning loop that prevents both knowledge loss and unbounded growth.

## Strengths

- **Instinct/continuous learning system** is the most innovative learning mechanism in the ecosystem. The extraction -> confidence scoring -> evolution -> pruning lifecycle is well-designed and addresses the key challenge of learning systems: preventing noise accumulation while capturing real signal.
- **Language-specific skill stacks** across 12 ecosystems provide actionable, framework-aware guidance. This is more useful than generic coding standards.
- **Hook profiles** (minimal/standard/strict) elegantly solve the "too many hooks" problem by making automation intensity user-configurable.
- **Documentation sync** (`/update-docs`, `/update-codemaps`) addresses the common drift between code and docs that occurs during rapid development.
- **Skill health auditing** (`/skill-health`) enables users to verify their skill configuration is correct. This is a useful meta-feature.
- **Multi-runtime compatibility** makes ECC accessible across 9+ runtimes. The largest user base drives the most feedback and iteration.
- **Deterministic TypeScript tools** for formatting, linting, testing, and security auditing provide reliable automation that does not depend on LLM interpretation.
- **Strategic compaction skill** teaches when and how to compact context, which is a sophisticated context management technique.
- **Won Anthropic Hackathon** -- external validation of quality and innovation.

## Weaknesses / Concerns

- **Feature bloat risk:** 68 commands, 30+ skills, 24+ agents, and 8 tools create a massive surface area. The learning curve is steep and many features are niche (investor-materials, video-editing, x-api).
- **Content duplication across runtimes:** Maintaining 9+ runtime directories means changes must be replicated across `.claude/`, `.opencode/`, `.cursor/`, `.codex/`, `.gemini/`, `.kiro/`, `.trae/`, `.codebuddy/`. This is a maintenance burden.
- **Command bloat:** 68 commands (many are language-specific variants of the same pattern) create a cluttered command palette. The transition from commands to skills is incomplete.
- **Token cost of full stack:** Loading all skills + instincts + rules at session start can consume 10,000-20,000 tokens. Without selective loading, this is a significant context overhead.
- **Business/content skills dilute developer focus.** Skills like article-writing, investor-materials, market-research, content-engine are outside the core developer tool value proposition.
- **Instinct evolution is manual.** `/evolve` must be explicitly triggered, missing the opportunity for automatic skill graduation.
- **No structured memory system.** Instincts are a learning system, not a memory system. There is no session recall, no timeline navigation, no progressive disclosure like claude-mem offers.

## Relevance to Our Plugin

### Features We Should Adopt (with rationale)
- **Instinct/learning system concepts (Phase 15):** The extraction -> confidence scoring -> evolution -> pruning lifecycle should inform our lesson memory enhancement. We already have lesson memory with decay; adding confidence scoring and skill graduation would be a significant improvement.
- **Hook profiles (Phase 17):** User-configurable automation intensity (minimal/standard/strict). Our users should be able to choose how much automation they want.
- **Documentation sync commands (Phase 14):** `/update-docs` and `/update-codemaps` are high-value commands. Keeping docs in sync with code is a universal need.
- **Skill health auditing (Phase 14):** A `/skill-health` or `/doctor` command that verifies skill configuration. Complements the diagnostics command from OMO.
- **Strategic compaction skill (Phase 14):** Teaching Claude when and how to compact context. This is a high-value skill for long sessions.
- **Language-specific skill stacks (Phase 14, curated):** Instead of 12 ecosystems, start with the 3-4 most relevant to our users (TypeScript, Go, Python, Rust) and add more based on demand. Quality over quantity.
- **Deterministic tools pattern:** TypeScript tools for deterministic tasks (format, lint, test, coverage). Our existing tools follow this pattern; we should extend it.
- **Commands as skill invocations:** Where it makes sense, commands should invoke skills rather than implementing logic directly.

### Features We Should Skip (with rationale)
- **Multi-runtime targeting:** We target OpenCode. Adding compatibility directories for 8 other runtimes is maintenance overhead we do not need.
- **68 commands:** Command bloat is an antipattern. We should add commands only when research proves demand.
- **Business/content skills:** Article-writing, investor-materials, market-research, content-engine, frontend-slides, brand-voice, crosspost are outside our developer tool scope.
- **Language-specific reviewers for every language:** We already have 22 review specialists. Adding per-language reviewers would create maintenance burden with diminishing returns.
- **Harness optimizer:** Self-optimization of the harness is too meta for our use case.
- **Instinct import/export:** Cross-machine portability is a nice-to-have but adds complexity. Defer to post-v3.0.

### Opportunities to Do Better
- **Curated skill stacks instead of exhaustive lists:** ECC has 30+ skills. We should curate 10-15 high-impact skills with deeper quality. Our value proposition is curation, not volume.
- **Automatic instinct evolution:** Where ECC requires manual `/evolve`, our system could automatically detect when accumulated patterns warrant skill graduation, using confidence thresholds and clustering.
- **Integrated memory + learning:** ECC has instincts (learning) but not memory (recall). claude-mem has memory but not learning. We can build an integrated system that does both -- learning from patterns AND remembering context across sessions.
- **Selective skill loading via hook:** ECC loads all skills at session start. We can use our config hook to detect project type (language, framework) and inject only relevant skills, reducing token overhead.
- **Unified command surface:** Where ECC has 68 commands, we can provide the same capability through fewer, smarter commands that use context to determine behavior (e.g., `/build-fix` auto-detects language instead of `/go-build`, `/rust-build`, `/cpp-build`).
