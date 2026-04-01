<p align="center">
  <img src="https://img.shields.io/npm/v/@kodrunhq/opencode-autopilot?color=blue&label=npm" alt="npm version" />
  <img src="https://img.shields.io/github/actions/workflow/status/kodrunhq/opencode-autopilot/ci.yml?branch=main&label=CI" alt="CI" />
  <img src="https://img.shields.io/github/license/kodrunhq/opencode-autopilot" alt="license" />
  <img src="https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/runtime-Bun-f9f1e1?logo=bun&logoColor=black" alt="Bun" />
</p>

<p align="center">
  <img src="assets/logo.svg" alt="opencode-autopilot logo" width="120" height="120" />
</p>

<h1 align="center">opencode-autopilot</h1>

<p align="center">
  <strong>Autonomous AI coding pipeline for OpenCode.</strong><br/>
  Idea to shipped code &bull; 21-agent code review &bull; Model fallback &bull; Zero config
</p>

---

A plugin for the [OpenCode](https://github.com/nickthecook/opencode) AI coding CLI that turns it into a fully autonomous software development system. Give it an idea — it researches, designs architecture, plans tasks, implements code, runs multi-agent code review, writes documentation, and extracts lessons for next time. All in one pipeline, all hands-free.

## Why opencode-autopilot?

- **Full SDLC, one command.** Eight pipeline phases take your idea from research through implementation to documentation — no manual handoffs.
- **21 specialized review agents.** Security, logic, dead code, concurrency, type soundness, React patterns, Go idioms, database queries — automatically selected based on your stack.
- **Learns from every run.** The retrospective phase extracts lessons and injects them into future pipelines. Your agent gets smarter over time.
- **Never stuck on one model.** Automatic fallback chains retry with alternative models when rate-limited or unavailable. Configurable per agent.
- **Extend without leaving the TUI.** Create custom agents, skills, and commands in-session with `/new-agent`, `/new-skill`, `/new-command`.
- **Zero config to start.** Install, add to `opencode.json`, done. Assets self-install on first load and never overwrite your customizations.

## Quick Start

**Install:**

```bash
npm install -g @kodrunhq/opencode-autopilot
```

**Add to your OpenCode config** (`opencode.json`):

```json
{
  "plugin": ["@kodrunhq/opencode-autopilot"]
}
```

That's it. Launch OpenCode and the plugin auto-installs agents, skills, and commands to `~/.config/opencode/`.

## The Pipeline

opencode-autopilot runs an 8-phase autonomous pipeline, each driven by a specialized agent:

```
IDEA ──► RECON ──► CHALLENGE ──► ARCHITECT ──► EXPLORE ──► PLAN ──► BUILD ──► SHIP ──► RETROSPECTIVE
           │          │              │                        │         │        │            │
       Research   Enhance      Multi-proposal           Task plan   Code +   Docs &     Extract
       & assess   the idea     design arena             with waves  review   changelog  lessons
```

| Phase | Agent | What happens |
|-------|-------|-------------|
| **RECON** | oc-researcher | Domain research, feasibility assessment, technology landscape |
| **CHALLENGE** | oc-challenger | Proposes ambitious enhancements to the original idea |
| **ARCHITECT** | oc-architect × N | Multiple design proposals debated by oc-critic; depth scales with confidence |
| **EXPLORE** | — | Reserved for speculative analysis (future) |
| **PLAN** | oc-planner | Decomposes architecture into wave-scheduled tasks (max 300-line diffs each) |
| **BUILD** | oc-implementer | Implements code with inline review; 3-strike limit on CRITICAL findings |
| **SHIP** | oc-shipper | Generates walkthrough, architectural decisions, and changelog |
| **RETROSPECTIVE** | oc-retrospector | Extracts lessons → injected into future runs |

### Confidence-driven architecture

The ARCHITECT phase uses a **multi-proposal arena**. Based on confidence signals from RECON:

- **High confidence** → 1 architecture proposal
- **Medium confidence** → 2 competing proposals (simplicity vs. extensibility)
- **Low confidence** → 3 competing proposals + critic evaluation

### Strike-limited builds

BUILD tracks implementation quality with a strike system:

- Each CRITICAL review finding = 1 strike
- 3 strikes → pipeline stops (prevents infinite retry loops)
- Non-critical findings generate fix instructions without strikes
- Waves execute in order; a wave advances only after passing review

## Code Review

The `oc_review` tool provides a 4-stage multi-agent review pipeline:

**Stage 1 — Specialist dispatch:** Auto-detects your stack from changed files and dispatches relevant agents in parallel.

**Stage 2 — Cross-verification:** Each agent reviews other agents' findings to filter noise and catch missed issues.

**Stage 3 — Adversarial review:** Red-team agent hunts for exploits; product-thinker checks for UX gaps.

**Stage 4 — Report or fix cycle:** CRITICAL findings with actionable fixes trigger an automatic fix cycle; everything else lands in the final report.

### 21 Review Agents

| Category | Agents | When selected |
|----------|--------|--------------|
| **Universal** (always run) | logic-auditor, security-auditor, code-quality-auditor, test-interrogator, silent-failure-hunter, contract-verifier | Every review |
| **Stack-aware** (auto-selected) | type-soundness, react-patterns-auditor, go-idioms-auditor, python-django-auditor, rust-safety-auditor, database-auditor, auth-flow-verifier, state-mgmt-auditor, concurrency-checker, scope-intent-verifier, wiring-inspector, dead-code-scanner, spec-checker | Based on changed file types |
| **Sequenced** (run last) | red-team, product-thinker | After all findings collected |

Review memory persists per project — false positives are tracked and suppressed in future reviews (auto-pruned after 30 days).

## Model Fallback

When a model is rate-limited, unavailable, or returns an error, the fallback system automatically:

1. Classifies the error (rate limit, auth, quota, service unavailable, etc.)
2. Selects the next model from the fallback chain
3. Replays the conversation on the new model
4. Shows a toast notification (configurable)
5. Recovers to the primary model after a cooldown period

Configure fallback chains globally or per agent:

```json
{
  "fallback": {
    "enabled": true,
    "retryOnErrors": [401, 402, 429, 500, 502, 503, 504],
    "maxFallbackAttempts": 10,
    "cooldownSeconds": 60,
    "timeoutSeconds": 30,
    "notifyOnFallback": true
  },
  "fallback_models": ["anthropic/claude-sonnet", "openai/gpt-4o"]
}
```

## Bundled Assets

The plugin ships with production-ready assets that auto-install to `~/.config/opencode/`:

| Type | Assets | Purpose |
|------|--------|---------|
| **Agents** | researcher, metaprompter, documenter, pr-reviewer, autopilot | Research, prompt optimization, docs, PR review, full pipeline |
| **Commands** | `/configure`, `/new-agent`, `/new-skill`, `/new-command`, `/review-pr` | Setup, extend the plugin in-session, trigger PR reviews |
| **Skills** | coding-standards | Universal best practices (naming, file org, error handling, immutability, DRY, validation) |

### In-session creation

Extend the plugin without leaving OpenCode:

- **`/new-agent`** — Create a custom agent with YAML frontmatter + system prompt
- **`/new-skill`** — Create a skill directory with domain knowledge
- **`/new-command`** — Create a slash command (validates against built-in names)

All created assets write to `~/.config/opencode/` and are available immediately.

## Configuration

Config lives at `~/.config/opencode/opencode-autopilot.json` (auto-created on first load):

```json
{
  "version": 3,
  "configured": true,
  "models": {
    "oc-researcher": "anthropic/claude-sonnet",
    "oc-implementer": "anthropic/claude-opus"
  },
  "orchestrator": {
    "autonomy": "full",
    "strictness": "normal",
    "phases": {
      "recon": true,
      "challenge": true,
      "architect": true,
      "plan": true,
      "build": true,
      "ship": true,
      "retrospective": true
    }
  },
  "confidence": {
    "enabled": true,
    "thresholds": { "proceed": "MEDIUM", "abort": "LOW" }
  },
  "fallback": { "enabled": true },
  "fallback_models": ["anthropic/claude-sonnet"]
}
```

| Setting | Options | Default |
|---------|---------|---------|
| `orchestrator.autonomy` | `full`, `supervised`, `manual` | `full` |
| `orchestrator.strictness` | `strict`, `normal`, `lenient` | `normal` |
| `orchestrator.phases.*` | `true` / `false` | all `true` |
| `confidence.thresholds.proceed` | `HIGH`, `MEDIUM`, `LOW` | `MEDIUM` |
| `confidence.thresholds.abort` | `HIGH`, `MEDIUM`, `LOW` | `LOW` |

Config auto-migrates across schema versions (v1 → v2 → v3).

## Tools

The plugin registers 11 tools, all prefixed with `oc_` to avoid conflicts with OpenCode built-ins:

| Tool | Purpose |
|------|---------|
| `oc_orchestrate` | Core pipeline state machine — start a run or advance phases |
| `oc_review` | Multi-agent code review (4-stage pipeline) |
| `oc_state` | Query and patch pipeline state |
| `oc_phase` | Phase transitions and validation |
| `oc_confidence` | Confidence ledger management |
| `oc_plan` | Query task waves and status counts |
| `oc_forensics` | Diagnose pipeline failures (recoverable vs. terminal) |
| `oc_create_agent` | Create custom agents in-session |
| `oc_create_skill` | Create custom skills in-session |
| `oc_create_command` | Create custom commands in-session |
| `oc_placeholder` | Plugin health check |

## Architecture

```
src/
├── index.ts                 Plugin entry — registers tools, hooks, fallback handlers
├── config.ts                Zod-validated config with v1→v2→v3 migration
├── installer.ts             Self-healing asset copier (COPYFILE_EXCL, never overwrites)
├── tools/                   Tool definitions (thin wrappers calling *Core functions)
├── templates/               Pure functions: input → markdown string
├── review/                  21-agent review engine, stack gate, memory, severity
├── orchestrator/
│   ├── handlers/            Per-phase state machine handlers
│   ├── fallback/            Model fallback: classifier, manager, state, chain resolver
│   ├── artifacts.ts         Phase artifact path management
│   ├── lesson-memory.ts     Cross-run lesson persistence
│   └── schemas.ts           Pipeline state Zod schemas
└── utils/                   Validators, paths, fs-helpers, gitignore management
```

**Dependency flow** (strictly top-down, no cycles):
`index.ts` → `tools/*` → `templates/*` + `utils/*` → Node built-ins + `yaml`

**Key patterns:**
- **Atomic writes** — all file operations use tmp + rename to prevent corruption
- **Immutable state** — spread operators, `Object.freeze()`, readonly arrays
- **Bidirectional validation** — Zod parse on read AND write
- **Self-healing assets** — bundled files copy on load, never overwrite user customizations

## Contributing

```bash
git clone https://github.com/kodrunhq/opencode-autopilot.git
cd opencode-autopilot
bun install
bun test && bun run lint
```

744 tests across 59 files. No build step — Bun runs TypeScript natively.

## License

[MIT](LICENSE)
