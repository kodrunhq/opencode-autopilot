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
  Idea to shipped code &bull; 21-agent code review &bull; Adversarial model diversity &bull; Guided setup
</p>

---

A plugin for the [OpenCode](https://github.com/opencode-ai/opencode) AI coding CLI that turns it into a fully autonomous software development system. Give it an idea — it researches, designs architecture, plans tasks, implements code, runs multi-agent code review, writes documentation, and extracts lessons for next time.

The core insight: **adversarial model diversity**. Agents that review each other's work use different model families. Your architect designs in Claude, your critic challenges in GPT, your red team attacks from Gemini — three different reasoning patterns catching three different classes of bugs.

## Quick Start

### Option A: AI-guided setup (recommended)

Paste this into your AI session:

```
Install and configure opencode-autopilot by following the instructions here:
https://raw.githubusercontent.com/kodrunhq/opencode-autopilot/main/docs/guide/installation.md
```

The AI walks you through installation, model assignment for each agent group, and verification.

### Option B: CLI installer

```bash
bunx @kodrunhq/opencode-autopilot install
```

This registers the plugin in `opencode.json` and creates a starter config. Then launch OpenCode and run `/oc-configure` to set up your model assignments.

### Option C: Manual setup

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

Launch OpenCode. The plugin auto-installs agents, skills, and commands on first load and shows a welcome toast directing you to `/oc-configure`.

### Verify your setup

```bash
bunx @kodrunhq/opencode-autopilot doctor
```

This checks config health, model assignments, and adversarial diversity between agent groups.

## Model Groups

Agents are organized into 8 groups by the type of thinking they do. Each group gets a primary model and fallback chain. The `/oc-configure` command walks you through assigning models interactively.

| Group | Agents | What they do | Model recommendation |
|-------|--------|-------------|---------------------|
| **Architects** | oc-architect, oc-planner, autopilot | System design, planning, orchestration | Most powerful available |
| **Challengers** | oc-critic, oc-challenger | Challenge architecture, find design flaws | Strong model, **different family from Architects** |
| **Builders** | oc-implementer | Write production code | Strong coding model |
| **Reviewers** | oc-reviewer + 19 review agents | Find bugs, security issues, logic errors | Strong model, **different family from Builders** |
| **Red Team** | red-team, product-thinker | Final adversarial pass, hunt exploits | **Different family from both Builders and Reviewers** |
| **Researchers** | oc-researcher, researcher | Domain research, feasibility analysis | Good comprehension, any family |
| **Communicators** | oc-shipper, documenter, oc-retrospector | Docs, changelogs, lesson extraction | Mid-tier model |
| **Utilities** | oc-explorer, metaprompter, pr-reviewer | Fast lookups, prompt tuning, PR scanning | Fastest/cheapest available |

### Adversarial diversity

The installer warns when adversarial pairs share a model family:

| Pair | Relationship | Why diversity matters |
|------|-------------|---------------------|
| Architects / Challengers | Challengers critique architect output | Same model = confirmation bias |
| Builders / Reviewers | Reviewers find bugs in builder code | Same model = shared blind spots |
| Red Team / Builders+Reviewers | Final adversarial perspective | Most effective as a third family |

### Example config

```json
{
  "version": 4,
  "configured": true,
  "groups": {
    "architects":    { "primary": "anthropic/claude-opus-4-6",   "fallbacks": ["openai/gpt-5.4"] },
    "challengers":   { "primary": "openai/gpt-5.4",             "fallbacks": ["google/gemini-3.1-pro"] },
    "builders":      { "primary": "anthropic/claude-opus-4-6",   "fallbacks": ["anthropic/claude-sonnet-4-6"] },
    "reviewers":     { "primary": "openai/gpt-5.4",             "fallbacks": ["google/gemini-3.1-pro"] },
    "red-team":      { "primary": "google/gemini-3.1-pro",      "fallbacks": ["openai/gpt-5.4"] },
    "researchers":   { "primary": "anthropic/claude-sonnet-4-6", "fallbacks": ["openai/gpt-5.4"] },
    "communicators": { "primary": "anthropic/claude-sonnet-4-6", "fallbacks": ["anthropic/claude-haiku-4-5"] },
    "utilities":     { "primary": "anthropic/claude-haiku-4-5",  "fallbacks": ["google/gemini-3-flash"] }
  },
  "overrides": {}
}
```

Per-agent overrides are supported for fine-grained control:

```json
{
  "overrides": {
    "oc-planner": { "primary": "openai/gpt-5.4", "fallbacks": ["anthropic/claude-opus-4-6"] }
  }
}
```

## The Pipeline

opencode-autopilot runs an 8-phase autonomous pipeline, each driven by a specialized agent:

```
IDEA --> RECON --> CHALLENGE --> ARCHITECT --> EXPLORE --> PLAN --> BUILD --> SHIP --> RETROSPECTIVE
           |          |              |                      |         |        |            |
       Research   Enhance      Multi-proposal           Task plan   Code +   Docs &     Extract
       & assess   the idea     design arena             with waves  review   changelog  lessons
```

| Phase | Agent | What happens |
|-------|-------|-------------|
| **RECON** | oc-researcher | Domain research, feasibility assessment, technology landscape |
| **CHALLENGE** | oc-challenger | Proposes ambitious enhancements to the original idea |
| **ARCHITECT** | oc-architect x N | Multiple design proposals debated by oc-critic; depth scales with confidence |
| **EXPLORE** | -- | Reserved for speculative analysis (future) |
| **PLAN** | oc-planner | Decomposes architecture into wave-scheduled tasks (max 300-line diffs each) |
| **BUILD** | oc-implementer | Implements code with inline review; 3-strike limit on CRITICAL findings |
| **SHIP** | oc-shipper | Generates walkthrough, architectural decisions, and changelog |
| **RETROSPECTIVE** | oc-retrospector | Extracts lessons, injected into future runs |

### Confidence-driven architecture

The ARCHITECT phase uses a **multi-proposal arena**. Based on confidence signals from RECON:

- **High confidence** -> 1 architecture proposal
- **Medium confidence** -> 2 competing proposals (simplicity vs. extensibility)
- **Low confidence** -> 3 competing proposals + critic evaluation

### Strike-limited builds

BUILD tracks implementation quality with a strike system:

- Each CRITICAL review finding = 1 strike
- 3 strikes -> pipeline stops (prevents infinite retry loops)
- Non-critical findings generate fix instructions without strikes
- Waves execute in order; a wave advances only after passing review

## Code Review

The `oc_review` tool provides a 4-stage multi-agent review pipeline:

**Stage 1 -- Specialist dispatch:** Auto-detects your stack from changed files and dispatches relevant agents in parallel.

**Stage 2 -- Cross-verification:** Each agent reviews other agents' findings to filter noise and catch missed issues.

**Stage 3 -- Adversarial review:** Red-team agent hunts for exploits; product-thinker checks for UX gaps.

**Stage 4 -- Report or fix cycle:** CRITICAL findings with actionable fixes trigger an automatic fix cycle; everything else lands in the final report.

### 21 Review Agents

| Category | Agents | When selected |
|----------|--------|--------------|
| **Universal** (always run) | logic-auditor, security-auditor, code-quality-auditor, test-interrogator, silent-failure-hunter, contract-verifier | Every review |
| **Stack-aware** (auto-selected) | type-soundness, react-patterns-auditor, go-idioms-auditor, python-django-auditor, rust-safety-auditor, database-auditor, auth-flow-verifier, state-mgmt-auditor, concurrency-checker, scope-intent-verifier, wiring-inspector, dead-code-scanner, spec-checker | Based on changed file types |
| **Sequenced** (run last) | red-team, product-thinker | After all findings collected |

Review memory persists per project -- false positives are tracked and suppressed in future reviews (auto-pruned after 30 days).

## Model Fallback

When a model is rate-limited, unavailable, or returns an error, the fallback system automatically:

1. Classifies the error (rate limit, auth, quota, service unavailable, etc.)
2. Selects the next model from the group's fallback chain
3. Replays the conversation on the new model
4. Shows a toast notification (configurable)
5. Recovers to the primary model after a cooldown period

## Bundled Assets

The plugin ships with production-ready assets that auto-install to `~/.config/opencode/`:

| Type | Assets | Purpose |
|------|--------|---------|
| **Agents** | researcher, metaprompter, documenter, pr-reviewer, autopilot + 10 pipeline agents | Research, docs, PR review, full autonomous pipeline |
| **Commands** | `/oc-configure`, `/new-agent`, `/new-skill`, `/new-command`, `/review-pr` | Model setup, extend the plugin in-session, PR reviews |
| **Skills** | coding-standards | Universal best practices (naming, error handling, immutability, validation) |

### In-session creation

Extend the plugin without leaving OpenCode:

- **`/new-agent`** -- Create a custom agent with YAML frontmatter + system prompt
- **`/new-skill`** -- Create a skill directory with domain knowledge
- **`/new-command`** -- Create a slash command (validates against built-in names)

All created assets write to `~/.config/opencode/` and are available immediately.

## Configuration

Config lives at `~/.config/opencode/opencode-autopilot.json`. Run `/oc-configure` for interactive setup, or edit manually.

| Setting | Options | Default |
|---------|---------|---------|
| `orchestrator.autonomy` | `full`, `supervised`, `manual` | `full` |
| `orchestrator.strictness` | `strict`, `normal`, `lenient` | `normal` |
| `orchestrator.phases.*` | `true` / `false` | all `true` |
| `confidence.thresholds.proceed` | `HIGH`, `MEDIUM`, `LOW` | `MEDIUM` |
| `confidence.thresholds.abort` | `HIGH`, `MEDIUM`, `LOW` | `LOW` |
| `fallback.enabled` | `true` / `false` | `true` |

Config auto-migrates across schema versions (v1 -> v2 -> v3 -> v4).

## Tools

The plugin registers 11 tools, all prefixed with `oc_` to avoid conflicts with OpenCode built-ins:

| Tool | Purpose |
|------|---------|
| `oc_orchestrate` | Core pipeline state machine -- start a run or advance phases |
| `oc_review` | Multi-agent code review (4-stage pipeline) |
| `oc_configure` | Interactive model group assignment (start/assign/commit/doctor/reset) |
| `oc_state` | Query and patch pipeline state |
| `oc_phase` | Phase transitions and validation |
| `oc_confidence` | Confidence ledger management |
| `oc_plan` | Query task waves and status counts |
| `oc_forensics` | Diagnose pipeline failures (recoverable vs. terminal) |
| `oc_create_agent` | Create custom agents in-session |
| `oc_create_skill` | Create custom skills in-session |
| `oc_create_command` | Create custom commands in-session |

## Architecture

```
src/
+-- index.ts                 Plugin entry -- registers tools, hooks, fallback handlers
+-- config.ts                Zod-validated config with v1->v2->v3->v4 migration
+-- installer.ts             Self-healing asset copier (COPYFILE_EXCL, never overwrites)
+-- registry/
|   +-- types.ts             GroupId, AgentEntry, GroupDefinition, DiversityRule, ...
|   +-- model-groups.ts      AGENT_REGISTRY, GROUP_DEFINITIONS, DIVERSITY_RULES
|   +-- resolver.ts          Model resolution: override > group > default
|   +-- diversity.ts         Adversarial diversity checker
|   +-- doctor.ts            Shared diagnosis logic (CLI + tool)
+-- tools/                   Tool definitions (thin wrappers calling *Core functions)
+-- templates/               Pure functions: input -> markdown string
+-- review/                  21-agent review engine, stack gate, memory, severity
+-- orchestrator/
|   +-- handlers/            Per-phase state machine handlers
|   +-- fallback/            Model fallback: classifier, manager, state, chain resolver
|   +-- artifacts.ts         Phase artifact path management
|   +-- lesson-memory.ts     Cross-run lesson persistence
|   +-- schemas.ts           Pipeline state Zod schemas
+-- utils/                   Validators, paths, fs-helpers, gitignore management

bin/
+-- cli.ts                   CLI: install + doctor subcommands
```

**Dependency flow** (strictly top-down, no cycles):
`index.ts` -> `tools/*` -> `registry/*` + `templates/*` + `utils/*` -> Node built-ins + `yaml`

**Key patterns:**
- **Declarative registry** -- adding an agent = one line in AGENT_REGISTRY, everything derives from it
- **Atomic writes** -- all file operations use tmp + rename with crypto-random suffixes
- **Immutable state** -- deep-frozen data, spread operators, readonly arrays
- **Bidirectional validation** -- Zod parse on read AND write
- **Self-healing assets** -- bundled files copy on load, never overwrite user customizations

## Contributing

```bash
git clone https://github.com/kodrunhq/opencode-autopilot.git
cd opencode-autopilot
bun install
bun test && bun run lint
```

834 tests across 64 files. No build step -- Bun runs TypeScript natively.

## License

[MIT](LICENSE)
