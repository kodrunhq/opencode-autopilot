# OpenCode Autopilot Skills Benchmark

**Date**: April 5, 2026  
**Comparison**: opencode-autopilot vs oh-my-openagent (OMO) vs other popular plugins

---

## Executive Summary

**opencode-autopilot** is a comprehensive autonomous SDLC orchestration plugin with:
- **22 production-ready skills** covering design, development, testing, and deployment
- **13 slash commands** for in-session workflows (brainstorming, TDD, planning, refactoring)
- **8 agent groups** with adversarial model diversity for multi-agent code review
- **Focus**: Full pipeline automation (idea → research → design → plan → build → ship → retrospective)

**oh-my-openagent (OMO)** is a specialized agent harness with:
- **4 builtin skills** (browser automation, UI/UX design, git mastery, agent browser)
- **3 project-local skills** (GitHub triage, pre-publish review, PR workflow)
- **4 project-local commands** (publish, deadcode removal, unpublished changes, easter egg)
- **Focus**: Multi-model orchestration, parallel background agents, LSP/AST tools

---

## Skills Comparison

### opencode-autopilot Skills (22 total)

#### Design & Architecture (3)
| Skill | Purpose | Scope |
|-------|---------|-------|
| **brainstorming** | Socratic design refinement methodology | 5-phase divergent/convergent thinking |
| **api-design** | REST/GraphQL API conventions | Resource naming, HTTP methods, pagination, versioning |
| **frontend-design** | State-of-the-art UX/UI patterns | Component architecture, responsive design, accessibility |

#### Development Patterns (6)
| Skill | Purpose | Scope |
|-------|---------|-------|
| **typescript-patterns** | TypeScript & Bun idioms | Type-level programming, testing, performance |
| **python-patterns** | Pythonic patterns | Type hints, async, pytest, project organization |
| **go-patterns** | Idiomatic Go | Error handling, concurrency, interfaces, testing |
| **rust-patterns** | Rust ownership & safety | Error handling with Result/Option, unsafe guidelines |
| **java-patterns** | Spring Boot conventions | Records, JPA/Hibernate, common pitfalls |
| **csharp-patterns** | .NET idiomatic patterns | Records, DI, Entity Framework, async |

#### Quality & Testing (4)
| Skill | Purpose | Scope |
|-------|---------|-------|
| **tdd-workflow** | Strict RED-GREEN-REFACTOR TDD | Anti-pattern catalog, explicit failure modes |
| **e2e-testing** | End-to-end testing patterns | Critical user flows, system-as-user testing |
| **code-review** | Structured code review methodology | Requesting, performing, responding to feedback |
| **verification** | Pre-completion verification checklist | Catch issues before marking work done |

#### Infrastructure & DevOps (2)
| Skill | Purpose | Scope |
|-------|---------|-------|
| **docker-deployment** | Container best practices | Dockerfile, orchestration, CI/CD, security, health checks |
| **database-patterns** | Database design & optimization | Query optimization, migrations, indexing, transactions |

#### Process & Workflow (4)
| Skill | Purpose | Scope |
|-------|---------|-------|
| **plan-writing** | Feature decomposition | Bite-sized tasks, file paths, dependencies, verification |
| **plan-executing** | Batch execution with verification | Implementation with checkpoints after each task |
| **systematic-debugging** | 4-phase root cause analysis | Bug diagnosis and resolution methodology |
| **git-worktrees** | Parallel development | Isolated branches without stashing |

#### Security & Maintenance (2)
| Skill | Purpose | Scope |
|-------|---------|-------|
| **security-patterns** | OWASP Top 10 patterns | Authentication, authorization, input validation, secrets |
| **coding-standards** | Universal best practices | Naming, file organization, error handling, immutability |

#### Meta & Context (1)
| Skill | Purpose | Scope |
|-------|---------|-------|
| **strategic-compaction** | Context window management | Token budgeting, strategic summarization |

---

### oh-my-openagent Skills (7 total)

#### Builtin Skills (4)
| Skill | Purpose | Scope |
|-------|---------|-------|
| **dev-browser** | Browser automation with persistent state | Navigation, form filling, screenshots, data extraction |
| **agent-browser** | Web testing & interaction | Form filling, screenshots, web app testing |
| **frontend-ui-ux** | Designer-turned-developer | Aesthetic direction, typography, color, micro-interactions |
| **git-master** | Git expert (3 specializations) | Atomic commits, rebase/squash, history archaeology |

#### Project-Local Skills (3)
| Skill | Purpose | Scope |
|-------|---------|-------|
| **github-triage** | Read-only GitHub issue/PR analysis | Evidence-backed reports, no actions taken |
| **pre-publish-review** | 16-agent pre-publish gate | Deep per-change analysis, release synthesis |
| **work-with-pr** | Full PR lifecycle automation | Worktree → implement → commit → PR → verify → merge |

---

## Commands Comparison

### opencode-autopilot Commands (13 total)

| Command | Purpose |
|---------|---------|
| `/oc-brainstorm` | Start Socratic design refinement session |
| `/oc-tdd` | Implement feature with RED-GREEN-REFACTOR |
| `/oc-quick` | Quick task (skip research, go straight to plan+build+ship) |
| `/oc-write-plan` | Decompose feature into structured plan with waves |
| `/oc-refactor` | Analyze and refactor code for improved design |
| `/oc-security-audit` | Run security audit on recent changes |
| `/oc-review-pr` | Review GitHub PR with structured feedback |
| `/oc-review-agents` | Review and improve agents.md file |
| `/oc-stocktake` | Audit installed skills, commands, agents |
| `/oc-update-docs` | Detect and suggest documentation updates |
| `/oc-new-agent` | Create custom agent in-session |
| `/oc-new-skill` | Create custom skill in-session |
| `/oc-new-command` | Create custom command in-session |

### oh-my-openagent Commands (4 total)

| Command | Purpose |
|---------|---------|
| `/publish` | Publish to npm via GitHub Actions |
| `/get-unpublished-changes` | Compare HEAD with latest npm version |
| `/remove-deadcode` | Remove unused code with LSP verification |
| `/omomomo` | Easter egg (about oh-my-opencode) |

---

## Gap Analysis: What Autopilot Lacks

### Missing from Autopilot (OMO has these)

1. **Browser Automation Skills** (2 skills)
   - `dev-browser`: Persistent state browser automation
   - `agent-browser`: Web testing and interaction
   - **Impact**: Can't automate web testing, form filling, screenshots without external tools
   - **Recommendation**: Add `/browser-automation` skill with Playwright integration

2. **Git Mastery Skill** (1 skill)
   - `git-master`: Atomic commits, rebase/squash, history archaeology
   - **Impact**: Autopilot has `git-worktrees` but lacks comprehensive git workflow expertise
   - **Recommendation**: Enhance `git-worktrees` or create dedicated `/git-master` skill

3. **GitHub Integration Skills** (2 skills)
   - `github-triage`: Read-only issue/PR analysis
   - `work-with-pr`: Full PR lifecycle (worktree → implement → PR → merge)
   - **Impact**: No built-in GitHub workflow automation
   - **Recommendation**: Add `/github-workflow` skill for PR lifecycle automation

4. **Pre-Publish Review Skill** (1 skill)
   - `pre-publish-review`: 16-agent nuclear-grade release gate
   - **Impact**: No release validation before npm publish
   - **Recommendation**: Add `/pre-publish-review` skill for release gates

---

## Gap Analysis: What OMO Lacks

### Missing from OMO (Autopilot has these)

1. **Language-Specific Patterns** (6 skills)
   - TypeScript, Python, Go, Rust, Java, C#
   - **Impact**: OMO focuses on orchestration, not language idioms
   - **Recommendation**: Add language pattern skills for broader developer audience

2. **Testing Methodology Skills** (2 skills)
   - TDD workflow, E2E testing patterns
   - **Impact**: No structured testing guidance
   - **Recommendation**: Add `/tdd-workflow` and `/e2e-testing` skills

3. **Infrastructure & DevOps** (2 skills)
   - Docker deployment, Database patterns
   - **Impact**: No container or database guidance
   - **Recommendation**: Add `/docker-deployment` and `/database-patterns` skills

4. **Process & Workflow Skills** (4 skills)
   - Plan writing, Plan executing, Systematic debugging, Git worktrees
   - **Impact**: No structured planning or debugging methodology
   - **Recommendation**: Add planning and debugging skills

5. **Security & Standards** (2 skills)
   - Security patterns, Coding standards
   - **Impact**: No OWASP or universal best practices
   - **Recommendation**: Add `/security-patterns` and `/coding-standards` skills

6. **API Design Skill** (1 skill)
   - REST/GraphQL conventions
   - **Impact**: No API design guidance
   - **Recommendation**: Add `/api-design` skill

---

## Competitive Landscape

### Other Popular OpenCode Plugins (from npm registry)

| Plugin | Focus | Key Features |
|--------|-------|-------------|
| **oh-my-opencode** (v3.15.2) | Agent orchestration | Multi-model, parallel agents, LSP/AST tools |
| **@viberlabs/opencode-plugin** (v2.1.35) | Orchestration layer | AI-native development |
| **@tarquinen/opencode-dcp** (v3.1.8) | Context optimization | Token pruning, context management |
| **opencode-supermemory** (v2.0.6) | Persistent memory | Supermemory integration |
| **opencode-mem** (v2.13.0) | Vector memory | Local vector database |
| **opencode-graphiti** (v0.2.2) | Knowledge graphs | Graphiti integration |
| **opencode-scheduler** (v1.3.0) | Job scheduling | Cron/launchd/systemd |
| **opencode-plugin-apprise** (v1.3.1) | Notifications | Slack, Discord, Telegram |
| **opencode-lmstudio** (v0.3.0) | Local LLMs | LM Studio support |
| **opencode-plugin-openspec** (v0.1.4) | Architecture planning | OpenSpec integration |
| **@kompassdev/opencode** (v0.11.0) | Repo navigation | Code review, PR, ticketing |

### Autopilot's Unique Strengths

1. **Comprehensive skill library** (22 skills) — broadest coverage of any plugin
2. **Language-specific patterns** — 6 language skills (TS, Python, Go, Rust, Java, C#)
3. **Full SDLC pipeline** — research → design → plan → build → ship → retrospective
4. **Adversarial model diversity** — 8 agent groups with different model families
5. **In-session creation** — create agents, skills, commands without leaving OpenCode
6. **Structured methodologies** — TDD, brainstorming, debugging, code review, verification

### OMO's Unique Strengths

1. **Browser automation** — persistent state, form filling, screenshots
2. **Git mastery** — atomic commits, rebase/squash, history archaeology
3. **GitHub integration** — triage, PR workflow, pre-publish review
4. **Designer-focused UI/UX** — aesthetic direction, typography, color theory
5. **Multi-model orchestration** — parallel background agents, model fallback
6. **LSP/AST tools** — deep code analysis capabilities

---

## Recommendations for Autopilot

### High-Priority Additions (would close major gaps)

1. **Browser Automation Skill** (Effort: Medium, Impact: High)
   - Integrate Playwright for web testing, form filling, screenshots
   - Trigger: "navigate to", "fill form", "take screenshot", "test website"
   - Complements existing E2E testing skill

2. **GitHub Workflow Skill** (Effort: Medium, Impact: High)
   - Full PR lifecycle: worktree → implement → atomic commits → PR → verify → merge
   - Trigger: "implement and PR", "work on this as a PR", "create PR"
   - Integrates with existing plan-writing and plan-executing skills

3. **Pre-Publish Review Skill** (Effort: High, Impact: Medium)
   - Multi-agent release gate before npm publish
   - Trigger: "ready to publish?", "pre-publish review", "safe to publish?"
   - Complements security-patterns and code-review skills

4. **Enhanced Git Mastery Skill** (Effort: Medium, Impact: Medium)
   - Expand git-worktrees with atomic commits, rebase/squash, history archaeology
   - Trigger: "commit", "rebase", "who changed", "when was X added"
   - Builds on existing git-worktrees skill

### Medium-Priority Additions (nice-to-have)

5. **GitHub Triage Skill** (Effort: Low, Impact: Low)
   - Read-only issue/PR analysis with evidence-backed reports
   - Trigger: "triage", "triage issues", "triage PRs"
   - Complements code-review skill

6. **Performance Optimization Skill** (Effort: High, Impact: Medium)
   - Database query optimization, bundle size reduction, memory profiling
   - Complements database-patterns and language-specific skills

7. **Accessibility Audit Skill** (Effort: Medium, Impact: Medium)
   - WCAG compliance checking, semantic HTML, keyboard navigation
   - Complements frontend-design skill

---

## Skill Maturity Assessment

### Autopilot Skills (by maturity)

| Maturity | Skills | Notes |
|----------|--------|-------|
| **Production** (22/22) | All skills | Comprehensive, well-documented, tested |
| **Stable** | Language patterns, testing, DevOps | Widely used, battle-tested |
| **Emerging** | Strategic compaction | Newer, token budgeting still evolving |

### OMO Skills (by maturity)

| Maturity | Skills | Notes |
|----------|--------|-------|
| **Production** (7/7) | All skills | Focused, specialized, well-maintained |
| **Stable** | Browser automation, git-master | Core features, widely used |
| **Specialized** | GitHub integration, UI/UX | Project-specific, highly opinionated |

---

## Conclusion

**opencode-autopilot** is the most comprehensive OpenCode plugin for autonomous SDLC orchestration, with 22 production-ready skills covering the full development lifecycle. It excels at:
- Full pipeline automation (idea → ship)
- Language-specific guidance (6 languages)
- Structured methodologies (TDD, brainstorming, debugging)
- Adversarial model diversity for code review

**oh-my-openagent** is a specialized agent harness excelling at:
- Browser automation and web testing
- Git workflow mastery
- GitHub integration and PR lifecycle
- Designer-focused UI/UX

**Recommendation**: Autopilot should add browser automation and GitHub workflow skills to close the gap with OMO, while maintaining its focus on comprehensive SDLC orchestration.

