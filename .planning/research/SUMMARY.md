# Project Research Summary

**Project:** OpenCode Autopilot v4.0 — Production Quality Milestone
**Domain:** AI coding plugin — asset expansion, hardening, and polish
**Researched:** 2026-04-03
**Confidence:** HIGH

## Executive Summary

OpenCode Autopilot v4.0 is a "polish and expand" milestone, not a greenfield effort. The plugin (v1.7.0) already ships 15 skills, 11 commands, 20 tools, a SQLite memory system, observability logging, adaptive skill injection, and a fallback chain. The v4.0 gaps are concentrated in three areas: agent presentation bugs (stocktake cannot see config-hook-injected agents, Tab cycle is uncontrolled), content expansion (OOP/SOLID coding standards, Java/C# language patterns, new agents), and production hardening (command namespace prefixing, mock fallback test mode, QA playbook). Competitors (oh-my-openagent, ECC, superpowers, GSD) have been thoroughly benchmarked in Phase 11 research; we have parity or better on skills, memory, observability, and adaptive loading.

The recommended approach is zero new dependencies. Every v4.0 feature is achievable with the existing stack: Bun runtime, TypeScript, the @opencode-ai/plugin API, yaml for frontmatter, and zod for schema validation. The work is content authoring (markdown skills, agents, commands), config schema extensions (mock fallback test mode), and wiring fixes (stocktake registry-aware detection, command rename via DEPRECATED_ASSETS). The mock provider infrastructure, adaptive skill injector, dependency resolver, and config hook agent registration are all proven and operational.

The key risks are: (1) command renaming without atomic migration leaves users with duplicate or missing commands, (2) stocktake remaining blind to config-hook agents undermines all agent expansion work, (3) adding too many primary agents pollutes the Tab cycle (strict subagent-only policy required), and (4) repeating the Phase 11 research-to-execution gap where planned features are silently dropped. Each risk has a concrete mitigation strategy documented in the pitfalls research.

## Key Findings

### Recommended Stack

No changes to the technology stack for v4.0. The entire milestone is content authoring plus wiring changes on the existing foundation.

**Core technologies (unchanged):**
- **Bun 1.3.11:** Runtime, test runner, package manager -- required by OpenCode plugin spec
- **TypeScript ^6.0.2:** Type safety with `--noEmit` check
- **@opencode-ai/plugin ^1.3.8:** The only way to register tools/hooks/agents in OpenCode
- **yaml ^2.8.3:** All YAML frontmatter parsing for skills, agents, commands
- **zod (transitive):** Schema validation for tool args and config (no separate install)
- **Biome ^2.4.10:** Lint and format for all TS files

**What NOT to add:** No mocking libraries (mock provider already built), no test frameworks for QA (playbooks are AI-executable markdown), no AST parsing (standards enforced via prompt injection), no agent frameworks (OpenCode IS the runtime), no template engines (pure TS functions).

### Expected Features

**Must have (table stakes):**
- T-01: Fix agent visibility in Tab cycle and stocktake detection -- this is a bug, not a feature
- T-02/T-03/T-04: Add Debugger, Planner, and Code Reviewer agents (all competitors have these)
- T-05: Prefix all commands with `oc-` for namespace collision prevention
- T-06: Remove `oc-configure` as slash command (CLI-only per PROJECT.md)
- T-07: Fix stocktake agent detection (must see config-hook agents)
- T-08: Expand coding-standards with OOP/SOLID/Clean Architecture principles
- T-09: Add Java and C# language pattern skills

**Should have (differentiators):**
- D-01: Mock/fail-forced fallback test mode (no competitor offers this)
- D-05: Skill-aware doctor diagnostics (extend existing doctor tool)
- D-06: Anti-slop comment checking hook
- D-07: Agents.md curated template library for common project types

**Defer (post-v4.0):**
- Per-language build/test/review commands (anti-feature: causes command bloat)
- Cross-machine memory portability
- Eval harness for agent effectiveness measurement
- Multi-runtime targeting (stay OpenCode-only)

### Architecture Approach

No new directories or subsystems are needed. All v4.0 changes modify existing components or add assets. The two-layer architecture (JS/TS module + filesystem assets) remains unchanged. The critical architectural fix is making stocktake registry-aware so it queries both filesystem agents AND config-hook agents, merging results with filesystem winning on name collision.

**Major components affected:**
1. **src/tools/stocktake.ts** -- Add registry-aware agent detection (accept `registeredAgents` parameter from AGENT_REGISTRY)
2. **src/installer.ts** -- Expand DEPRECATED_ASSETS for renamed commands; remove oc-configure from FORCE_UPDATE_ASSETS
3. **src/agents/index.ts** -- Add new agent definitions (debugger, planner, reviewer) following existing frozen AgentConfig pattern
4. **src/orchestrator/fallback/** -- Add testMode config-driven toggle with message counter and mock error injection
5. **assets/skills/** -- Add 6+ new skill directories (oop-patterns, abstraction-layers, java-patterns, csharp-patterns, security-standards, api-design)
6. **assets/commands/** -- Rename all to oc-* prefix, add oc-review-agents and oc-qa commands

**Key patterns to follow:**
- Deprecation-driven rename via DEPRECATED_ASSETS (proven for configure.md removal)
- Config-driven feature toggle via Zod defaults (no schema version bump needed)
- Strict subagent-only policy: only `autopilot` as mode "primary"; all others as "subagent"

### Critical Pitfalls

1. **Command rename breaks user workflows** -- Old commands silently disappear if DEPRECATED_ASSETS is not atomically updated. Prevention: add every old filename to DEPRECATED_ASSETS before release; test fresh install, upgrade, and customized-file scenarios.

2. **Stocktake blind to config-hook agents** -- Adding more agents via config hook while stocktake only scans filesystem compounds the visibility problem. Prevention: fix stocktake BEFORE any agent expansion work. Add `origin: "config-hook"` to AssetEntry.

3. **Tab-cycle pollution from primary agents** -- Every primary-mode agent appears in Tab cycle. Adding 6+ primary agents makes Tab unusable. Prevention: STRICT rule -- only `autopilot` is primary. All new agents are subagent mode. Add automated test enforcing this.

4. **Research-to-execution gap** -- Phase 11 research was good but execution fell short. Prevention: each implementation plan references specific gap IDs; each phase completion reconciles planned vs shipped features; scope ruthlessly upfront.

5. **Token budget overflow from skill expansion** -- 8000-token budget for skills gets crowded with 20+ skills. Prevention: enforce 2000-token cap per skill in linter; methodology skills under 1000 tokens; add doctor warning at 80% budget usage.

## Implications for Roadmap

Based on research, suggested phase structure (5 phases):

### Phase 1: Foundation and Namespace Cleanup
**Rationale:** Zero-risk file renames and deprecation cleanup that must happen before adding new assets. Command renaming and oc-configure removal are prerequisites for a clean namespace.
**Delivers:** All commands prefixed with `oc-*`, oc-configure removed, DEPRECATED_ASSETS updated for migration
**Addresses:** T-05 (command prefix), T-06 (remove oc-configure)
**Avoids:** Pitfall 1 (command rename breakage), Pitfall 8 (broken first-run UX from dangling oc-configure references)

### Phase 2: Agent Visibility and Registry Fixes
**Rationale:** Stocktake must see agents before adding new ones. This is the critical bug fix phase that unblocks all agent expansion work.
**Delivers:** Registry-aware stocktake, correct agent mode assignments, Tab-cycle policy enforced
**Addresses:** T-01 (agent visibility), T-07 (stocktake detection fix)
**Avoids:** Pitfall 2 (invisible agents), Pitfall 3 (Tab-cycle pollution)

### Phase 3: Agent and Skill Expansion
**Rationale:** With namespace clean and stocktake working, add the content that achieves competitive parity. This is the largest phase by effort.
**Delivers:** New agents (Debugger, Planner, Reviewer), expanded coding standards (OOP/SOLID), Java/C# language skills, agents.md review command
**Addresses:** T-02, T-03, T-04 (new agents), T-08, T-09 (coding standards), T-10 (agents.md review), D-03 (Tab ordering), D-07 (template library)
**Avoids:** Pitfall 5 (token budget overflow -- enforce per-skill caps), Pitfall 9 (dependency cycles -- linter validation), Pitfall 10 (agent name collisions -- oc- prefix), Pitfall 12 (subagent discovery)

### Phase 4: Production Hardening
**Rationale:** Independent from Phase 3 content work. Adds resilience testing and quality tooling. Can run in parallel with Phase 3.
**Delivers:** Mock/fail fallback test mode via config toggle, skill-aware doctor diagnostics, anti-slop comment hook
**Addresses:** D-01 (fallback test mode), D-05 (skill-aware doctor), D-06 (anti-slop hook)
**Avoids:** Pitfall 6 (persistent mock state -- use session scope or TTL)

### Phase 5: QA Playbook and Validation
**Rationale:** Must come last because it tests everything above. The playbook documents the complete feature surface and validates the entire v4.0 delivery.
**Delivers:** Manual QA playbook in `qa/` directory, test scenarios for all features, gap matrix reconciliation
**Addresses:** D-02 (QA playbook), D-04 (context-aware commands)
**Avoids:** Pitfall 4 (research-execution gap -- reconcile planned vs shipped), Pitfall 7 (write-once documentation -- use executable steps linked to test files)

### Phase Ordering Rationale

- Phase 1 before Phase 2: Clean namespace is needed before stocktake fix so renamed commands are correctly detected
- Phase 2 before Phase 3: Stocktake must work before adding agents, otherwise new agents are invisible and cannot be verified
- Phase 3 and Phase 4 can run in parallel: Agent/skill expansion and fallback test mode are independent subsystems
- Phase 5 must be last: QA playbook tests the complete feature surface from all prior phases
- This mirrors the dependency graph from FEATURES.md: T-07 -> T-01 -> T-02/T-03/T-04 -> D-02

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** Tab-cycle ordering behavior in OpenCode is not fully documented. Need to verify how OpenCode orders agents in Tab cycle (alphabetical? registration order? configurable?). Feature request #16840 was closed/rejected.
- **Phase 4:** FallbackManager mock error injection point needs careful analysis. The integration between test mode counter and the actual error surface where provider errors occur requires tracing the data flow through the fallback chain.

Phases with standard patterns (skip research-phase):
- **Phase 1:** Exact same DEPRECATED_ASSETS + copyIfMissing pattern already proven for configure.md removal. No novelty.
- **Phase 3:** Agent registration follows existing frozen AgentConfig pattern. Skill authoring follows existing SKILL.md format. Content work, not architecture work.
- **Phase 5:** Pure documentation. Template structure already defined in ARCHITECTURE.md.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies; every integration point audited against codebase |
| Features | HIGH | Exhaustive competitor inventory (Phase 11) cross-referenced with current codebase; clear gap analysis |
| Architecture | HIGH | All changes modify existing components; patterns proven (DEPRECATED_ASSETS, configHook, Zod defaults) |
| Pitfalls | HIGH | Based on codebase analysis, OpenCode docs, competitor patterns, and Phase 11 post-mortem |

**Overall confidence:** HIGH

### Gaps to Address

- **Tab-cycle ordering:** No documented way to control agent order in OpenCode Tab cycle. If ordering matters, may need to investigate OpenCode internals or accept alphabetical ordering. Research during Phase 2 planning.
- **Java/C# stack detection:** Adding `pom.xml` and `*.csproj` detection to MANIFEST_TAGS requires glob or directory scan for csproj files. The exact detection mechanism needs implementation design.
- **Token budget under expansion:** With 20+ skills, the 8000-token budget may need to become configurable. Monitor during Phase 3 and raise budget if needed.
- **Agent name collision policy:** Standard agents (researcher, documenter, etc.) are not oc-prefixed. Whether to rename them in v4.0 or defer is a scope decision for roadmap creation.
- **FallbackManager injection point:** The exact code location where mock errors should be injected into the live fallback chain needs tracing during Phase 4 implementation.

## Sources

### Primary (HIGH confidence)
- Codebase audit: `src/observability/mock/`, `src/skills/adaptive-injector.ts`, `src/agents/index.ts`, `src/tools/stocktake.ts`, `src/installer.ts`, `src/config.ts`, `src/registry/model-groups.ts`
- OpenCode documentation: [plugins](https://opencode.ai/docs/plugins/), [agents](https://opencode.ai/docs/agents/), [commands](https://opencode.ai/docs/commands/), [skills](https://opencode.ai/docs/skills)
- Phase 11 deep-dives: GSD, superpowers, OMO, ECC, claude-mem at `.planning/phases/11-ecosystem-research/research/`
- Phase 11 gap matrix: `.planning/phases/11-ecosystem-research/11-GAP-MATRIX.md` (73 gaps, 10 coverage areas)

### Secondary (MEDIUM confidence)
- [oh-my-openagent GitHub](https://github.com/code-yeongyu/oh-my-openagent) -- competitor agent count and architecture
- OpenCode Tab-cycle ordering issue #16840 (closed/rejected)
- Token waste analysis: https://dev.to/nicolalessi/i-tracked-every-token-my-ai-coding-agent-consumed-for-a-week-70-was-waste-465

### Tertiary (LOW confidence)
- Exact OpenCode Tab-cycle ordering mechanism -- needs validation during implementation

---
*Research completed: 2026-04-03*
*Ready for roadmap: yes*
