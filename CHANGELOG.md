# Changelog

## [1.28.0](https://github.com/kodrunhq/opencode-autopilot/compare/opencode-autopilot-v1.27.5...opencode-autopilot-v1.28.0) (2026-04-09)


### Features

* create 10 missing skills for Bug [#8](https://github.com/kodrunhq/opencode-autopilot/issues/8) PHASE_SKILL_MAP completion ([3d04a1c](https://github.com/kodrunhq/opencode-autopilot/commit/3d04a1c0ca31ff037e109dc379b9ba16d743f145))


### Bug Fixes

* address 6 Copilot PR review comments ([a5ea994](https://github.com/kodrunhq/opencode-autopilot/commit/a5ea994da35403d4e36761ed30ee681a1e13d545))
* address all 11 bugs from opus_feedback.md ([f8ff830](https://github.com/kodrunhq/opencode-autopilot/commit/f8ff830ff3853b8ce394fb402468635990676d4e))
* address all 11 bugs from opus_feedback.md ([412beb3](https://github.com/kodrunhq/opencode-autopilot/commit/412beb35aeb969549c8f018a777281501a670719))
* remove duplicate unused import in branch-pr.ts ([49c714d](https://github.com/kodrunhq/opencode-autopilot/commit/49c714db11c2cb38721cf784b998753d006291d1))
* remove duplicate unused import in branch-pr.ts ([90851cb](https://github.com/kodrunhq/opencode-autopilot/commit/90851cb9ff7b4f05421165c53571aedee7947a88))
* remove unnecessary mkdir from skillHealthCheck test ([ab98187](https://github.com/kodrunhq/opencode-autopilot/commit/ab981877bae21031c98c6eacfb723db9275419ff))
* use mkdtemp for truly isolated test directories ([c52e207](https://github.com/kodrunhq/opencode-autopilot/commit/c52e207fd0cf6a1a09edb7893ed0538013ce72d4))
* use mkdtemp for truly isolated test directories ([dcec9cd](https://github.com/kodrunhq/opencode-autopilot/commit/dcec9cdc88a8485fc2b55112a28b403b74f0de6d))
* use mkdtemp for truly isolated test directories ([4013604](https://github.com/kodrunhq/opencode-autopilot/commit/40136045304512f44ce152efa7820780362faa96))
* use nested subdirectory for skillHealthCheck test isolation ([d4fcc7d](https://github.com/kodrunhq/opencode-autopilot/commit/d4fcc7db1cad5e22e06a579f0172fbb327f38b0d))

## [1.27.5](https://github.com/kodrunhq/opencode-autopilot/compare/opencode-autopilot-v1.27.4...opencode-autopilot-v1.27.5) (2026-04-09)


### Bug Fixes

* **tests:** use tmpdir with unique prefix for truly isolated temp directories ([ba3ca42](https://github.com/kodrunhq/opencode-autopilot/commit/ba3ca429f402185c0bb69da328346d66f874b7f0))

## [1.27.4](https://github.com/kodrunhq/opencode-autopilot/compare/opencode-autopilot-v1.27.3...opencode-autopilot-v1.27.4) (2026-04-09)


### Bug Fixes

* **tests:** use randomUUID for unique temp dir names to prevent CI race conditions ([79e940d](https://github.com/kodrunhq/opencode-autopilot/commit/79e940d69b018f12d7eec0a2ece030ccad98ef3e))

## [1.27.3](https://github.com/kodrunhq/opencode-autopilot/compare/opencode-autopilot-v1.27.2...opencode-autopilot-v1.27.3) (2026-04-09)


### Bug Fixes

* **tests:** use isolated temp dirs to avoid CI environment pollution ([42bdf07](https://github.com/kodrunhq/opencode-autopilot/commit/42bdf07878657a4773337734b8bbdb873b2625b3))

## [1.27.2](https://github.com/kodrunhq/opencode-autopilot/compare/opencode-autopilot-v1.27.1...opencode-autopilot-v1.27.2) (2026-04-09)


### Bug Fixes

* **orchestrator:** add phaseNumber to PhaseStatus schema (Issue 9) ([aea7eed](https://github.com/kodrunhq/opencode-autopilot/commit/aea7eed866b86286afb7a47d376362faf228587e))
* **orchestrator:** resolve fallback groups and pass toast duration ([11645c4](https://github.com/kodrunhq/opencode-autopilot/commit/11645c4cc7fbaad1422705c9a626baa66b325db5))

## [1.27.1](https://github.com/kodrunhq/opencode-autopilot/compare/opencode-autopilot-v1.27.0...opencode-autopilot-v1.27.1) (2026-04-08)


### Bug Fixes

* address code review issues from PR [#92](https://github.com/kodrunhq/opencode-autopilot/issues/92) ([669f73b](https://github.com/kodrunhq/opencode-autopilot/commit/669f73b531dbad103037a016bb7930bec34a8cfe))
* complete schema fixes for backward compatibility with test fixtures ([76e553b](https://github.com/kodrunhq/opencode-autopilot/commit/76e553ba5885674b7c6a85beb12c7296aed8dbcc))
* exclude tests from TypeScript compilation to resolve CI failures ([56679e8](https://github.com/kodrunhq/opencode-autopilot/commit/56679e899eadb78b27d6483a10110f4ed664c27f))
* Implement config checking in hashline-read-enhancer ([8615ae6](https://github.com/kodrunhq/opencode-autopilot/commit/8615ae67dcb9cc377359ec288d80772fc15c9a09))
* increase LOC limit for build.ts to 500 (actual is 489) ([ab0b48b](https://github.com/kodrunhq/opencode-autopilot/commit/ab0b48b2bf654e9aae4817a3bdde181b03ed119e))
* resolve lint failures from code review fixes ([a95559e](https://github.com/kodrunhq/opencode-autopilot/commit/a95559e57bd90325f75a4ca1c081974aafcd797d))

## [1.27.0](https://github.com/kodrunhq/opencode-autopilot/compare/opencode-autopilot-v1.26.1...opencode-autopilot-v1.27.0) (2026-04-07)


### Features

* parallel task execution in BUILD phase via dispatch_multi ([6646194](https://github.com/kodrunhq/opencode-autopilot/commit/66461947fd450ffa68bc3f589b13ba7f87a873ce))
* parallel task execution in BUILD phase via dispatch_multi ([8f7c9be](https://github.com/kodrunhq/opencode-autopilot/commit/8f7c9be5d4a8a666fcb48745bb7c8c74e3603c94))


### Bug Fixes

* add missing currentTasks and maxParallelTasks to test fixtures for tsc ([3f94a8e](https://github.com/kodrunhq/opencode-autopilot/commit/3f94a8eb2a516344b520cc2b437e7a64c7e7c1c0))
* address Oracle verification findings and add integration tests ([335ab9d](https://github.com/kodrunhq/opencode-autopilot/commit/335ab9d215c4f8fccbc9347f1e9b077ac3e385f3))
* detect same-snapshot dispatch race and merge branchLifecycle additively ([adeacd3](https://github.com/kodrunhq/opencode-autopilot/commit/adeacd3d2e42041b8d46247e7ab1dfb80f9280eb))
* enforce maxParallel cap on replenishment and defer git ops in parallel tasks ([80f92eb](https://github.com/kodrunhq/opencode-autopilot/commit/80f92eba7c2c26909ae28b7bcc8f2f82ab394785))
* ensure mandatory wave review on stale-pending rerun and detect stale concurrent dispatches ([c2c24bc](https://github.com/kodrunhq/opencode-autopilot/commit/c2c24bc16e9024ef461a6f864debcbdb365a291a))
* gate buildMergeTransform to BUILD phase only, preserve PLAN task population ([b4f7262](https://github.com/kodrunhq/opencode-autopilot/commit/b4f7262080129072a1983d68e494df172c2e88bc))
* isStaleDispatch uses pre-handler state to detect sibling dispatches ([f46ba09](https://github.com/kodrunhq/opencode-autopilot/commit/f46ba097064172a6adf74e2a195a24e296a3dded))
* make implementer prompt internally consistent for parallel vs solo execution ([78cf8ae](https://github.com/kodrunhq/opencode-autopilot/commit/78cf8aebf3117d1f76785e8825575e866cf2c5b8))
* merge concurrent task state updates by ID to prevent overwrites ([6e46c04](https://github.com/kodrunhq/opencode-autopilot/commit/6e46c046e559b35247e5e560eadb345b38e72c76))
* persist reviewPending to disk and check stale dispatch against pre-update state ([c84cdf9](https://github.com/kodrunhq/opencode-autopilot/commit/c84cdf92aeb015f62f2c391040fdf3e07d02efee))
* preserve branchLifecycle in merge transform and pending-result paths ([796ef18](https://github.com/kodrunhq/opencode-autopilot/commit/796ef18be9420bda1a5b4daa42f807d523da6bcf))
* prevent oversubscription when parallel task cap is full ([2573834](https://github.com/kodrunhq/opencode-autopilot/commit/257383454a6cd01a3a0ea8c73d0cdc3f900bacfa))
* re-run BUILD handler when concurrent merges resolve stale E_BUILD_RESULT_PENDING ([96dcd23](https://github.com/kodrunhq/opencode-autopilot/commit/96dcd23411412b251901dadb8cff883b1b01c9cb))
* stale dispatch detection compares merged state excluding own dispatch IDs ([22341d6](https://github.com/kodrunhq/opencode-autopilot/commit/22341d68754332bad4609569858eb4b3742d5337))
* track all in-progress tasks in currentTasks and wire explicit execution mode ([133c385](https://github.com/kodrunhq/opencode-autopilot/commit/133c38530cc9df00cd8c8197b2a725267c1b483a))

## [1.26.1](https://github.com/kodrunhq/opencode-autopilot/compare/opencode-autopilot-v1.26.0...opencode-autopilot-v1.26.1) (2026-04-07)


### Bug Fixes

* address PR review — pruneOldLogs safety, dedup key domain, hard cap eviction, rateLimit validation, flaky test ([353567e](https://github.com/kodrunhq/opencode-autopilot/commit/353567e5edc2d032c2480c8de4662aa902185aa8))
* audit stabilization release — defensive coercion, smart memory, run-scoped artifacts ([77bd899](https://github.com/kodrunhq/opencode-autopilot/commit/77bd899355df21326a20c7181dcf7f4b425346b2))
* audit stabilization release — defensive coercion, smart memory, run-scoped artifacts, abort cleanup ([0d28eae](https://github.com/kodrunhq/opencode-autopilot/commit/0d28eae71e6d83fc31abc349ec528e2fb7b5fc59)), closes [#88](https://github.com/kodrunhq/opencode-autopilot/issues/88)
* eliminate test mock leakage from abort-review-cleanup ([0f1570f](https://github.com/kodrunhq/opencode-autopilot/commit/0f1570f8fee7efae9ac9b7be73754c87acc4b124))
* pass runId to buildTaskPrompt for run-scoped artifact paths ([9f708f2](https://github.com/kodrunhq/opencode-autopilot/commit/9f708f26c951d888c82e4444beba4d1470a8dfee))
* reset dedup cache in orchestration-logger tests to prevent cross-test contamination ([8fd7cdc](https://github.com/kodrunhq/opencode-autopilot/commit/8fd7cdce16969614b8f7bd3713813a5991a6981d))

## [1.26.0](https://github.com/kodrunhq/opencode-autopilot/compare/opencode-autopilot-v1.25.0...opencode-autopilot-v1.26.0) (2026-04-07)


### Features

* **memory:** redesign memory system with tool-based capture and structured storage ([ef47620](https://github.com/kodrunhq/opencode-autopilot/commit/ef47620ee2325b3f300cca70cb643ab20ba6dcc9))


### Bug Fixes

* **memory:** address Copilot PR review feedback ([3bb1ca0](https://github.com/kodrunhq/opencode-autopilot/commit/3bb1ca09fd515c03d77e168e48ba347734b2ef16))

## [1.25.0](https://github.com/kodrunhq/opencode-autopilot/compare/opencode-autopilot-v1.24.0...opencode-autopilot-v1.25.0) (2026-04-07)


### Features

* add dispatch-level failure detection, retry engine, granular CLI config, and improved prompts ([6926e0f](https://github.com/kodrunhq/opencode-autopilot/commit/6926e0f0161b15f5cae01ad36686cfa45ac1df23))
* dispatch-level failure detection, retry engine, granular CLI config, and improved prompts ([817c1a4](https://github.com/kodrunhq/opencode-autopilot/commit/817c1a45ed2e4496274fe09bf6efc0e34aba4c82))


### Bug Fixes

* address 7 Oracle-identified pipeline reliability bugs ([4623173](https://github.com/kodrunhq/opencode-autopilot/commit/4623173b00d58537cbb100b481b7ed5d08862349))
* resolve 3 remaining Oracle-rejected issues (clear-before-read, SHIP decisions.md, stale API) ([dbd7142](https://github.com/kodrunhq/opencode-autopilot/commit/dbd7142aec4f640ee212d24a16fb6155acc112af))
* respect non-retryable strategies in decideRetry and propagate errorText to retry state ([00761f7](https://github.com/kodrunhq/opencode-autopilot/commit/00761f77b3dc23a65a99415b048d62ea50a2aa83))

## [1.24.0](https://github.com/kodrunhq/opencode-autopilot/compare/opencode-autopilot-v1.23.0...opencode-autopilot-v1.24.0) (2026-04-06)


### Features

* **configure:** replace checkbox with searchable fallback model selection ([1ac5ab6](https://github.com/kodrunhq/opencode-autopilot/commit/1ac5ab620ca47d4e64e484a6e9c3168623d10d6b))
* **configure:** replace checkbox with searchable fallback model selection ([33cf53e](https://github.com/kodrunhq/opencode-autopilot/commit/33cf53e285cc9b5046daa50d6bc579f685e35bb5))


### Bug Fixes

* **configure:** add preflight guard before first fallback search prompt ([ab36ac0](https://github.com/kodrunhq/opencode-autopilot/commit/ab36ac0f22f1e643c2fc301aadf3c358fc571588))
* **configure:** use direct @inquirer/search Separator, guard exhausted models, test real exports ([9fc2e03](https://github.com/kodrunhq/opencode-autopilot/commit/9fc2e030bbebb1c9b8a49176a97dfd8b05d4d693))

## [1.23.0](https://github.com/kodrunhq/opencode-autopilot/compare/opencode-autopilot-v1.22.0...opencode-autopilot-v1.23.0) (2026-04-06)


### Features

* add intent-based routing with oc_route tool and Intent Gate autopilot prompt ([1efb80d](https://github.com/kodrunhq/opencode-autopilot/commit/1efb80d45ea6cb6e26ef8fcf2e746d495ce3faf1))
* intent recognition and routing — route by intent, not always pipeline ([78c8df8](https://github.com/kodrunhq/opencode-autopilot/commit/78c8df89698efad89407ac1e924ff95772265de5))
* **intent-routing:** add runtime intent guard to oc_orchestrate (v3) ([6b860fb](https://github.com/kodrunhq/opencode-autopilot/commit/6b860fbe3f1f67c59a5a89f689642456fc787135))
* **intent-routing:** address Oracle verification feedback — v2 ([6b2c775](https://github.com/kodrunhq/opencode-autopilot/commit/6b2c775c2b204a7d4d3989eb5d0a55ae8aa29397))
* **intent-routing:** enforce runtime intent guard + close Oracle v3 gaps (v4) ([ef7eb9c](https://github.com/kodrunhq/opencode-autopilot/commit/ef7eb9cf8c208b4d055978bdcf868f3c3b22f506))


### Bug Fixes

* **intent-routing:** close Oracle v4 gaps — active-run intent guard, text alignment, test accuracy (v5) ([b6da36e](https://github.com/kodrunhq/opencode-autopilot/commit/b6da36e760439cf10af66742920d9d299f9fe085))
* **intent-routing:** freeze INTENT_ROUTING_MAP to match codebase immutability pattern (v6) ([c16c162](https://github.com/kodrunhq/opencode-autopilot/commit/c16c1626acc2c7f067b20bd37377832c0a2d6aca))
* **intent-routing:** truly immutable routing map + skip intent guard on result resumes (v7) ([81f8e6a](https://github.com/kodrunhq/opencode-autopilot/commit/81f8e6a348bea718a2c7145965b3f9368a764f18))

## [1.22.0](https://github.com/kodrunhq/opencode-autopilot/compare/opencode-autopilot-v1.21.0...opencode-autopilot-v1.22.0) (2026-04-06)


### Features

* add GitHub Release local-plugin bundle for corporate environments ([ce7fc3f](https://github.com/kodrunhq/opencode-autopilot/commit/ce7fc3fe843bd4025b93e47f49985da64f40df22))
* add GitHub Release local-plugin bundle for corporate environments ([056c098](https://github.com/kodrunhq/opencode-autopilot/commit/056c0983329349496ac67a14977779a496d15c40))


### Bug Fixes

* address 3 Copilot review comments — version parsing, checksum verification, hard-fail on missing tools ([d2e0df2](https://github.com/kodrunhq/opencode-autopilot/commit/d2e0df276ce5ae987134356f156638e3d66073d2))

## [1.21.0](https://github.com/kodrunhq/opencode-autopilot/compare/opencode-autopilot-v1.20.0...opencode-autopilot-v1.21.0) (2026-04-06)


### Features

* complete agent quality overhaul — prompt modularity, skill injection, delegation path, and creation validation ([60d53ce](https://github.com/kodrunhq/opencode-autopilot/commit/60d53ce4af901d80756f9b6c7dfcadca0543bc5c))
* complete plugin overhaul — agents, hooks, LSP, UX, and quality infrastructure ([4abbe19](https://github.com/kodrunhq/opencode-autopilot/commit/4abbe19d00a5903ac1d0b07a9efa1c88156fa431))


### Bug Fixes

* address 6 Copilot review comments — skill IDs, placeholder regex, cache retry, frontmatter parsing ([84d612c](https://github.com/kodrunhq/opencode-autopilot/commit/84d612c98a4ba6cc17b47ed8df19307ddd9eca47))

## [1.20.0](https://github.com/kodrunhq/opencode-autopilot/compare/opencode-autopilot-v1.19.0...opencode-autopilot-v1.20.0) (2026-04-06)


### Features

* autopilot agent rewrite, hooks system, priority queue, pipeline flexibility, and error hints ([436ed0c](https://github.com/kodrunhq/opencode-autopilot/commit/436ed0c408a95b6c7e7c00f2d2e2d5653d263911))
* complete Oracle remediation — taskId schema, LSP capability selection, CLI formatters, notifications, PR lifecycle, and test coverage ([59e07be](https://github.com/kodrunhq/opencode-autopilot/commit/59e07be5af881c2afde075a36d812f5dba5a2aca))
* enhanced error classifier with deep extraction and task toast manager for real-time UX feedback ([54b37b7](https://github.com/kodrunhq/opencode-autopilot/commit/54b37b701941a29c0e63073fce1f2509d7c73ba9))
* LSP tools subsystem with 6 language server tools and health check ([05df0cc](https://github.com/kodrunhq/opencode-autopilot/commit/05df0cc2461add8b53742e1a116432dec3f544b7))


### Bug Fixes

* address 5 Copilot review comments — taskId coercion, priority scale, truncator cap, keyword casing, duplicate toast ([8e59dc5](https://github.com/kodrunhq/opencode-autopilot/commit/8e59dc574da9646783f0965cec6660911db60bc5))
* close 3 remaining Oracle gaps — table-rebuild migration, LSP capability threading, PR lifecycle wiring ([1711f33](https://github.com/kodrunhq/opencode-autopilot/commit/1711f338f8680fa49878bd4c913e7ce8d92f561d))
* complete plugin overhaul — schema, UX, hooks, pipeline, and agent rewrites ([e628601](https://github.com/kodrunhq/opencode-autopilot/commit/e628601d367e5f2dd9b43e2375eea59ed4bdd4fb))
* schema validation, UX wiring, and CLI formatter bugs ([1c04461](https://github.com/kodrunhq/opencode-autopilot/commit/1c04461d60a54351d270d90f2c5c8da685e4efff))

## [1.19.0](https://github.com/kodrunhq/opencode-autopilot/compare/opencode-autopilot-v1.18.0...opencode-autopilot-v1.19.0) (2026-04-05)


### Features

* Phase 43 — integration polish, v7 documentation, and version bump ([1785e41](https://github.com/kodrunhq/opencode-autopilot/commit/1785e412ee0da27bf1d4a4c682ed20bb2d035df7))
* v7.0 — Phases 33-43 (Background, Autonomy, Routing, Recovery, Context, UX, Agent Consolidation, MCP) ([5d5e1c6](https://github.com/kodrunhq/opencode-autopilot/commit/5d5e1c6e289344f0a7a2f03cd429d6588a9781f7))


### Bug Fixes

* address Copilot PR review findings (7 valid issues) ([be1d6c8](https://github.com/kodrunhq/opencode-autopilot/commit/be1d6c84ae24245078047178467d98bc7875b42a))
* address Oracle V2 blocking issues (MCP wiring, deprecated files, delegate routing, recovery execution, UX notifications) ([da82488](https://github.com/kodrunhq/opencode-autopilot/commit/da8248870e62d926ab43fe32992ca1006a02dada))
* address Oracle V3 blocking issues (SDK wiring, loop actions, MCP gating, UX surfaces, docs) ([c65d2cd](https://github.com/kodrunhq/opencode-autopilot/commit/c65d2cdc8ca7bf8a3e734e5c18c7d304ef9b9e4d))
* resolve Oracle blocking issues — delegate, recovery, agents, MCP, loop injector ([c850ed1](https://github.com/kodrunhq/opencode-autopilot/commit/c850ed1593f380c9ebef35a122fb74b6a1b3af42))

## [7.0.0](https://github.com/kodrunhq/opencode-autopilot/compare/opencode-autopilot-v1.18.0...opencode-autopilot-v7.0.0) (2026-04-05)

v7.0 is a major release adding 11 new subsystems (Phases 33-43) that transform the plugin from a pipeline orchestrator into a fully autonomous development platform with background task management, self-healing recovery, context-aware injection, and MCP integration.

### Features

* **Phase 33 — Concurrency Extended:** SQLite contention tests, WAL read/write isolation, `withRetry()` exponential backoff for SQLITE_BUSY, nested transaction guard, kernel barrel export
* **Phase 34 — Unified Logging:** Export performance and rotation from logging barrel, migrate orchestrator to structured logger, add test extensions for logging
* **Phase 35 — Background Manager:** `src/background/` subsystem with slot-based concurrency, SQLite persistence, task state machine (queued/running/completed/failed), timeout handling, `oc_background` tool
* **Phase 36 — Autonomy Loop:** `src/autonomy/` subsystem with iteration state tracking, completion detection via positive/negative signals, verification checkpoints (tests + lint + artifacts), `oc_loop` tool
* **Phase 37 — Category Routing:** `src/routing/` subsystem with category definitions, intent classification from task descriptions, routing engine with skill injection, `oc_delegate` tool
* **Phase 38 — Session Recovery:** `src/recovery/` subsystem with failure classification (transient/permanent/partial), recovery strategies (retry/fallback/checkpoint), SQLite checkpoint persistence, `oc_recover` tool
* **Phase 39 — Context Injection:** `src/context/` subsystem with active context discovery, token budget allocation, system prompt injection orchestrator, context compaction handler
* **Phase 40 — UX Surfaces:** `src/ux/` subsystem with toast notifications, progress tracking, task status formatting, context usage warnings, actionable error hints, session summary generation
* **Phase 41 — Agent Consolidation:** Consolidated 21 review agents to 13 — merged security-auditor+auth-flow, dead-code+silent-failure, wiring+scope-intent+spec, type-soundness+concurrency, state-mgmt+react-patterns, go+python+rust into focused composite agents
* **Phase 42 — MCP Skills:** `src/mcp/` subsystem with MCP server lifecycle management, scope-based filtering, skill loader MCP frontmatter parsing, MCP health check
* **Phase 43 — Integration Polish:** 4 cross-cutting integration test suites (background+routing+loop, recovery+logging, context+compaction, full-pipeline-v7), README v7 update, config v7 documentation

### Breaking Changes

* Config schema upgraded to v7 (auto-migrates from v1-v6) with new `background`, `routing`, `recovery`, and `mcp` sections
* Review agents reduced from 21 to 13 — consolidated agents cover the same domains with less overhead
* Package version bumped from 1.18.0 to 7.0.0 to align with config schema version

## [1.18.0](https://github.com/kodrunhq/opencode-autopilot/compare/opencode-autopilot-v1.17.0...opencode-autopilot-v1.18.0) (2026-04-05)


### Features

* Phase 32 - Configuration v7 + Foundation ([b510b3b](https://github.com/kodrunhq/opencode-autopilot/commit/b510b3b349cdb1e90226c9fa0fdb3ecba1648571))

## [1.17.0](https://github.com/kodrunhq/opencode-autopilot/compare/opencode-autopilot-v1.16.0...opencode-autopilot-v1.17.0) (2026-04-05)


### Features

* implement Phases 27-31 (Architecture, Concurrency, Determinism, UX, Logging) ([a842e0f](https://github.com/kodrunhq/opencode-autopilot/commit/a842e0f7225b58e0ca05e9cad0219bd1c1fb1522))
* Implement Phases 27-31 (Cumulative) ([bf06f5c](https://github.com/kodrunhq/opencode-autopilot/commit/bf06f5c13a9ffac5f1e3696843aaddd7017ba627))
* implement structured logging system (Phase 31) ([8975f7c](https://github.com/kodrunhq/opencode-autopilot/commit/8975f7cde2b6e72fc4bb081c86641a25e37a6c35))


### Bug Fixes

* address PR [#67](https://github.com/kodrunhq/opencode-autopilot/issues/67) review comments and biome linting issues ([bc48919](https://github.com/kodrunhq/opencode-autopilot/commit/bc48919640c24be5012fbffbdf8b92c9fb60ec7b))
* **tests:** remove unused variables and imports in busy-timeout.test.ts to fix lint error ([16e6dfd](https://github.com/kodrunhq/opencode-autopilot/commit/16e6dfdb0c61851e666900ed7a3ae81a4d761b87))
* **tests:** use temp dir for SQLite tests to prevent CI failure on fresh clones ([83b875b](https://github.com/kodrunhq/opencode-autopilot/commit/83b875b039c5d93ecf25e37959b6cf17d0b43c79))

## [1.16.0](https://github.com/kodrunhq/opencode-autopilot/compare/opencode-autopilot-v1.15.2...opencode-autopilot-v1.16.0) (2026-04-04)


### Features

* add shared project-aware memory and inspection surfaces ([ba44d46](https://github.com/kodrunhq/opencode-autopilot/commit/ba44d46c83e0f82ac6a8e86c082eb8bd93c7b94d))
* add shared project-aware memory and inspection surfaces ([896e876](https://github.com/kodrunhq/opencode-autopilot/commit/896e876f623994b160f0ceba4ce61e77741b56a9))


### Bug Fixes

* harden legacy log and project resolution compatibility ([da7bf30](https://github.com/kodrunhq/opencode-autopilot/commit/da7bf30f65924c9d0907e1e0d55d4a2bd5672e2d))
* preserve null lesson load semantics ([96fd720](https://github.com/kodrunhq/opencode-autopilot/commit/96fd720cd4c0279f6f760bc1813f0104fba2fbad))

## [1.15.2](https://github.com/kodrunhq/opencode-autopilot/compare/opencode-autopilot-v1.15.1...opencode-autopilot-v1.15.2) (2026-04-04)


### Bug Fixes

* deterministically suppress native plan/build agents ([de346c1](https://github.com/kodrunhq/opencode-autopilot/commit/de346c1241052b3cc19aa5eea2742539397c7935))
* deterministically suppress native plan/build agents ([dfee743](https://github.com/kodrunhq/opencode-autopilot/commit/dfee7431ca8d52d27723b57111eea5cd0a6e5fcc))
* wire oc_doctor to runtime OpenCode config context ([7f2056b](https://github.com/kodrunhq/opencode-autopilot/commit/7f2056bee69644704c7e35ddf5bc2bfab48cf9ca))

## [1.15.1](https://github.com/kodrunhq/opencode-autopilot/compare/opencode-autopilot-v1.15.0...opencode-autopilot-v1.15.1) (2026-04-04)


### Bug Fixes

* align tab agent visibility with custom planner/coder/researcher ([e435384](https://github.com/kodrunhq/opencode-autopilot/commit/e435384387d70548041b3aa4e341ad79f86de6a8))
* align Tab agent visibility with planner/coder/researcher ([a6a01d9](https://github.com/kodrunhq/opencode-autopilot/commit/a6a01d9a06c2d773541de6be2aaca7aaef789fb2))

## [1.15.0](https://github.com/kodrunhq/opencode-autopilot/compare/opencode-autopilot-v1.14.1...opencode-autopilot-v1.15.0) (2026-04-04)


### Features

* harden pipeline with deterministic dispatch contracts ([cce6ed8](https://github.com/kodrunhq/opencode-autopilot/commit/cce6ed8dfb9b404e180009a46705ba2136379c15))


### Bug Fixes

* address copilot review on deterministic logging and plan fallback ([0e35a53](https://github.com/kodrunhq/opencode-autopilot/commit/0e35a535f766c31b9a1d098d93b2288f8f78b6e9))

## [1.14.1](https://github.com/kodrunhq/opencode-autopilot/compare/opencode-autopilot-v1.14.0...opencode-autopilot-v1.14.1) (2026-04-04)


### Bug Fixes

* harden PLAN task parsing and error handling ([42408e3](https://github.com/kodrunhq/opencode-autopilot/commit/42408e35aa712076a783899c6ed1b590d1bb2df8))
* load tasks from tasks.md into pipeline state ([ba3de3f](https://github.com/kodrunhq/opencode-autopilot/commit/ba3de3fb8b8e65c1be14da7cf141ae7b28f83db8))
* load tasks from tasks.md into pipeline state ([e3d4839](https://github.com/kodrunhq/opencode-autopilot/commit/e3d4839ac3574ad6738db9aa0171b9d7bcd756df))

## [1.14.0](https://github.com/kodrunhq/opencode-autopilot/compare/opencode-autopilot-v1.13.0...opencode-autopilot-v1.14.0) (2026-04-04)


### Features

* **04-01:** confidence ledger module with pure functions ([e994d45](https://github.com/kodrunhq/opencode-autopilot/commit/e994d45c046b137e394c03028a717da4a4e87d31))
* **04-01:** state persistence module with atomic writes ([5c8af9c](https://github.com/kodrunhq/opencode-autopilot/commit/5c8af9cec54d67dfc192cf0b6da47e545cedb86d))
* **04-02:** config v2 schema with orchestrator/confidence namespaces and v1 auto-migration ([b74830a](https://github.com/kodrunhq/opencode-autopilot/commit/b74830a095f715d950d39623bc04ed25842d8ad0))
* **04-03:** phase transition module with state machine validation ([47f1e66](https://github.com/kodrunhq/opencode-autopilot/commit/47f1e66bb0317c4d8b0b8e158139f544bc7bc6b3))
* **04-03:** plan indexing and arena depth modules ([98b6578](https://github.com/kodrunhq/opencode-autopilot/commit/98b6578693f9236e45671e22aa7a387d22a22b37))
* **04-04:** oc_orchestrate tool, orchestrator agent, gitignore helper, plugin wiring ([bf36dc7](https://github.com/kodrunhq/opencode-autopilot/commit/bf36dc76841f55aeb4fe7f64de249c05d2376128))
* **04-04:** tool registrations for oc_state, oc_confidence, oc_phase, oc_plan ([4b062ac](https://github.com/kodrunhq/opencode-autopilot/commit/4b062ace33232eaed86557f15c806f8837f28860))
* **05-01:** agent catalog registry with 21 review agents ([801f0d7](https://github.com/kodrunhq/opencode-autopilot/commit/801f0d7b67ed2acac17bd73bc22088f5423d97c4))
* **05-01:** finding builder with deduplication and severity sorting ([2aae1a5](https://github.com/kodrunhq/opencode-autopilot/commit/2aae1a571d619a9c834d23c3c4c52bfd0e9ee509))
* **05-01:** review engine Zod schemas and types ([4fe49d5](https://github.com/kodrunhq/opencode-autopilot/commit/4fe49d5aed3815f9301805406e46c81141960c84))
* **05-01:** severity definitions with comparison and blocking check ([99e4aa0](https://github.com/kodrunhq/opencode-autopilot/commit/99e4aa085efb5db59c98babc3950e877941ba56f))
* **05-01:** stack gate filtering for technology-specific agents ([871875f](https://github.com/kodrunhq/opencode-autopilot/commit/871875f623a3c2fe9ba7224430aa7f4701d459b9))
* **05-01:** team selection logic combining catalog and stack gate ([b8a1043](https://github.com/kodrunhq/opencode-autopilot/commit/b8a1043cdbd080eb95e2cf183073c568ce5b6277))
* **05-02:** add 6 universal specialist review agent definitions ([ea22dbc](https://github.com/kodrunhq/opencode-autopilot/commit/ea22dbceb2f0372d4ea208ad96b078d23aa9ae30))
* **05-02:** add stage-3 agents, barrel export, and registry tests ([29d4703](https://github.com/kodrunhq/opencode-autopilot/commit/29d4703180ca2a655611160746112123218e0f82))
* **05-03:** add deterministic agent selection and cross-verification ([cdebf79](https://github.com/kodrunhq/opencode-autopilot/commit/cdebf79dba806f9cde2b70248a15fea1148fa455))
* **05-03:** add pipeline state machine and report builder ([16e7dee](https://github.com/kodrunhq/opencode-autopilot/commit/16e7dee478e18498bfa70b107be7e3f820ef2400))
* **05-04:** implement oc_review tool and register in plugin ([bb4f1bb](https://github.com/kodrunhq/opencode-autopilot/commit/bb4f1bba46db169176a082cbcecce7330ff400a0))
* **05-04:** implement review memory persistence and fix cycle ([7b25a89](https://github.com/kodrunhq/opencode-autopilot/commit/7b25a89952f1b6af46b24d42d51f5b130e31bdad))
* **06-01:** add 9 pipeline subagent configs and barrel export ([9af6e36](https://github.com/kodrunhq/opencode-autopilot/commit/9af6e36c1762a95486b43c62ac6134f8e1479539))
* **06-01:** add handler types, artifact module, and buildProgress schema ([5842a5e](https://github.com/kodrunhq/opencode-autopilot/commit/5842a5e5c81f1b7757b5288c83f41ab3912e90b5))
* **06-02:** add ARCHITECT handler with Arena multi-step logic ([c615a08](https://github.com/kodrunhq/opencode-autopilot/commit/c615a08a8b2ca203399f53065ddb5b3b8239817f))
* **06-02:** add RECON and CHALLENGE phase handlers with tests ([f9c1287](https://github.com/kodrunhq/opencode-autopilot/commit/f9c1287f4fbd35a6964d72755fc8d535db65b352))
* **06-03:** implement PLAN, SHIP, RETROSPECTIVE, EXPLORE handlers with tests ([4cd9d62](https://github.com/kodrunhq/opencode-autopilot/commit/4cd9d6239aff251b55c846297c58720eaec4cbe5))
* **06-04:** handler dispatch map and enhanced orchestrateCore ([f77a10c](https://github.com/kodrunhq/opencode-autopilot/commit/f77a10c675374181f5c79bdf66dec52d036e8bab))
* **06-04:** register pipeline agents in configHook ([c743d0a](https://github.com/kodrunhq/opencode-autopilot/commit/c743d0a61ee9d9faaa5e1bd7921a123cc7b7b07c))
* **07-01:** implement lesson memory module with schemas, types, and persistence ([b318a56](https://github.com/kodrunhq/opencode-autopilot/commit/b318a569a182e15fea95cdd4f1fb9d8d264e8187))
* **07-02:** enhanced retrospective handler with JSON parsing and lesson persistence ([3bf6f35](https://github.com/kodrunhq/opencode-autopilot/commit/3bf6f35396a48c541bd9afd0eeeb8fde6b07edf9))
* **07-02:** lesson injection into phase dispatch prompts ([ebfb4f4](https://github.com/kodrunhq/opencode-autopilot/commit/ebfb4f46639f0dd9037c0b3d7e6cf6e8fa2f3774))
* **07-03:** add failureContext schema and capture failure metadata in orchestrateCore ([bef5312](https://github.com/kodrunhq/opencode-autopilot/commit/bef5312909d7858a2c10fc2555b2c065ccd3adc2))
* **07-03:** create oc_forensics tool and register in plugin ([483f54d](https://github.com/kodrunhq/opencode-autopilot/commit/483f54ddce0189b01a11f1145fae5392a7de73ab))
* **08-01:** add coverage thresholds and tool registration smoke test ([fc53aee](https://github.com/kodrunhq/opencode-autopilot/commit/fc53aeeaddc2e470beb71dfa46b6026c1804c527))
* **08-02:** add GitHub Actions CI workflow ([9b2d909](https://github.com/kodrunhq/opencode-autopilot/commit/9b2d909199cbf9a96da924a96160ccce831c5bed))
* **09-01:** add fallback config schema and upgrade pluginConfigSchema to v3 ([4e039ef](https://github.com/kodrunhq/opencode-autopilot/commit/4e039ef6b5647460b3689198ab3c9448dfce7e22))
* **09-01:** add fallback types, error classifier, state machine, and message replay ([e8f9cd0](https://github.com/kodrunhq/opencode-autopilot/commit/e8f9cd0d9764f95699cfef38db2eda4980c7cf60))
* **09-02:** implement FallbackManager with concurrency guards and session lifecycle ([4413e99](https://github.com/kodrunhq/opencode-autopilot/commit/4413e99eb25d82ac207fa71771da5ce1ff10fac8))
* **09-02:** update barrel export and fix lint issues ([ddd0157](https://github.com/kodrunhq/opencode-autopilot/commit/ddd0157cf22f78167735b164a5d88a0c567a457c))
* **09-03:** add event, chat.message, and tool.execute.after handler factories ([d9c7c90](https://github.com/kodrunhq/opencode-autopilot/commit/d9c7c90ce79a38cba950a15894d26a2854f18cd9))
* **09-03:** wire fallback handlers into plugin entry and update barrel export ([8ace438](https://github.com/kodrunhq/opencode-autopilot/commit/8ace4380f2a382b71094b80e7640f9dfc6ad5f3d))
* **10-01:** rename orchestrator to autopilot, update modes and hidden flags ([bcc4866](https://github.com/kodrunhq/opencode-autopilot/commit/bcc486660a9bd185cf7b419bb9adeaf7b5ae7a2e))
* **10-01:** standardize severity levels to CRITICAL/HIGH/MEDIUM/LOW ([0f3530a](https://github.com/kodrunhq/opencode-autopilot/commit/0f3530a35321a9edac365ea6894f9780cebbff2b))
* **10-02:** rewrite all 10 pipeline agent prompts to 150+ word structured format ([881bbf4](https://github.com/kodrunhq/opencode-autopilot/commit/881bbf41b33703993389d575ce14e7d69217b1c7))
* **10-03:** implement skill injection module and enhance buildTaskPrompt ([51cdf0e](https://github.com/kodrunhq/opencode-autopilot/commit/51cdf0e437257b9b88761124894b59b090940e74))
* **10-03:** implement two-tier fallback chain resolution and config v3 fallback_models ([60646b2](https://github.com/kodrunhq/opencode-autopilot/commit/60646b2d91dfcdd0ce96f7dcaf4528acfd978cab))
* **10-04:** add 13 specialized review agents with stack-gated selection ([fefa8d8](https://github.com/kodrunhq/opencode-autopilot/commit/fefa8d878258733d2f9e94836fb83124937522bb))
* **10-04:** wire stack detection and all-agent selection into review pipeline ([9dc937b](https://github.com/kodrunhq/opencode-autopilot/commit/9dc937b21c3a76c144174f6148fb2e6749fca7cc))
* **12-02:** add oc_doctor diagnostic tool with health check module ([28a30a5](https://github.com/kodrunhq/opencode-autopilot/commit/28a30a5a81217cdab9c6e4dd9c5efe192ea0582f))
* **12-03:** implement oc_quick tool and /quick command ([db2fb13](https://github.com/kodrunhq/opencode-autopilot/commit/db2fb1349e8c6bc89a19664bc0ad23168598a1b5))
* **13-01:** add structured event logging with session logger ([1af3bd3](https://github.com/kodrunhq/opencode-autopilot/commit/1af3bd3a4e69a3a6f4b035339ae41a5db4e44e61))
* **13-01:** add time-based log retention with configurable pruning ([6f42279](https://github.com/kodrunhq/opencode-autopilot/commit/6f4227973b62103518c5b4d365cc9a8abf983a77))
* **13-02:** add event emitters, hook handlers, and event store ([d43a6b1](https://github.com/kodrunhq/opencode-autopilot/commit/d43a6b1e2f69cf9ec3a38fd74a64ae2056550fce))
* **13-02:** add token tracker and context monitor with TDD ([f8f5ee8](https://github.com/kodrunhq/opencode-autopilot/commit/f8f5ee8845c4a8dacdf81763d388029cb20dd754))
* **13-03:** add log writer and log reader for session persistence ([7415519](https://github.com/kodrunhq/opencode-autopilot/commit/741551970e235b6063e8337e52f766e2268457d2))
* **13-03:** add session summary generator and barrel export ([80a101d](https://github.com/kodrunhq/opencode-autopilot/commit/80a101debf7eef07ba3fe9866b28962320a0ce07))
* **13-04:** add oc_logs, oc_session_stats, oc_pipeline_report tools with TDD ([35c2b4d](https://github.com/kodrunhq/opencode-autopilot/commit/35c2b4d87b983d9658e84e356ed51d60fac9928a))
* **13-04:** wire observability into plugin entry with 4 new tools and hooks ([5ae995c](https://github.com/kodrunhq/opencode-autopilot/commit/5ae995cffe7d2c3713eb4726a88a74adbd57150a))
* **13-05:** add mock provider types and error generator ([6f6661a](https://github.com/kodrunhq/opencode-autopilot/commit/6f6661a6e24234aa58572c271653ca8ba0213fa4))
* **13-05:** add oc_mock_fallback tool for fallback chain testing ([7e94a09](https://github.com/kodrunhq/opencode-autopilot/commit/7e94a09b0c230a751100fb25534ac502262be4a3))
* **14-01:** create brainstorming skill with Socratic design refinement methodology ([ef35765](https://github.com/kodrunhq/opencode-autopilot/commit/ef35765172dc1886256a68b6c34369ab9fb28ef3))
* **14-01:** create TDD workflow and systematic debugging skills ([f5030ee](https://github.com/kodrunhq/opencode-autopilot/commit/f5030eeb0072eef1be6cbbedb87fcf2b49056a96))
* **14-02:** create plan-writing and plan-executing skills (SK-06, SK-07) ([4f8f962](https://github.com/kodrunhq/opencode-autopilot/commit/4f8f9625150ec7d7647ebf35cbedf53ee365fdad))
* **14-02:** create verification and git-worktrees skills (SK-04, SK-05) ([2b1dcf3](https://github.com/kodrunhq/opencode-autopilot/commit/2b1dcf38f6209cd4ef4ced830aee110cdaa17663))
* **14-03:** create code-review, strategic-compaction, and e2e-testing skills ([a7449f1](https://github.com/kodrunhq/opencode-autopilot/commit/a7449f1fe56c04038328c021d4143019aa56fd67))
* **14-03:** create thin wrapper commands for brainstorm, tdd, and write-plan ([9afc04f](https://github.com/kodrunhq/opencode-autopilot/commit/9afc04fdb4f76832f9f9445e361d6b7f5134d147))
* **14-04:** create Python and Rust language pattern skills ([fb52608](https://github.com/kodrunhq/opencode-autopilot/commit/fb526086962d3dcb17ede9b4b4201bb1c3eb06cf))
* **14-04:** create TypeScript/Bun and Go language pattern skills ([75e0168](https://github.com/kodrunhq/opencode-autopilot/commit/75e016856042e73801dab15c528b8029d8c2a05e))
* **14-05:** add asset linter, stocktake tool, and update-docs tool ([c82cfc9](https://github.com/kodrunhq/opencode-autopilot/commit/c82cfc97c2bfecf2544bc133f79643d016f2b6d7))
* **14-05:** update skill template with stacks/requires and register new tools ([f9052ab](https://github.com/kodrunhq/opencode-autopilot/commit/f9052abf0dbbe78a68281c34e31c952184a81bfc))
* **14-06:** add loadAdaptiveSkillContext to skill-injection.ts ([78544e8](https://github.com/kodrunhq/opencode-autopilot/commit/78544e81a37b50292ff88157f295969df8721700))
* **14-06:** create skill loader, dependency resolver, and adaptive injector ([432fc52](https://github.com/kodrunhq/opencode-autopilot/commit/432fc52eaf2624d413dfad688d0dbb8e2d97582c))
* **15-01:** add memory schemas, types, constants, and project-key module ([5f77e6a](https://github.com/kodrunhq/opencode-autopilot/commit/5f77e6a5a6819484a8d1c23065d2d44659e42976))
* **15-01:** add memory schemas, types, constants, and project-key module ([ab1150e](https://github.com/kodrunhq/opencode-autopilot/commit/ab1150ef0b53b48483ae156881ac8d2ee5e90281))
* **15-01:** add SQLite database singleton with FTS5 and repository CRUD ([bd588b8](https://github.com/kodrunhq/opencode-autopilot/commit/bd588b8623a21dfe89f9b1821d1894577be146f6))
* **15-01:** add SQLite database singleton with FTS5 and repository CRUD ([044c851](https://github.com/kodrunhq/opencode-autopilot/commit/044c8516aa72bd2dd5c4fd1f32beb803f5ffd02c))
* **15-02:** add 3-layer progressive disclosure retrieval with token budget ([07db844](https://github.com/kodrunhq/opencode-autopilot/commit/07db8440eb0a057740c9193fb64ff6e95d2d172c))
* **15-02:** add event capture handler and decay scoring ([79f39fb](https://github.com/kodrunhq/opencode-autopilot/commit/79f39fbe4e34bc7f4affde47dbe40b9878680db9))
* **15-03:** add memory injector and oc_memory_status tool ([e4ccd2a](https://github.com/kodrunhq/opencode-autopilot/commit/e4ccd2a82968c6213a64459ef840bb59e0db6543))
* **15-03:** config v5 with memory section and index.ts wiring ([1ce8bc9](https://github.com/kodrunhq/opencode-autopilot/commit/1ce8bc9d63982207414854f91fb0cb1fdcc9547e))
* **17-01:** add memory-based confidence tuning to arena depth ([7b358f0](https://github.com/kodrunhq/opencode-autopilot/commit/7b358f0a7fc9d562482ee9975346306ba093d54b))
* **17-01:** replace single-skill injection with adaptive skill context ([493a0b6](https://github.com/kodrunhq/opencode-autopilot/commit/493a0b655a8332b3d8d89a65a60b7f123636fa42))
* **18:** rename all command files to oc- prefix and delete oc-configure ([1ef8e3a](https://github.com/kodrunhq/opencode-autopilot/commit/1ef8e3afa795600d767506106d2cd0a4451ff87a))
* **18:** update DEPRECATED_ASSETS and clear FORCE_UPDATE_ASSETS ([5610815](https://github.com/kodrunhq/opencode-autopilot/commit/5610815806a3f664de796124420cf3a98225c9c0))
* **18:** update source code references to oc- prefixed command names ([9327bba](https://github.com/kodrunhq/opencode-autopilot/commit/9327bbae529744f95d8a4ba0180d00572194a892))
* **19-02:** extend stocktake with config-hook agent detection ([ff8798b](https://github.com/kodrunhq/opencode-autopilot/commit/ff8798b2cf110ee2d0b27b0478509540abaeaad2))
* **20-01:** create debugger, planner, and reviewer primary agents ([22214f3](https://github.com/kodrunhq/opencode-autopilot/commit/22214f3de39e23c9bcd1e2078873d07a8d4706fa))
* **20-02:** wire debugger, planner, reviewer into agents map ([1fbfc0d](https://github.com/kodrunhq/opencode-autopilot/commit/1fbfc0dccaa0883a2ece9a5f765e0480396436bd))
* **20:** add Debugger, Planner, and Reviewer primary agents ([a6737ba](https://github.com/kodrunhq/opencode-autopilot/commit/a6737ba565a80fdee2cb0cb68084e116b0089740))
* **21-01:** expand coding-standards with SOLID/architecture and create 3 new language skills ([93cfa44](https://github.com/kodrunhq/opencode-autopilot/commit/93cfa4475efe3015daabb5762790830ff23bdab3))
* **21-01:** wire Java and C# stack detection in adaptive-injector ([c0fc79a](https://github.com/kodrunhq/opencode-autopilot/commit/c0fc79a0c561fac2c81fa798ca259c5f29e3e0d7))
* **21-02:** create oc-review-agents command and four starter templates ([7894777](https://github.com/kodrunhq/opencode-autopilot/commit/7894777030fc302b78be2ebcede89fd031ef997b))
* **21-02:** wire templates directory into asset installer ([b335947](https://github.com/kodrunhq/opencode-autopilot/commit/b335947fa8927450c8d7b2299481969666ef7984))
* **21:** content expansion — OOP/SOLID, Java, C#, frontend-design skills, review command, templates ([ec01dda](https://github.com/kodrunhq/opencode-autopilot/commit/ec01dda10549d17bb45438be4907ecdc882d4b44))
* **22-01:** add config v6 schema with testMode and v5-to-v6 migration ([f86c4a3](https://github.com/kodrunhq/opencode-autopilot/commit/f86c4a38bd9d5cfa796253081e75bc50bca8bd7b))
* **22-01:** add MockInterceptor with deterministic sequence cycling ([7a9bf38](https://github.com/kodrunhq/opencode-autopilot/commit/7a9bf38ce7711461d6990e58a3be72232481ff3b))
* **22-02:** add $LANGUAGE variable to four command templates ([d53271d](https://github.com/kodrunhq/opencode-autopilot/commit/d53271d19d5f6a3352937fa6e05b43e506b3c426))
* **22-02:** implement language resolver utility with caching ([2ba3e11](https://github.com/kodrunhq/opencode-autopilot/commit/2ba3e1186f71689d0d892509e2df014703574f19))
* **22-03:** add skill, memory, and command health check functions ([3c944a8](https://github.com/kodrunhq/opencode-autopilot/commit/3c944a828cf32452911539f9b58e5ec14b49be5b))
* **22-03:** register 6 health checks in runner and update doctor tool ([1d132c9](https://github.com/kodrunhq/opencode-autopilot/commit/1d132c93aac07f7af1e6a6cf3aeff4152c3bb0b9))
* **22-04:** add anti-slop pattern definitions and detection logic ([6a0d9d3](https://github.com/kodrunhq/opencode-autopilot/commit/6a0d9d3cf5efcb1263966cd6b97017638165d9dd))
* **22-04:** register anti-slop hook in plugin entry ([82db082](https://github.com/kodrunhq/opencode-autopilot/commit/82db082547ddb32b0a4c1b8bc464b215b4ef8df8))
* **22:** production hardening — mock fallback, language commands, doctor, anti-slop ([0af4552](https://github.com/kodrunhq/opencode-autopilot/commit/0af455264c98e72ff4672d85406b09d265dc7f43))
* **24-01:** create coder agent with embedded TDD and coding-standards skills ([2c1a129](https://github.com/kodrunhq/opencode-autopilot/commit/2c1a129b205b657acbcb8f22056d5d47d654933f))
* **24-01:** route /oc-tdd command to coder agent ([38b751b](https://github.com/kodrunhq/opencode-autopilot/commit/38b751b2946c235a312e3e8c8b6706651cd8d0a2))
* **24-02:** implement oc_hashline_edit tool with FNV-1a hashing and CID alphabet ([b9e275e](https://github.com/kodrunhq/opencode-autopilot/commit/b9e275e3e94cbb093fa75e0a4d131f84e98bac59))
* **24-03:** add wave-assigner module with Kahn's algorithm ([5fd19b7](https://github.com/kodrunhq/opencode-autopilot/commit/5fd19b71e608bdc5f0ca46b96fb2ef14cac4a02f))
* **24-03:** extend taskSchema with depends_on and wire wave-assigner into build handler ([698d996](https://github.com/kodrunhq/opencode-autopilot/commit/698d9963ed10058b186b8dc4a6796c3aaa0d04a4))
* **24-04:** add hashline-edit guidance to all code-writing agent prompts ([4e3b0de](https://github.com/kodrunhq/opencode-autopilot/commit/4e3b0debafda6ea5f336cbaaec13f6dc972b72f0))
* **24-04:** suppress built-in Plan agent via config hook ([e18ff0d](https://github.com/kodrunhq/opencode-autopilot/commit/e18ff0d1f14a4a5571d467f8a822d0f4b7af0272))
* **24:** coder agent, hash-anchored edits, wave auto-assignment ([bf7bb07](https://github.com/kodrunhq/opencode-autopilot/commit/bf7bb0756b74761ee0542475e56bf584e7d7707a))
* **25-01:** add database-patterns and docker-deployment skills ([99794f4](https://github.com/kodrunhq/opencode-autopilot/commit/99794f4053c7fa766952fe19528b333a46401568))
* **25-01:** add security-patterns and api-design skills ([9a190bd](https://github.com/kodrunhq/opencode-autopilot/commit/9a190bd56d26b2f29c1925b61123ba8b9eef589b))
* **25-02:** create 4 subagent agents with embedded skills ([03b77ed](https://github.com/kodrunhq/opencode-autopilot/commit/03b77ed34dee07b25bf3def2b5c84d6a17e7376d))
* **25-02:** wire 4 agents into index.ts and create 2 commands ([de61d45](https://github.com/kodrunhq/opencode-autopilot/commit/de61d45df3ad0032cfba18051e0d4dc61001fc4b))
* **25:** content & agent expansion — 4 skills, 4 agents, 2 commands ([a2b2062](https://github.com/kodrunhq/opencode-autopilot/commit/a2b20627f02b2cb5e553bd0038ec05b9bccc3d77))
* add /oc-configure command asset ([7900253](https://github.com/kodrunhq/opencode-autopilot/commit/790025314db3938558d851b704e85d1236006c26))
* add adversarial diversity checker for model group assignments ([325ce94](https://github.com/kodrunhq/opencode-autopilot/commit/325ce94968729bf6c25838d13ea20b85f86c4cc9))
* add CLI installer and doctor commands ([faf2bc9](https://github.com/kodrunhq/opencode-autopilot/commit/faf2bc97640212438c144ddb8c054c2baf660316))
* add config schema v4 with groups/overrides and v3→v4 migration ([523393d](https://github.com/kodrunhq/opencode-autopilot/commit/523393d42377a871eb4cbbc20ac9bb5f78114b99))
* add declarative agent group registry with definitions and diversity rules ([8ceab8a](https://github.com/kodrunhq/opencode-autopilot/commit/8ceab8a39fc74e0fa0742e7061124fa63a36eccf))
* add interactive CLI configure wizard with searchable model selection ([4c822fb](https://github.com/kodrunhq/opencode-autopilot/commit/4c822fbe857d68fb6f52dc2742ab6092f33c62cc))
* add model resolver with override &gt; group &gt; null precedence ([7a874a5](https://github.com/kodrunhq/opencode-autopilot/commit/7a874a5587a3d7e3aafd0ba780025344bb5644c7))
* add oc_configure tool with start/assign/commit/doctor/reset subcommands ([4f35cad](https://github.com/kodrunhq/opencode-autopilot/commit/4f35cad7c56cbf3897ee4a5ca55e986c5dffdfe2))
* add registry type definitions for model groups ([4e5c931](https://github.com/kodrunhq/opencode-autopilot/commit/4e5c931ef73b637c0978da81398335e5d6672a08))
* agent visibility fixes — stocktake detects config-hook agents ([86153b6](https://github.com/kodrunhq/opencode-autopilot/commit/86153b68fa63723dc66f0ec01515cb4b9df1a139))
* configHook resolves models from group registry ([4fd315e](https://github.com/kodrunhq/opencode-autopilot/commit/4fd315e4ca79eb8061cb2acc0dcaa23c1c460588))
* installer, model groups & configuration UX ([13e1b5e](https://github.com/kodrunhq/opencode-autopilot/commit/13e1b5eca6f61fde54a51f69afe028d7d09b2249))
* model fallback integration (Phase 9) ([1543377](https://github.com/kodrunhq/opencode-autopilot/commit/15433773a56c37a0838a51167fd443dc1262fe6c))
* namespace cleanup — prefix all commands with oc- ([39e826d](https://github.com/kodrunhq/opencode-autopilot/commit/39e826d4102b0f832bbe24a928f406bc07841770))
* Phase 10 — UX polish, metaprompting, fallback resolution, smart review selection ([16092a3](https://github.com/kodrunhq/opencode-autopilot/commit/16092a352fa9054d592c4e1ac7c3d534e9d42eb4))
* Phase 14 — Skills & Commands (22 features) ([9e25581](https://github.com/kodrunhq/opencode-autopilot/commit/9e25581bec977ec8b30d32fbda0ce5537f3936f4))
* Phase 15 — smart memory system with SQLite, FTS5, and relevance-scored retrieval ([c8be170](https://github.com/kodrunhq/opencode-autopilot/commit/c8be17063c00edb6f87b6d3c2e627da68a0b5eae))
* Phase 17 — integration polish, adaptive skill routing, confidence tuning ([9feb7b8](https://github.com/kodrunhq/opencode-autopilot/commit/9feb7b8743d5fa7e504d8aaa587f744563be2139))
* Phase 4 — Foundation Infrastructure for Autonomous Orchestrator ([eccfd4c](https://github.com/kodrunhq/opencode-autopilot/commit/eccfd4cf757fc8e9c91bc6e839ecc4bdcbce5840))
* Phase 5 — Review Engine (multi-agent code review) ([9816ab9](https://github.com/kodrunhq/opencode-autopilot/commit/9816ab965b2a3c5d69993224a5489f09c546018b))
* Phase 6 — Orchestrator Pipeline (8-phase autonomous SDLC) ([34deef2](https://github.com/kodrunhq/opencode-autopilot/commit/34deef2ec657f5f7fd0d3f0b35bff7861572b3ec))
* Phase 7 — Learning & Resilience (institutional memory + forensics) ([25e7346](https://github.com/kodrunhq/opencode-autopilot/commit/25e7346e5a7ed696809c0448ee2134059599f5e2))
* Phase 8 — Testing & CI pipeline ([8d6d19a](https://github.com/kodrunhq/opencode-autopilot/commit/8d6d19a369be5c172a296d2d10c4fcf65675af4c))
* **v3.0:** Phase 12 — self-healing doctor, quick mode, Zen display fix ([d93121d](https://github.com/kodrunhq/opencode-autopilot/commit/d93121d84e37bb8d2d5c9db89bc3fbf804ab7b9f))
* **v3.0:** Phase 13 — session observability, token tracking, decision replay ([7ec841b](https://github.com/kodrunhq/opencode-autopilot/commit/7ec841b72c3fd8aa5a3dbc76ebc3a3be901bb733))
* wire oc_configure, remove placeholder, add first-load toast ([1931765](https://github.com/kodrunhq/opencode-autopilot/commit/19317651b13b479606e0d12b7f69b405a3d2ddcc))


### Bug Fixes

* **04-03:** lint and format cleanup for orchestrator modules ([e084723](https://github.com/kodrunhq/opencode-autopilot/commit/e08472390b20cd511360ad0734045b8b6c7f3482))
* **04:** address review findings (patch allowlist, DRY paths, immutability, schema bounds, atomic config) ([d0da334](https://github.com/kodrunhq/opencode-autopilot/commit/d0da334ba04cbdcc0712a91bd7d731cb72f35687))
* **05:** address Copilot PR review comments ([4f72417](https://github.com/kodrunhq/opencode-autopilot/commit/4f72417a341796e578789036a1ed14964e95557e))
* **05:** address review findings (schema alignment, pipeline wiring, dead code, security hardening) ([aa94771](https://github.com/kodrunhq/opencode-autopilot/commit/aa94771ca6369cef29ed1427d625f2f8b8be0740))
* **05:** address second round Copilot PR review comments ([4d7df97](https://github.com/kodrunhq/opencode-autopilot/commit/4d7df97f28d161c4accce494ce1740148bc8237f))
* **06:** address PR review — dispatch_multi tracking, resume safety, stale comment ([dbd9470](https://github.com/kodrunhq/opencode-autopilot/commit/dbd9470ffe859532cda3e72a29126749700687ce))
* **06:** address review findings (critical parse, type safety, prompt sanitization, least privilege) ([49d2f2a](https://github.com/kodrunhq/opencode-autopilot/commit/49d2f2a196ad055c2a8cddb8b2bb7f6eb9b9531c))
* **07:** ACE review fixes (phase guard, type safety, prompt clarity, test coverage, error detail) ([f816dc8](https://github.com/kodrunhq/opencode-autopilot/commit/f816dc86fed1a7457dbc59349284af8499452df5))
* **07:** address PR review — forensics error handling, lesson recovery, roadmap sync ([0c60f42](https://github.com/kodrunhq/opencode-autopilot/commit/0c60f42a69aa04c2e6ada440a6b325bd987dd8f3))
* **07:** address PR review round 2 — path scrubbing, I/O dedup, freeze consistency ([37b876e](https://github.com/kodrunhq/opencode-autopilot/commit/37b876e9eadda1fd8bb9c5a26c1e0424943e25d1))
* **07:** address review findings (prune overflow, sourcePhase enum, sanitization, error paths) ([7761274](https://github.com/kodrunhq/opencode-autopilot/commit/77612748cb8291a79185b38e1d41c7232f5cb9d8))
* **08-01:** resolve all TypeScript type errors across codebase ([78c2076](https://github.com/kodrunhq/opencode-autopilot/commit/78c2076ab2126dfe1d509273a424ba6fe356f0e0))
* **08:** address PR review — prompt type, coverage threshold, doc alignment ([7e02371](https://github.com/kodrunhq/opencode-autopilot/commit/7e023714c9282e468e343a3caed5be7f7a5d1a76))
* **08:** address review round 2 — bail syntax, coverage keys, state counters ([5d9ac57](https://github.com/kodrunhq/opencode-autopilot/commit/5d9ac5741d0a66bb2dec7fa815f7778c9ef50661))
* **08:** address review squad findings — CI hardening, test quality, doc consistency ([0855f02](https://github.com/kodrunhq/opencode-autopilot/commit/0855f02c80edd47f631cda650832e19e0b9880e1))
* **08:** remove coverage thresholds — Bun enforces per-file, not aggregate ([b5ec4d3](https://github.com/kodrunhq/opencode-autopilot/commit/b5ec4d367d4a3573aadc1c9bc3ffc39082a4e92e))
* **09:** add missing 09-02 dependency to Plan 03, move to wave 3 ([7547e97](https://github.com/kodrunhq/opencode-autopilot/commit/7547e97c8114a3ffdb610d1d2f01e24af04f0b66))
* **09:** address PR review — parentID null guard, TTFT enabled gate, test accuracy ([46542fb](https://github.com/kodrunhq/opencode-autopilot/commit/46542fb4d61e495b8b735fb1c01d6fbc4a8bcc80))
* **09:** address review round 1 — security, concurrency, correctness, test coverage ([161e9ff](https://github.com/kodrunhq/opencode-autopilot/commit/161e9ff07a4019b58c62bac91b06f884aa9cb676))
* **09:** move markAwaitingResult inside dispatch block, format tests ([cd058cd](https://github.com/kodrunhq/opencode-autopilot/commit/cd058cda8bebc9d6ab7efea874605d15ba202dd9))
* **10-02:** fix base agent prompt issues (paths, constraints, skill references) ([173bdf8](https://github.com/kodrunhq/opencode-autopilot/commit/173bdf82774e9e9da7f0dc2a68a19c82694a038d))
* **10:** address PR review — cwd for git, --root for diff-tree, derive stage3 names, fix roadmap status ([d17a126](https://github.com/kodrunhq/opencode-autopilot/commit/d17a126231d67c0bd9002fe2580f0ee95dae0838))
* **10:** address review round 1 — agentName forwarding, string filtering, prompt identity, stack detection, branch scope ([e53893f](https://github.com/kodrunhq/opencode-autopilot/commit/e53893f2e6747670431fbb7a31c5a0fa1b8fc442))
* **10:** update remaining test severity values from WARNING/NITPICK to HIGH/LOW ([153c08e](https://github.com/kodrunhq/opencode-autopilot/commit/153c08e3c3c86023570520eea8ef32ecec51c2de))
* **12-01:** use model id field for provider-prefixed model discovery ([06d3f32](https://github.com/kodrunhq/opencode-autopilot/commit/06d3f32179d20df92fdded65c6502a89c1065256))
* **18:** address PR review comments and CI failure ([49cc26b](https://github.com/kodrunhq/opencode-autopilot/commit/49cc26b00e26cf3e5e48de9a0ab0090596d14a0b))
* **18:** resolve stale command references and add deprecation test ([4ee636e](https://github.com/kodrunhq/opencode-autopilot/commit/4ee636e9092bf593801d4d06d05c8a4cd11a6484))
* **19:** correct agent modes and export agents map ([501e0e3](https://github.com/kodrunhq/opencode-autopilot/commit/501e0e3a2a6cc0617c95f5f104f2ee8bed4069e3))
* **19:** resolve CI type errors and PR review comments ([6cf99b7](https://github.com/kodrunhq/opencode-autopilot/commit/6cf99b7a5cd54a3c06e5220b08b52bf9745cc9a2))
* **19:** resolve review findings — stale tests, lint, narrow ConfigHookAgent type ([a4e2e27](https://github.com/kodrunhq/opencode-autopilot/commit/a4e2e27e3b0d9609daac88b566def2c85663822a))
* **20:** address review findings — add agent tests, fix stale descriptions ([fa66c0e](https://github.com/kodrunhq/opencode-autopilot/commit/fa66c0e722a641942b3f574335c78f8f21f473ca))
* **20:** resolve CI type errors and PR review comments ([b64a699](https://github.com/kodrunhq/opencode-autopilot/commit/b64a69969ed4987d890c23933692e8fc6fefa287))
* **21:** resolve PR comments and ace review findings ([39acc13](https://github.com/kodrunhq/opencode-autopilot/commit/39acc13954ca04570022cf502f6d040a7a50c322))
* **21:** resolve review findings — stack-gate extensions, rename GLOB→EXT, add tests ([777c6f2](https://github.com/kodrunhq/opencode-autopilot/commit/777c6f2fdff1f6cc1d141ab8e740fa2ccfe3acb9))
* **22:** replace as any with as unknown as Config in doctor test ([cf20427](https://github.com/kodrunhq/opencode-autopilot/commit/cf20427dac86a1fd899d825e6a0c992fbbc4c6d1))
* **22:** replace dead $LANGUAGE variable with inline detection in commands ([cac5675](https://github.com/kodrunhq/opencode-autopilot/commit/cac567538add97c04e53c80ee05f0a2f34a8c67c))
* **22:** resolve CI lint errors and ace review findings ([aa10876](https://github.com/kodrunhq/opencode-autopilot/commit/aa108769dab8597d3c34d5be3d45cf4b683d0d29))
* **22:** resolve CI type errors — downgrade lint rules, fix non-null assertions, fix import ordering ([7c20adc](https://github.com/kodrunhq/opencode-autopilot/commit/7c20adcca911beb2de20d8becbf241c541b4a72d))
* **22:** resolve CI type errors — version 5→6 in configure, typed mock params, remove unused ts-expect-error ([87d2dd9](https://github.com/kodrunhq/opencode-autopilot/commit/87d2dd968f7b6950fe248a46bedd6c25ae838c61))
* **22:** resolve review findings — anti-slop reads file content, MockInterceptor guards, memory check pass on fresh install ([ae5f530](https://github.com/kodrunhq/opencode-autopilot/commit/ae5f530817371a0f28e7105cd0abce06e094d4ac))
* **22:** update tests for config v6 migration and format fixes ([40a0c6e](https://github.com/kodrunhq/opencode-autopilot/commit/40a0c6e74cc59c642d9b9a3b054b567345181c47))
* **23:** add agent routing to commands — planner for write-plan, documenter for update-docs, autopilot for quick ([249ca82](https://github.com/kodrunhq/opencode-autopilot/commit/249ca8204e1bd76ccb7e8765cc57742a9e9cbafc))
* **23:** add missing stacks/requires fields to coding-standards skill frontmatter ([b0348cd](https://github.com/kodrunhq/opencode-autopilot/commit/b0348cddf2da3c39556507da2bec2e9ee2f9a47d))
* **23:** QA findings — command agent routing, coding-standards frontmatter, Phase 24 roadmap ([81e44b0](https://github.com/kodrunhq/opencode-autopilot/commit/81e44b09fbcd032df04c9706f4928c30df7ee4ab))
* **23:** resolve PR comments — doctor check count 6→7, fix PostToolUse naming, add maintenance note, update STATE/ROADMAP ([8872ff0](https://github.com/kodrunhq/opencode-autopilot/commit/8872ff09bf4bae32d0b475346e1f8e97d98d7c01))
* **23:** route commands to correct agents, add Phase 24 to roadmap ([51b28a3](https://github.com/kodrunhq/opencode-autopilot/commit/51b28a3835c6d2c82636c73d3d73602de75421f9))
* **24-04:** update tests for hashline-edit guidance and Plan suppression ([b09393a](https://github.com/kodrunhq/opencode-autopilot/commit/b09393a74760a5bc7e7d16cbb972c4efcd8ae441))
* **24:** resolve PR review and ace findings ([b4e35e4](https://github.com/kodrunhq/opencode-autopilot/commit/b4e35e4b684f1967ccfd88983e085939f4811a57))
* **24:** resolve review findings — path safety, error handling, edge cases ([1564a10](https://github.com/kodrunhq/opencode-autopilot/commit/1564a10d8b66758691ba4ddb7fcede3f5fdb9074))
* **24:** update test assertions for new coder agent and hashline-edit tool ([d83ac8f](https://github.com/kodrunhq/opencode-autopilot/commit/d83ac8f4a19ecf2bb5ae11ed98887396cccab59c))
* **25:** add subagent tests and fix embedded credential example ([638e4a6](https://github.com/kodrunhq/opencode-autopilot/commit/638e4a6992c62bbcb2ad52e62f2f686774aeb4ab))
* **25:** resolve CI lint errors and PR review comments ([3edbd0c](https://github.com/kodrunhq/opencode-autopilot/commit/3edbd0cc5a6868d866390b122472995318b913a6))
* **25:** resolve review findings — permissions, content quality, duplicates ([5ddad24](https://github.com/kodrunhq/opencode-autopilot/commit/5ddad2410479f0ca951c87aad94ce8035a28ed80))
* add missing oc_quick import and registration after merge ([12eb0b9](https://github.com/kodrunhq/opencode-autopilot/commit/12eb0b9de7c3c2b5a0fa82d0f7e05244b0effc62))
* address ACE review — logic bug, error handling, type safety, test assertions ([055a83e](https://github.com/kodrunhq/opencode-autopilot/commit/055a83ed248f167f7c1f58a9815e0f78500925b9))
* address ace review + Copilot findings — type alignment, path validation, error handling, session lifecycle ([4a0c94b](https://github.com/kodrunhq/opencode-autopilot/commit/4a0c94b2a95e844f51acf1b70e44c97a082d10d6))
* address ace review findings — halfLifeDays forwarding, FTS5 sanitization, type safety, error logging, budget accounting, schema constraints ([758a4dd](https://github.com/kodrunhq/opencode-autopilot/commit/758a4dd1ad6ddea882cd08f3c2cf12f405fe6e52))
* address code quality and security review findings ([1853b1b](https://github.com/kodrunhq/opencode-autopilot/commit/1853b1bdfa10202e211da0052f408e60bb0db037))
* address Copilot PR comments + ace findings — projectRoot param, error logging, boundary test, length assertion, singleton isolation ([0b1111b](https://github.com/kodrunhq/opencode-autopilot/commit/0b1111b4cb42d6609b03fa08a2c271fe9937d4ee))
* address Copilot PR comments + ace review findings — cycle detection, CRLF, yaml guards, error handling, sanitizer, token budget ([d09c145](https://github.com/kodrunhq/opencode-autopilot/commit/d09c145c88fd1542df7c7cdafd9fd3f103604e34))
* address Copilot PR comments + remaining ace findings — unused import, timeline date tracking, DB leak, storage path, empty catches ([f909da3](https://github.com/kodrunhq/opencode-autopilot/commit/f909da3028f2df2d46b9012017ceb82dfb75dbba))
* address Copilot PR review comments ([cb5dff2](https://github.com/kodrunhq/opencode-autopilot/commit/cb5dff2d2b9d420d13db27b164b15d341dd5cfec))
* address PR [#25](https://github.com/kodrunhq/opencode-autopilot/issues/25) review comments ([3c5d186](https://github.com/kodrunhq/opencode-autopilot/commit/3c5d1868f9b1b6ecd19a5ce7c7ca8569942797c3))
* address PR [#27](https://github.com/kodrunhq/opencode-autopilot/issues/27) review comments ([572cd42](https://github.com/kodrunhq/opencode-autopilot/commit/572cd422eaf6976915c7f6ac35ee3e900a01c789))
* address PR [#29](https://github.com/kodrunhq/opencode-autopilot/issues/29) round 2 — session.error extraction, Zod sanitized write, timestamp guard, table escaping, lint ([dff5965](https://github.com/kodrunhq/opencode-autopilot/commit/dff59658ac810432299f94a0190786ebac1bab8f))
* address PR review — dirname for ensureDir, access-before-copy, keep currentAssignment key ([84b82c1](https://github.com/kodrunhq/opencode-autopilot/commit/84b82c1186a887616879f1614e42f5abb34a80e2))
* address PR review — diversity rule logic, group key validation, unused imports, CI exit code ([4283af7](https://github.com/kodrunhq/opencode-autopilot/commit/4283af75de8162b1dd3a6db6a6d58cbf228b08f6))
* address PR review — reset clears providers, rename variable, surface cleanup errors, test isolation ([3e0572c](https://github.com/kodrunhq/opencode-autopilot/commit/3e0572cc6bdc6e4a3bbf66a6c64248f75a05cd62))
* address review findings — Promise.allSettled, error discrimination, registry-derived agents, stub artifacts ([db93c4b](https://github.com/kodrunhq/opencode-autopilot/commit/db93c4b39d4bf925ff3c1002e1a5d5e7bb2bf1bf))
* address review round 1 — agent count, anti-patterns, immutability, test assertions, lint failure test ([89e0f6e](https://github.com/kodrunhq/opencode-autopilot/commit/89e0f6eaeb02301c3e7668e21ee81b1e09e2de16))
* address review round 2 — update-docs project root, remove duplicate anti-pattern section ([99d6e03](https://github.com/kodrunhq/opencode-autopilot/commit/99d6e03d85486ab703eb4cda06c3d51f0e5456e1))
* apply lint fixes to new memory test files ([e636d8e](https://github.com/kodrunhq/opencode-autopilot/commit/e636d8e266a3ef19180d5ac64aef2e1c5590ab7d))
* **ci:** add NPM_TOKEN for publish authentication (provenance handles signing separately) ([eea2ddb](https://github.com/kodrunhq/opencode-autopilot/commit/eea2ddb018684bd1116f465a396c2f310ae6853b))
* **ci:** remove npm cache — project uses bun.lock, not package-lock.json ([830e912](https://github.com/kodrunhq/opencode-autopilot/commit/830e912022b55f684ac44393d8f19df4fad00edd))
* **ci:** remove npm self-upgrade step — Node 22 npm already supports OIDC ([63e8972](https://github.com/kodrunhq/opencode-autopilot/commit/63e89724ccd3bd38eb6e8f70c9a716e5ef88f5fd))
* **ci:** reorder steps — Node + npm upgrade before Bun, remove NODE_AUTH_TOKEN (use OIDC) ([322941e](https://github.com/kodrunhq/opencode-autopilot/commit/322941e6ea69d1e4974bdeb6acaf1cac5eba49f9))
* **ci:** update action SHAs to match kodrunhq/claudefy ([21c0505](https://github.com/kodrunhq/opencode-autopilot/commit/21c0505b9d77138d2baf580f98b99b6d12a4a88f))
* **ci:** use npx npm@latest for publish instead of self-upgrading npm ([121930a](https://github.com/kodrunhq/opencode-autopilot/commit/121930a44be88908c8017f3e6eddfe25645b9fd8))
* compact tool output to prevent OpenCode truncation ([6bd0901](https://github.com/kodrunhq/opencode-autopilot/commit/6bd090113695b53007ef29221fc9e1fd1dbe93cf))
* compact tool output to prevent truncation, force-update command files ([6552b28](https://github.com/kodrunhq/opencode-autopilot/commit/6552b282bdd6338d8a42869b95223961fead7a32))
* deep freeze registry data, derive ALL_GROUP_IDS, replace unsafe casts, freeze assignments ([4be6cfe](https://github.com/kodrunhq/opencode-autopilot/commit/4be6cfec2d9605aa94046c0f05c0af8961b666ef))
* format and lint fixes for integration tests ([8d5fd3e](https://github.com/kodrunhq/opencode-autopilot/commit/8d5fd3ef2983319bc6525b5d757ee6defa6ddf3b))
* format dependency-resolver.ts and config.json for CI lint ([48ebc15](https://github.com/kodrunhq/opencode-autopilot/commit/48ebc15fae74fe4cc06825f0c148515433e6d371))
* guard against sync failures and race condition in provider discovery ([d07d192](https://github.com/kodrunhq/opencode-autopilot/commit/d07d1923075aae98a545fbf0772ca101ca707a17))
* installer UX bugs — model discovery, deprecated assets, command agent, guide flow ([eb24628](https://github.com/kodrunhq/opencode-autopilot/commit/eb24628b6052c9347cfa5b71633a5ece4a74fac4))
* make provider discovery non-blocking to prevent plugin init hang ([2b374ec](https://github.com/kodrunhq/opencode-autopilot/commit/2b374ecb7fc2ab46b9c345b140aa32e5dc7af2ba))
* model discovery via provider API, deprecated asset cleanup, command agent field ([e5d2598](https://github.com/kodrunhq/opencode-autopilot/commit/e5d25989a3b91ae0af661d0ca5851aec04d46b8b))
* non-blocking provider discovery to prevent startup hang ([b76238a](https://github.com/kodrunhq/opencode-autopilot/commit/b76238ab924f6165ee44e894b799eeb82e1e7997))
* pre-format model list in tool response to prevent LLM summarization ([b0f12e7](https://github.com/kodrunhq/opencode-autopilot/commit/b0f12e74cd87b3ffd58503cecc7e3a9036e5ccf7))
* re-throw SyntaxError in loadAdaptiveSkillContext, document observation scan cap ([f94e228](https://github.com/kodrunhq/opencode-autopilot/commit/f94e22814f738a835558cdca88f1d6bae546d3d1))
* reconcile sessionLogSchema after Wave 2 parallel merge ([2c1d914](https://github.com/kodrunhq/opencode-autopilot/commit/2c1d91444032b25bb0e56e4334539bc95267de06))
* resolve lint errors — no-assign-in-expression, config.json formatting ([b872d70](https://github.com/kodrunhq/opencode-autopilot/commit/b872d70fb182d6813ec1cfd54bc2c456de7c4c3a))
* resolve type errors from config v5 migration and SDK Model type ([8e4df4d](https://github.com/kodrunhq/opencode-autopilot/commit/8e4df4dad732b8b96f732b010912df425528d4e2))
* resolve TypeScript errors and CI failures ([2e71af1](https://github.com/kodrunhq/opencode-autopilot/commit/2e71af190df40bf0d2309a9879484ddec65bbf3e))
* return pre-formatted model list from oc_configure start ([42d82fd](https://github.com/kodrunhq/opencode-autopilot/commit/42d82fdad6854b5c2e041d7192d0f37a17dc6123))
* rewrite oc-configure instructions to show all models and collect fallbacks ([8988b60](https://github.com/kodrunhq/opencode-autopilot/commit/8988b60f86adb5ab23327655c79582a49c110ad6))
* show all models and collect fallbacks in oc-configure ([4934a05](https://github.com/kodrunhq/opencode-autopilot/commit/4934a05f9d80546e1c9fc22e720746696fcce175))
* use real provider IDs in examples, remove ambiguous reference option ([fe66f12](https://github.com/kodrunhq/opencode-autopilot/commit/fe66f1204f0556081b3c3b89d3ed9248a51d6db4))

## [1.13.0](https://github.com/kodrunhq/opencode-autopilot/compare/opencode-autopilot-v1.12.2...opencode-autopilot-v1.13.0) (2026-04-04)


### Features

* **25-01:** add database-patterns and docker-deployment skills ([99794f4](https://github.com/kodrunhq/opencode-autopilot/commit/99794f4053c7fa766952fe19528b333a46401568))
* **25-01:** add security-patterns and api-design skills ([9a190bd](https://github.com/kodrunhq/opencode-autopilot/commit/9a190bd56d26b2f29c1925b61123ba8b9eef589b))
* **25-02:** create 4 subagent agents with embedded skills ([03b77ed](https://github.com/kodrunhq/opencode-autopilot/commit/03b77ed34dee07b25bf3def2b5c84d6a17e7376d))
* **25-02:** wire 4 agents into index.ts and create 2 commands ([de61d45](https://github.com/kodrunhq/opencode-autopilot/commit/de61d45df3ad0032cfba18051e0d4dc61001fc4b))
* **25:** content & agent expansion — 4 skills, 4 agents, 2 commands ([a2b2062](https://github.com/kodrunhq/opencode-autopilot/commit/a2b20627f02b2cb5e553bd0038ec05b9bccc3d77))


### Bug Fixes

* **25:** add subagent tests and fix embedded credential example ([638e4a6](https://github.com/kodrunhq/opencode-autopilot/commit/638e4a6992c62bbcb2ad52e62f2f686774aeb4ab))
* **25:** resolve CI lint errors and PR review comments ([3edbd0c](https://github.com/kodrunhq/opencode-autopilot/commit/3edbd0cc5a6868d866390b122472995318b913a6))
* **25:** resolve review findings — permissions, content quality, duplicates ([5ddad24](https://github.com/kodrunhq/opencode-autopilot/commit/5ddad2410479f0ca951c87aad94ce8035a28ed80))

## [1.12.2](https://github.com/kodrunhq/opencode-autopilot/compare/opencode-autopilot-v1.12.1...opencode-autopilot-v1.12.2) (2026-04-03)


### Bug Fixes

* **23:** add agent routing to commands — planner for write-plan, documenter for update-docs, autopilot for quick ([249ca82](https://github.com/kodrunhq/opencode-autopilot/commit/249ca8204e1bd76ccb7e8765cc57742a9e9cbafc))
* **23:** add missing stacks/requires fields to coding-standards skill frontmatter ([b0348cd](https://github.com/kodrunhq/opencode-autopilot/commit/b0348cddf2da3c39556507da2bec2e9ee2f9a47d))
* **23:** QA findings — command agent routing, coding-standards frontmatter, Phase 24 roadmap ([81e44b0](https://github.com/kodrunhq/opencode-autopilot/commit/81e44b09fbcd032df04c9706f4928c30df7ee4ab))
* **23:** route commands to correct agents, add Phase 24 to roadmap ([51b28a3](https://github.com/kodrunhq/opencode-autopilot/commit/51b28a3835c6d2c82636c73d3d73602de75421f9))

## [1.12.1](https://github.com/kodrunhq/opencode-autopilot/compare/opencode-autopilot-v1.12.0...opencode-autopilot-v1.12.1) (2026-04-03)


### Bug Fixes

* **23:** resolve PR comments — doctor check count 6→7, fix PostToolUse naming, add maintenance note, update STATE/ROADMAP ([8872ff0](https://github.com/kodrunhq/opencode-autopilot/commit/8872ff09bf4bae32d0b475346e1f8e97d98d7c01))

## [1.12.0](https://github.com/kodrunhq/opencode-autopilot/compare/opencode-autopilot-v1.11.0...opencode-autopilot-v1.12.0) (2026-04-03)


### Features

* **22-01:** add config v6 schema with testMode and v5-to-v6 migration ([f86c4a3](https://github.com/kodrunhq/opencode-autopilot/commit/f86c4a38bd9d5cfa796253081e75bc50bca8bd7b))
* **22-01:** add MockInterceptor with deterministic sequence cycling ([7a9bf38](https://github.com/kodrunhq/opencode-autopilot/commit/7a9bf38ce7711461d6990e58a3be72232481ff3b))
* **22-02:** add $LANGUAGE variable to four command templates ([d53271d](https://github.com/kodrunhq/opencode-autopilot/commit/d53271d19d5f6a3352937fa6e05b43e506b3c426))
* **22-02:** implement language resolver utility with caching ([2ba3e11](https://github.com/kodrunhq/opencode-autopilot/commit/2ba3e1186f71689d0d892509e2df014703574f19))
* **22-03:** add skill, memory, and command health check functions ([3c944a8](https://github.com/kodrunhq/opencode-autopilot/commit/3c944a828cf32452911539f9b58e5ec14b49be5b))
* **22-03:** register 6 health checks in runner and update doctor tool ([1d132c9](https://github.com/kodrunhq/opencode-autopilot/commit/1d132c93aac07f7af1e6a6cf3aeff4152c3bb0b9))
* **22-04:** add anti-slop pattern definitions and detection logic ([6a0d9d3](https://github.com/kodrunhq/opencode-autopilot/commit/6a0d9d3cf5efcb1263966cd6b97017638165d9dd))
* **22-04:** register anti-slop hook in plugin entry ([82db082](https://github.com/kodrunhq/opencode-autopilot/commit/82db082547ddb32b0a4c1b8bc464b215b4ef8df8))
* **22:** production hardening — mock fallback, language commands, doctor, anti-slop ([0af4552](https://github.com/kodrunhq/opencode-autopilot/commit/0af455264c98e72ff4672d85406b09d265dc7f43))


### Bug Fixes

* **22:** replace as any with as unknown as Config in doctor test ([cf20427](https://github.com/kodrunhq/opencode-autopilot/commit/cf20427dac86a1fd899d825e6a0c992fbbc4c6d1))
* **22:** replace dead $LANGUAGE variable with inline detection in commands ([cac5675](https://github.com/kodrunhq/opencode-autopilot/commit/cac567538add97c04e53c80ee05f0a2f34a8c67c))
* **22:** resolve CI lint errors and ace review findings ([aa10876](https://github.com/kodrunhq/opencode-autopilot/commit/aa108769dab8597d3c34d5be3d45cf4b683d0d29))
* **22:** resolve CI type errors — downgrade lint rules, fix non-null assertions, fix import ordering ([7c20adc](https://github.com/kodrunhq/opencode-autopilot/commit/7c20adcca911beb2de20d8becbf241c541b4a72d))
* **22:** resolve CI type errors — version 5→6 in configure, typed mock params, remove unused ts-expect-error ([87d2dd9](https://github.com/kodrunhq/opencode-autopilot/commit/87d2dd968f7b6950fe248a46bedd6c25ae838c61))
* **22:** resolve review findings — anti-slop reads file content, MockInterceptor guards, memory check pass on fresh install ([ae5f530](https://github.com/kodrunhq/opencode-autopilot/commit/ae5f530817371a0f28e7105cd0abce06e094d4ac))
* **22:** update tests for config v6 migration and format fixes ([40a0c6e](https://github.com/kodrunhq/opencode-autopilot/commit/40a0c6e74cc59c642d9b9a3b054b567345181c47))

## [1.11.0](https://github.com/kodrunhq/opencode-autopilot/compare/opencode-autopilot-v1.10.0...opencode-autopilot-v1.11.0) (2026-04-03)


### Features

* **20-01:** create debugger, planner, and reviewer primary agents ([22214f3](https://github.com/kodrunhq/opencode-autopilot/commit/22214f3de39e23c9bcd1e2078873d07a8d4706fa))
* **20-02:** wire debugger, planner, reviewer into agents map ([1fbfc0d](https://github.com/kodrunhq/opencode-autopilot/commit/1fbfc0dccaa0883a2ece9a5f765e0480396436bd))
* **20:** add Debugger, Planner, and Reviewer primary agents ([a6737ba](https://github.com/kodrunhq/opencode-autopilot/commit/a6737ba565a80fdee2cb0cb68084e116b0089740))


### Bug Fixes

* **20:** address review findings — add agent tests, fix stale descriptions ([fa66c0e](https://github.com/kodrunhq/opencode-autopilot/commit/fa66c0e722a641942b3f574335c78f8f21f473ca))
* **20:** resolve CI type errors and PR review comments ([b64a699](https://github.com/kodrunhq/opencode-autopilot/commit/b64a69969ed4987d890c23933692e8fc6fefa287))

## [1.10.0](https://github.com/kodrunhq/opencode-autopilot/compare/opencode-autopilot-v1.9.0...opencode-autopilot-v1.10.0) (2026-04-03)


### Features

* **19-02:** extend stocktake with config-hook agent detection ([ff8798b](https://github.com/kodrunhq/opencode-autopilot/commit/ff8798b2cf110ee2d0b27b0478509540abaeaad2))
* agent visibility fixes — stocktake detects config-hook agents ([86153b6](https://github.com/kodrunhq/opencode-autopilot/commit/86153b68fa63723dc66f0ec01515cb4b9df1a139))


### Bug Fixes

* **19:** correct agent modes and export agents map ([501e0e3](https://github.com/kodrunhq/opencode-autopilot/commit/501e0e3a2a6cc0617c95f5f104f2ee8bed4069e3))
* **19:** resolve CI type errors and PR review comments ([6cf99b7](https://github.com/kodrunhq/opencode-autopilot/commit/6cf99b7a5cd54a3c06e5220b08b52bf9745cc9a2))
* **19:** resolve review findings — stale tests, lint, narrow ConfigHookAgent type ([a4e2e27](https://github.com/kodrunhq/opencode-autopilot/commit/a4e2e27e3b0d9609daac88b566def2c85663822a))

## [1.9.0](https://github.com/kodrunhq/opencode-autopilot/compare/opencode-autopilot-v1.8.0...opencode-autopilot-v1.9.0) (2026-04-03)


### Features

* **01-01:** add placeholder tool and plugin entry point with tests ([5016149](https://github.com/kodrunhq/opencode-autopilot/commit/50161492178eb71b62c4cf9c95d7bb516a997838))
* **01-01:** scaffold npm package with utility modules and tests ([5390a93](https://github.com/kodrunhq/opencode-autopilot/commit/5390a9385462997a55660f7e18f95b176ec32cf7))
* **01-02:** add config module and asset installer with tests ([11bacb6](https://github.com/kodrunhq/opencode-autopilot/commit/11bacb6e6d3470f3c506d53a90ee0780e24836a3))
* **01-02:** wire installer into plugin entry, add bundled assets ([dfd2323](https://github.com/kodrunhq/opencode-autopilot/commit/dfd23234f81eacd6d14c3f91b58e4aeb4749a7ba))
* **02-01:** add name validators and yaml dependency ([295850c](https://github.com/kodrunhq/opencode-autopilot/commit/295850c3af8c3fc019609984703b7816b21e7d09))
* **02-01:** add template generation for agents, skills, and commands ([34d9ea7](https://github.com/kodrunhq/opencode-autopilot/commit/34d9ea79b0cf8cd4c3ff864251fca9137468e0d3))
* **02-02:** implement creation tools for agents, skills, and commands ([a5e5e30](https://github.com/kodrunhq/opencode-autopilot/commit/a5e5e30ca0c573e71dbbf870af10f1b2305719d8))
* **02-02:** register creation tools and add slash command files ([1700977](https://github.com/kodrunhq/opencode-autopilot/commit/1700977b8988db748c3412931bf3b817214515d2))
* **03-01:** implement 4 agent config modules and config hook barrel ([8d6aa0e](https://github.com/kodrunhq/opencode-autopilot/commit/8d6aa0e7317f9009de254f08bc924c6852e7b48a))
* **03-01:** wire config hook into plugin entry point ([24df6cd](https://github.com/kodrunhq/opencode-autopilot/commit/24df6cd43848efff6c5fa14614abdda3a689f658))
* **03-02:** add /review-pr command delegating to [@pr-reviewer](https://github.com/pr-reviewer) agent ([72d95b5](https://github.com/kodrunhq/opencode-autopilot/commit/72d95b5715a6060eb6c676f59bac9b59552dd856))
* **03-02:** add coding-standards skill with universal best practices ([26ed0ca](https://github.com/kodrunhq/opencode-autopilot/commit/26ed0cadf72f502564e2d65e293b9c4234d44e70))
* **04-01:** confidence ledger module with pure functions ([e994d45](https://github.com/kodrunhq/opencode-autopilot/commit/e994d45c046b137e394c03028a717da4a4e87d31))
* **04-01:** state persistence module with atomic writes ([5c8af9c](https://github.com/kodrunhq/opencode-autopilot/commit/5c8af9cec54d67dfc192cf0b6da47e545cedb86d))
* **04-01:** Zod schemas, types, and paths extension ([bc05525](https://github.com/kodrunhq/opencode-autopilot/commit/bc055255b3f2fa1e76cc035986203e32ff113b1c))
* **04-02:** config v2 schema with orchestrator/confidence namespaces and v1 auto-migration ([b74830a](https://github.com/kodrunhq/opencode-autopilot/commit/b74830a095f715d950d39623bc04ed25842d8ad0))
* **04-03:** phase transition module with state machine validation ([47f1e66](https://github.com/kodrunhq/opencode-autopilot/commit/47f1e66bb0317c4d8b0b8e158139f544bc7bc6b3))
* **04-03:** plan indexing and arena depth modules ([98b6578](https://github.com/kodrunhq/opencode-autopilot/commit/98b6578693f9236e45671e22aa7a387d22a22b37))
* **04-04:** oc_orchestrate tool, orchestrator agent, gitignore helper, plugin wiring ([bf36dc7](https://github.com/kodrunhq/opencode-autopilot/commit/bf36dc76841f55aeb4fe7f64de249c05d2376128))
* **04-04:** tool registrations for oc_state, oc_confidence, oc_phase, oc_plan ([4b062ac](https://github.com/kodrunhq/opencode-autopilot/commit/4b062ace33232eaed86557f15c806f8837f28860))
* **05-01:** agent catalog registry with 21 review agents ([801f0d7](https://github.com/kodrunhq/opencode-autopilot/commit/801f0d7b67ed2acac17bd73bc22088f5423d97c4))
* **05-01:** finding builder with deduplication and severity sorting ([2aae1a5](https://github.com/kodrunhq/opencode-autopilot/commit/2aae1a571d619a9c834d23c3c4c52bfd0e9ee509))
* **05-01:** review engine Zod schemas and types ([4fe49d5](https://github.com/kodrunhq/opencode-autopilot/commit/4fe49d5aed3815f9301805406e46c81141960c84))
* **05-01:** severity definitions with comparison and blocking check ([99e4aa0](https://github.com/kodrunhq/opencode-autopilot/commit/99e4aa085efb5db59c98babc3950e877941ba56f))
* **05-01:** stack gate filtering for technology-specific agents ([871875f](https://github.com/kodrunhq/opencode-autopilot/commit/871875f623a3c2fe9ba7224430aa7f4701d459b9))
* **05-01:** team selection logic combining catalog and stack gate ([b8a1043](https://github.com/kodrunhq/opencode-autopilot/commit/b8a1043cdbd080eb95e2cf183073c568ce5b6277))
* **05-02:** add 6 universal specialist review agent definitions ([ea22dbc](https://github.com/kodrunhq/opencode-autopilot/commit/ea22dbceb2f0372d4ea208ad96b078d23aa9ae30))
* **05-02:** add stage-3 agents, barrel export, and registry tests ([29d4703](https://github.com/kodrunhq/opencode-autopilot/commit/29d4703180ca2a655611160746112123218e0f82))
* **05-03:** add deterministic agent selection and cross-verification ([cdebf79](https://github.com/kodrunhq/opencode-autopilot/commit/cdebf79dba806f9cde2b70248a15fea1148fa455))
* **05-03:** add pipeline state machine and report builder ([16e7dee](https://github.com/kodrunhq/opencode-autopilot/commit/16e7dee478e18498bfa70b107be7e3f820ef2400))
* **05-04:** implement oc_review tool and register in plugin ([bb4f1bb](https://github.com/kodrunhq/opencode-autopilot/commit/bb4f1bba46db169176a082cbcecce7330ff400a0))
* **05-04:** implement review memory persistence and fix cycle ([7b25a89](https://github.com/kodrunhq/opencode-autopilot/commit/7b25a89952f1b6af46b24d42d51f5b130e31bdad))
* **06-01:** add 9 pipeline subagent configs and barrel export ([9af6e36](https://github.com/kodrunhq/opencode-autopilot/commit/9af6e36c1762a95486b43c62ac6134f8e1479539))
* **06-01:** add handler types, artifact module, and buildProgress schema ([5842a5e](https://github.com/kodrunhq/opencode-autopilot/commit/5842a5e5c81f1b7757b5288c83f41ab3912e90b5))
* **06-02:** add ARCHITECT handler with Arena multi-step logic ([c615a08](https://github.com/kodrunhq/opencode-autopilot/commit/c615a08a8b2ca203399f53065ddb5b3b8239817f))
* **06-02:** add RECON and CHALLENGE phase handlers with tests ([f9c1287](https://github.com/kodrunhq/opencode-autopilot/commit/f9c1287f4fbd35a6964d72755fc8d535db65b352))
* **06-03:** implement PLAN, SHIP, RETROSPECTIVE, EXPLORE handlers with tests ([4cd9d62](https://github.com/kodrunhq/opencode-autopilot/commit/4cd9d6239aff251b55c846297c58720eaec4cbe5))
* **06-04:** handler dispatch map and enhanced orchestrateCore ([f77a10c](https://github.com/kodrunhq/opencode-autopilot/commit/f77a10c675374181f5c79bdf66dec52d036e8bab))
* **06-04:** register pipeline agents in configHook ([c743d0a](https://github.com/kodrunhq/opencode-autopilot/commit/c743d0a61ee9d9faaa5e1bd7921a123cc7b7b07c))
* **07-01:** implement lesson memory module with schemas, types, and persistence ([b318a56](https://github.com/kodrunhq/opencode-autopilot/commit/b318a569a182e15fea95cdd4f1fb9d8d264e8187))
* **07-02:** enhanced retrospective handler with JSON parsing and lesson persistence ([3bf6f35](https://github.com/kodrunhq/opencode-autopilot/commit/3bf6f35396a48c541bd9afd0eeeb8fde6b07edf9))
* **07-02:** lesson injection into phase dispatch prompts ([ebfb4f4](https://github.com/kodrunhq/opencode-autopilot/commit/ebfb4f46639f0dd9037c0b3d7e6cf6e8fa2f3774))
* **07-03:** add failureContext schema and capture failure metadata in orchestrateCore ([bef5312](https://github.com/kodrunhq/opencode-autopilot/commit/bef5312909d7858a2c10fc2555b2c065ccd3adc2))
* **07-03:** create oc_forensics tool and register in plugin ([483f54d](https://github.com/kodrunhq/opencode-autopilot/commit/483f54ddce0189b01a11f1145fae5392a7de73ab))
* **08-01:** add coverage thresholds and tool registration smoke test ([fc53aee](https://github.com/kodrunhq/opencode-autopilot/commit/fc53aeeaddc2e470beb71dfa46b6026c1804c527))
* **08-02:** add GitHub Actions CI workflow ([9b2d909](https://github.com/kodrunhq/opencode-autopilot/commit/9b2d909199cbf9a96da924a96160ccce831c5bed))
* **09-01:** add fallback config schema and upgrade pluginConfigSchema to v3 ([4e039ef](https://github.com/kodrunhq/opencode-autopilot/commit/4e039ef6b5647460b3689198ab3c9448dfce7e22))
* **09-01:** add fallback types, error classifier, state machine, and message replay ([e8f9cd0](https://github.com/kodrunhq/opencode-autopilot/commit/e8f9cd0d9764f95699cfef38db2eda4980c7cf60))
* **09-02:** implement FallbackManager with concurrency guards and session lifecycle ([4413e99](https://github.com/kodrunhq/opencode-autopilot/commit/4413e99eb25d82ac207fa71771da5ce1ff10fac8))
* **09-02:** update barrel export and fix lint issues ([ddd0157](https://github.com/kodrunhq/opencode-autopilot/commit/ddd0157cf22f78167735b164a5d88a0c567a457c))
* **09-03:** add event, chat.message, and tool.execute.after handler factories ([d9c7c90](https://github.com/kodrunhq/opencode-autopilot/commit/d9c7c90ce79a38cba950a15894d26a2854f18cd9))
* **09-03:** wire fallback handlers into plugin entry and update barrel export ([8ace438](https://github.com/kodrunhq/opencode-autopilot/commit/8ace4380f2a382b71094b80e7640f9dfc6ad5f3d))
* **10-01:** rename orchestrator to autopilot, update modes and hidden flags ([bcc4866](https://github.com/kodrunhq/opencode-autopilot/commit/bcc486660a9bd185cf7b419bb9adeaf7b5ae7a2e))
* **10-01:** standardize severity levels to CRITICAL/HIGH/MEDIUM/LOW ([0f3530a](https://github.com/kodrunhq/opencode-autopilot/commit/0f3530a35321a9edac365ea6894f9780cebbff2b))
* **10-02:** rewrite all 10 pipeline agent prompts to 150+ word structured format ([881bbf4](https://github.com/kodrunhq/opencode-autopilot/commit/881bbf41b33703993389d575ce14e7d69217b1c7))
* **10-03:** implement skill injection module and enhance buildTaskPrompt ([51cdf0e](https://github.com/kodrunhq/opencode-autopilot/commit/51cdf0e437257b9b88761124894b59b090940e74))
* **10-03:** implement two-tier fallback chain resolution and config v3 fallback_models ([60646b2](https://github.com/kodrunhq/opencode-autopilot/commit/60646b2d91dfcdd0ce96f7dcaf4528acfd978cab))
* **10-04:** add 13 specialized review agents with stack-gated selection ([fefa8d8](https://github.com/kodrunhq/opencode-autopilot/commit/fefa8d878258733d2f9e94836fb83124937522bb))
* **10-04:** wire stack detection and all-agent selection into review pipeline ([9dc937b](https://github.com/kodrunhq/opencode-autopilot/commit/9dc937b21c3a76c144174f6148fb2e6749fca7cc))
* **12-02:** add oc_doctor diagnostic tool with health check module ([28a30a5](https://github.com/kodrunhq/opencode-autopilot/commit/28a30a5a81217cdab9c6e4dd9c5efe192ea0582f))
* **12-03:** implement oc_quick tool and /quick command ([db2fb13](https://github.com/kodrunhq/opencode-autopilot/commit/db2fb1349e8c6bc89a19664bc0ad23168598a1b5))
* **13-01:** add structured event logging with session logger ([1af3bd3](https://github.com/kodrunhq/opencode-autopilot/commit/1af3bd3a4e69a3a6f4b035339ae41a5db4e44e61))
* **13-01:** add time-based log retention with configurable pruning ([6f42279](https://github.com/kodrunhq/opencode-autopilot/commit/6f4227973b62103518c5b4d365cc9a8abf983a77))
* **13-02:** add event emitters, hook handlers, and event store ([d43a6b1](https://github.com/kodrunhq/opencode-autopilot/commit/d43a6b1e2f69cf9ec3a38fd74a64ae2056550fce))
* **13-02:** add token tracker and context monitor with TDD ([f8f5ee8](https://github.com/kodrunhq/opencode-autopilot/commit/f8f5ee8845c4a8dacdf81763d388029cb20dd754))
* **13-03:** add log writer and log reader for session persistence ([7415519](https://github.com/kodrunhq/opencode-autopilot/commit/741551970e235b6063e8337e52f766e2268457d2))
* **13-03:** add session summary generator and barrel export ([80a101d](https://github.com/kodrunhq/opencode-autopilot/commit/80a101debf7eef07ba3fe9866b28962320a0ce07))
* **13-04:** add oc_logs, oc_session_stats, oc_pipeline_report tools with TDD ([35c2b4d](https://github.com/kodrunhq/opencode-autopilot/commit/35c2b4d87b983d9658e84e356ed51d60fac9928a))
* **13-04:** wire observability into plugin entry with 4 new tools and hooks ([5ae995c](https://github.com/kodrunhq/opencode-autopilot/commit/5ae995cffe7d2c3713eb4726a88a74adbd57150a))
* **13-05:** add mock provider types and error generator ([6f6661a](https://github.com/kodrunhq/opencode-autopilot/commit/6f6661a6e24234aa58572c271653ca8ba0213fa4))
* **13-05:** add oc_mock_fallback tool for fallback chain testing ([7e94a09](https://github.com/kodrunhq/opencode-autopilot/commit/7e94a09b0c230a751100fb25534ac502262be4a3))
* **14-01:** create brainstorming skill with Socratic design refinement methodology ([ef35765](https://github.com/kodrunhq/opencode-autopilot/commit/ef35765172dc1886256a68b6c34369ab9fb28ef3))
* **14-01:** create TDD workflow and systematic debugging skills ([f5030ee](https://github.com/kodrunhq/opencode-autopilot/commit/f5030eeb0072eef1be6cbbedb87fcf2b49056a96))
* **14-02:** create plan-writing and plan-executing skills (SK-06, SK-07) ([4f8f962](https://github.com/kodrunhq/opencode-autopilot/commit/4f8f9625150ec7d7647ebf35cbedf53ee365fdad))
* **14-02:** create verification and git-worktrees skills (SK-04, SK-05) ([2b1dcf3](https://github.com/kodrunhq/opencode-autopilot/commit/2b1dcf38f6209cd4ef4ced830aee110cdaa17663))
* **14-03:** create code-review, strategic-compaction, and e2e-testing skills ([a7449f1](https://github.com/kodrunhq/opencode-autopilot/commit/a7449f1fe56c04038328c021d4143019aa56fd67))
* **14-03:** create thin wrapper commands for brainstorm, tdd, and write-plan ([9afc04f](https://github.com/kodrunhq/opencode-autopilot/commit/9afc04fdb4f76832f9f9445e361d6b7f5134d147))
* **14-04:** create Python and Rust language pattern skills ([fb52608](https://github.com/kodrunhq/opencode-autopilot/commit/fb526086962d3dcb17ede9b4b4201bb1c3eb06cf))
* **14-04:** create TypeScript/Bun and Go language pattern skills ([75e0168](https://github.com/kodrunhq/opencode-autopilot/commit/75e016856042e73801dab15c528b8029d8c2a05e))
* **14-05:** add asset linter, stocktake tool, and update-docs tool ([c82cfc9](https://github.com/kodrunhq/opencode-autopilot/commit/c82cfc97c2bfecf2544bc133f79643d016f2b6d7))
* **14-05:** update skill template with stacks/requires and register new tools ([f9052ab](https://github.com/kodrunhq/opencode-autopilot/commit/f9052abf0dbbe78a68281c34e31c952184a81bfc))
* **14-06:** add loadAdaptiveSkillContext to skill-injection.ts ([78544e8](https://github.com/kodrunhq/opencode-autopilot/commit/78544e81a37b50292ff88157f295969df8721700))
* **14-06:** create skill loader, dependency resolver, and adaptive injector ([432fc52](https://github.com/kodrunhq/opencode-autopilot/commit/432fc52eaf2624d413dfad688d0dbb8e2d97582c))
* **15-01:** add memory schemas, types, constants, and project-key module ([5f77e6a](https://github.com/kodrunhq/opencode-autopilot/commit/5f77e6a5a6819484a8d1c23065d2d44659e42976))
* **15-01:** add memory schemas, types, constants, and project-key module ([ab1150e](https://github.com/kodrunhq/opencode-autopilot/commit/ab1150ef0b53b48483ae156881ac8d2ee5e90281))
* **15-01:** add SQLite database singleton with FTS5 and repository CRUD ([bd588b8](https://github.com/kodrunhq/opencode-autopilot/commit/bd588b8623a21dfe89f9b1821d1894577be146f6))
* **15-01:** add SQLite database singleton with FTS5 and repository CRUD ([044c851](https://github.com/kodrunhq/opencode-autopilot/commit/044c8516aa72bd2dd5c4fd1f32beb803f5ffd02c))
* **15-02:** add 3-layer progressive disclosure retrieval with token budget ([07db844](https://github.com/kodrunhq/opencode-autopilot/commit/07db8440eb0a057740c9193fb64ff6e95d2d172c))
* **15-02:** add event capture handler and decay scoring ([79f39fb](https://github.com/kodrunhq/opencode-autopilot/commit/79f39fbe4e34bc7f4affde47dbe40b9878680db9))
* **15-03:** add memory injector and oc_memory_status tool ([e4ccd2a](https://github.com/kodrunhq/opencode-autopilot/commit/e4ccd2a82968c6213a64459ef840bb59e0db6543))
* **15-03:** config v5 with memory section and index.ts wiring ([1ce8bc9](https://github.com/kodrunhq/opencode-autopilot/commit/1ce8bc9d63982207414854f91fb0cb1fdcc9547e))
* **17-01:** add memory-based confidence tuning to arena depth ([7b358f0](https://github.com/kodrunhq/opencode-autopilot/commit/7b358f0a7fc9d562482ee9975346306ba093d54b))
* **17-01:** replace single-skill injection with adaptive skill context ([493a0b6](https://github.com/kodrunhq/opencode-autopilot/commit/493a0b655a8332b3d8d89a65a60b7f123636fa42))
* **18:** rename all command files to oc- prefix and delete oc-configure ([1ef8e3a](https://github.com/kodrunhq/opencode-autopilot/commit/1ef8e3afa795600d767506106d2cd0a4451ff87a))
* **18:** update DEPRECATED_ASSETS and clear FORCE_UPDATE_ASSETS ([5610815](https://github.com/kodrunhq/opencode-autopilot/commit/5610815806a3f664de796124420cf3a98225c9c0))
* **18:** update source code references to oc- prefixed command names ([9327bba](https://github.com/kodrunhq/opencode-autopilot/commit/9327bbae529744f95d8a4ba0180d00572194a892))
* add /oc-configure command asset ([7900253](https://github.com/kodrunhq/opencode-autopilot/commit/790025314db3938558d851b704e85d1236006c26))
* add adversarial diversity checker for model group assignments ([325ce94](https://github.com/kodrunhq/opencode-autopilot/commit/325ce94968729bf6c25838d13ea20b85f86c4cc9))
* add CLI installer and doctor commands ([faf2bc9](https://github.com/kodrunhq/opencode-autopilot/commit/faf2bc97640212438c144ddb8c054c2baf660316))
* add config schema v4 with groups/overrides and v3→v4 migration ([523393d](https://github.com/kodrunhq/opencode-autopilot/commit/523393d42377a871eb4cbbc20ac9bb5f78114b99))
* add declarative agent group registry with definitions and diversity rules ([8ceab8a](https://github.com/kodrunhq/opencode-autopilot/commit/8ceab8a39fc74e0fa0742e7061124fa63a36eccf))
* add interactive CLI configure wizard with searchable model selection ([4c822fb](https://github.com/kodrunhq/opencode-autopilot/commit/4c822fbe857d68fb6f52dc2742ab6092f33c62cc))
* add model resolver with override &gt; group &gt; null precedence ([7a874a5](https://github.com/kodrunhq/opencode-autopilot/commit/7a874a5587a3d7e3aafd0ba780025344bb5644c7))
* add oc_configure tool with start/assign/commit/doctor/reset subcommands ([4f35cad](https://github.com/kodrunhq/opencode-autopilot/commit/4f35cad7c56cbf3897ee4a5ca55e986c5dffdfe2))
* add registry type definitions for model groups ([4e5c931](https://github.com/kodrunhq/opencode-autopilot/commit/4e5c931ef73b637c0978da81398335e5d6672a08))
* configHook resolves models from group registry ([4fd315e](https://github.com/kodrunhq/opencode-autopilot/commit/4fd315e4ca79eb8061cb2acc0dcaa23c1c460588))
* installer, model groups & configuration UX ([13e1b5e](https://github.com/kodrunhq/opencode-autopilot/commit/13e1b5eca6f61fde54a51f69afe028d7d09b2249))
* model fallback integration (Phase 9) ([1543377](https://github.com/kodrunhq/opencode-autopilot/commit/15433773a56c37a0838a51167fd443dc1262fe6c))
* namespace cleanup — prefix all commands with oc- ([39e826d](https://github.com/kodrunhq/opencode-autopilot/commit/39e826d4102b0f832bbe24a928f406bc07841770))
* Phase 1 — Plugin Infrastructure ([f642447](https://github.com/kodrunhq/opencode-autopilot/commit/f6424478b35a722fcfdc6a49464b0d0384b61ad8))
* Phase 10 — UX polish, metaprompting, fallback resolution, smart review selection ([16092a3](https://github.com/kodrunhq/opencode-autopilot/commit/16092a352fa9054d592c4e1ac7c3d534e9d42eb4))
* Phase 14 — Skills & Commands (22 features) ([9e25581](https://github.com/kodrunhq/opencode-autopilot/commit/9e25581bec977ec8b30d32fbda0ce5537f3936f4))
* Phase 15 — smart memory system with SQLite, FTS5, and relevance-scored retrieval ([c8be170](https://github.com/kodrunhq/opencode-autopilot/commit/c8be17063c00edb6f87b6d3c2e627da68a0b5eae))
* Phase 17 — integration polish, adaptive skill routing, confidence tuning ([9feb7b8](https://github.com/kodrunhq/opencode-autopilot/commit/9feb7b8743d5fa7e504d8aaa587f744563be2139))
* Phase 2 — Creation Tooling ([552c097](https://github.com/kodrunhq/opencode-autopilot/commit/552c0979b29eedb4e03acf1814d7006449e276eb))
* Phase 3 — Curated Assets ([2b39924](https://github.com/kodrunhq/opencode-autopilot/commit/2b39924114b65e1d5d6428095f8e723fa6bb9980))
* Phase 4 — Foundation Infrastructure for Autonomous Orchestrator ([eccfd4c](https://github.com/kodrunhq/opencode-autopilot/commit/eccfd4cf757fc8e9c91bc6e839ecc4bdcbce5840))
* Phase 5 — Review Engine (multi-agent code review) ([9816ab9](https://github.com/kodrunhq/opencode-autopilot/commit/9816ab965b2a3c5d69993224a5489f09c546018b))
* Phase 6 — Orchestrator Pipeline (8-phase autonomous SDLC) ([34deef2](https://github.com/kodrunhq/opencode-autopilot/commit/34deef2ec657f5f7fd0d3f0b35bff7861572b3ec))
* Phase 7 — Learning & Resilience (institutional memory + forensics) ([25e7346](https://github.com/kodrunhq/opencode-autopilot/commit/25e7346e5a7ed696809c0448ee2134059599f5e2))
* Phase 8 — Testing & CI pipeline ([8d6d19a](https://github.com/kodrunhq/opencode-autopilot/commit/8d6d19a369be5c172a296d2d10c4fcf65675af4c))
* **v3.0:** Phase 12 — self-healing doctor, quick mode, Zen display fix ([d93121d](https://github.com/kodrunhq/opencode-autopilot/commit/d93121d84e37bb8d2d5c9db89bc3fbf804ab7b9f))
* **v3.0:** Phase 13 — session observability, token tracking, decision replay ([7ec841b](https://github.com/kodrunhq/opencode-autopilot/commit/7ec841b72c3fd8aa5a3dbc76ebc3a3be901bb733))
* wire oc_configure, remove placeholder, add first-load toast ([1931765](https://github.com/kodrunhq/opencode-autopilot/commit/19317651b13b479606e0d12b7f69b405a3d2ddcc))


### Bug Fixes

* **04-03:** lint and format cleanup for orchestrator modules ([e084723](https://github.com/kodrunhq/opencode-autopilot/commit/e08472390b20cd511360ad0734045b8b6c7f3482))
* **04:** address review findings (patch allowlist, DRY paths, immutability, schema bounds, atomic config) ([d0da334](https://github.com/kodrunhq/opencode-autopilot/commit/d0da334ba04cbdcc0712a91bd7d731cb72f35687))
* **05:** address Copilot PR review comments ([4f72417](https://github.com/kodrunhq/opencode-autopilot/commit/4f72417a341796e578789036a1ed14964e95557e))
* **05:** address review findings (schema alignment, pipeline wiring, dead code, security hardening) ([aa94771](https://github.com/kodrunhq/opencode-autopilot/commit/aa94771ca6369cef29ed1427d625f2f8b8be0740))
* **05:** address second round Copilot PR review comments ([4d7df97](https://github.com/kodrunhq/opencode-autopilot/commit/4d7df97f28d161c4accce494ce1740148bc8237f))
* **06:** address PR review — dispatch_multi tracking, resume safety, stale comment ([dbd9470](https://github.com/kodrunhq/opencode-autopilot/commit/dbd9470ffe859532cda3e72a29126749700687ce))
* **06:** address review findings (critical parse, type safety, prompt sanitization, least privilege) ([49d2f2a](https://github.com/kodrunhq/opencode-autopilot/commit/49d2f2a196ad055c2a8cddb8b2bb7f6eb9b9531c))
* **07:** ACE review fixes (phase guard, type safety, prompt clarity, test coverage, error detail) ([f816dc8](https://github.com/kodrunhq/opencode-autopilot/commit/f816dc86fed1a7457dbc59349284af8499452df5))
* **07:** address PR review — forensics error handling, lesson recovery, roadmap sync ([0c60f42](https://github.com/kodrunhq/opencode-autopilot/commit/0c60f42a69aa04c2e6ada440a6b325bd987dd8f3))
* **07:** address PR review round 2 — path scrubbing, I/O dedup, freeze consistency ([37b876e](https://github.com/kodrunhq/opencode-autopilot/commit/37b876e9eadda1fd8bb9c5a26c1e0424943e25d1))
* **07:** address review findings (prune overflow, sourcePhase enum, sanitization, error paths) ([7761274](https://github.com/kodrunhq/opencode-autopilot/commit/77612748cb8291a79185b38e1d41c7232f5cb9d8))
* **08-01:** resolve all TypeScript type errors across codebase ([78c2076](https://github.com/kodrunhq/opencode-autopilot/commit/78c2076ab2126dfe1d509273a424ba6fe356f0e0))
* **08:** address PR review — prompt type, coverage threshold, doc alignment ([7e02371](https://github.com/kodrunhq/opencode-autopilot/commit/7e023714c9282e468e343a3caed5be7f7a5d1a76))
* **08:** address review round 2 — bail syntax, coverage keys, state counters ([5d9ac57](https://github.com/kodrunhq/opencode-autopilot/commit/5d9ac5741d0a66bb2dec7fa815f7778c9ef50661))
* **08:** address review squad findings — CI hardening, test quality, doc consistency ([0855f02](https://github.com/kodrunhq/opencode-autopilot/commit/0855f02c80edd47f631cda650832e19e0b9880e1))
* **08:** remove coverage thresholds — Bun enforces per-file, not aggregate ([b5ec4d3](https://github.com/kodrunhq/opencode-autopilot/commit/b5ec4d367d4a3573aadc1c9bc3ffc39082a4e92e))
* **09:** add missing 09-02 dependency to Plan 03, move to wave 3 ([7547e97](https://github.com/kodrunhq/opencode-autopilot/commit/7547e97c8114a3ffdb610d1d2f01e24af04f0b66))
* **09:** address PR review — parentID null guard, TTFT enabled gate, test accuracy ([46542fb](https://github.com/kodrunhq/opencode-autopilot/commit/46542fb4d61e495b8b735fb1c01d6fbc4a8bcc80))
* **09:** address review round 1 — security, concurrency, correctness, test coverage ([161e9ff](https://github.com/kodrunhq/opencode-autopilot/commit/161e9ff07a4019b58c62bac91b06f884aa9cb676))
* **09:** move markAwaitingResult inside dispatch block, format tests ([cd058cd](https://github.com/kodrunhq/opencode-autopilot/commit/cd058cda8bebc9d6ab7efea874605d15ba202dd9))
* **10-02:** fix base agent prompt issues (paths, constraints, skill references) ([173bdf8](https://github.com/kodrunhq/opencode-autopilot/commit/173bdf82774e9e9da7f0dc2a68a19c82694a038d))
* **10:** address PR review — cwd for git, --root for diff-tree, derive stage3 names, fix roadmap status ([d17a126](https://github.com/kodrunhq/opencode-autopilot/commit/d17a126231d67c0bd9002fe2580f0ee95dae0838))
* **10:** address review round 1 — agentName forwarding, string filtering, prompt identity, stack detection, branch scope ([e53893f](https://github.com/kodrunhq/opencode-autopilot/commit/e53893f2e6747670431fbb7a31c5a0fa1b8fc442))
* **10:** update remaining test severity values from WARNING/NITPICK to HIGH/LOW ([153c08e](https://github.com/kodrunhq/opencode-autopilot/commit/153c08e3c3c86023570520eea8ef32ecec51c2de))
* **12-01:** use model id field for provider-prefixed model discovery ([06d3f32](https://github.com/kodrunhq/opencode-autopilot/commit/06d3f32179d20df92fdded65c6502a89c1065256))
* **18:** address PR review comments and CI failure ([49cc26b](https://github.com/kodrunhq/opencode-autopilot/commit/49cc26b00e26cf3e5e48de9a0ab0090596d14a0b))
* **18:** resolve stale command references and add deprecation test ([4ee636e](https://github.com/kodrunhq/opencode-autopilot/commit/4ee636e9092bf593801d4d06d05c8a4cd11a6484))
* add missing oc_quick import and registration after merge ([12eb0b9](https://github.com/kodrunhq/opencode-autopilot/commit/12eb0b9de7c3c2b5a0fa82d0f7e05244b0effc62))
* address ACE review — logic bug, error handling, type safety, test assertions ([055a83e](https://github.com/kodrunhq/opencode-autopilot/commit/055a83ed248f167f7c1f58a9815e0f78500925b9))
* address ace review + Copilot findings — type alignment, path validation, error handling, session lifecycle ([4a0c94b](https://github.com/kodrunhq/opencode-autopilot/commit/4a0c94b2a95e844f51acf1b70e44c97a082d10d6))
* address ace review findings — halfLifeDays forwarding, FTS5 sanitization, type safety, error logging, budget accounting, schema constraints ([758a4dd](https://github.com/kodrunhq/opencode-autopilot/commit/758a4dd1ad6ddea882cd08f3c2cf12f405fe6e52))
* address code quality and security review findings ([1853b1b](https://github.com/kodrunhq/opencode-autopilot/commit/1853b1bdfa10202e211da0052f408e60bb0db037))
* address Copilot PR comments + ace findings — projectRoot param, error logging, boundary test, length assertion, singleton isolation ([0b1111b](https://github.com/kodrunhq/opencode-autopilot/commit/0b1111b4cb42d6609b03fa08a2c271fe9937d4ee))
* address Copilot PR comments + ace review findings — cycle detection, CRLF, yaml guards, error handling, sanitizer, token budget ([d09c145](https://github.com/kodrunhq/opencode-autopilot/commit/d09c145c88fd1542df7c7cdafd9fd3f103604e34))
* address Copilot PR comments + remaining ace findings — unused import, timeline date tracking, DB leak, storage path, empty catches ([f909da3](https://github.com/kodrunhq/opencode-autopilot/commit/f909da3028f2df2d46b9012017ceb82dfb75dbba))
* address Copilot PR review comments ([cb5dff2](https://github.com/kodrunhq/opencode-autopilot/commit/cb5dff2d2b9d420d13db27b164b15d341dd5cfec))
* address PR [#25](https://github.com/kodrunhq/opencode-autopilot/issues/25) review comments ([3c5d186](https://github.com/kodrunhq/opencode-autopilot/commit/3c5d1868f9b1b6ecd19a5ce7c7ca8569942797c3))
* address PR [#27](https://github.com/kodrunhq/opencode-autopilot/issues/27) review comments ([572cd42](https://github.com/kodrunhq/opencode-autopilot/commit/572cd422eaf6976915c7f6ac35ee3e900a01c789))
* address PR [#29](https://github.com/kodrunhq/opencode-autopilot/issues/29) round 2 — session.error extraction, Zod sanitized write, timestamp guard, table escaping, lint ([dff5965](https://github.com/kodrunhq/opencode-autopilot/commit/dff59658ac810432299f94a0190786ebac1bab8f))
* address PR review — dirname for ensureDir, access-before-copy, keep currentAssignment key ([84b82c1](https://github.com/kodrunhq/opencode-autopilot/commit/84b82c1186a887616879f1614e42f5abb34a80e2))
* address PR review — diversity rule logic, group key validation, unused imports, CI exit code ([4283af7](https://github.com/kodrunhq/opencode-autopilot/commit/4283af75de8162b1dd3a6db6a6d58cbf228b08f6))
* address PR review — reset clears providers, rename variable, surface cleanup errors, test isolation ([3e0572c](https://github.com/kodrunhq/opencode-autopilot/commit/3e0572cc6bdc6e4a3bbf66a6c64248f75a05cd62))
* address PR review comments (hermetic tests, path portability, DRY config, graceful errors) ([ef47abf](https://github.com/kodrunhq/opencode-autopilot/commit/ef47abf2bfce3035c88fad46969a2a3b12c08aca))
* address review findings — Promise.allSettled, error discrimination, registry-derived agents, stub artifacts ([db93c4b](https://github.com/kodrunhq/opencode-autopilot/commit/db93c4b39d4bf925ff3c1002e1a5d5e7bb2bf1bf))
* address review findings (immutability, atomic writes, validation, security) ([1106ecc](https://github.com/kodrunhq/opencode-autopilot/commit/1106ecca01a19cb16f918d85011b2dd5cc49650c))
* address review findings (immutability, permissions, security hardening) ([a51d888](https://github.com/kodrunhq/opencode-autopilot/commit/a51d888e7b4262dd0c0732b57a579d8d7e7c0ce1))
* address review findings (immutability, validation, security, tests) ([c83d2c0](https://github.com/kodrunhq/opencode-autopilot/commit/c83d2c0ee50a234d52f6ef6e6971f78a76ebe767))
* address review round 1 — agent count, anti-patterns, immutability, test assertions, lint failure test ([89e0f6e](https://github.com/kodrunhq/opencode-autopilot/commit/89e0f6eaeb02301c3e7668e21ee81b1e09e2de16))
* address review round 2 — update-docs project root, remove duplicate anti-pattern section ([99d6e03](https://github.com/kodrunhq/opencode-autopilot/commit/99d6e03d85486ab703eb4cda06c3d51f0e5456e1))
* apply lint fixes to new memory test files ([e636d8e](https://github.com/kodrunhq/opencode-autopilot/commit/e636d8e266a3ef19180d5ac64aef2e1c5590ab7d))
* **ci:** add NPM_TOKEN for publish authentication (provenance handles signing separately) ([eea2ddb](https://github.com/kodrunhq/opencode-autopilot/commit/eea2ddb018684bd1116f465a396c2f310ae6853b))
* **ci:** remove npm cache — project uses bun.lock, not package-lock.json ([830e912](https://github.com/kodrunhq/opencode-autopilot/commit/830e912022b55f684ac44393d8f19df4fad00edd))
* **ci:** remove npm self-upgrade step — Node 22 npm already supports OIDC ([63e8972](https://github.com/kodrunhq/opencode-autopilot/commit/63e89724ccd3bd38eb6e8f70c9a716e5ef88f5fd))
* **ci:** reorder steps — Node + npm upgrade before Bun, remove NODE_AUTH_TOKEN (use OIDC) ([322941e](https://github.com/kodrunhq/opencode-autopilot/commit/322941e6ea69d1e4974bdeb6acaf1cac5eba49f9))
* **ci:** update action SHAs to match kodrunhq/claudefy ([21c0505](https://github.com/kodrunhq/opencode-autopilot/commit/21c0505b9d77138d2baf580f98b99b6d12a4a88f))
* **ci:** use npx npm@latest for publish instead of self-upgrading npm ([121930a](https://github.com/kodrunhq/opencode-autopilot/commit/121930a44be88908c8017f3e6eddfe25645b9fd8))
* compact tool output to prevent OpenCode truncation ([6bd0901](https://github.com/kodrunhq/opencode-autopilot/commit/6bd090113695b53007ef29221fc9e1fd1dbe93cf))
* compact tool output to prevent truncation, force-update command files ([6552b28](https://github.com/kodrunhq/opencode-autopilot/commit/6552b282bdd6338d8a42869b95223961fead7a32))
* deep freeze registry data, derive ALL_GROUP_IDS, replace unsafe casts, freeze assignments ([4be6cfe](https://github.com/kodrunhq/opencode-autopilot/commit/4be6cfec2d9605aa94046c0f05c0af8961b666ef))
* deep-copy permission in config hook, handle optional prompt in tests ([b56305b](https://github.com/kodrunhq/opencode-autopilot/commit/b56305b4f3c4645f5040f54395672e0fc89cdf45))
* format and lint cleanup for Phase 3 files ([9cbc233](https://github.com/kodrunhq/opencode-autopilot/commit/9cbc2333b76761bfa71a352b2991e72d0a44c5fd))
* format and lint fixes for integration tests ([8d5fd3e](https://github.com/kodrunhq/opencode-autopilot/commit/8d5fd3ef2983319bc6525b5d757ee6defa6ddf3b))
* format dependency-resolver.ts and config.json for CI lint ([48ebc15](https://github.com/kodrunhq/opencode-autopilot/commit/48ebc15fae74fe4cc06825f0c148515433e6d371))
* guard against sync failures and race condition in provider discovery ([d07d192](https://github.com/kodrunhq/opencode-autopilot/commit/d07d1923075aae98a545fbf0772ca101ca707a17))
* installer UX bugs — model discovery, deprecated assets, command agent, guide flow ([eb24628](https://github.com/kodrunhq/opencode-autopilot/commit/eb24628b6052c9347cfa5b71633a5ece4a74fac4))
* make provider discovery non-blocking to prevent plugin init hang ([2b374ec](https://github.com/kodrunhq/opencode-autopilot/commit/2b374ecb7fc2ab46b9c345b140aa32e5dc7af2ba))
* model discovery via provider API, deprecated asset cleanup, command agent field ([e5d2598](https://github.com/kodrunhq/opencode-autopilot/commit/e5d25989a3b91ae0af661d0ca5851aec04d46b8b))
* non-blocking provider discovery to prevent startup hang ([b76238a](https://github.com/kodrunhq/opencode-autopilot/commit/b76238ab924f6165ee44e894b799eeb82e1e7997))
* pre-format model list in tool response to prevent LLM summarization ([b0f12e7](https://github.com/kodrunhq/opencode-autopilot/commit/b0f12e74cd87b3ffd58503cecc7e3a9036e5ccf7))
* re-throw SyntaxError in loadAdaptiveSkillContext, document observation scan cap ([f94e228](https://github.com/kodrunhq/opencode-autopilot/commit/f94e22814f738a835558cdca88f1d6bae546d3d1))
* reconcile sessionLogSchema after Wave 2 parallel merge ([2c1d914](https://github.com/kodrunhq/opencode-autopilot/commit/2c1d91444032b25bb0e56e4334539bc95267de06))
* resolve lint errors — no-assign-in-expression, config.json formatting ([b872d70](https://github.com/kodrunhq/opencode-autopilot/commit/b872d70fb182d6813ec1cfd54bc2c456de7c4c3a))
* resolve type errors from config v5 migration and SDK Model type ([8e4df4d](https://github.com/kodrunhq/opencode-autopilot/commit/8e4df4dad732b8b96f732b010912df425528d4e2))
* resolve TypeScript errors and CI failures ([2e71af1](https://github.com/kodrunhq/opencode-autopilot/commit/2e71af190df40bf0d2309a9879484ddec65bbf3e))
* return pre-formatted model list from oc_configure start ([42d82fd](https://github.com/kodrunhq/opencode-autopilot/commit/42d82fdad6854b5c2e041d7192d0f37a17dc6123))
* rewrite oc-configure instructions to show all models and collect fallbacks ([8988b60](https://github.com/kodrunhq/opencode-autopilot/commit/8988b60f86adb5ab23327655c79582a49c110ad6))
* show all models and collect fallbacks in oc-configure ([4934a05](https://github.com/kodrunhq/opencode-autopilot/commit/4934a05f9d80546e1c9fc22e720746696fcce175))
* update biome config, fix lint warnings, format all files ([28e0b00](https://github.com/kodrunhq/opencode-autopilot/commit/28e0b003edc7576f9ffa5e9f3357a4a8a6fd7dde))
* use MAX_NAME_LENGTH constant in error messages instead of hardcoded value ([72bbe84](https://github.com/kodrunhq/opencode-autopilot/commit/72bbe8463bcc16cd71242a471bb92047f8cd1eac))
* use real provider IDs in examples, remove ambiguous reference option ([fe66f12](https://github.com/kodrunhq/opencode-autopilot/commit/fe66f1204f0556081b3c3b89d3ed9248a51d6db4))

## [1.8.0](https://github.com/kodrunhq/opencode-autopilot/compare/opencode-autopilot-v1.7.0...opencode-autopilot-v1.8.0) (2026-04-03)


### Features

* **18:** rename all command files to oc- prefix and delete oc-configure ([1ef8e3a](https://github.com/kodrunhq/opencode-autopilot/commit/1ef8e3afa795600d767506106d2cd0a4451ff87a))
* **18:** update DEPRECATED_ASSETS and clear FORCE_UPDATE_ASSETS ([5610815](https://github.com/kodrunhq/opencode-autopilot/commit/5610815806a3f664de796124420cf3a98225c9c0))
* **18:** update source code references to oc- prefixed command names ([9327bba](https://github.com/kodrunhq/opencode-autopilot/commit/9327bbae529744f95d8a4ba0180d00572194a892))
* namespace cleanup — prefix all commands with oc- ([39e826d](https://github.com/kodrunhq/opencode-autopilot/commit/39e826d4102b0f832bbe24a928f406bc07841770))


### Bug Fixes

* **18:** address PR review comments and CI failure ([49cc26b](https://github.com/kodrunhq/opencode-autopilot/commit/49cc26b00e26cf3e5e48de9a0ab0090596d14a0b))
* **18:** resolve stale command references and add deprecation test ([4ee636e](https://github.com/kodrunhq/opencode-autopilot/commit/4ee636e9092bf593801d4d06d05c8a4cd11a6484))

## [1.7.0](https://github.com/kodrunhq/opencode-autopilot/compare/opencode-autopilot-v1.6.0...opencode-autopilot-v1.7.0) (2026-04-02)


### Features

* **17-01:** add memory-based confidence tuning to arena depth ([7b358f0](https://github.com/kodrunhq/opencode-autopilot/commit/7b358f0a7fc9d562482ee9975346306ba093d54b))
* **17-01:** replace single-skill injection with adaptive skill context ([493a0b6](https://github.com/kodrunhq/opencode-autopilot/commit/493a0b655a8332b3d8d89a65a60b7f123636fa42))
* Phase 17 — integration polish, adaptive skill routing, confidence tuning ([9feb7b8](https://github.com/kodrunhq/opencode-autopilot/commit/9feb7b8743d5fa7e504d8aaa587f744563be2139))


### Bug Fixes

* address Copilot PR comments + ace findings — projectRoot param, error logging, boundary test, length assertion, singleton isolation ([0b1111b](https://github.com/kodrunhq/opencode-autopilot/commit/0b1111b4cb42d6609b03fa08a2c271fe9937d4ee))
* format and lint fixes for integration tests ([8d5fd3e](https://github.com/kodrunhq/opencode-autopilot/commit/8d5fd3ef2983319bc6525b5d757ee6defa6ddf3b))
* re-throw SyntaxError in loadAdaptiveSkillContext, document observation scan cap ([f94e228](https://github.com/kodrunhq/opencode-autopilot/commit/f94e22814f738a835558cdca88f1d6bae546d3d1))

## [1.6.0](https://github.com/kodrunhq/opencode-autopilot/compare/opencode-autopilot-v1.5.0...opencode-autopilot-v1.6.0) (2026-04-02)


### Features

* **17-01:** wire adaptive skill routing into orchestrator dispatch (replaces single coding-standards injection)
* **17-01:** add memory-based confidence tuning for Arena debate depth
* **17-02:** add cross-feature integration tests (orchestrator + skills + memory)
* **17-02:** add config migration chain v1-v5 integration test
* **17-03:** update CLAUDE.md with memory, observability, and skills documentation
* **15-01:** add memory schemas, types, constants, and project-key module ([5f77e6a](https://github.com/kodrunhq/opencode-autopilot/commit/5f77e6a5a6819484a8d1c23065d2d44659e42976))
* **15-01:** add memory schemas, types, constants, and project-key module ([ab1150e](https://github.com/kodrunhq/opencode-autopilot/commit/ab1150ef0b53b48483ae156881ac8d2ee5e90281))
* **15-01:** add SQLite database singleton with FTS5 and repository CRUD ([bd588b8](https://github.com/kodrunhq/opencode-autopilot/commit/bd588b8623a21dfe89f9b1821d1894577be146f6))
* **15-01:** add SQLite database singleton with FTS5 and repository CRUD ([044c851](https://github.com/kodrunhq/opencode-autopilot/commit/044c8516aa72bd2dd5c4fd1f32beb803f5ffd02c))
* **15-02:** add 3-layer progressive disclosure retrieval with token budget ([07db844](https://github.com/kodrunhq/opencode-autopilot/commit/07db8440eb0a057740c9193fb64ff6e95d2d172c))
* **15-02:** add event capture handler and decay scoring ([79f39fb](https://github.com/kodrunhq/opencode-autopilot/commit/79f39fbe4e34bc7f4affde47dbe40b9878680db9))
* **15-03:** add memory injector and oc_memory_status tool ([e4ccd2a](https://github.com/kodrunhq/opencode-autopilot/commit/e4ccd2a82968c6213a64459ef840bb59e0db6543))
* **15-03:** config v5 with memory section and index.ts wiring ([1ce8bc9](https://github.com/kodrunhq/opencode-autopilot/commit/1ce8bc9d63982207414854f91fb0cb1fdcc9547e))
* Phase 15 — smart memory system with SQLite, FTS5, and relevance-scored retrieval ([c8be170](https://github.com/kodrunhq/opencode-autopilot/commit/c8be17063c00edb6f87b6d3c2e627da68a0b5eae))

### Phase 15 (Memory System)

* Smart dual-scope memory with project patterns and user preferences
* bun:sqlite with FTS5 for full-text search
* 3-layer progressive disclosure retrieval with token budgeting
* System prompt injection via experimental.chat.system.transform hook
* Relevance scoring with configurable 90-day half-life decay

### Phase 14 (Skills and Commands)

* 22 new skills covering brainstorming, TDD, debugging, planning, code review, and language patterns
* Adaptive skill injection with stack detection, dependency resolution, and token budgeting
* Thin wrapper commands for brainstorm, tdd, and write-plan
* Asset linter, stocktake tool, and update-docs tool
* Skill template with stacks/requires metadata

### Phase 13 (Session Observability)

* Structured event logging with JSON persistence
* Token tracking and context monitoring
* Session summaries and pipeline reports
* Time-based log retention (30-day default)
* Mock provider for fallback chain testing

### Phase 12 (Quick Wins)

* Self-healing oc_doctor tool with plugin diagnostics
* Quick mode and Zen display fix


### Bug Fixes

* address ace review findings — halfLifeDays forwarding, FTS5 sanitization, type safety, error logging, budget accounting, schema constraints ([758a4dd](https://github.com/kodrunhq/opencode-autopilot/commit/758a4dd1ad6ddea882cd08f3c2cf12f405fe6e52))
* address Copilot PR comments + remaining ace findings — unused import, timeline date tracking, DB leak, storage path, empty catches ([f909da3](https://github.com/kodrunhq/opencode-autopilot/commit/f909da3028f2df2d46b9012017ceb82dfb75dbba))
* apply lint fixes to new memory test files ([e636d8e](https://github.com/kodrunhq/opencode-autopilot/commit/e636d8e266a3ef19180d5ac64aef2e1c5590ab7d))
* resolve lint errors — no-assign-in-expression, config.json formatting ([b872d70](https://github.com/kodrunhq/opencode-autopilot/commit/b872d70fb182d6813ec1cfd54bc2c456de7c4c3a))
* resolve type errors from config v5 migration and SDK Model type ([8e4df4d](https://github.com/kodrunhq/opencode-autopilot/commit/8e4df4dad732b8b96f732b010912df425528d4e2))

## [1.5.0](https://github.com/kodrunhq/opencode-autopilot/compare/opencode-autopilot-v1.4.0...opencode-autopilot-v1.5.0) (2026-04-02)


### Features

* **14-01:** create brainstorming skill with Socratic design refinement methodology ([ef35765](https://github.com/kodrunhq/opencode-autopilot/commit/ef35765172dc1886256a68b6c34369ab9fb28ef3))
* **14-01:** create TDD workflow and systematic debugging skills ([f5030ee](https://github.com/kodrunhq/opencode-autopilot/commit/f5030eeb0072eef1be6cbbedb87fcf2b49056a96))
* **14-02:** create plan-writing and plan-executing skills (SK-06, SK-07) ([4f8f962](https://github.com/kodrunhq/opencode-autopilot/commit/4f8f9625150ec7d7647ebf35cbedf53ee365fdad))
* **14-02:** create verification and git-worktrees skills (SK-04, SK-05) ([2b1dcf3](https://github.com/kodrunhq/opencode-autopilot/commit/2b1dcf38f6209cd4ef4ced830aee110cdaa17663))
* **14-03:** create code-review, strategic-compaction, and e2e-testing skills ([a7449f1](https://github.com/kodrunhq/opencode-autopilot/commit/a7449f1fe56c04038328c021d4143019aa56fd67))
* **14-03:** create thin wrapper commands for brainstorm, tdd, and write-plan ([9afc04f](https://github.com/kodrunhq/opencode-autopilot/commit/9afc04fdb4f76832f9f9445e361d6b7f5134d147))
* **14-04:** create Python and Rust language pattern skills ([fb52608](https://github.com/kodrunhq/opencode-autopilot/commit/fb526086962d3dcb17ede9b4b4201bb1c3eb06cf))
* **14-04:** create TypeScript/Bun and Go language pattern skills ([75e0168](https://github.com/kodrunhq/opencode-autopilot/commit/75e016856042e73801dab15c528b8029d8c2a05e))
* **14-05:** add asset linter, stocktake tool, and update-docs tool ([c82cfc9](https://github.com/kodrunhq/opencode-autopilot/commit/c82cfc97c2bfecf2544bc133f79643d016f2b6d7))
* **14-05:** update skill template with stacks/requires and register new tools ([f9052ab](https://github.com/kodrunhq/opencode-autopilot/commit/f9052abf0dbbe78a68281c34e31c952184a81bfc))
* **14-06:** add loadAdaptiveSkillContext to skill-injection.ts ([78544e8](https://github.com/kodrunhq/opencode-autopilot/commit/78544e81a37b50292ff88157f295969df8721700))
* **14-06:** create skill loader, dependency resolver, and adaptive injector ([432fc52](https://github.com/kodrunhq/opencode-autopilot/commit/432fc52eaf2624d413dfad688d0dbb8e2d97582c))
* Phase 14 — Skills & Commands (22 features) ([9e25581](https://github.com/kodrunhq/opencode-autopilot/commit/9e25581bec977ec8b30d32fbda0ce5537f3936f4))


### Bug Fixes

* address Copilot PR comments + ace review findings — cycle detection, CRLF, yaml guards, error handling, sanitizer, token budget ([d09c145](https://github.com/kodrunhq/opencode-autopilot/commit/d09c145c88fd1542df7c7cdafd9fd3f103604e34))
* address review round 1 — agent count, anti-patterns, immutability, test assertions, lint failure test ([89e0f6e](https://github.com/kodrunhq/opencode-autopilot/commit/89e0f6eaeb02301c3e7668e21ee81b1e09e2de16))
* address review round 2 — update-docs project root, remove duplicate anti-pattern section ([99d6e03](https://github.com/kodrunhq/opencode-autopilot/commit/99d6e03d85486ab703eb4cda06c3d51f0e5456e1))
* format dependency-resolver.ts and config.json for CI lint ([48ebc15](https://github.com/kodrunhq/opencode-autopilot/commit/48ebc15fae74fe4cc06825f0c148515433e6d371))

## [1.4.0](https://github.com/kodrunhq/opencode-autopilot/compare/opencode-autopilot-v1.3.0...opencode-autopilot-v1.4.0) (2026-04-02)


### Features

* **13-01:** add structured event logging with session logger ([1af3bd3](https://github.com/kodrunhq/opencode-autopilot/commit/1af3bd3a4e69a3a6f4b035339ae41a5db4e44e61))
* **13-01:** add time-based log retention with configurable pruning ([6f42279](https://github.com/kodrunhq/opencode-autopilot/commit/6f4227973b62103518c5b4d365cc9a8abf983a77))
* **13-02:** add event emitters, hook handlers, and event store ([d43a6b1](https://github.com/kodrunhq/opencode-autopilot/commit/d43a6b1e2f69cf9ec3a38fd74a64ae2056550fce))
* **13-02:** add token tracker and context monitor with TDD ([f8f5ee8](https://github.com/kodrunhq/opencode-autopilot/commit/f8f5ee8845c4a8dacdf81763d388029cb20dd754))
* **13-03:** add log writer and log reader for session persistence ([7415519](https://github.com/kodrunhq/opencode-autopilot/commit/741551970e235b6063e8337e52f766e2268457d2))
* **13-03:** add session summary generator and barrel export ([80a101d](https://github.com/kodrunhq/opencode-autopilot/commit/80a101debf7eef07ba3fe9866b28962320a0ce07))
* **13-04:** add oc_logs, oc_session_stats, oc_pipeline_report tools with TDD ([35c2b4d](https://github.com/kodrunhq/opencode-autopilot/commit/35c2b4d87b983d9658e84e356ed51d60fac9928a))
* **13-04:** wire observability into plugin entry with 4 new tools and hooks ([5ae995c](https://github.com/kodrunhq/opencode-autopilot/commit/5ae995cffe7d2c3713eb4726a88a74adbd57150a))
* **13-05:** add mock provider types and error generator ([6f6661a](https://github.com/kodrunhq/opencode-autopilot/commit/6f6661a6e24234aa58572c271653ca8ba0213fa4))
* **13-05:** add oc_mock_fallback tool for fallback chain testing ([7e94a09](https://github.com/kodrunhq/opencode-autopilot/commit/7e94a09b0c230a751100fb25534ac502262be4a3))
* **v3.0:** Phase 13 — session observability, token tracking, decision replay ([7ec841b](https://github.com/kodrunhq/opencode-autopilot/commit/7ec841b72c3fd8aa5a3dbc76ebc3a3be901bb733))


### Bug Fixes

* address ace review + Copilot findings — type alignment, path validation, error handling, session lifecycle ([4a0c94b](https://github.com/kodrunhq/opencode-autopilot/commit/4a0c94b2a95e844f51acf1b70e44c97a082d10d6))
* address PR [#29](https://github.com/kodrunhq/opencode-autopilot/issues/29) round 2 — session.error extraction, Zod sanitized write, timestamp guard, table escaping, lint ([dff5965](https://github.com/kodrunhq/opencode-autopilot/commit/dff59658ac810432299f94a0190786ebac1bab8f))
* reconcile sessionLogSchema after Wave 2 parallel merge ([2c1d914](https://github.com/kodrunhq/opencode-autopilot/commit/2c1d91444032b25bb0e56e4334539bc95267de06))
* resolve TypeScript errors and CI failures ([2e71af1](https://github.com/kodrunhq/opencode-autopilot/commit/2e71af190df40bf0d2309a9879484ddec65bbf3e))

## [1.3.0](https://github.com/kodrunhq/opencode-autopilot/compare/opencode-autopilot-v1.2.1...opencode-autopilot-v1.3.0) (2026-04-02)


### Features

* **v3.0:** Phase 12 — self-healing doctor, quick mode, Zen display fix ([d93121d](https://github.com/kodrunhq/opencode-autopilot/commit/d93121d84e37bb8d2d5c9db89bc3fbf804ab7b9f))


### Bug Fixes

* address PR [#27](https://github.com/kodrunhq/opencode-autopilot/issues/27) review comments ([572cd42](https://github.com/kodrunhq/opencode-autopilot/commit/572cd422eaf6976915c7f6ac35ee3e900a01c789))

## [1.2.1](https://github.com/kodrunhq/opencode-autopilot/compare/opencode-autopilot-v1.2.0...opencode-autopilot-v1.2.1) (2026-04-02)


### Bug Fixes

* address PR [#25](https://github.com/kodrunhq/opencode-autopilot/issues/25) review comments ([3c5d186](https://github.com/kodrunhq/opencode-autopilot/commit/3c5d1868f9b1b6ecd19a5ce7c7ca8569942797c3))

## [1.2.0](https://github.com/kodrunhq/opencode-autopilot/compare/opencode-autopilot-v1.1.3...opencode-autopilot-v1.2.0) (2026-04-02)


### Features

* add interactive CLI configure wizard with searchable model selection ([4c822fb](https://github.com/kodrunhq/opencode-autopilot/commit/4c822fbe857d68fb6f52dc2742ab6092f33c62cc))


### Bug Fixes

* address PR review — dirname for ensureDir, access-before-copy, keep currentAssignment key ([84b82c1](https://github.com/kodrunhq/opencode-autopilot/commit/84b82c1186a887616879f1614e42f5abb34a80e2))
* compact tool output to prevent OpenCode truncation ([6bd0901](https://github.com/kodrunhq/opencode-autopilot/commit/6bd090113695b53007ef29221fc9e1fd1dbe93cf))
* compact tool output to prevent truncation, force-update command files ([6552b28](https://github.com/kodrunhq/opencode-autopilot/commit/6552b282bdd6338d8a42869b95223961fead7a32))

## [1.1.3](https://github.com/kodrunhq/opencode-autopilot/compare/opencode-autopilot-v1.1.2...opencode-autopilot-v1.1.3) (2026-04-02)


### Bug Fixes

* pre-format model list in tool response to prevent LLM summarization ([b0f12e7](https://github.com/kodrunhq/opencode-autopilot/commit/b0f12e74cd87b3ffd58503cecc7e3a9036e5ccf7))
* return pre-formatted model list from oc_configure start ([42d82fd](https://github.com/kodrunhq/opencode-autopilot/commit/42d82fdad6854b5c2e041d7192d0f37a17dc6123))

## [1.1.2](https://github.com/kodrunhq/opencode-autopilot/compare/opencode-autopilot-v1.1.1...opencode-autopilot-v1.1.2) (2026-04-02)


### Bug Fixes

* rewrite oc-configure instructions to show all models and collect fallbacks ([8988b60](https://github.com/kodrunhq/opencode-autopilot/commit/8988b60f86adb5ab23327655c79582a49c110ad6))
* show all models and collect fallbacks in oc-configure ([4934a05](https://github.com/kodrunhq/opencode-autopilot/commit/4934a05f9d80546e1c9fc22e720746696fcce175))
* use real provider IDs in examples, remove ambiguous reference option ([fe66f12](https://github.com/kodrunhq/opencode-autopilot/commit/fe66f1204f0556081b3c3b89d3ed9248a51d6db4))

## [1.1.1](https://github.com/kodrunhq/opencode-autopilot/compare/opencode-autopilot-v1.1.0...opencode-autopilot-v1.1.1) (2026-04-02)


### Bug Fixes

* guard against sync failures and race condition in provider discovery ([d07d192](https://github.com/kodrunhq/opencode-autopilot/commit/d07d1923075aae98a545fbf0772ca101ca707a17))
* make provider discovery non-blocking to prevent plugin init hang ([2b374ec](https://github.com/kodrunhq/opencode-autopilot/commit/2b374ecb7fc2ab46b9c345b140aa32e5dc7af2ba))
* non-blocking provider discovery to prevent startup hang ([b76238a](https://github.com/kodrunhq/opencode-autopilot/commit/b76238ab924f6165ee44e894b799eeb82e1e7997))

## [1.1.0](https://github.com/kodrunhq/opencode-autopilot/compare/opencode-autopilot-v1.0.0...opencode-autopilot-v1.1.0) (2026-04-02)


### Features

* **01-01:** add placeholder tool and plugin entry point with tests ([5016149](https://github.com/kodrunhq/opencode-autopilot/commit/50161492178eb71b62c4cf9c95d7bb516a997838))
* **01-01:** scaffold npm package with utility modules and tests ([5390a93](https://github.com/kodrunhq/opencode-autopilot/commit/5390a9385462997a55660f7e18f95b176ec32cf7))
* **01-02:** add config module and asset installer with tests ([11bacb6](https://github.com/kodrunhq/opencode-autopilot/commit/11bacb6e6d3470f3c506d53a90ee0780e24836a3))
* **01-02:** wire installer into plugin entry, add bundled assets ([dfd2323](https://github.com/kodrunhq/opencode-autopilot/commit/dfd23234f81eacd6d14c3f91b58e4aeb4749a7ba))
* **02-01:** add name validators and yaml dependency ([295850c](https://github.com/kodrunhq/opencode-autopilot/commit/295850c3af8c3fc019609984703b7816b21e7d09))
* **02-01:** add template generation for agents, skills, and commands ([34d9ea7](https://github.com/kodrunhq/opencode-autopilot/commit/34d9ea79b0cf8cd4c3ff864251fca9137468e0d3))
* **02-02:** implement creation tools for agents, skills, and commands ([a5e5e30](https://github.com/kodrunhq/opencode-autopilot/commit/a5e5e30ca0c573e71dbbf870af10f1b2305719d8))
* **02-02:** register creation tools and add slash command files ([1700977](https://github.com/kodrunhq/opencode-autopilot/commit/1700977b8988db748c3412931bf3b817214515d2))
* **03-01:** implement 4 agent config modules and config hook barrel ([8d6aa0e](https://github.com/kodrunhq/opencode-autopilot/commit/8d6aa0e7317f9009de254f08bc924c6852e7b48a))
* **03-01:** wire config hook into plugin entry point ([24df6cd](https://github.com/kodrunhq/opencode-autopilot/commit/24df6cd43848efff6c5fa14614abdda3a689f658))
* **03-02:** add /review-pr command delegating to [@pr-reviewer](https://github.com/pr-reviewer) agent ([72d95b5](https://github.com/kodrunhq/opencode-autopilot/commit/72d95b5715a6060eb6c676f59bac9b59552dd856))
* **03-02:** add coding-standards skill with universal best practices ([26ed0ca](https://github.com/kodrunhq/opencode-autopilot/commit/26ed0cadf72f502564e2d65e293b9c4234d44e70))
* **04-01:** confidence ledger module with pure functions ([e994d45](https://github.com/kodrunhq/opencode-autopilot/commit/e994d45c046b137e394c03028a717da4a4e87d31))
* **04-01:** state persistence module with atomic writes ([5c8af9c](https://github.com/kodrunhq/opencode-autopilot/commit/5c8af9cec54d67dfc192cf0b6da47e545cedb86d))
* **04-01:** Zod schemas, types, and paths extension ([bc05525](https://github.com/kodrunhq/opencode-autopilot/commit/bc055255b3f2fa1e76cc035986203e32ff113b1c))
* **04-02:** config v2 schema with orchestrator/confidence namespaces and v1 auto-migration ([b74830a](https://github.com/kodrunhq/opencode-autopilot/commit/b74830a095f715d950d39623bc04ed25842d8ad0))
* **04-03:** phase transition module with state machine validation ([47f1e66](https://github.com/kodrunhq/opencode-autopilot/commit/47f1e66bb0317c4d8b0b8e158139f544bc7bc6b3))
* **04-03:** plan indexing and arena depth modules ([98b6578](https://github.com/kodrunhq/opencode-autopilot/commit/98b6578693f9236e45671e22aa7a387d22a22b37))
* **04-04:** oc_orchestrate tool, orchestrator agent, gitignore helper, plugin wiring ([bf36dc7](https://github.com/kodrunhq/opencode-autopilot/commit/bf36dc76841f55aeb4fe7f64de249c05d2376128))
* **04-04:** tool registrations for oc_state, oc_confidence, oc_phase, oc_plan ([4b062ac](https://github.com/kodrunhq/opencode-autopilot/commit/4b062ace33232eaed86557f15c806f8837f28860))
* **05-01:** agent catalog registry with 21 review agents ([801f0d7](https://github.com/kodrunhq/opencode-autopilot/commit/801f0d7b67ed2acac17bd73bc22088f5423d97c4))
* **05-01:** finding builder with deduplication and severity sorting ([2aae1a5](https://github.com/kodrunhq/opencode-autopilot/commit/2aae1a571d619a9c834d23c3c4c52bfd0e9ee509))
* **05-01:** review engine Zod schemas and types ([4fe49d5](https://github.com/kodrunhq/opencode-autopilot/commit/4fe49d5aed3815f9301805406e46c81141960c84))
* **05-01:** severity definitions with comparison and blocking check ([99e4aa0](https://github.com/kodrunhq/opencode-autopilot/commit/99e4aa085efb5db59c98babc3950e877941ba56f))
* **05-01:** stack gate filtering for technology-specific agents ([871875f](https://github.com/kodrunhq/opencode-autopilot/commit/871875f623a3c2fe9ba7224430aa7f4701d459b9))
* **05-01:** team selection logic combining catalog and stack gate ([b8a1043](https://github.com/kodrunhq/opencode-autopilot/commit/b8a1043cdbd080eb95e2cf183073c568ce5b6277))
* **05-02:** add 6 universal specialist review agent definitions ([ea22dbc](https://github.com/kodrunhq/opencode-autopilot/commit/ea22dbceb2f0372d4ea208ad96b078d23aa9ae30))
* **05-02:** add stage-3 agents, barrel export, and registry tests ([29d4703](https://github.com/kodrunhq/opencode-autopilot/commit/29d4703180ca2a655611160746112123218e0f82))
* **05-03:** add deterministic agent selection and cross-verification ([cdebf79](https://github.com/kodrunhq/opencode-autopilot/commit/cdebf79dba806f9cde2b70248a15fea1148fa455))
* **05-03:** add pipeline state machine and report builder ([16e7dee](https://github.com/kodrunhq/opencode-autopilot/commit/16e7dee478e18498bfa70b107be7e3f820ef2400))
* **05-04:** implement oc_review tool and register in plugin ([bb4f1bb](https://github.com/kodrunhq/opencode-autopilot/commit/bb4f1bba46db169176a082cbcecce7330ff400a0))
* **05-04:** implement review memory persistence and fix cycle ([7b25a89](https://github.com/kodrunhq/opencode-autopilot/commit/7b25a89952f1b6af46b24d42d51f5b130e31bdad))
* **06-01:** add 9 pipeline subagent configs and barrel export ([9af6e36](https://github.com/kodrunhq/opencode-autopilot/commit/9af6e36c1762a95486b43c62ac6134f8e1479539))
* **06-01:** add handler types, artifact module, and buildProgress schema ([5842a5e](https://github.com/kodrunhq/opencode-autopilot/commit/5842a5e5c81f1b7757b5288c83f41ab3912e90b5))
* **06-02:** add ARCHITECT handler with Arena multi-step logic ([c615a08](https://github.com/kodrunhq/opencode-autopilot/commit/c615a08a8b2ca203399f53065ddb5b3b8239817f))
* **06-02:** add RECON and CHALLENGE phase handlers with tests ([f9c1287](https://github.com/kodrunhq/opencode-autopilot/commit/f9c1287f4fbd35a6964d72755fc8d535db65b352))
* **06-03:** implement PLAN, SHIP, RETROSPECTIVE, EXPLORE handlers with tests ([4cd9d62](https://github.com/kodrunhq/opencode-autopilot/commit/4cd9d6239aff251b55c846297c58720eaec4cbe5))
* **06-04:** handler dispatch map and enhanced orchestrateCore ([f77a10c](https://github.com/kodrunhq/opencode-autopilot/commit/f77a10c675374181f5c79bdf66dec52d036e8bab))
* **06-04:** register pipeline agents in configHook ([c743d0a](https://github.com/kodrunhq/opencode-autopilot/commit/c743d0a61ee9d9faaa5e1bd7921a123cc7b7b07c))
* **07-01:** implement lesson memory module with schemas, types, and persistence ([b318a56](https://github.com/kodrunhq/opencode-autopilot/commit/b318a569a182e15fea95cdd4f1fb9d8d264e8187))
* **07-02:** enhanced retrospective handler with JSON parsing and lesson persistence ([3bf6f35](https://github.com/kodrunhq/opencode-autopilot/commit/3bf6f35396a48c541bd9afd0eeeb8fde6b07edf9))
* **07-02:** lesson injection into phase dispatch prompts ([ebfb4f4](https://github.com/kodrunhq/opencode-autopilot/commit/ebfb4f46639f0dd9037c0b3d7e6cf6e8fa2f3774))
* **07-03:** add failureContext schema and capture failure metadata in orchestrateCore ([bef5312](https://github.com/kodrunhq/opencode-autopilot/commit/bef5312909d7858a2c10fc2555b2c065ccd3adc2))
* **07-03:** create oc_forensics tool and register in plugin ([483f54d](https://github.com/kodrunhq/opencode-autopilot/commit/483f54ddce0189b01a11f1145fae5392a7de73ab))
* **08-01:** add coverage thresholds and tool registration smoke test ([fc53aee](https://github.com/kodrunhq/opencode-autopilot/commit/fc53aeeaddc2e470beb71dfa46b6026c1804c527))
* **08-02:** add GitHub Actions CI workflow ([9b2d909](https://github.com/kodrunhq/opencode-autopilot/commit/9b2d909199cbf9a96da924a96160ccce831c5bed))
* **09-01:** add fallback config schema and upgrade pluginConfigSchema to v3 ([4e039ef](https://github.com/kodrunhq/opencode-autopilot/commit/4e039ef6b5647460b3689198ab3c9448dfce7e22))
* **09-01:** add fallback types, error classifier, state machine, and message replay ([e8f9cd0](https://github.com/kodrunhq/opencode-autopilot/commit/e8f9cd0d9764f95699cfef38db2eda4980c7cf60))
* **09-02:** implement FallbackManager with concurrency guards and session lifecycle ([4413e99](https://github.com/kodrunhq/opencode-autopilot/commit/4413e99eb25d82ac207fa71771da5ce1ff10fac8))
* **09-02:** update barrel export and fix lint issues ([ddd0157](https://github.com/kodrunhq/opencode-autopilot/commit/ddd0157cf22f78167735b164a5d88a0c567a457c))
* **09-03:** add event, chat.message, and tool.execute.after handler factories ([d9c7c90](https://github.com/kodrunhq/opencode-autopilot/commit/d9c7c90ce79a38cba950a15894d26a2854f18cd9))
* **09-03:** wire fallback handlers into plugin entry and update barrel export ([8ace438](https://github.com/kodrunhq/opencode-autopilot/commit/8ace4380f2a382b71094b80e7640f9dfc6ad5f3d))
* **10-01:** rename orchestrator to autopilot, update modes and hidden flags ([bcc4866](https://github.com/kodrunhq/opencode-autopilot/commit/bcc486660a9bd185cf7b419bb9adeaf7b5ae7a2e))
* **10-01:** standardize severity levels to CRITICAL/HIGH/MEDIUM/LOW ([0f3530a](https://github.com/kodrunhq/opencode-autopilot/commit/0f3530a35321a9edac365ea6894f9780cebbff2b))
* **10-02:** rewrite all 10 pipeline agent prompts to 150+ word structured format ([881bbf4](https://github.com/kodrunhq/opencode-autopilot/commit/881bbf41b33703993389d575ce14e7d69217b1c7))
* **10-03:** implement skill injection module and enhance buildTaskPrompt ([51cdf0e](https://github.com/kodrunhq/opencode-autopilot/commit/51cdf0e437257b9b88761124894b59b090940e74))
* **10-03:** implement two-tier fallback chain resolution and config v3 fallback_models ([60646b2](https://github.com/kodrunhq/opencode-autopilot/commit/60646b2d91dfcdd0ce96f7dcaf4528acfd978cab))
* **10-04:** add 13 specialized review agents with stack-gated selection ([fefa8d8](https://github.com/kodrunhq/opencode-autopilot/commit/fefa8d878258733d2f9e94836fb83124937522bb))
* **10-04:** wire stack detection and all-agent selection into review pipeline ([9dc937b](https://github.com/kodrunhq/opencode-autopilot/commit/9dc937b21c3a76c144174f6148fb2e6749fca7cc))
* add /oc-configure command asset ([7900253](https://github.com/kodrunhq/opencode-autopilot/commit/790025314db3938558d851b704e85d1236006c26))
* add adversarial diversity checker for model group assignments ([325ce94](https://github.com/kodrunhq/opencode-autopilot/commit/325ce94968729bf6c25838d13ea20b85f86c4cc9))
* add CLI installer and doctor commands ([faf2bc9](https://github.com/kodrunhq/opencode-autopilot/commit/faf2bc97640212438c144ddb8c054c2baf660316))
* add config schema v4 with groups/overrides and v3→v4 migration ([523393d](https://github.com/kodrunhq/opencode-autopilot/commit/523393d42377a871eb4cbbc20ac9bb5f78114b99))
* add declarative agent group registry with definitions and diversity rules ([8ceab8a](https://github.com/kodrunhq/opencode-autopilot/commit/8ceab8a39fc74e0fa0742e7061124fa63a36eccf))
* add model resolver with override &gt; group &gt; null precedence ([7a874a5](https://github.com/kodrunhq/opencode-autopilot/commit/7a874a5587a3d7e3aafd0ba780025344bb5644c7))
* add oc_configure tool with start/assign/commit/doctor/reset subcommands ([4f35cad](https://github.com/kodrunhq/opencode-autopilot/commit/4f35cad7c56cbf3897ee4a5ca55e986c5dffdfe2))
* add registry type definitions for model groups ([4e5c931](https://github.com/kodrunhq/opencode-autopilot/commit/4e5c931ef73b637c0978da81398335e5d6672a08))
* configHook resolves models from group registry ([4fd315e](https://github.com/kodrunhq/opencode-autopilot/commit/4fd315e4ca79eb8061cb2acc0dcaa23c1c460588))
* installer, model groups & configuration UX ([13e1b5e](https://github.com/kodrunhq/opencode-autopilot/commit/13e1b5eca6f61fde54a51f69afe028d7d09b2249))
* model fallback integration (Phase 9) ([1543377](https://github.com/kodrunhq/opencode-autopilot/commit/15433773a56c37a0838a51167fd443dc1262fe6c))
* Phase 1 — Plugin Infrastructure ([f642447](https://github.com/kodrunhq/opencode-autopilot/commit/f6424478b35a722fcfdc6a49464b0d0384b61ad8))
* Phase 10 — UX polish, metaprompting, fallback resolution, smart review selection ([16092a3](https://github.com/kodrunhq/opencode-autopilot/commit/16092a352fa9054d592c4e1ac7c3d534e9d42eb4))
* Phase 2 — Creation Tooling ([552c097](https://github.com/kodrunhq/opencode-autopilot/commit/552c0979b29eedb4e03acf1814d7006449e276eb))
* Phase 3 — Curated Assets ([2b39924](https://github.com/kodrunhq/opencode-autopilot/commit/2b39924114b65e1d5d6428095f8e723fa6bb9980))
* Phase 4 — Foundation Infrastructure for Autonomous Orchestrator ([eccfd4c](https://github.com/kodrunhq/opencode-autopilot/commit/eccfd4cf757fc8e9c91bc6e839ecc4bdcbce5840))
* Phase 5 — Review Engine (multi-agent code review) ([9816ab9](https://github.com/kodrunhq/opencode-autopilot/commit/9816ab965b2a3c5d69993224a5489f09c546018b))
* Phase 6 — Orchestrator Pipeline (8-phase autonomous SDLC) ([34deef2](https://github.com/kodrunhq/opencode-autopilot/commit/34deef2ec657f5f7fd0d3f0b35bff7861572b3ec))
* Phase 7 — Learning & Resilience (institutional memory + forensics) ([25e7346](https://github.com/kodrunhq/opencode-autopilot/commit/25e7346e5a7ed696809c0448ee2134059599f5e2))
* Phase 8 — Testing & CI pipeline ([8d6d19a](https://github.com/kodrunhq/opencode-autopilot/commit/8d6d19a369be5c172a296d2d10c4fcf65675af4c))
* wire oc_configure, remove placeholder, add first-load toast ([1931765](https://github.com/kodrunhq/opencode-autopilot/commit/19317651b13b479606e0d12b7f69b405a3d2ddcc))


### Bug Fixes

* **04-03:** lint and format cleanup for orchestrator modules ([e084723](https://github.com/kodrunhq/opencode-autopilot/commit/e08472390b20cd511360ad0734045b8b6c7f3482))
* **04:** address review findings (patch allowlist, DRY paths, immutability, schema bounds, atomic config) ([d0da334](https://github.com/kodrunhq/opencode-autopilot/commit/d0da334ba04cbdcc0712a91bd7d731cb72f35687))
* **05:** address Copilot PR review comments ([4f72417](https://github.com/kodrunhq/opencode-autopilot/commit/4f72417a341796e578789036a1ed14964e95557e))
* **05:** address review findings (schema alignment, pipeline wiring, dead code, security hardening) ([aa94771](https://github.com/kodrunhq/opencode-autopilot/commit/aa94771ca6369cef29ed1427d625f2f8b8be0740))
* **05:** address second round Copilot PR review comments ([4d7df97](https://github.com/kodrunhq/opencode-autopilot/commit/4d7df97f28d161c4accce494ce1740148bc8237f))
* **06:** address PR review — dispatch_multi tracking, resume safety, stale comment ([dbd9470](https://github.com/kodrunhq/opencode-autopilot/commit/dbd9470ffe859532cda3e72a29126749700687ce))
* **06:** address review findings (critical parse, type safety, prompt sanitization, least privilege) ([49d2f2a](https://github.com/kodrunhq/opencode-autopilot/commit/49d2f2a196ad055c2a8cddb8b2bb7f6eb9b9531c))
* **07:** ACE review fixes (phase guard, type safety, prompt clarity, test coverage, error detail) ([f816dc8](https://github.com/kodrunhq/opencode-autopilot/commit/f816dc86fed1a7457dbc59349284af8499452df5))
* **07:** address PR review — forensics error handling, lesson recovery, roadmap sync ([0c60f42](https://github.com/kodrunhq/opencode-autopilot/commit/0c60f42a69aa04c2e6ada440a6b325bd987dd8f3))
* **07:** address PR review round 2 — path scrubbing, I/O dedup, freeze consistency ([37b876e](https://github.com/kodrunhq/opencode-autopilot/commit/37b876e9eadda1fd8bb9c5a26c1e0424943e25d1))
* **07:** address review findings (prune overflow, sourcePhase enum, sanitization, error paths) ([7761274](https://github.com/kodrunhq/opencode-autopilot/commit/77612748cb8291a79185b38e1d41c7232f5cb9d8))
* **08-01:** resolve all TypeScript type errors across codebase ([78c2076](https://github.com/kodrunhq/opencode-autopilot/commit/78c2076ab2126dfe1d509273a424ba6fe356f0e0))
* **08:** address PR review — prompt type, coverage threshold, doc alignment ([7e02371](https://github.com/kodrunhq/opencode-autopilot/commit/7e023714c9282e468e343a3caed5be7f7a5d1a76))
* **08:** address review round 2 — bail syntax, coverage keys, state counters ([5d9ac57](https://github.com/kodrunhq/opencode-autopilot/commit/5d9ac5741d0a66bb2dec7fa815f7778c9ef50661))
* **08:** address review squad findings — CI hardening, test quality, doc consistency ([0855f02](https://github.com/kodrunhq/opencode-autopilot/commit/0855f02c80edd47f631cda650832e19e0b9880e1))
* **08:** remove coverage thresholds — Bun enforces per-file, not aggregate ([b5ec4d3](https://github.com/kodrunhq/opencode-autopilot/commit/b5ec4d367d4a3573aadc1c9bc3ffc39082a4e92e))
* **09:** add missing 09-02 dependency to Plan 03, move to wave 3 ([7547e97](https://github.com/kodrunhq/opencode-autopilot/commit/7547e97c8114a3ffdb610d1d2f01e24af04f0b66))
* **09:** address PR review — parentID null guard, TTFT enabled gate, test accuracy ([46542fb](https://github.com/kodrunhq/opencode-autopilot/commit/46542fb4d61e495b8b735fb1c01d6fbc4a8bcc80))
* **09:** address review round 1 — security, concurrency, correctness, test coverage ([161e9ff](https://github.com/kodrunhq/opencode-autopilot/commit/161e9ff07a4019b58c62bac91b06f884aa9cb676))
* **09:** move markAwaitingResult inside dispatch block, format tests ([cd058cd](https://github.com/kodrunhq/opencode-autopilot/commit/cd058cda8bebc9d6ab7efea874605d15ba202dd9))
* **10-02:** fix base agent prompt issues (paths, constraints, skill references) ([173bdf8](https://github.com/kodrunhq/opencode-autopilot/commit/173bdf82774e9e9da7f0dc2a68a19c82694a038d))
* **10:** address PR review — cwd for git, --root for diff-tree, derive stage3 names, fix roadmap status ([d17a126](https://github.com/kodrunhq/opencode-autopilot/commit/d17a126231d67c0bd9002fe2580f0ee95dae0838))
* **10:** address review round 1 — agentName forwarding, string filtering, prompt identity, stack detection, branch scope ([e53893f](https://github.com/kodrunhq/opencode-autopilot/commit/e53893f2e6747670431fbb7a31c5a0fa1b8fc442))
* **10:** update remaining test severity values from WARNING/NITPICK to HIGH/LOW ([153c08e](https://github.com/kodrunhq/opencode-autopilot/commit/153c08e3c3c86023570520eea8ef32ecec51c2de))
* address ACE review — logic bug, error handling, type safety, test assertions ([055a83e](https://github.com/kodrunhq/opencode-autopilot/commit/055a83ed248f167f7c1f58a9815e0f78500925b9))
* address code quality and security review findings ([1853b1b](https://github.com/kodrunhq/opencode-autopilot/commit/1853b1bdfa10202e211da0052f408e60bb0db037))
* address Copilot PR review comments ([cb5dff2](https://github.com/kodrunhq/opencode-autopilot/commit/cb5dff2d2b9d420d13db27b164b15d341dd5cfec))
* address PR review — diversity rule logic, group key validation, unused imports, CI exit code ([4283af7](https://github.com/kodrunhq/opencode-autopilot/commit/4283af75de8162b1dd3a6db6a6d58cbf228b08f6))
* address PR review — reset clears providers, rename variable, surface cleanup errors, test isolation ([3e0572c](https://github.com/kodrunhq/opencode-autopilot/commit/3e0572cc6bdc6e4a3bbf66a6c64248f75a05cd62))
* address PR review comments (hermetic tests, path portability, DRY config, graceful errors) ([ef47abf](https://github.com/kodrunhq/opencode-autopilot/commit/ef47abf2bfce3035c88fad46969a2a3b12c08aca))
* address review findings (immutability, atomic writes, validation, security) ([1106ecc](https://github.com/kodrunhq/opencode-autopilot/commit/1106ecca01a19cb16f918d85011b2dd5cc49650c))
* address review findings (immutability, permissions, security hardening) ([a51d888](https://github.com/kodrunhq/opencode-autopilot/commit/a51d888e7b4262dd0c0732b57a579d8d7e7c0ce1))
* address review findings (immutability, validation, security, tests) ([c83d2c0](https://github.com/kodrunhq/opencode-autopilot/commit/c83d2c0ee50a234d52f6ef6e6971f78a76ebe767))
* **ci:** add NPM_TOKEN for publish authentication (provenance handles signing separately) ([eea2ddb](https://github.com/kodrunhq/opencode-autopilot/commit/eea2ddb018684bd1116f465a396c2f310ae6853b))
* **ci:** remove npm cache — project uses bun.lock, not package-lock.json ([830e912](https://github.com/kodrunhq/opencode-autopilot/commit/830e912022b55f684ac44393d8f19df4fad00edd))
* **ci:** remove npm self-upgrade step — Node 22 npm already supports OIDC ([63e8972](https://github.com/kodrunhq/opencode-autopilot/commit/63e89724ccd3bd38eb6e8f70c9a716e5ef88f5fd))
* **ci:** reorder steps — Node + npm upgrade before Bun, remove NODE_AUTH_TOKEN (use OIDC) ([322941e](https://github.com/kodrunhq/opencode-autopilot/commit/322941e6ea69d1e4974bdeb6acaf1cac5eba49f9))
* **ci:** update action SHAs to match kodrunhq/claudefy ([21c0505](https://github.com/kodrunhq/opencode-autopilot/commit/21c0505b9d77138d2baf580f98b99b6d12a4a88f))
* **ci:** use npx npm@latest for publish instead of self-upgrading npm ([121930a](https://github.com/kodrunhq/opencode-autopilot/commit/121930a44be88908c8017f3e6eddfe25645b9fd8))
* deep freeze registry data, derive ALL_GROUP_IDS, replace unsafe casts, freeze assignments ([4be6cfe](https://github.com/kodrunhq/opencode-autopilot/commit/4be6cfec2d9605aa94046c0f05c0af8961b666ef))
* deep-copy permission in config hook, handle optional prompt in tests ([b56305b](https://github.com/kodrunhq/opencode-autopilot/commit/b56305b4f3c4645f5040f54395672e0fc89cdf45))
* format and lint cleanup for Phase 3 files ([9cbc233](https://github.com/kodrunhq/opencode-autopilot/commit/9cbc2333b76761bfa71a352b2991e72d0a44c5fd))
* installer UX bugs — model discovery, deprecated assets, command agent, guide flow ([eb24628](https://github.com/kodrunhq/opencode-autopilot/commit/eb24628b6052c9347cfa5b71633a5ece4a74fac4))
* model discovery via provider API, deprecated asset cleanup, command agent field ([e5d2598](https://github.com/kodrunhq/opencode-autopilot/commit/e5d25989a3b91ae0af661d0ca5851aec04d46b8b))
* update biome config, fix lint warnings, format all files ([28e0b00](https://github.com/kodrunhq/opencode-autopilot/commit/28e0b003edc7576f9ffa5e9f3357a4a8a6fd7dde))
* use MAX_NAME_LENGTH constant in error messages instead of hardcoded value ([72bbe84](https://github.com/kodrunhq/opencode-autopilot/commit/72bbe8463bcc16cd71242a471bb92047f8cd1eac))
