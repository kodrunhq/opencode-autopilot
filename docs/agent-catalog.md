# Agent Catalog

## Standard Agents (9)

Registered in `src/agents/index.ts`. These are the primary Tab-cycle agents visible to users.

| Agent | Role | Model Group |
|-------|------|-------------|
| `autopilot` | Full autonomous orchestration | architects |
| `coder` | Production code implementation | builders |
| `debugger` | Bug diagnosis and resolution | builders |
| `metaprompter` | Prompt tuning and optimization | utilities |
| `planner` | Task decomposition and planning | architects |
| `pr-reviewer` | Pull request scanning | utilities |
| `researcher` | Domain research and analysis | researchers |
| `reviewer` | Code review orchestration | reviewers |
| `security-auditor` | Security-focused code analysis | reviewers |

## Pipeline Agents (8)

Registered in `src/agents/pipeline/index.ts`. These drive the 8-phase autonomous pipeline.

| Agent | Pipeline Phase(s) | Model Group |
|-------|-------------------|-------------|
| `oc-researcher` | RECON, EXPLORE | researchers |
| `oc-challenger` | CHALLENGE | challengers |
| `oc-architect` | ARCHITECT | architects |
| `oc-critic` | ARCHITECT (debate) | challengers |
| `oc-planner` | PLAN | architects |
| `oc-implementer` | BUILD | builders |
| `oc-reviewer` | REVIEW | reviewers |
| `oc-shipper` | SHIP, RETROSPECTIVE | communicators |

## Review Agents (13)

Registered in `src/review/agents/index.ts`. These power the 4-stage multi-agent code review pipeline (`oc_review`).

### Universal (always dispatched)

| Agent | Focus |
|-------|-------|
| `logic-auditor` | Logic errors, off-by-one, null handling |
| `security-auditor` | OWASP Top 10, injection, auth flaws |
| `code-quality-auditor` | DRY, SOLID, naming, complexity |
| `test-interrogator` | Test coverage, edge cases, test quality |
| `code-hygiene-auditor` | Dead code, unused imports, formatting |
| `contract-verifier` | API contracts, type safety, interface compliance |

### Stack-aware (auto-selected by file types)

| Agent | Triggered By |
|-------|-------------|
| `architecture-verifier` | Multi-module changes, config files |
| `database-auditor` | SQL, migration, ORM files |
| `correctness-auditor` | Algorithm-heavy, math, data processing |
| `frontend-auditor` | CSS, JSX/TSX, component files |
| `language-idioms-auditor` | Language-specific patterns |

### Sequenced (run after all findings collected)

| Agent | Role |
|-------|------|
| `red-team` | Adversarial exploit hunting |
| `product-thinker` | UX completeness, user-facing gaps |

## Deprecated Agent Remap

The following agents were consolidated in Phase 41. References to deprecated names are automatically remapped via `DEPRECATED_AGENT_REMAP` in `src/registry/resolver.ts`:

| Deprecated Name | Maps To |
|----------------|---------|
| `documenter` | `coder` |
| `devops` | `coder` |
| `frontend-engineer` | `coder` |
| `db-specialist` | `coder` |
| `oc-explorer` | `oc-researcher` |
| `oc-retrospector` | `oc-shipper` |

## Suppressed Native Agents

OpenCode's built-in `plan` and `build` agents are suppressed by the plugin config hook to avoid duplicate planning/building functionality:

```json
{ "disable": true, "mode": "subagent", "hidden": true }
```

## Model Group Assignments

All agents resolve their model via the group system in `src/registry/model-groups.ts`. Per-agent overrides are supported via the `overrides` field in `opencode-autopilot.json`.

| Group | Purpose |
|-------|---------|
| `architects` | System design, planning, orchestration |
| `challengers` | Architecture critique, design flaw detection |
| `builders` | Production code implementation |
| `reviewers` | Bug finding, security, code quality |
| `red-team` | Adversarial final pass |
| `researchers` | Domain research, feasibility |
| `communicators` | Documentation, changelogs |
| `utilities` | Fast lookups, prompt tuning |
