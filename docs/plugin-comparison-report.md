# AI Coding Plugin Comparison Report: opencode-autopilot vs. Competition

## Summary

This report provides a detailed comparison of **opencode-autopilot** against four major AI coding plugins: **get-shit-done (GSD)**, **superpowers**, **oh-my-openagent (omo)**, and **everything-claude-code (ECC)**. The analysis reveals that opencode-autopilot has unique strengths in multi-phase orchestration and deep code review, but significant gaps exist in community adoption, skills ecosystem, and autonomous execution capabilities compared to the 47K-136K star competitors.

---

## 1. Features Comparison

### 1.1 Core Feature Matrix

| Feature | opencode-autopilot | GSD | Superpowers | omo | ECC |
|---------|:-----------------:|:---:|:-----------:|:---:|:---:|
| **Multi-phase orchestration** | ✅ 8-phase pipeline | ✅ 5-phase workflow | ✅ 5-phase process | ✅ Ultrawork loop | ✅ Modular workflow |
| **Autonomous overnight execution** | ✅ Primary focus | ⚠️ Via SDK | ❌ | ✅ Ralph Loop | ❌ |
| **Multi-agent parallel execution** | ✅ Via agents | ✅ Wave-based parallel | ✅ Subagent-driven | ✅ Background agents | ✅ Multi-agent commands |
| **Code review** | ✅ 21 specialized auditors | ✅ Via `/gsd:review` | ✅ 2-stage review | ✅ Via agents | ✅ 36 specialized agents |
| **Memory system** | ✅ Dual-scope SQLite | ⚠️ STATE.md files | ❌ | ⚠️ Session-based | ✅ Instinct-based learning |
| **Token optimization** | ✅ Token tracking | ⚠️ Context engineering | ❌ | ❌ | ✅ Comprehensive |
| **Skill ecosystem** | ⚠️ 16 bundled | ❌ | ✅ 15+ skills | ⚠️ Built-in + custom | ✅ 156 skills |
| **Multi-platform support** | ⚠️ OpenCode only | ✅ 10+ runtimes | ✅ 5+ platforms | ⚠️ OpenCode focus | ✅ 10+ platforms |
| **Security hardening** | ✅ Sanitization | ✅ Built-in security | ❌ | ⚠️ Basic | ✅ AgentShield integration |
| **Verification/Testing** | ✅ Cross-verification | ✅ Quality gates | ✅ TDD enforcement | ❌ | ✅ E2E testing |

### 1.2 Detailed Feature Analysis

#### opencode-autopilot Strengths
- **8-phase pipeline**: RECON → CHALLENGE → ARCHITECT → EXPLORE → PLAN → BUILD → SHIP → RETROSPECTIVE provides comprehensive SDLC coverage
- **21 specialized review agents**: Deep code analysis including logic auditing, security auditing, concurrency checking, Rust safety, React patterns, Django patterns, etc.
- **Adaptive skill injection**: Stack detection, filtering, dependency ordering, and token budgeting for skill loading
- **Memory system**: Dual-scope SQLite-based memory with FTS5 search, relevance decay, and 3-layer retrieval

#### GSD (get-shit-done) Strengths
- **Wave-based parallel execution**: Plans grouped by dependencies, independent plans run in parallel
- **Context engineering**: File-based state management (PROJECT.md, ROADMAP.md, STATE.md, PLAN.md)
- **Atomic git commits**: Each task gets its own commit for traceability
- **Multi-runtime support**: Works with Claude Code, OpenCode, Gemini CLI, Kilo, Codex, Copilot, Cursor, Windsurf, Antigravity, Augment

#### Superpowers Strengths
- **TDD enforcement**: RED-GREEN-REFACTOR cycle is mandatory, not optional
- **Automatic skill triggers**: Skills activate based on context without manual invocation
- **Two-stage review**: Spec compliance check + code quality check
- **Multi-platform**: Claude Code, Cursor, Codex, Gemini CLI

#### oh-my-openagent (omo) Strengths
- **Ultrawork command**: Single command that activates everything
- **Hash-anchored edits**: LINE#ID content hash validation prevents stale-line errors
- **Multi-model orchestration**: Claude, Kimi, GLM, GPT, Minimax, Gemini - best model per task
- **Ralph Loop**: Self-referential loop that doesn't stop until 100% done
- **Sisyphus discipline agents**: Orchestrator + deep worker + planner working together

#### everything-claude-code (ECC) Strengths
- **156 skills**: Largest skills ecosystem, covering 12 language ecosystems
- **30+ specialized agents**: Including language-specific reviewers and build error resolvers
- **Instinct-based learning**: Auto-extract patterns from sessions with confidence scoring
- **Harness audit scoring**: Deterministic scoring system for evaluating harness performance
- **Cross-harness parity**: Tight integration across Claude Code, Cursor, OpenCode, Codex

---

## 2. Agents Architecture

### 2.1 Agent Count and Specialization

| Plugin | Primary Agents | Specialist Agents | Total |
|--------|:--------------:|:----------------:|:-----:|
| opencode-autopilot | 8 phase handlers | 21 review auditors | 29+ |
| GSD | 4 orchestrator roles | Multiple workflow agents | 10+ |
| Superpowers | 5 workflow roles | 15+ skills | 20+ |
| omo | 4 discipline agents | Background specialists | 10+ |
| ECC | 36 specialized agents | 156 skills | 192+ |

### 2.2 Agent Specialization Comparison

#### opencode-autopilot Agents
```
Phase Handlers:
- handleRecon: Requirements discovery
- handleChallenge: Critical analysis
- handleArchitect: System design
- handleExplore: Codebase analysis
- handlePlan: Task decomposition
- handleBuild: Implementation
- handleShip: Deployment
- handleRetrospective: Lessons learned

Review Auditors (21):
- logicAuditor, securityAuditor, codeQualityAuditor
- testInterrogator, silentFailureHunter, contractVerifier
- wiringInspector, deadCodeScanner, specChecker
- databaseAuditor, authFlowVerifier, typeSoundness
- stateMgmtAuditor, concurrencyChecker, scopeIntentVerifier
- reactPatternsAuditor, goIdiomsAuditor
- pythonDjangoAuditor, rustSafetyAuditor
- redTeam, productThinker
```

#### GSD Agents
```
Orchestrator Pattern:
- Researcher: Parallel domain investigation (4 researchers)
- Planner: Plan creation and verification
- Executor: Implementation in fresh context
- Verifier: Goal verification and debugging

Workflow Agents:
- Auto-chain capability for autonomous execution
- Wave-based parallelization
```

#### Superpowers Agents
```
Workflow Agents:
- brainstorming: Socratic design refinement
- writing-plans: Implementation planning
- subagent-driven-development: Batch execution
- test-driven-development: RED-GREEN-REFACTOR
- requesting-code-review: Quality checks
- finishing-a-development-branch: Merge workflow

Skills as Agents:
- systematic-debugging (4-phase root cause)
- verification-before-completion
```

#### oh-my-openagent Agents
```
Core Discipline Agents:
- Sisyphus: Main orchestrator (claude-opus-4-6 / kimi-k2.5 / glm-5)
- Hephaestus: Autonomous deep worker (gpt-5.4)
- Prometheus: Strategic planner with interview mode
- Oracle: Architecture and debugging specialist
- Librarian: Documentation and code search
- Explore: Fast codebase grep

Category-based routing:
- visual-engineering, deep, quick, ultrabrain
```

#### ECC Agents (36 specialized)
```
Language Reviewers:
- typescript-reviewer, python-reviewer, go-reviewer
- java-reviewer, kotlin-reviewer, rust-reviewer
- cpp-reviewer

Build Error Resolvers:
- pytorch-build-resolver, java-build-resolver
- kotlin-build-resolver, cpp-build-resolver
- go-build-resolver, rust-build-resolver

Specialized Agents:
- architect, tdd-guide, code-reviewer, security-reviewer
- e2e-runner, refactor-cleaner, doc-updater
- docs-lookup, chief-of-staff, loop-operator
- harness-optimizer
```

---

## 3. Skills Comparison

### 3.1 Skills Ecosystem Overview

| Plugin | Built-in Skills | Custom Skills | Total Skills |
|--------|:--------------:|:-------------:|:------------:|
| opencode-autopilot | 16 | Supported | 16+ |
| GSD | N/A | N/A | Meta-prompting system |
| Superpowers | 15+ | Supported | 15+ |
| omo | 5+ built-in | Supported | 5+ |
| ECC | 156 | Supported | 156+ |

### 3.2 Skills Architecture

#### opencode-autopilot Skills
```
Built-in Skills:
- coding-standards
- python-patterns, go-patterns, rust-patterns
- typescript-patterns
- tdd-workflow, e2e-testing
- systematic-debugging, verification
- brainstorming, code-review
- git-worktrees
- plan-writing, plan-executing
- strategic-compaction

Key Features:
- Adaptive injection based on stack detection
- Dependency ordering via topological sort
- Token budgeting (8000-token default budget)
- Skill validation via linter
```

#### Superpowers Skills (15+)
```
Testing:
- test-driven-development (RED-GREEN-REFACTOR)

Debugging:
- systematic-debugging (4-phase root cause)
- verification-before-completion

Collaboration:
- brainstorming (Socratic design)
- writing-plans (Detailed implementation)
- executing-plans (Batch execution)
- requesting-code-review
- receiving-code-review

Development:
- using-git-worktrees
- finishing-a-development-branch
- subagent-driven-development

Meta:
- writing-skills
- using-superpowers
```

#### ECC Skills (156)
```
Language-Specific (60+):
- python-patterns, python-testing
- golang-patterns, golang-testing
- cpp-coding-standards, cpp-testing
- django-patterns, django-security
- laravel-patterns, laravel-security
- springboot-patterns, springboot-security
- java-coding-standards, jpa-patterns
- kotlin-reviewer, kotlin-build-resolver
- swift-actor-persistence, swift-protocol-di-testing
- perl-patterns, perl-security

Infrastructure (40+):
- api-design, database-migrations
- deployment-patterns, docker-patterns
- e2e-testing, clickhouse-io

AI/ML (10+):
- pytorch-patterns, foundation-models-on-device
- cost-aware-llm-pipeline

Content (10+):
- article-writing, content-engine
- market-research, investor-materials

Operational (30+):
- continuous-learning-v2, skill-stocktake
- autonomous-loops, plankton-code-quality
```

#### oh-my-openagent Skills
```
Built-in:
- playwright (browser automation)
- git-master (atomic commits, rebase)
- frontend-ui-ux (design-first UI)

Custom Skills:
- Skill-embedded MCPs (on-demand, scoped)
- .opencode/skills/*/SKILL.md
- ~/.config/opencode/skills/*/SKILL.md
```

---

## 4. Commands/CLI Tools

### 4.1 Command Count

| Plugin | Primary Commands | Workflow Commands | Total |
|--------|:---------------:|:-----------------:|:-----:|
| opencode-autopilot | 15+ | 10+ | 25+ |
| GSD | 40+ | 20+ | 60+ |
| Superpowers | N/A (skills-based) | N/A | N/A |
| omo | 10+ | 5+ | 15+ |
| ECC | 72 legacy | 30+ | 100+ |

### 4.2 Command Comparison

#### opencode-autopilot Commands
```typescript
// Orchestrator commands
oc_orchestrate      // Drive pipeline with idea or result
oc_phase            // Manage phase transitions
oc_plan             // Query plan data
oc_confidence       // Manage confidence ledger
oc_state            // Pipeline state management

// Review commands
oc_review           // Multi-agent code review

// Creation commands
oc_create_agent     // Create new agent
oc_create_skill     // Create new skill
oc_create_command   // Create new command

// Diagnostic commands
oc_doctor           // Plugin health diagnostics
oc_stocktake        // Audit skills/commands/agents
oc_logs             // Session logs
oc_pipeline_report // Decision trace

// Memory commands
oc_memory_status    // Memory system status
oc_update_docs       // Detect affected documentation
```

#### GSD Commands
```bash
# Core workflow
/gsd:new-project [--auto]
/gsd:discuss-phase [N] [--auto] [--analyze] [--chain]
/gsd:plan-phase [N] [--auto] [--reviews]
/gsd:execute-phase <N>
/gsd:verify-work [N]
/gsd:ship [N] [--draft]
/gsd:next
/gsd:fast <text>

# Phase management
/gsd:add-phase
/gsd:insert-phase [N]
/gsd:remove-phase [N]
/gsd:list-phase-assumptions [N]

# Workstreams
/gsd:workstreams list|create|switch|complete

# Utilities
/gsd:health [--repair]
/gsd:stats
/gsd:debug [desc]
/gsd:quick [--full] [--validate] [--discuss] [--research]
```

#### ECC Commands (72 legacy shims)
```bash
/tdd, /plan, /e2e, /code-review
/build-fix, /refactor-clean, /learn
/verify, /checkpoint, /sessions
/multi-plan, /multi-execute, /multi-backend
/frontend, /orchestrate, /eval
/harness-audit, /loop-start, /loop-status
/quality-gate, /model-route
```

---

## 5. Architecture Comparison

### 5.1 System Architecture

#### opencode-autopilot Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    Plugin Entry (index.ts)                  │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  Orchestrator │  │    Review    │  │    Memory    │       │
│  │  (8 phases)   │  │ (21 agents)  │  │  (SQLite)    │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  Observability│  │    Skills    │  │   Config     │       │
│  │  (event-store)│  │(adaptive inj)│  │ (migration)  │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
├─────────────────────────────────────────────────────────────┤
│  Tools Layer (oc_*) │ Hooks │ Skill Loader │ Installer     │
└─────────────────────────────────────────────────────────────┘
```

**Key Architecture Decisions:**
- Two-layer design: JS/TS module + filesystem assets
- Strict top-down dependency flow (no cycles)
- SQLite with FTS5 for memory
- Token budgeting for context management
- Atomic file writes with `wx` flag

#### GSD Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    Meta-prompting Layer                      │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Context    │  │     Wave      │  │    State     │     │
│  │ Engineering  │  │  Execution    │  │ Management   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │     XML      │  │     Hook     │  │   Quality    │     │
│  │  Formatting  │  │   System     │  │    Gates     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

**Key Architecture Decisions:**
- File-based state (PROJECT.md, ROADMAP.md, STATE.md)
- Wave-based parallel execution
- Atomic git commits per task
- Multi-runtime targeting (10+ platforms)

#### Superpowers Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                   Skills-Based Framework                     │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────┐      │
│  │     Automatic Skill Triggers (Context-based)     │      │
│  └──────────────────────────────────────────────────┘      │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │   Brainstorm│ │    Plan     │ │    TDD      │          │
│  │   (Socratic)│ │  (Detailed)  │ │(RED-GREEN)  │          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │   Debug     │ │   Review    │ │   Branch    │          │
│  │ (Systematic)│ │ (2-stage)   │ │  (Git-work) │          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

**Key Architecture Decisions:**
- Skills as first-class citizens
- Automatic trigger based on context
- TDD as mandatory workflow
- Subagent-driven development

#### oh-my-openagent Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                  Discipline Agent System                     │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────┐      │
│  │           Sisyphus (Orchestrator)                │      │
│  │    ┌─────────┐ ┌─────────┐ ┌─────────┐          │      │
│  │    │Prometheus│ │Hephaestus│ │ Oracle  │          │      │
│  │    │(Planner) │ │(Worker)  │ │ (Debug) │          │      │
│  │    └─────────┘ └─────────┘ └─────────┘          │      │
│  └──────────────────────────────────────────────────┘      │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │    Hash     │ │    LSP +    │ │   Skill-    │          │
│  │   Anchored  │ │  AST-Grep   │ │ embedded    │          │
│  │    Edits    │ │             │ │   MCPs      │          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

**Key Architecture Decisions:**
- Category-based agent routing
- Multi-model orchestration (best model per task)
- Hash-anchored edit tool
- Skill-embedded MCPs for context efficiency

#### ECC Architecture
```
┌─────────────────────────────────────────────────────────────┐
│               Harness Performance Optimization               │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │    Skills    │  │    Agents    │  │   Hooks &    │     │
│  │   (156)      │  │   (36)       │  │   Rules      │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │    Instinct  │  │    Harness   │  │     MCP      │     │
│  │   Learning   │  │   Audit      │  │  Configs     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

**Key Architecture Decisions:**
- Manifest-driven selective install
- Instinct-based continuous learning
- Deterministic harness audit scoring
- Cross-platform parity

---

## 6. Gaps Analysis: opencode-autopilot vs. Competition

### 6.1 Critical Gaps

#### 1. **Community Adoption Gap** (Critical)
| Metric | opencode-autopilot | Best Competitor |
|--------|:-----------------:|:---------------:|
| GitHub Stars | ~0 (private/niche) | 136K (ECC) |
| Forks | ~0 | 19.9K (ECC) |
| npm Downloads | Unknown | 1.5M+ (omo) |
| Contributors | ~1 | 30+ (ECC) |

**Impact**: Limited community resources, no marketplace presence, no third-party skills.

#### 2. **Skills Ecosystem Gap** (Critical)
- **ECC**: 156 skills covering 12 language ecosystems
- **Superpowers**: 15+ production-ready skills
- **omo**: Built-in MCPs + custom skill support
- **opencode-autopilot**: 16 bundled skills only

**Impact**: Users must build everything from scratch.

#### 3. **Autonomous Execution Gap** (High)
- **omo**: Ralph Loop - self-referential loop until 100% done
- **GSD**: SDK for headless autonomous execution
- **opencode-autopilot**: Manual phase advancement required

**Impact**: Cannot run overnight or unattended sessions.

#### 4. **Multi-Runtime Support Gap** (High)
- **GSD**: 10+ runtimes (Claude Code, OpenCode, Gemini, Kilo, Codex, Copilot, Cursor, Windsurf, Antigravity, Augment)
- **ECC**: Claude Code, Codex, Cowork, Cursor, OpenCode, Antigravity, Gemini
- **opencode-autopilot**: OpenCode only

**Impact**: Locked to single platform, limits user base.

### 6.2 Feature Gaps

#### 5. **Command Count Gap**
| Plugin | Commands |
|--------|:--------:|
| ECC | 100+ |
| GSD | 60+ |
| opencode-autopilot | 25+ |

#### 6. **Agent Specialization Gap**
| Plugin | Language Agents |
|--------|:----------------:|
| ECC | 20+ (TypeScript, Python, Go, Java, Kotlin, Rust, C++, etc.) |
| GSD | Workflow-based (researcher, planner, executor, verifier) |
| opencode-autopilot | 21 review auditors (limited language focus) |

#### 7. **Verification Testing Gap**
- **Superpowers**: Mandatory TDD enforcement
- **GSD**: Quality gates, automated verification
- **ECC**: E2E testing, verification loops
- **opencode-autopilot**: Cross-verification (limited)

#### 8. **Memory Persistence Gap**
| Plugin | Memory Type |
|--------|:-----------:|
| ECC | Instinct-based continuous learning |
| omo | Session-based |
| opencode-autopilot | SQLite with decay (good foundation) |

### 6.3 Architecture Gaps

#### 9. **Wave/Parallel Execution**
- **GSD**: Wave-based parallel execution with dependency tracking
- **omo**: Background parallel agents
- **ECC**: Multi-agent commands
- **opencode-autopilot**: Sequential phase execution

#### 10. **Hash-Anchored Edits**
- **omo**: LINE#ID content hash validation prevents stale-line errors
- **opencode-autopilot**: Standard edit tool (vulnerable to stale-line errors)

#### 11. **Context Engineering**
- **GSD**: Comprehensive file-based context management
- **ECC**: Token optimization system
- **opencode-autopilot**: Token tracking only

---

## 7. Performance Characteristics

### 7.1 Performance Metrics

| Metric | opencode-autopilot | GSD | omo | ECC |
|--------|:-----------------:|:---:|:---:|:---:|
| **Context efficiency** | Token budgeting | Size limits | Lean context | Comprehensive optimization |
| **Parallel execution** | Sequential phases | Wave-based | Background agents | Multi-agent commands |
| **Memory usage** | SQLite + decay | File-based | Session | SQLite + instincts |
| **Token overhead** | Moderate | Optimized | Minimal | Extensive optimization |
| **Startup time** | Fast | Fast | Fast | Medium (156 skills) |

### 7.2 Performance Comparison

#### GSD Performance
```
Wave Execution:
- Independent plans → Same wave → Parallel
- Dependent plans → Later wave → Sequential
- File conflicts → Sequential or same plan

Context Management:
- 200k tokens purely for implementation
- Zero accumulated garbage in fresh subagent contexts
- Size limits based on Claude's quality degradation points
```

#### omo Performance
```
Multi-Model Routing:
- Category-based task delegation
- Best model per task type
- GPT-5.4 xhigh for ultrabrain tasks

Hash-Anchored Edits:
- 6.7% → 68.3% success rate improvement
- Zero stale-line errors
```

#### ECC Performance
```
Token Optimization:
- Hook runtime controls (minimal/standard/strict)
- Aggressive truncation
- Background process optimization

Multi-Agent:
- Git worktrees for isolation
- Cascade method for parallelization
```

---

## 8. Other Differentiating Factors

### 8.1 Unique Strengths of Each Plugin

#### opencode-autopilot Unique Features
1. **8-phase orchestration pipeline**: Most comprehensive phase system
2. **21 specialized review auditors**: Deepest code analysis capability
3. **Dual-scope memory system**: SQLite-based with FTS5 and decay
4. **Confidence ledger**: Structured confidence tracking per phase/agent
5. **Pipeline decision trace**: Full audit trail of autonomous decisions

#### GSD Unique Features
1. **Multi-runtime targeting**: 10+ platforms from single codebase
2. **Atomic git commits**: Surgical, traceable commits per task
3. **Workstream management**: Parallel milestone work
4. **Brownfield support**: `/gsd:map-codebase` for existing projects
5. **Quality gates**: Built-in security, scope reduction, schema drift

#### Superpowers Unique Features
1. **Mandatory TDD**: RED-GREEN-REFACTOR enforced automatically
2. **Automatic triggers**: Skills activate without manual invocation
3. **Two-stage review**: Spec compliance + code quality
4. **Multi-platform**: Single plugin works across 5+ platforms

#### oh-my-openagent Unique Features
1. **Ultrawork command**: One word activates everything
2. **Multi-model orchestration**: Best model per task category
3. **Hash-anchored edits**: Surgical precision, zero stale-line errors
4. **Ralph Loop**: Doesn't stop until 100% done
5. **Skill-embedded MCPs**: On-demand, scoped to task

#### ECC Unique Features
1. **Largest skills ecosystem**: 156 skills, 12 language ecosystems
2. **Instinct-based learning**: Auto-extract patterns with confidence scoring
3. **Harness audit scoring**: Deterministic performance evaluation
4. **Selective install**: Manifest-driven, install only what you need
5. **AgentShield integration**: Security scanning

### 8.2 Target Users

| Plugin | Primary Target |
|--------|:--------------:|
| opencode-autopilot | Enterprise teams needing structured SDLC |
| GSD | Solo developers wanting spec-driven development |
| Superpowers | Teams wanting disciplined TDD workflow |
| omo | Developers wanting maximum automation |
| ECC | Power users wanting comprehensive tooling |

### 8.3 Development Maturity

| Plugin | Stars | Age | Commits | Contributors |
|--------|:-----:|:---:|:-------:|:-------------:|
| ECC | 136K | ~10 months | 1,063 | 30+ |
| GSD | 47K | ~1 year | 1,559 | 100+ |
| omo | 47.6K | ~1 year | 4,400 | 100+ |
| Superpowers | 134K | ~1 year | 419 | 10+ |
| opencode-autopilot | Unknown | ~6 months | ~200 | 1-2 |

---

## 9. Strategic Recommendations

### 9.1 High-Priority Gaps to Address

1. **Community Building**
   - Publish to npm with proper documentation
   - Create marketplace presence
   - Build examples and tutorials

2. **Skills Ecosystem**
   - Adopt ECC's skill framework compatibility
   - Create migration path from existing skills
   - Build first-party skills for popular frameworks

3. **Autonomous Execution**
   - Implement Ralph Loop equivalent
   - Add headless SDK capability
   - Support overnight/unattended execution

4. **Multi-Platform Support**
   - Target Claude Code marketplace
   - Add Codex, Gemini CLI support
   - Maintain single codebase approach

### 9.2 Differentiation Opportunities

1. **Enterprise Focus**: Leverage 8-phase pipeline as enterprise differentiator
2. **Deep Review**: Expand 21-agent review system into flagship feature
3. **Confidence System**: Unique structured confidence tracking
4. **Memory System**: Superior SQLite-based memory with decay

### 9.3 Recommended Feature Additions

| Priority | Feature | Reference |
|:--------:|---------|:---------:|
| P0 | Wave-based parallel execution | GSD |
| P0 | Hash-anchored edit tool | omo |
| P1 | Instinct-based learning | ECC |
| P1 | Multi-runtime targeting | GSD |
| P1 | TDD enforcement | Superpowers |
| P2 | AgentShield integration | ECC |
| P2 | Skill marketplace | ECC |
| P2 | Harness audit scoring | ECC |

---

## Sources

1. **get-shit-done (GSD)**
   - [GitHub Repository](https://github.com/gsd-build/get-shit-done) - 47.4K stars
   - [Documentation](https://github.com/gsd-build/get-shit-done/blob/main/README.md)

2. **Superpowers**
   - [GitHub Repository](https://github.com/obra/superpowers) - 134K stars
   - [BSWEN Blog Post](https://docs.bswen.com/blog/2026-03-18-what-is-superpowers/)

3. **oh-my-openagent (omo)**
   - [GitHub Repository](https://github.com/code-yeongyu/oh-my-openagent) - 47.6K stars
   - [Official Website](https://ohmyopenagent.com/)

4. **everything-claude-code (ECC)**
   - [GitHub Repository](https://github.com/affaan-m/everything-claude-code) - 136K stars
   - [Official Guide](https://github.com/affaan-m/everything-claude-code/blob/main/the-longform-guide.md)

5. **opencode-autopilot**
   - [PyPI Package](https://pypi.org/project/opencode-autopilot/)
   - [GitHub (this project)](https://github.com/joshuadavidthomas/opencode-agent-skills)

6. **opencode-agent-skills**
   - [GitHub Repository](https://github.com/joshuadavidthomas/opencode-agent-skills) - 124 stars

7. **Anthropic Agent Skills Spec**
   - [Official Documentation](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)

8. **Community Resources**
   - [VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills) - 13.8K stars
   - [Reddit Discussion on Oh-My-OpenCode](https://docs.bswen.com/blog/2026-03-10-oh-my-opencode-plugin-guide)
   - [Agent Native GSD Article](https://agentnativedev.medium.com/get-sh-t-done-meta-prompting-and-spec-driven-development-for-claude-code-and-codex-d1cde082e103)
   - [AI for Automation Superpowers Review](https://aiforautomation.io/news/2026-03-27-superpowers-claude-code-skill-118k-stars-tdd)
