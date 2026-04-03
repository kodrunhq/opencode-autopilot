# Phase 25: Content & Agent Expansion - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Add 4 new subagent agents (frontend-engineer, db-specialist, security-auditor, devops), 4 new skills (security-patterns, api-design, database-patterns, docker-deployment), and 2 new commands (/oc-security-audit, /oc-refactor). Target 22-25 high-quality skills total. All new agents are subagent-only (no Tab cycle changes).

</domain>

<decisions>
## Implementation Decisions

### New Agents (4 subagents)
- **D-01:** Frontend engineer agent — subagent (`mode: "subagent"`), embeds `frontend-design` skill, accessible via `@frontend-engineer`. For frontend-focused tasks (component architecture, responsive design, accessibility).
- **D-02:** Database specialist agent — subagent, embeds new `database-patterns` skill. For query optimization, migrations, schema design. Accessible via `@db-specialist`.
- **D-03:** Security auditor agent — subagent, embeds new `security-patterns` skill. For on-demand security reviews, OWASP checks. Accessible via `@security-auditor`. Distinct from the review pipeline's `security-auditor` review agent — this is interactive.
- **D-04:** DevOps agent — subagent, embeds new `docker-deployment` skill. For Docker, CI/CD, deployment configs. Accessible via `@devops`.
- **D-05:** All 4 agents are subagent-only — Tab cycle stays clean at 5 primaries (autopilot, coder, debugger, planner, reviewer).
- **D-06:** Follow Phase 20 pattern: static skill embedding, role-scoped permissions, `Object.freeze()`.

### New Skills (4)
- **D-07:** `security-patterns` — OWASP Top 10, auth patterns, input validation, secret management, XSS/CSRF/SQLi prevention. Stacks: `[]` (universal).
- **D-08:** `api-design` — REST/GraphQL conventions, status codes, pagination, versioning, error response formats. Stacks: `[]` (universal).
- **D-09:** `database-patterns` — Query optimization, migration strategies, schema design, indexing, connection pooling. Stacks: `[]` (universal).
- **D-10:** `docker-deployment` — Dockerfile best practices, multi-stage builds, docker-compose, CI/CD patterns, health checks. Stacks: `[]` (universal).
- **D-11:** Each skill is 200-400 lines of actionable patterns. Quality over quantity — 4-6 well-chosen skills outperform 150+ (per gap analysis).
- **D-12:** All skills use `stacks: []` (universal) since security, API, DB, and Docker patterns are language-agnostic.
- **D-13:** No new language-specific skills — current 6 (TypeScript, Python, Go, Rust, Java, C#) cover 90%+ of users.

### New Commands (2)
- **D-14:** `/oc-security-audit` — Routes to `security-auditor` agent. Runs a security review of current changes. Description: "Run a security audit of recent code changes".
- **D-15:** `/oc-refactor` — Routes to `coder` agent. Analyzes and refactors selected code. Description: "Analyze and refactor code for improved design and maintainability".
- **D-16:** Both commands include `agent:` frontmatter routing (Phase 24 fix pattern).

### Quality Strategy
- **D-17:** Target 22-25 total skills (18 current + 4 new). Focus on high-quality, actionable patterns.
- **D-18:** No new dependencies — skills are pure markdown content.

### Claude's Discretion
- Exact skill content (within the domain + quality constraints)
- Agent permission scopes (read/bash/edit/webfetch per agent)
- `maxSteps` values for new agents
- Skill `requires:` dependencies (if any skill depends on another)
- Whether to add `argument-hint` to new commands
- Internal organization of skill sections

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Agent Registration Pattern
- `src/agents/index.ts` — Config hook, agents map, registerAgents()
- `src/agents/documenter.ts` — Reference subagent pattern (mode: "subagent")
- `src/agents/coder.ts` — Reference skill embedding pattern (Phase 24)

### Existing Skills (reference pattern)
- `assets/skills/frontend-design/SKILL.md` — Skill to embed in frontend-engineer agent
- `assets/skills/coding-standards/SKILL.md` — Reference for universal skill format
- `assets/skills/typescript-patterns/SKILL.md` — Reference for language-specific skill format

### Existing Commands (reference pattern)
- `assets/commands/oc-tdd.md` — Reference for command with agent routing
- `assets/commands/oc-review-pr.md` — Reference for review-type command

### Gap Analysis
- `docs/gap-analysis-deep-dive.md` §6 — Skills value analysis (quality > quantity)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/agents/documenter.ts` — Subagent pattern reference (mode: "subagent", skill embedding)
- `src/skills/adaptive-injector.ts` — Stack detection + token budgeting (skills automatically filtered and budget-capped)
- `src/skills/loader.ts` — Loads all skill directories from assets
- `src/utils/validators.ts` — Asset name validation (lowercase-hyphenated, 1-64 chars)

### Established Patterns
- Skills: YAML frontmatter (name, description, stacks, requires) + markdown body
- Agents: Static skill embedding via template literal, Object.freeze(), role-scoped permissions
- Commands: YAML frontmatter (description, agent, argument-hint) + markdown body

### Integration Points
- `src/agents/index.ts` — Add 4 new agents to `agents` map (alphabetical order)
- `assets/skills/` — Create 4 new skill directories
- `assets/commands/` — Create 2 new command files
- `src/installer.ts` — No changes needed (installer auto-discovers assets)

</code_context>

<specifics>
## Specific Ideas

- Security-auditor agent name must not collide with the review pipeline's `security-auditor` agent (in `src/review/agents/`). Use `security-auditor` for the subagent since the review agents are namespaced differently.
- Frontend engineer should also embed coding-standards skill alongside frontend-design (both agents that write code should know the standards)
- The /oc-refactor command should detect the project language and adapt its refactoring guidance (same pattern as /oc-tdd with inline language detection)

</specifics>

<deferred>
## Deferred Ideas

- TDD enforcement hook (PostToolUse) — warn when Write used without prior test execution. Future phase.
- Context engineering improvements — selective history loading, structured context files. Future phase.
- Additional language skills (Ruby, Kotlin, PHP, Swift) — gap analysis shows diminishing returns. Revisit if user demand arises.
- /oc-explain command — educational use case, lower priority than workflow commands
- /oc-migrate-db command — niche, can be added later alongside db-specialist agent enhancements

</deferred>

---

*Phase: 25-content-agent-expansion*
*Context gathered: 2026-04-04*
