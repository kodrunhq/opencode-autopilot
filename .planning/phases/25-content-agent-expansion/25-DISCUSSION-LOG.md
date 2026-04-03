# Phase 25: Content & Agent Expansion - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-04
**Phase:** 25-content-agent-expansion
**Areas discussed:** New agents, New skills, New commands, Quality vs quantity strategy

---

## New Agents

| Option | Description | Selected |
|--------|-------------|----------|
| Frontend engineer | Subagent for frontend tasks, embeds frontend-design skill | ✓ |
| Database specialist | Subagent for DB queries, migrations, schema design | ✓ |
| Security auditor | Interactive subagent for on-demand security reviews | ✓ |
| DevOps / CI-CD agent | Subagent for Docker, CI/CD, deployment configs | ✓ |

**User's choice:** All four
**Notes:** User wants comprehensive agent coverage.

## Agent Mode

| Option | Description | Selected |
|--------|-------------|----------|
| All subagent | Keep Tab cycle clean (5 primary). New agents via @mention only. | ✓ |
| Frontend as primary, rest subagent | Frontend in Tab cycle since common workflow. | |
| All primary | 9 agents in Tab cycle. | |

**User's choice:** All subagent
**Notes:** Clean Tab cycle is important — 5 primary agents is the right number.

## New Skills

| Option | Description | Selected |
|--------|-------------|----------|
| Security patterns | OWASP Top 10, auth, input validation, secrets | ✓ |
| API design | REST/GraphQL conventions, status codes, pagination | ✓ |
| Database patterns | Query optimization, migrations, schema design | ✓ |
| Docker & deployment | Dockerfile best practices, CI/CD, docker-compose | ✓ |

**User's choice:** All four

## Language Skills

| Option | Description | Selected |
|--------|-------------|----------|
| No more languages | 6 languages cover 90%+ of users. Focus on workflow skills. | ✓ |
| Add Ruby and Kotlin | Two popular missing languages | |
| Add PHP and Swift | PHP/Laravel and iOS ecosystems | |

**User's choice:** No more languages
**Notes:** Gap analysis found niche language skills rarely used.

## New Commands

| Option | Description | Selected |
|--------|-------------|----------|
| /oc-security-audit | Run security review, routes to security-auditor | ✓ |
| /oc-refactor | Analyze and refactor code, routes to coder | ✓ |
| /oc-explain | Explain code, routes to researcher | |
| /oc-migrate-db | DB migrations, routes to db-specialist | |

**User's choice:** /oc-security-audit and /oc-refactor

## Quality Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| 22-25 high-quality skills | Add 4 new, each 200-400 lines of patterns | ✓ |
| 30+ skills broader coverage | 12+ skills, thinner content per skill | |
| Keep 18, focus on agents/commands | Skills are good enough | |

**User's choice:** 22-25 high-quality skills
**Notes:** Quality > quantity per gap analysis findings.

---

## Claude's Discretion

- Exact skill content and internal organization
- Agent permission scopes per agent
- maxSteps values for new agents
- Skill requires: dependencies

## Deferred Ideas

- TDD enforcement hook → Future phase
- Context engineering improvements → Future phase
- Additional language skills (Ruby, Kotlin, PHP, Swift) → Revisit if demand
- /oc-explain command → Lower priority
- /oc-migrate-db command → Niche
