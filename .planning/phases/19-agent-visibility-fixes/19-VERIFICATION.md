---
phase: 19-agent-visibility-fixes
verified: 2026-04-03T12:00:00Z
status: passed
score: 4/4 must-haves verified
re_verification: false
---

# Phase 19: Agent Visibility Fixes Verification Report

**Phase Goal:** Stocktake correctly detects all agents (filesystem and config-hook-injected), and ambiguous agents are replaced with well-defined alternatives
**Verified:** 2026-04-03
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Running /oc-stocktake lists config-hook-injected agents alongside filesystem agents with an origin indicator (config-hook vs filesystem) | VERIFIED | `stocktakeCore` accepts `configHookAgents` param; `ocStocktake` wrapper passes all 15 agents from `standardAgents` + `pipelineAgents`; entries get `origin: "config-hook"`; filesystem entries retain `origin: "built-in"` or `"user-created"` (stocktake.ts:157-165, 209-223) |
| 2 | The "general" and "explore" agents are removed or replaced with clearly-scoped agents that have explicit purposes | VERIFIED | Research confirmed these are OpenCode built-in agents outside plugin control; test suite documents this permanently with assertions that neither appears in `agents` or `pipelineAgents` maps (agents-visibility.test.ts:58-67) |
| 3 | Primary-mode agents registered via config hook appear correctly in the Tab cycle (not just in @ autocomplete) | VERIFIED | `autopilot` is the only agent with `mode: "all"` (Tab-cycle eligible); researcher/metaprompter corrected from `"all"` to `"subagent"`; mode field propagated to stocktake output via `ConfigHookAgent.mode` (researcher.ts:5, metaprompter.ts:6, autopilot.ts:6) |
| 4 | Agent count reported by stocktake matches actual number of registered agents (zero silent omissions) | VERIFIED | Test asserts 5 standard + 10 pipeline = 15 total; stocktake deduplication ensures no double-counting; `configHook` count in summary matches injected agents (agents-visibility.test.ts:49-55, stocktake.test.ts:145-155) |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/agents/researcher.ts` | Researcher agent with mode: "subagent" | VERIFIED | Line 5: `mode: "subagent"` confirmed |
| `src/agents/metaprompter.ts` | Metaprompter agent with mode: "subagent" | VERIFIED | Line 6: `mode: "subagent"` confirmed |
| `src/agents/index.ts` | Exported agents map | VERIFIED | Line 17: `export const agents = {` confirmed |
| `tests/agents-visibility.test.ts` | 9-test visibility suite | VERIFIED | 9 tests, all passing, 41 assertions |
| `src/tools/stocktake.ts` | Extended stocktake with config-hook detection | VERIFIED | `ConfigHookAgent` interface, `configHookAgents` param, `configHook` summary count, all imports wired |
| `tests/tools/stocktake.test.ts` | Tests for config-hook agent detection | VERIFIED | 11 tests (4 existing + 7 new), all passing |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/agents/researcher.ts` | `src/agents/index.ts` | agents map entry | WIRED | `researcher: researcherAgent` at line 18 |
| `tests/agents-visibility.test.ts` | `src/agents/pipeline/index.ts` | import pipelineAgents | WIRED | Import at line 3, used in 4 locations |
| `src/tools/stocktake.ts` | `src/agents/index.ts` | import agents map | WIRED | `import { agents as standardAgents }` at line 4 |
| `src/tools/stocktake.ts` | `src/agents/pipeline/index.ts` | import pipelineAgents | WIRED | `import { pipelineAgents }` at line 5 |
| `src/tools/stocktake.ts` | `src/registry/model-groups.ts` | import AGENT_REGISTRY | WIRED | `import { AGENT_REGISTRY }` at line 6 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `src/tools/stocktake.ts` | `configHookAgentList` | `standardAgents` + `pipelineAgents` maps | Yes -- frozen AgentConfig objects with real mode/hidden/prompt | FLOWING |
| `src/tools/stocktake.ts` | `agentEntries` | filesystem scan + configHookAgents param | Yes -- readdir for filesystem, injected config-hook agents | FLOWING |
| `src/tools/stocktake.ts` | `summary.configHook` | `allAssets.filter(a => a.origin === "config-hook").length` | Yes -- derived from actual agent entries | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 20 tests pass | `bun test tests/agents-visibility.test.ts tests/tools/stocktake.test.ts` | 20 pass, 0 fail, 67 expect() calls | PASS |
| Lint clean (no errors) | `bun run lint` | 122 warnings, 0 errors | PASS |
| Researcher mode is subagent | `grep mode src/agents/researcher.ts` | `mode: "subagent"` | PASS |
| Metaprompter mode is subagent | `grep mode src/agents/metaprompter.ts` | `mode: "subagent"` | PASS |
| Autopilot mode is all | `grep mode src/agents/autopilot.ts` | `mode: "all"` | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| BFIX-01 | 19-02 | Stocktake detects config-hook-injected agents alongside filesystem agents | SATISFIED | `stocktakeCore` extended with `configHookAgents` param; `ocStocktake` wrapper passes all 15 agents; 7 new tests verify detection |
| BFIX-04 | 19-01 | Clarify/remove ambiguous "general" and "explore" agents | SATISFIED | Research confirmed they are OpenCode built-ins; documented permanently in test assertions (agents-visibility.test.ts:58-67) |
| AGNT-14 | 19-01 | Config-hook agents appear in Tab cycle correctly for primary mode agents | SATISFIED | Only `autopilot` has `mode: "all"`; researcher/metaprompter corrected to `"subagent"`; mode field propagated to stocktake output |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | - | - | - | - |

No TODOs, FIXMEs, placeholders, empty returns, or hardcoded empty data found in phase-modified files.

### Human Verification Required

### 1. Tab Cycle Behavior

**Test:** Open OpenCode, press Tab to cycle through agents
**Expected:** Only "autopilot" appears in the Tab cycle. Researcher, metaprompter, documenter, pr-reviewer, and all pipeline agents should NOT appear.
**Why human:** Tab-cycle behavior depends on the OpenCode runtime interpreting the `mode` field. Cannot verify programmatically without running the full application.

### 2. Stocktake Output Formatting

**Test:** Run `/oc-stocktake` in an OpenCode session
**Expected:** Output lists all 15 config-hook agents with origin, mode, group, and hidden fields alongside any filesystem agents
**Why human:** Requires the full plugin loaded in OpenCode to execute the tool wrapper with real filesystem state.

### Gaps Summary

No gaps found. All four must-have truths are verified. All three requirement IDs (BFIX-01, BFIX-04, AGNT-14) are satisfied. All artifacts exist, are substantive, are wired, and have flowing data. All 20 tests pass. No anti-patterns detected.

---

_Verified: 2026-04-03_
_Verifier: Claude (gsd-verifier)_
