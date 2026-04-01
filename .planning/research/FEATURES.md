# Feature Landscape

**Domain:** Autonomous SDLC orchestrator with embedded multi-agent code review engine (OpenCode plugin)
**Researched:** 2026-03-31
**Overall confidence:** MEDIUM -- core patterns well-understood from source plugins; OpenCode plugin API constraints introduce uncertainty on agent dispatch limits and parallel execution behavior.

---

## Table Stakes

Features users expect from an autonomous SDLC orchestrator. Missing any of these means the product is not a credible autonomous pipeline -- it is just another helper tool.

| Feature | Why Expected | Complexity | Depends On (v1) | Source |
|---------|--------------|------------|-----------------|--------|
| **State machine orchestrator** | Core loop: phase transitions, resume on crash, idempotent re-entry. Without this, "autonomous" is a lie -- any interruption restarts from zero. | High | `configHook` for agent injection, `oc_` tool registration pattern | hands-free `state.cjs`, oh-my-opencode Sisyphus |
| **Research phase (RECON)** | Every orchestrator researches before building. Users expect the system to understand the problem domain before proposing solutions. | Medium | Existing `researcher` subagent (adapt prompt) | hands-free `hf-researcher`, oh-my-opencode Prometheus+Librarian |
| **Architecture phase** | Producing a system design before writing code is what separates an orchestrator from "just code it." Without this, the build phase makes ad-hoc decisions. | Medium | None new -- pure subagent | hands-free `hf-proposer` |
| **Task decomposition (PLAN)** | Breaking architecture into small, ordered, independently testable tasks. Without this, the build phase is a single monolithic prompt that fails at scale. | Medium | None new -- pure subagent | hands-free `hf-planner` (wave grouping, 300-line max diffs) |
| **Iterative build loop** | Implementing tasks one at a time with branch/commit/PR per task. This is what makes the output professional (not one giant diff). | High | None new -- git operations via Bash tool | hands-free `hf-implementer` (per-task PRs) |
| **Code review gate** | Every implementation must pass review before proceeding. This is the quality floor. Without it, the orchestrator ships unchecked code. | Medium | Existing `pr-reviewer` subagent (expand scope) | hands-free `hf-reviewer`, ace core squad |
| **Review-fix loop** | When review finds issues, the implementer fixes and resubmits. Without this loop, review findings are decoration. Max 3 cycles to prevent infinite loops. | Medium | Review gate above | hands-free review dialogue, ace Phase 5 fix cycle |
| **Decision logging** | Every autonomous decision must be logged with rationale. Users cannot trust a black box. The decision log is the accountability mechanism. | Low | Filesystem write (`.opencode-autopilot/decision-log.md`) | hands-free `decision-log.md` |
| **Deterministic tooling (TypeScript)** | State management, config, phase transitions, plan parsing -- these must be deterministic code, not LLM-generated. LLMs hallucinate state; code does not. | High | Existing TS patterns in `src/utils/`, `src/config.ts` | hands-free `hf-tools.cjs` (13 modules), ported to native TS |
| **User-configurable settings** | Autonomy level, strictness, phase toggles, model routing. Users will not adopt a tool they cannot tune. | Medium | Existing `pluginConfigSchema` in `config.ts` (extend) | hands-free `config.cjs`, oh-my-opencode config system |
| **Specialized review agents (core squad)** | At minimum: logic auditor, test coverage checker, contract/type verifier. These catch the most common classes of bugs. A review engine with one generic reviewer is not credible. | High | `configHook` for agent injection | ace core squad (logic-auditor, test-interrogator, contract-verifier) |
| **Dynamic agent selection (team lead)** | Not every project needs every reviewer. A team lead agent that selects relevant specialists based on stack and diff avoids wasting tokens on irrelevant agents. | Medium | Agent catalog reference file | ace `team-lead` agent, scoring protocol |
| **Parallel agent dispatch** | Review agents that run one-at-a-time are too slow. Parallel dispatch of independent agents is expected. | Medium | OpenCode Agent tool supports parallel calls | ace Phase 1 parallel dispatch, oh-my-opencode parallel subagents |
| **Consolidated review report** | Scattered findings from 10 agents are unusable. A single report with severity levels, grouped by file, is the minimum useful output. | Low | None new -- template formatting | ace report generation, severity definitions |

---

## Differentiators

Features that set this product apart. Not expected, but provide significant value. These are what make users choose this orchestrator over building their own agent prompts.

| Feature | Value Proposition | Complexity | Depends On (v1) | Source |
|---------|-------------------|------------|-----------------|--------|
| **Architecture Arena** | 2-3 parallel architecture proposals + adversarial critic. Prevents the #1 class of expensive mistakes: choosing the wrong foundation. No other OpenCode plugin does structured multi-proposal debate. | High | Research phase output as input context | hands-free `hf-proposer` (x2-3) + `hf-critic` + `hf-mediator` |
| **Confidence ledger** | Every decision tagged HIGH/MEDIUM/LOW with rationale. Makes uncertainty visible. Downstream phases allocate effort based on where the system is guessing vs. certain. | Medium | State machine (stores ledger), all agents must emit scores | hands-free `confidence.cjs` |
| **Challenge phase (Ambition Engine)** | After research, before architecture: a dedicated agent asks "is there a better version of this?" Catches table-stakes features users forgot to request. Capped at 3 additions. | Low | Research output as input | hands-free `hf-challenge` |
| **Negotiating reviewer (dialogue protocol)** | Implementer can rebut review comments. Mediator resolves disputes based on evidence, not authority. Prevents bad review feedback from degrading code quality. | Medium | Review gate, review-fix loop | hands-free `hf-mediator`, review dialogue transcripts |
| **Cross-verification (Phase 2)** | After all review agents report, each sees others' findings and can upgrade severity or add new findings. Catches inter-domain bugs that no single agent sees. | Medium | Parallel review dispatch completes first | ace Phase 2 cross-verification |
| **Product thinker (sequenced)** | After technical review: a UX/product agent traces user journeys, checks CRUD completeness, finds dead-end flows. Catches "it works but it's unusable." | Low | All Phase 1 findings as input | ace `product-thinker` (Phase 3) |
| **Red team (sequenced)** | Final adversarial pass: reads ALL findings, constructs attack scenarios, hunts inter-domain gaps. The "what did everyone else miss?" agent. | Low | All prior phase findings as input | ace `red-team` (Phase 4) |
| **Institutional memory** | Cross-project learning: lessons from past runs injected into future agents. The system improves with every project. Decay mechanism prevents stale advice. | High | Global config directory (`~/.config/opencode/`), memory store | hands-free `memory.cjs`, retrospective agent |
| **Ship package** | Architecture walkthrough, decision summary, complexity map, security surface, contextual changelog. Ships understanding, not just code. | Medium | All phase artifacts as input | hands-free `hf-shipper`, SHIP phase |
| **Wave-based parallel build** | Tasks grouped into waves by dependency. Independent tasks within a wave build in parallel. Faster builds without sacrificing correctness. | High | Task decomposition with wave numbers | hands-free `plan.cjs` wave grouping |
| **Stack-gated agent selection** | Agents auto-excluded when their stack is absent (no Go auditor for TypeScript projects). Prevents wasted tokens and false positives. | Low | Stack detection script, agent catalog metadata | ace `stack-gate.md`, team-lead scoring |
| **Enforcement pipeline (inline quality)** | During BUILD, not just after: enriched plan with hard contracts per task, checkpoint verification after each implementation step, tiered quality gates. | Very High | Task decomposition, review agents available as checkpoints | ace `enricher`, `enforcement-orchestrator`, `checkpoint-runner` |
| **Project memory (per-project)** | Findings, false positives, fix failures, project profile stored per-project. Reviews get better across multiple runs on the same codebase. | Medium | Global config directory, project key resolution | ace per-project memory (`~/.claude/ace/<project-key>/`) |
| **Forensics / failure analysis** | Post-mortem analysis when a run fails. Identifies what went wrong, which phase, which agent. Recoverable vs. terminal classification. | Medium | State machine with phase history | hands-free `forensics.cjs`, `--forensics` flag |

---

## Anti-Features

Features to explicitly NOT build. Each would undermine the product's core value or violate project constraints.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Human approval gates** | Core promise is zero-intervention autonomy. Every approval gate erodes the reason to exist. "Would you like to proceed?" turns an orchestrator into a chatbot with extra steps. | Better agents, better verification, decision logging for auditability. Single exception: truly unparseable input. |
| **GUI/web dashboard** | OpenCode is a TUI. Plugin runs inside the TUI. Adding a web dashboard is a scope explosion that serves a different product. | All interaction via OpenCode TUI tools and commands. Status via tool output. |
| **MCP server for review** | Out of scope per PROJECT.md. Review engine must be native plugin tools, not a separate server process. | Tools registered via `@opencode-ai/plugin`, agents via `configHook`. |
| **Language-specific agents for ALL languages** | Ace has Go, Python/Django, Rust, React auditors. Porting all of them is scope creep for an initial release. Many users will never trigger them. | Ship with universal agents (logic, security, quality, test). Add language-specific agents as follow-up based on usage data. Start with TypeScript-specific since the plugin itself is TS. |
| **Divergent explorer (parallel prototyping)** | Most complex hands-free feature. Requires parallel git branches, side-by-side builds, and a comparator agent. Very high compute cost. Value only surfaces on genuinely ambiguous decisions, which are rare. | Log MEDIUM confidence architecture decisions to the confidence ledger. Let the review cycle catch bad choices. Build this in a future milestone if the Arena alone proves insufficient. |
| **Documentation longer than code** | Ship Package must be concise. A 2,000-line walkthrough for a 500-line CLI tool is worse than no walkthrough. | Shipper agent instructed to match documentation depth to project complexity. Hard cap: docs cannot exceed 2x codebase LOC. |
| **Model-specific agent assignments** | PROJECT.md constraint: model agnostic. Hardcoding `model: opus` or `model: sonnet` ties the plugin to one provider. | Omit model field from agent configs. Let users configure models via OpenCode's model routing. Provide recommended tiers (heavy/medium/light) in docs. |
| **Shared mutable state between agents** | Agents communicate through filesystem artifacts, not shared memory. Mutable shared state is a concurrency bug waiting to happen. | Each agent reads input files, writes output files. Orchestrator coordinates through state machine transitions. |
| **Silent scope accumulation** | Ambition Engine additions must be loud and logged. Silently adding features the user did not request is scope creep, not ambition. | Challenge agent proposals require orchestrator accept/reject with logged rationale. Hard cap of 3 additions per run. |
| **Ace enforcement pipeline in v2.0** | The full enricher + enforcement-orchestrator + checkpoint-runner + contract-checker pipeline is a product unto itself. It requires enriched plans with per-step contracts, 3-tier verification, and fix loops within the build phase. This nearly doubles build complexity. | Ship v2.0 with post-build review (ace review phases). Add inline enforcement as a v2.1 or v3.0 feature once the review engine is proven stable. |

---

## Feature Dependencies

```
State machine orchestrator
  |
  +---> Research phase (RECON)
  |       |
  |       +---> Challenge phase (Ambition Engine)
  |       |       |
  |       |       +---> Architecture phase
  |       |               |
  |       |               +---> Architecture Arena (parallel proposals + critic)
  |       |               |
  |       |               +---> Task decomposition (PLAN)
  |       |                       |
  |       |                       +---> Wave-based parallel build
  |       |                       |
  |       |                       +---> Iterative build loop
  |       |                               |
  |       |                               +---> Code review gate
  |       |                               |       |
  |       |                               |       +---> Review-fix loop
  |       |                               |       |       |
  |       |                               |       |       +---> Negotiating reviewer
  |       |                               |       |
  |       |                               |       +---> Consolidated review report
  |       |                               |
  |       |                               +---> Ship package
  |       |
  |       +---> Confidence ledger (populated by all phases)
  |
  +---> Decision logging (parallel with everything)

Deterministic tooling (TypeScript) --- underlies state machine, config, confidence, plan parsing

User-configurable settings --- extends existing config.ts

Dynamic agent selection (team lead) ---> Specialized review agents (core squad)
                                    |
                                    +---> Stack-gated agent selection
                                    |
                                    +---> Parallel agent dispatch
                                            |
                                            +---> Cross-verification
                                            |
                                            +---> Product thinker (sequenced after Phase 1+2)
                                            |
                                            +---> Red team (sequenced after Phase 1+2+3)

Institutional memory --- independent, reads from completed runs, writes to global store
  |
  +---> Project memory (per-project subset)

Forensics --- reads state machine history, independent of normal pipeline
```

### Existing v1 Infrastructure Reused

| v1 Component | How v2 Uses It |
|--------------|----------------|
| `configHook` in `src/agents/index.ts` | Injects 12+ orchestrator subagents and review agents. Same pattern, larger agent map. |
| `pluginConfigSchema` in `src/config.ts` | Extended with orchestrator settings (autonomy, strictness, phase toggles). Same Zod pattern. |
| `src/utils/paths.ts` (getGlobalConfigDir) | Used for institutional memory path, project memory path, orchestrator artifact storage. |
| `src/utils/fs-helpers.ts` (ensureDir, copyIfMissing) | Used for creating `.opencode-autopilot/` run directories and artifact files. |
| `src/utils/validators.ts` | Extended for phase name validation, agent name validation in the orchestrator context. |
| Tool registration pattern (`src/tools/`) | `oc_orchestrate` follows same pattern: `*Core` function + `tool()` wrapper. |
| Existing `researcher` subagent | Prompt adapted for RECON phase. Same agent, expanded output contract. |
| Existing `pr-reviewer` subagent | Prompt adapted for review gate. Extended with structured finding format. |
| `src/installer.ts` (asset copier) | Copies orchestrator reference files (agent catalog, severity definitions, hard gates) to global config. |

---

## MVP Recommendation

### Phase 1: Foundation (must ship first)

Build the infrastructure that everything else depends on:

1. **State machine orchestrator** (`oc_orchestrate` tool) -- the core loop
2. **Deterministic tooling** -- state, config, phase transitions, plan parsing in TypeScript
3. **Decision logging** -- accountability from day one
4. **User-configurable settings** -- extend existing `pluginConfigSchema`

**Rationale:** Without these, no other feature can exist. The state machine is the skeleton; deterministic tooling is the nervous system.

### Phase 2: Pipeline phases (RECON through SHIP)

Build the actual SDLC phases as subagents:

1. **Research phase** (adapt existing `researcher` subagent)
2. **Architecture phase** (single proposal first, Arena added separately)
3. **Task decomposition** (planner subagent with wave numbers)
4. **Iterative build loop** (implementer subagent, branch/commit/PR per task)
5. **Code review gate + review-fix loop** (expand existing `pr-reviewer`)
6. **Ship package** (shipper subagent)

**Rationale:** These are the pipeline stages. Each is a subagent with clear input/output contracts. Ship the linear pipeline before adding adversarial features.

### Phase 3: Review engine (embedded ace)

Build the multi-agent review system:

1. **Specialized review agents** (core squad: logic, test, contract)
2. **Dynamic agent selection** (team lead)
3. **Stack-gated selection**
4. **Parallel agent dispatch**
5. **Cross-verification** (Phase 2 findings exchange)
6. **Consolidated review report**

**Rationale:** The review engine is the quality differentiator. It works standalone (not just within the orchestrator) and is the highest-value component for users who already have their own workflow.

### Phase 4: Adversarial intelligence

Add the features that make decisions better, not just faster:

1. **Architecture Arena** (parallel proposals + critic + mediator)
2. **Challenge phase** (Ambition Engine)
3. **Confidence ledger** (wired into all agents)
4. **Negotiating reviewer** (dialogue protocol)

**Rationale:** These are differentiators that require the base pipeline to be stable. They add compute cost and complexity. Ship them after the pipeline is proven.

### Phase 5: Learning and resilience

1. **Institutional memory** (retrospective agent, global memory store)
2. **Project memory** (per-project findings, false positives)
3. **Forensics** (failure analysis, recovery)

**Rationale:** These provide compounding value but require multiple successful runs to validate. Ship after the pipeline has real-world usage.

### Defer indefinitely

- **Divergent explorer** (parallel prototyping) -- too complex, too expensive, rare value
- **Ace enforcement pipeline** (inline quality during build) -- separate product scope
- **Language-specific auditors beyond TypeScript** -- add based on demand

---

## Hands-Free Feature Mapping

Which hands-free features are essential vs. nice-to-have for the OpenCode plugin.

| hands-free Feature | Classification | Rationale |
|--------------------|---------------|-----------|
| 8-phase state machine (RECON through RETROSPECTIVE) | **Essential** | Core pipeline structure. Port the phase model, simplify to OpenCode's tool-based architecture. |
| 12 subagents (researcher through shipper) | **Essential** | Each phase needs its specialist. Inject via `configHook` as subagents. |
| `hf-tools.cjs` (13 deterministic modules) | **Essential (rewrite)** | Port to native TypeScript. The functions are critical; the CJS format is not. |
| Architecture Arena (3 proposals + critic) | **Differentiator** | High value but adds 3x architect-phase cost. Ship as opt-in, default to single proposal. |
| Confidence ledger | **Differentiator** | Enables intelligent downstream decisions. Medium effort to wire into all agents. |
| Challenge phase (Ambition Engine) | **Nice-to-have** | Low complexity, high charm. Worth including but not blocking on. |
| Negotiating reviewer + mediator | **Nice-to-have** | Improves review quality but adds dialogue complexity. Ship after basic review-fix loop works. |
| Wave-based BUILD | **Differentiator** | Significant speed improvement for large projects. Requires solid task decomposition first. |
| Institutional memory | **Differentiator** | Compounding value. Complex to get right (relevance, decay). Ship after pipeline is stable. |
| Divergent explorer | **Skip** | Most complex feature. Rare value. Build only if Arena proves insufficient. |
| Ship package (6 artifacts) | **Nice-to-have** | Professional output. Start with README + decision summary. Expand incrementally. |
| Forensics | **Nice-to-have** | Valuable for debugging but not core to the pipeline's value. |

---

## Ace Feature Mapping

Which ace features are essential vs. nice-to-have for the embedded review engine.

| ace Feature | Classification | Rationale |
|-------------|---------------|-----------|
| Core squad (logic-auditor, test-interrogator, contract-verifier) | **Essential** | Minimum credible review engine. These 3 agents catch the most common bug classes. |
| Team lead agent selection | **Essential** | Without it, you either run all agents (expensive) or none of the right ones. |
| Agent catalog + scoring protocol | **Essential** | The team lead needs a structured catalog to score against. Port as reference markdown. |
| Parallel dispatch (Phase 1) | **Essential** | Sequential dispatch of 10+ agents is unacceptably slow. |
| Cross-verification (Phase 2) | **Differentiator** | Catches inter-domain bugs. Medium effort, high value. |
| Product thinker (Phase 3) | **Nice-to-have** | UX-level review. Not needed for library/CLI projects. |
| Red team (Phase 4) | **Differentiator** | Adversarial final pass. High value, low complexity (just reads all findings). |
| Fix cycle (Phase 5) | **Essential** | A review engine that cannot fix is only half useful. |
| Re-verify + converge (Phases 6-7) | **Differentiator** | Ensures fixes do not introduce new issues. Important for fix mode credibility. |
| 16 parallel specialists | **Nice-to-have (selective)** | Ship 6-8 universal specialists first (security, quality, dead-code, silent-failure, wiring, scope-intent). Add language-specific later. |
| Stack detection scripts | **Essential (rewrite)** | Port `detect-stack.sh` and `classify-changes.sh` to TypeScript. The team lead depends on these. |
| Per-project memory | **Differentiator** | Reviews improve over time on the same codebase. Worth building after core review works. |
| Enforcement pipeline (enricher, checkpoint-runner) | **Skip for v2.0** | Separate product scope. Inline quality during build is v3.0 territory. |
| Severity definitions + finding format | **Essential** | Standardized output format. Port as reference files. |
| Hard gates per agent | **Essential** | Each agent needs explicit verification criteria, not vague "review the code." |
| UI branding (banners, progress) | **Nice-to-have** | Nice UX but OpenCode TUI may limit formatting options. Adapt to what the plugin API supports. |

---

## Sources

- claude-hands-free repository at `/home/joseibanez/develop/projects/claude-hands-free/` -- 8-phase pipeline, 12 agents, hf-tools.cjs with 13 modules, Architecture Arena, confidence ledger, institutional memory
- claude-ace repository at `/home/joseibanez/develop/projects/claude-ace/` -- 30 review agents, 7-phase review pipeline, team-lead selection, agent catalog, cross-verification, enforcement pipeline
- [oh-my-opencode / Sisyphus pattern](https://github.com/opensoft/oh-my-opencode) -- primary orchestrator delegating to Prometheus (planner), Oracle (architect), Librarian (explorer), parallel subagent execution
- hands-free v2 vision document at `/home/joseibanez/develop/projects/claude-hands-free/docs/internal/product/vision-v2.md` -- Architecture Arena, Divergent Explorer, Ambition Engine, Institutional Memory, Confidence Ledger, Ship Package, Negotiating Reviewer design specs
- [Agentic SDLC trends 2026](https://medium.com/codetodeploy/the-orchestrator-era-why-2026-is-the-year-agentic-coding-rewrites-the-sdlc-c1bf547df755) -- industry context for multi-agent orchestration
- [GitLab + TCS intelligent orchestration](https://about.gitlab.com/blog/agentic-sdlc-gitlab-and-tcs-deliver-intelligent-orchestration-across-the-enterprise/) -- enterprise pattern: confidence-scored decisioning, continuous learning
