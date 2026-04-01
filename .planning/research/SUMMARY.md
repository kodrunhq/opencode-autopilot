# Project Research Summary

**Project:** OpenCode Assets Plugin v2.0 -- Autonomous Orchestrator + Review Engine
**Domain:** Autonomous SDLC orchestrator with embedded multi-agent code review engine (OpenCode plugin)
**Researched:** 2026-03-31
**Confidence:** MEDIUM-HIGH

## Executive Summary

OpenCode Assets v2.0 merges two proven systems -- the hands-free autonomous orchestrator (8-phase SDLC pipeline with 12 subagents) and the ace multi-agent review engine (30 review agents, 7-phase review pipeline) -- into the existing opencode-autopilot plugin. The key architectural insight is that OpenCode's plugin model requires a fundamentally different approach from the source systems: orchestrator logic must live in deterministic TypeScript code (not 2400-line markdown prompts), agents are dispatched indirectly through a tool-returns-instruction pattern (tools compute state, agents execute dispatch), and review specialists should be internal prompt templates rather than config-hook-injected agents. The existing plugin's patterns (tool registration, config hook, Zod validation, immutable data, atomic writes) extend naturally to support the new capabilities.

The recommended approach is bottom-up construction across 5 phases: foundation infrastructure (state machine, config, tooling), standalone review engine, orchestrator pipeline phases, adversarial intelligence features, and learning systems. Only one new runtime dependency is needed: mitt (200-byte event emitter). Everything else uses existing deps (Zod, yaml, node:fs/promises) or custom TypeScript. The review engine should ship before the orchestrator because it is simpler, independently useful, and required by the orchestrator's BUILD phase -- delivering value early while de-risking the harder integration.

The top risks are: token budget explosion from nested prompt contexts (orchestrator dispatching review engine inside BUILD phase), architectural fragmentation from porting two independent state machines instead of designing one unified system, and the untested tool-returns-instruction dispatch pattern that is the logical design given OpenCode's constraints but has not been validated end-to-end. All three must be resolved in Phase 1 before any implementation begins.

## Key Findings

### Recommended Stack

The stack strategy is deliberately conservative: one new dependency (mitt, 200 bytes), everything else custom TypeScript. This matches the codebase philosophy of minimal external deps and leverages existing patterns.

**Core technologies:**
- **Custom FSM (discriminated unions):** 8-phase orchestrator state machine -- ~80 lines of TypeScript, compile-time exhaustiveness checking, no library needed (XState rejected as overkill for a linear pipeline)
- **JSON + Zod persistence:** State, confidence ledger, decision log -- extends existing config.ts atomic write pattern, zero new deps
- **mitt (^3.0.1):** Typed event bus for lifecycle events -- 200 bytes, decouples state changes from consumers (logging, hooks, confidence ledger)
- **Pure function registry:** Review dimension-to-agent mapping -- flat fan-out via dispatch instructions, not a DAG framework
- **Config-hook agents:** 12+ orchestrator subagents registered via existing configHook pattern -- OpenCode handles all session management

**Critical stack decisions:**
- No agent framework (LangChain, Mastra, ADK-TS) -- OpenCode IS the agent runtime
- No database (bun:sqlite) -- JSON files sufficient for ~8 writes per run; upgrade path documented for future
- No task queue -- subagent dispatch goes through OpenCode's Task tool

### Expected Features

**Must have (table stakes):**
- State machine orchestrator with crash recovery and idempotent re-entry
- Research, Architecture, Plan, Build, Review, Ship phases as subagents
- Code review gate with review-fix loop (max 3 cycles)
- Specialized review agents: logic auditor, test interrogator, contract verifier (core squad)
- Dynamic agent selection (team lead) with parallel dispatch
- Decision logging for accountability
- Deterministic tooling in TypeScript (not LLM-generated state management)
- User-configurable settings (autonomy, strictness, phase toggles)
- Consolidated review report with severity levels

**Should have (differentiators):**
- Architecture Arena (2-3 parallel proposals + adversarial critic)
- Confidence ledger driving pipeline depth decisions
- Challenge phase (Ambition Engine) for scope enhancement
- Cross-verification between review agents
- Wave-based parallel build for independent tasks
- Red team adversarial final pass

**Defer (v2.1+):**
- Divergent explorer (parallel prototyping) -- too complex, rare value
- Ace enforcement pipeline (inline quality during build) -- separate product scope
- Language-specific auditors beyond TypeScript -- add based on demand
- Product thinker agent -- not needed for library/CLI projects
- Full institutional memory with decay mechanisms -- needs real-world usage data first

### Architecture Approach

The architecture follows a strictly top-down dependency flow with clear component boundaries: tools call orchestrator/review modules, which call state management, which calls utilities. No cycles. Agent definitions are pure frozen data objects with no runtime logic. The critical pattern is "tool-returns-instruction": the orchestrator tool computes state and returns structured dispatch instructions, while a lean orchestrator agent (injected via config hook with Agent tool permission) executes them by dispatching subagents via Task tool. All machine state uses JSON (not markdown tables parsed by regex); markdown is reserved for human-readable artifacts.

**Major components:**
1. **`src/orchestrator/`** -- State machine transitions, phase handlers (8 phases), dispatch instruction generation. Pure functions operating on immutable state.
2. **`src/review/`** -- Review pipeline orchestration, team selection (deterministic TypeScript, not an agent), cross-verification, fix cycle, verdict computation. Usable standalone via `oc_review` tool.
3. **`src/state/`** -- Atomic JSON read/write for pipeline state, confidence ledger, decision log, metrics. Single working directory, single config schema.
4. **`src/tools/`** -- 6 new tools (`oc_orchestrate`, `oc_review`, `oc_state`, `oc_confidence`, `oc_phase`, `oc_plan`) following existing `*Core` + `tool()` wrapper pattern.
5. **`src/agents/`** -- 12+ orchestrator subagents + review agents. Orchestrator agents are config-hook injected; review specialists are internal prompt templates (not config-hook agents).

### Critical Pitfalls

1. **Token budget explosion** -- Nested prompts (orchestrator + review engine + diff) can exceed 30K tokens before analyzing code. Prevention: orchestrator logic in TypeScript code (not prompt), lazy-load reference material, compress agent prompts to ~50 lines, cap per-phase prompt budgets at 15K tokens.

2. **Franken-architecture (dual state machines)** -- Porting hands-free and ace as independent systems creates two state machines, two configs, two memory stores. Prevention: single unified state machine, single Zod config schema, single working directory, single memory interface. Design from OpenCode's model backward, not port forward.

3. **Untested agent dispatch pattern** -- OpenCode tools cannot call Agent tool directly. The tool-returns-instruction pattern is the logical design but unvalidated. Prevention: build and test one agent dispatch end-to-end in Phase 1 before designing the full pipeline. If it fails, the entire architecture changes.

4. **CJS-to-TypeScript behavioral drift** -- 3300 lines of battle-tested CJS tooling (regex parsers, sync I/O, lock files) will subtly change behavior when ported to async TypeScript with Zod. Prevention: port test suites first, parity test both implementations against same fixtures, port one module at a time.

5. **Agent count overwhelming the plugin** -- 30 ace agents pollute the config-hook namespace. Prevention: only orchestrator-level agents are config-hook injected (~12); review specialists are internal prompt templates loaded on demand. Team-lead selection becomes a deterministic TypeScript function, not an agent.

## Implications for Roadmap

### Phase 1: Foundation Infrastructure
**Rationale:** Everything depends on the state machine, state management, and validated agent dispatch pattern. The dispatch pattern validation is a hard gate -- if it fails, the architecture must change before any other work proceeds.
**Delivers:** State machine with transitions and resume, state management layer (atomic JSON read/write), confidence ledger, decision logging, 4 state tools (`oc_state`, `oc_confidence`, `oc_phase`, `oc_plan`), foundation utilities (markdown parser, slug, timestamp), validated agent dispatch proof-of-concept.
**Addresses:** State machine orchestrator, deterministic tooling, decision logging, user-configurable settings (config schema extension).
**Avoids:** Pitfall 2 (franken-architecture -- unified design from day one), Pitfall 3 (blind dispatch port -- validated before scaling), Pitfall 9 (config complexity -- single schema from the start), Pitfall 16 (orchestrator logic in code, not prompt).

### Phase 2: Review Engine (Standalone)
**Rationale:** The review engine is simpler than the orchestrator (stateless pipeline, no state machine), independently useful as a standalone `/review` capability, and required by the orchestrator's BUILD phase. Building it first delivers value early and de-risks the harder integration. The team-lead selection as deterministic TypeScript validates the approach of keeping review agents internal.
**Delivers:** `oc_review` tool, team-lead selection function, core squad agents (logic, test, contract), parallel dispatch instructions, cross-verification, fix cycle (1-cycle default), verdict computation, consolidated report, severity definitions, agent catalog.
**Addresses:** Specialized review agents, dynamic agent selection, parallel dispatch, cross-verification, consolidated report, review-fix loop.
**Avoids:** Pitfall 5 (agent count -- review specialists are internal, not config-hook), Pitfall 8 (convergence cascade -- 1-cycle default, short-circuit on nitpicks).

### Phase 3: Orchestrator Pipeline
**Rationale:** With state management proven (Phase 1) and review engine available (Phase 2), the orchestrator phases can be built sequentially. Each phase is an independent handler with clear input/output contracts. The BUILD phase integrates the review engine.
**Delivers:** `oc_orchestrate` tool, 8 phase handlers (RECON through RETROSPECTIVE), 12 orchestrator subagent definitions, orchestrator agent (lean prompt + tool loop), iterative build loop with branch/commit per task.
**Addresses:** Research phase, architecture phase, task decomposition, iterative build, code review gate (via Phase 2 integration), ship package.
**Avoids:** Pitfall 1 (token explosion -- lean orchestrator prompt, phase-specific context injection), Pitfall 13 (arena over-engineering -- confidence-gated depth, default shallow), Pitfall 7 (stale state -- git SHA checkpoints, artifact validation on resume).

### Phase 4: Adversarial Intelligence
**Rationale:** These features enhance decision quality but require a stable base pipeline. They add compute cost and complexity. Shipping them after the pipeline is proven avoids premature optimization of features that may need redesign based on real usage.
**Delivers:** Architecture Arena (parallel proposals + critic + mediator), Challenge phase (Ambition Engine, capped at 3 additions), confidence ledger wired into all agents for depth gating, negotiating reviewer dialogue protocol.
**Addresses:** Architecture Arena, challenge phase, confidence-gated depth, negotiating reviewer.
**Avoids:** Pitfall 13 (arena depth is configurable and confidence-gated from the start).

### Phase 5: Learning and Resilience
**Rationale:** Institutional and project memory provide compounding value but require multiple successful runs to validate what data is actually useful to persist. Forensics (failure analysis) similarly needs real failure modes to design against.
**Delivers:** Institutional memory store with recency weighting and size caps, project-specific memory, retrospective agent, forensics/failure analysis, memory injection into agent prompts (budgeted at 500 tokens per agent).
**Addresses:** Institutional memory, project memory, forensics.
**Avoids:** Pitfall 10 (unbounded memory growth -- size caps, recency weighting, garbage collection from day one).

### Phase Ordering Rationale

- **Bottom-up construction:** Each phase depends only on phases before it. No forward references or circular dependencies between phases.
- **Review before orchestrator:** The review engine is a prerequisite for the BUILD phase handler and is independently shippable. This follows the architecture research's build order recommendation.
- **Adversarial features after base pipeline:** Arena, Challenge, and negotiating reviewer add cost and complexity. They need a stable pipeline to enhance, not a fragile one to destabilize.
- **Learning systems last:** Memory requires real-world usage data to validate. The storage format is designed in Phase 1 (per Pitfall 10 prevention), but implementation waits until Phase 5.
- **Config migration spans phases:** The Zod config schema is extended incrementally as each phase adds settings, not as a big-bang migration.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** Agent dispatch mechanism validation -- the tool-returns-instruction pattern is untested in OpenCode. A proof-of-concept spike is mandatory before full design.
- **Phase 2:** OpenCode Agent tool concurrency limits -- parallel dispatch of 10+ review agents may hit undocumented rate limits or session caps.
- **Phase 3:** BUILD phase git operations -- branching strategy, PR creation, and merge workflow need to support non-GitHub remotes and trunk-based development (Pitfall 14).
- **Phase 5:** Institutional memory usefulness -- what data is actually valuable to persist across projects is unknown until real runs produce data. Research spike needed during implementation.

Phases with standard patterns (skip research-phase):
- **Phase 1 (state management):** Atomic JSON write, Zod validation, discriminated union FSM -- all well-documented TypeScript patterns already used in the codebase.
- **Phase 2 (review pipeline core):** Fan-out dispatch, severity aggregation, verdict computation -- straightforward data processing with no novel patterns.
- **Phase 4 (Arena/Challenge):** These are subagent prompt engineering problems, not architectural problems. The dispatch mechanism is proven by Phase 3.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Only 1 new dep (mitt). All others are existing or custom TS. Alternatives thoroughly evaluated and rejected with clear rationale. |
| Features | MEDIUM | Core features well-understood from source analysis. OpenCode plugin API constraints (agent dispatch, parallel execution limits) introduce uncertainty. Feature dependency tree is clear. |
| Architecture | MEDIUM-HIGH | Component boundaries, dependency flow, and build order are well-designed. The tool-returns-instruction pattern is logical but unvalidated -- this is the single biggest uncertainty. |
| Pitfalls | HIGH | All pitfalls derived from direct source code analysis of three codebases. Prevention strategies are specific and actionable. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Agent dispatch validation:** The tool-returns-instruction pattern (tools return dispatch instructions, orchestrator agent executes them) is the foundational pattern but has not been tested in OpenCode. Must be validated as Phase 1's first task. If it does not work, the entire architecture needs redesign.
- **OpenCode concurrency limits:** How many parallel Agent tool calls can an agent make? If limited to 3-5 concurrent, the review engine's parallel dispatch strategy needs wave sizing adjustment.
- **Institutional memory schema:** What data is useful to persist across projects is speculative. The storage format and interface should be designed early (Phase 1), but the actual content schema needs a research spike during Phase 5 implementation.
- **Plugin load performance:** Registering 15+ agents via config hook at plugin load -- does this noticeably slow OpenCode startup? Need to measure after Phase 1 implementation.
- **mitt compatibility with Bun:** mitt is a standard ESM package and should work fine, but must be verified in the Bun runtime during Phase 1 setup.

## Sources

### Primary (HIGH confidence)
- claude-hands-free source code at `/home/joseibanez/develop/projects/claude-hands-free/` -- 2413-line orchestrator, 12 agents, 3538 lines CJS tooling, 8-phase state machine
- claude-ace source code at `/home/joseibanez/develop/projects/claude-ace/` -- 30 agents, 8-phase review pipeline, 6 bash scripts, references directory
- opencode-autopilot source code at `/home/joseibanez/develop/projects/opencode-autopilot/src/` -- current plugin architecture, tool registration, config hook, agent definitions
- OpenCode plugin API (`@opencode-ai/plugin` dist/index.d.ts) -- hooks interface, tool registration, config hook
- [XState v5 documentation](https://stately.ai/docs/xstate) -- evaluated and rejected
- [mitt GitHub](https://github.com/developit/mitt) -- 200-byte typed event emitter

### Secondary (MEDIUM confidence)
- [OpenCode Plugin Documentation](https://opencode.ai/docs/plugins/) -- plugin API, config hook, event hooks
- [OpenCode Agent Documentation](https://opencode.ai/docs/agents/) -- Task tool dispatch, subagent architecture
- [oh-my-opencode / Sisyphus pattern](https://github.com/opensoft/oh-my-opencode) -- supervisor orchestrator pattern validation
- [Supervisor pattern for agent orchestration](https://dev.to/programmingcentral/the-supervisor-pattern-stop-writing-monolithic-agents-and-start-orchestrating-teams-2olk) -- hub-and-spoke topology validation
- hands-free v2 vision document -- Architecture Arena, Divergent Explorer, Ambition Engine design specs

### Tertiary (LOW confidence)
- Tool-returns-instruction pattern -- logical design given OpenCode constraints, but untested in this plugin context. Needs validation spike.
- OpenCode Agent tool concurrency limits -- not documented, needs empirical testing.

---
*Research completed: 2026-03-31*
*Ready for roadmap: yes*
