# Phase 20: New Primary Agents - Research

**Researched:** 2026-04-03
**Domain:** OpenCode agent registration, Tab-cycle ordering, prompt design with embedded skills
**Confidence:** HIGH

## Summary

This phase adds three new primary agents (Debugger, Planner, Code Reviewer) to the plugin's agent map alongside the existing Autopilot. Each agent embeds its relevant skill content directly in its prompt as a template literal (no runtime I/O), uses `mode: "all"` for Tab-cycle visibility, and has role-scoped permissions.

The critical discovery from researching OpenCode source code is that **Tab-cycle ordering is alphabetical by agent name**, with the default agent (or "build" if unconfigured) placed first. The chosen names -- `autopilot`, `debugger`, `planner`, `reviewer` -- already sort alphabetically in the desired order (a < d < p < r), confirming that D-04's prediction is correct. No explicit ordering field exists in the AgentConfig schema; the open feature request (issue #16840) for a custom order field has not been implemented.

A secondary finding is that the SDK `AgentConfig.permission` type only explicitly types `edit`, `bash`, `webfetch`, `doom_loop`, and `external_directory`. However, the OpenCode runtime supports additional permissions (`read`, `write`, `glob`, `grep`, etc.) per official docs. Since most permissions default to `"allow"`, agents that need restrictive permissions must explicitly `deny` unneeded capabilities. The CONTEXT decisions for `read: allow` are unnecessary (already the default); `write: allow` maps to `edit: "allow"` (which covers edit+write+patch+multiedit per OpenCode docs).

**Primary recommendation:** Create three agent source files following the `autopilot.ts` pattern, each embedding skill content as template literals in the prompt, using `mode: "all"`, and with SDK-typed permission objects that `deny` unneeded tools rather than `allow` already-default ones.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Embed skill content statically in each agent's source file as template literal content. No file I/O at load time, no runtime dependency on the adaptive injector. Debugger embeds `systematic-debugging`, Planner embeds `plan-writing` + `plan-executing`, Reviewer embeds `code-review`.
- **D-02:** Skills are copy-pasted into agent source, not read from `assets/skills/` at runtime. If a skill changes, the corresponding agent source must be updated too. This trades DRY for simplicity and zero I/O.
- **D-03:** Research OpenCode source code to understand the exact Tab-cycle ordering mechanism before committing to a strategy. This is a prerequisite task -- don't assume insertion order or alphabetical.
- **D-04:** If OpenCode sorts alphabetically, accept the natural order of the chosen names. The names autopilot/debugger/planner/reviewer already sort alphabetically in the desired order (a < d < p < r).
- **D-05:** Use plain names: `debugger`, `planner`, `reviewer`. Consistent with existing user-facing agents (researcher, metaprompter, documenter, autopilot). No `oc-` prefix -- that's reserved for pipeline agents.
- **D-06:** Keep the existing `pr-reviewer` subagent alongside the new `reviewer` primary agent. Different scopes: `reviewer` is interactive code review with oc_review tool invocation; `pr-reviewer` is GitHub PR-specific review via gh commands. No overlap.
- **D-07:** Debugger -- `read: allow`, `bash: allow`, `edit: allow`. Can inspect code, run tests/reproduce bugs, and apply fixes. No write (new files) or webfetch.
- **D-08:** Planner -- `read: allow`, `write: allow`, `bash: allow`. Can analyze codebase, run read-only commands for context (git log, ls, etc.), and write plan files. No edit or webfetch.
- **D-09:** Reviewer -- `read: allow`, `bash: allow`. Can read code and run git/oc_review commands. No edit (review only, no fixes), no write, no webfetch.
- **D-10:** Code Reviewer agent auto-invokes oc_review tool when the user asks for a review. Fully autonomous like the Autopilot pattern -- no guidance-only mode.
- **D-11:** All three agents use `mode: "all"` to appear in both Tab cycle and @ autocomplete.

### Claude's Discretion
- Exact prompt content for each agent (within the skill-embedded, role-scoped constraints)
- `maxSteps` value for each agent (Autopilot uses 50 -- new agents likely need fewer)
- Whether to add `temperature` settings
- Internal structure of agent source files (single export vs helper functions)
- How Planner structures its output (markdown plan files vs inline guidance)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AGNT-10 | Primary Debugger agent visible in Tab cycle, loads systematic-debugging skill | Agent config with `mode: "all"`, skill embedded as template literal (~15K chars). Tab visibility confirmed via OpenCode source: non-subagent, non-hidden agents appear in cycle. |
| AGNT-11 | Primary Planner agent visible in Tab cycle, loads plan-writing + plan-executing skills | Agent config with `mode: "all"`, two skills embedded (~26K chars combined). Same visibility mechanism. |
| AGNT-12 | Primary Code Reviewer agent visible in Tab cycle, loads code-review skill and invokes oc_review | Agent config with `mode: "all"`, skill embedded (~10K chars). Prompt instructs auto-invocation of `oc_review` tool. |
| AGNT-13 | Primary agents registered with intentional Tab-cycle ordering (Autopilot first, then Debugger, Planner, Reviewer) | OpenCode sorts agents alphabetically after default agent. Names autopilot/debugger/planner/reviewer sort correctly: a < d < p < r. No code changes needed for ordering -- naming alone ensures correct cycle. |
</phase_requirements>

## Standard Stack

No new dependencies required. This phase is pure content creation using existing patterns.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @opencode-ai/sdk | (existing) | AgentConfig type for type-safe agent definitions | Already in use by all agents |
| @opencode-ai/plugin | (existing) | Plugin registration infrastructure | Already in use |

### Supporting
None -- no new libraries needed. This is a content-only phase.

## Architecture Patterns

### Recommended Project Structure
```
src/agents/
  autopilot.ts        # Existing primary agent (reference pattern)
  debugger.ts         # NEW - Primary debugger agent
  planner.ts          # NEW - Primary planner agent
  reviewer.ts         # NEW - Primary code reviewer agent
  researcher.ts       # Existing subagent (unchanged)
  metaprompter.ts     # Existing subagent (unchanged)
  documenter.ts       # Existing subagent (unchanged)
  pr-reviewer.ts      # Existing subagent (unchanged, coexists with reviewer)
  index.ts            # MODIFY - Add 3 new entries to agents map
  pipeline/            # Existing pipeline subagents (unchanged)
```

### Pattern 1: Primary Agent Definition
**What:** Each primary agent is a single exported `Readonly<AgentConfig>` object, frozen with `Object.freeze()`, containing the full prompt as a template literal.
**When to use:** All three new agents follow this pattern.
**Example:**
```typescript
// Source: src/agents/autopilot.ts (existing reference)
import type { AgentConfig } from "@opencode-ai/sdk";

export const debuggerAgent: Readonly<AgentConfig> = Object.freeze({
    description: "Systematic bug diagnosis using the 4-phase debugging methodology: Reproduce, Isolate, Diagnose, Fix",
    mode: "all",
    maxSteps: 25,
    prompt: `You are the debugger agent. You apply a systematic 4-phase debugging methodology...

<embedded-skill>
## Systematic Debugging
[Full SKILL.md content embedded here as template literal]
</embedded-skill>

## Rules
...`,
    permission: {
        edit: "allow",
        bash: "allow",
        webfetch: "deny",
    } as const,
});
```

### Pattern 2: Agent Map Registration
**What:** New agents are added to the `agents` map in `src/agents/index.ts`. Order in the map does not affect Tab cycle (OpenCode sorts alphabetically), but maintaining alphabetical order in the source improves readability.
**When to use:** When adding entries to the agents const.
**Example:**
```typescript
import { debuggerAgent } from "./debugger";
import { plannerAgent } from "./planner";
import { reviewerAgent } from "./reviewer";

export const agents = {
    autopilot: autopilotAgent,
    debugger: debuggerAgent,
    documenter: documenterAgent,
    metaprompter: metaprompterAgent,
    planner: plannerAgent,
    "pr-reviewer": prReviewerAgent,
    researcher: researcherAgent,
    reviewer: reviewerAgent,
} as const;
```

### Pattern 3: Skill Embedding in Prompts
**What:** Skill content is copy-pasted into the agent's prompt template literal, wrapped in a clear section delimiter. No runtime file reads.
**When to use:** Per D-01/D-02 -- all three new agents.
**Example:**
```typescript
prompt: `You are the planner agent...

## Your Methodology

<skill name="plan-writing">
[Full content of assets/skills/plan-writing/SKILL.md minus YAML frontmatter]
</skill>

<skill name="plan-executing">
[Full content of assets/skills/plan-executing/SKILL.md minus YAML frontmatter]
</skill>

## Rules
...`,
```

### Anti-Patterns to Avoid
- **Runtime skill loading in agent prompts:** D-01 explicitly forbids this. No `readFile()`, no adaptive injector dependency.
- **Using `mode: "primary"` instead of `mode: "all"`:** D-11 says all three use `mode: "all"` to appear in both Tab cycle AND @ autocomplete. `mode: "primary"` only shows in Tab cycle.
- **Adding unnecessary `read: "allow"` to permissions:** The SDK type does not have a `read` field on the permission object. Since `read` defaults to `allow` in OpenCode, omit it.
- **Mutating agent configs:** Always use `Object.freeze()` per project pattern.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Agent registration | Custom registration logic | Existing `registerAgents()` in `src/agents/index.ts` | Already handles model resolution, deep-copy, and user-override protection |
| Tab-cycle ordering | Custom ordering mechanism | Alphabetical agent names | OpenCode sorts alphabetically; the chosen names naturally sort correctly |
| Skill content loading | Runtime file reader | Static template literal embedding | D-01/D-02 decision; zero I/O, no failure modes |

## Common Pitfalls

### Pitfall 1: Permission Type Mismatch
**What goes wrong:** CONTEXT decisions D-07/D-08/D-09 reference `read: "allow"` and `write: "allow"` which are not fields on the SDK `AgentConfig.permission` type. Using them would cause TypeScript errors.
**Why it happens:** OpenCode runtime supports more permissions than the SDK type exposes (`read`, `write`, `glob`, `grep`, `list`, `task`, `skill`, `lsp`, `question`, `websearch`, `codesearch`). The SDK only types `edit`, `bash`, `webfetch`, `doom_loop`, `external_directory`.
**How to avoid:** Map CONTEXT decisions to SDK-typed fields:
- `read: allow` -> omit (default is allow)
- `write: allow` -> `edit: "allow"` (edit permission covers write+edit+patch+multiedit per OpenCode docs)
- `edit: allow` -> `edit: "allow"`
- `bash: allow` -> `bash: "allow"`
- "No webfetch" -> `webfetch: "deny"`
- "No edit" (Reviewer D-09) -> `edit: "deny"`
**Warning signs:** TypeScript compilation errors on the permission object.

### Pitfall 2: Test Count Assertions Break
**What goes wrong:** The existing `agents-visibility.test.ts` asserts exactly 5 standard agents and 15 total. Adding 3 new agents will break these assertions.
**Why it happens:** Hard-coded count assertions in tests.
**How to avoid:** Update test assertions to expect 8 standard agents and 18 total. Also update the test that asserts "no standard agent other than autopilot has mode 'all'" since now 3 more agents will have `mode: "all"`.
**Warning signs:** `bun test tests/agents-visibility.test.ts` fails immediately.

### Pitfall 3: Planner Agent Name Collision with Pipeline oc-planner
**What goes wrong:** The new `planner` primary agent could be confused with the existing `oc-planner` pipeline subagent.
**Why it happens:** Both serve planning functions but at different levels (interactive primary vs. pipeline subagent).
**How to avoid:** Per D-05, the primary uses `planner` (no prefix), while the pipeline agent is `oc-planner`. These are distinct keys in the agent map. The `registerAgents()` function handles both maps separately. No collision occurs.
**Warning signs:** None expected -- different names, different maps.

### Pitfall 4: Large Prompt Sizes
**What goes wrong:** Embedded skill content makes agent prompts very large. The Planner agent embeds ~26K chars of skill content. This consumes significant context window.
**Why it happens:** D-01/D-02 trades DRY for simplicity by embedding full skill content.
**How to avoid:** Strip YAML frontmatter from skill content when embedding (it adds no value in the prompt). Consider trimming the "Integration with Our Tools" and "Failure Modes" sections if they reference tools the agent doesn't have access to. Keep the core methodology intact.
**Warning signs:** Users report context overflow when using the Planner agent on large codebases.

### Pitfall 5: Default Agent Override
**What goes wrong:** If a user sets `default_agent: "debugger"` in their OpenCode config, the Tab cycle starts with debugger instead of autopilot.
**Why it happens:** OpenCode's sorting puts the default agent first, overriding alphabetical order.
**How to avoid:** This is expected behavior and not a bug. The plugin cannot control user's `default_agent` setting. Document that Tab cycle order assumes default agent is "build" or unset (the common case).
**Warning signs:** Users report different Tab ordering than expected.

## Code Examples

### Agent Source File (Debugger)
```typescript
// Source: Pattern derived from src/agents/autopilot.ts
import type { AgentConfig } from "@opencode-ai/sdk";

export const debuggerAgent: Readonly<AgentConfig> = Object.freeze({
    description: "Systematic bug diagnosis: Reproduce, Isolate, Diagnose, Fix -- with regression tests",
    mode: "all",
    maxSteps: 25,
    prompt: `You are the debugger agent. You apply a systematic 4-phase debugging methodology to find and fix bugs.

## How You Work

When the user reports a bug, error, or unexpected behavior, you follow the 4-phase process:
1. **Reproduce** -- Confirm the bug and create a minimal reproduction
2. **Isolate** -- Narrow the scope to the exact function/line
3. **Diagnose** -- Understand WHY the bug exists (not just WHERE)
4. **Fix** -- Write regression test first, then apply minimal fix

<skill name="systematic-debugging">
[SKILL.md content here, minus YAML frontmatter]
</skill>

## Rules

- ALWAYS follow the 4-phase process in order. Do not skip to Fix.
- ALWAYS write a regression test before applying the fix.
- Use bash to run tests, git bisect, and reproduce bugs.
- Use edit to apply fixes after diagnosis.
- NEVER make random changes hoping something works (shotgun debugging).
- NEVER fix symptoms without understanding the root cause.`,
    permission: {
        edit: "allow",
        bash: "allow",
        webfetch: "deny",
    } as const,
});
```

### Updated Agent Map
```typescript
// Source: src/agents/index.ts (modified)
import { debuggerAgent } from "./debugger";
import { plannerAgent } from "./planner";
import { reviewerAgent } from "./reviewer";

export const agents = {
    autopilot: autopilotAgent,
    debugger: debuggerAgent,
    documenter: documenterAgent,
    metaprompter: metaprompterAgent,
    planner: plannerAgent,
    "pr-reviewer": prReviewerAgent,
    researcher: researcherAgent,
    reviewer: reviewerAgent,
} as const;
```

### Updated Test Assertions
```typescript
// Source: tests/agents-visibility.test.ts (modified)
it("total agent count is 18 (8 standard + 10 pipeline)", () => {
    const standardCount = Object.keys(agents).length;
    const pipelineCount = Object.keys(pipelineAgents).length;
    expect(standardCount).toBe(8);
    expect(pipelineCount).toBe(10);
    expect(standardCount + pipelineCount).toBe(18);
});

// New assertions for primary agents
it("debugger has mode 'all'", () => {
    expect(agents.debugger.mode).toBe("all");
});

it("planner has mode 'all'", () => {
    expect(agents.planner.mode).toBe("all");
});

it("reviewer has mode 'all'", () => {
    expect(agents.reviewer.mode).toBe("all");
});

// Updated: now 4 primary agents instead of 1
it("exactly 4 agents have mode 'all': autopilot, debugger, planner, reviewer", () => {
    const primaryAgents = Object.entries(agents)
        .filter(([_, agent]) => agent.mode === "all")
        .map(([name]) => name);
    expect(primaryAgents.sort()).toEqual(["autopilot", "debugger", "planner", "reviewer"]);
});
```

## Tab-Cycle Ordering Analysis (D-03 Research Result)

**Source:** OpenCode source code at `packages/opencode/src/agent/agent.ts` (anomalyco/opencode repo, dev branch)

The `list()` function in OpenCode's agent module sorts agents using two criteria:
1. **Primary sort (descending):** Whether the agent name matches `cfg.default_agent` (or "build" if unset) -- this agent goes first
2. **Secondary sort (ascending):** Alphabetical by agent name

The TUI's `local.tsx` receives this pre-sorted list via `sync.data.agent`, filters out `mode: "subagent"` and `hidden: true` agents, and preserves the server ordering.

**Implication for Phase 20:**
- If user has no `default_agent` set (common case): "build" goes first, then alphabetical. Since none of our agents are named "build", all four appear in pure alphabetical order: `autopilot`, `debugger`, `planner`, `reviewer` -- exactly the desired order per AGNT-13.
- If user sets `default_agent: "autopilot"`: autopilot is forced first, then remaining alphabetical (`debugger`, `planner`, `reviewer`) -- still correct.
- If user sets `default_agent` to something else: that agent goes first, then our four sort alphabetically among the remaining agents.

**Confidence: HIGH** -- verified directly from OpenCode source code.

## Permission Mapping (D-07/D-08/D-09 Reconciliation)

The CONTEXT decisions reference permissions not in the SDK type. Here is the mapping to SDK-compatible permission objects:

| Agent | CONTEXT Decision | SDK Permission Object | Rationale |
|-------|-----------------|----------------------|-----------|
| Debugger (D-07) | read:allow, bash:allow, edit:allow, no write, no webfetch | `{ edit: "allow", bash: "allow", webfetch: "deny" }` | read defaults to allow; edit covers editing existing files; webfetch explicitly denied |
| Planner (D-08) | read:allow, write:allow, bash:allow, no edit, no webfetch | `{ edit: "allow", bash: "allow", webfetch: "deny" }` | read defaults to allow; edit covers both write and edit per OpenCode docs; webfetch denied |
| Reviewer (D-09) | read:allow, bash:allow, no edit, no write, no webfetch | `{ edit: "deny", bash: "allow", webfetch: "deny" }` | read defaults to allow; edit explicitly denied (review only); webfetch denied |

**Note on D-08 (Planner):** The CONTEXT says "write: allow" but "no edit." In OpenCode, the `edit` permission governs all file modifications (edit, write, patch, multiedit). There is no separate `write` permission at the SDK type level. Setting `edit: "allow"` enables both writing new files AND editing existing files. To honor the spirit of D-08 (can create plan files but shouldn't edit source code), the prompt should instruct the Planner to only create new plan files, not modify existing source code. The permission system cannot make this distinction -- it must be enforced at the prompt level.

## Discretion Recommendations

### maxSteps
- **Debugger:** 25 -- debugging involves multi-step investigation (reproduce, bisect, read code, run tests, fix) but is more focused than orchestration
- **Planner:** 20 -- plan writing is primarily analysis and file creation, fewer tool calls needed
- **Reviewer:** 30 -- code review via oc_review is a multi-stage pipeline (dispatch -> collect findings -> cross-verify -> fix cycle) requiring several round-trips

### Temperature
- Omit for all three. Let OpenCode use its default. Model-agnostic constraint from CLAUDE.md.

### Internal Structure
- Single export per file, no helper functions. The prompt is the only variable content, and it's a template literal. Keep the same structure as autopilot.ts for consistency.

### Planner Output
- Instruct the Planner to write plan files as markdown to the current working directory. This aligns with plan-writing skill's methodology (Step 2: List Required Artifacts) and keeps output inspectable.

## Skill Content Sizing

| Agent | Skill(s) | Raw Size | Estimated Tokens (~4 chars/token) |
|-------|----------|----------|-----------------------------------|
| Debugger | systematic-debugging | 15,337 chars | ~3,834 tokens |
| Planner | plan-writing + plan-executing | 26,102 chars | ~6,526 tokens |
| Reviewer | code-review | 10,373 chars | ~2,593 tokens |

The Planner agent's prompt will be the largest. With agent preamble and rules (~500 chars), total is ~27K chars / ~6,750 tokens. This is within reasonable bounds for an agent system prompt but should be monitored.

## Open Questions

1. **OpenCode's "build" default agent and plugin agents**
   - What we know: If `default_agent` is unset, OpenCode treats "build" as the default. None of our agents are named "build."
   - What's unclear: Does OpenCode create a "build" agent by default in `config.agent`? If so, does it appear in the Tab cycle alongside our agents?
   - Recommendation: Test empirically after implementation. If "build" appears, it would be: build, autopilot, debugger, planner, reviewer. The CONTEXT decisions don't address this, but it's unlikely to cause issues since "build" is an OpenCode built-in.

2. **Skill content trimming**
   - What we know: Skill files contain sections like "Integration with Our Tools" referencing tools the agent may not have access to (e.g., `oc_forensics` in systematic-debugging, `oc_orchestrate` in plan-executing).
   - What's unclear: Whether these references confuse the agent when the tools aren't available.
   - Recommendation: Keep full skill content for v1. If agents try to call unavailable tools, the prompt's permission restrictions will block them. Trimming can be done in a follow-up if needed.

## Sources

### Primary (HIGH confidence)
- OpenCode source: `packages/opencode/src/agent/agent.ts` -- agent list sorting logic (alphabetical with default agent first)
- OpenCode source: `packages/app/src/context/local.tsx` -- TUI agent cycling (preserves server order, filters subagent+hidden)
- OpenCode source: `packages/opencode/src/cli/cmd/tui/context/local.tsx` -- TUI move() function (circular navigation)
- OpenCode SDK: `@opencode-ai/sdk` types.gen.d.ts -- AgentConfig type definition with permission fields
- OpenCode docs: https://opencode.ai/docs/permissions/ -- Full permission list and defaults
- OpenCode docs: https://opencode.ai/docs/agents/ -- Agent mode documentation

### Secondary (MEDIUM confidence)
- GitHub issue: https://github.com/anomalyco/opencode/issues/16840 -- Feature request for custom Tab cycle ordering (confirms no explicit order field exists)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, pure content creation using existing patterns
- Architecture: HIGH -- follows established agent definition pattern from autopilot.ts
- Tab-cycle ordering: HIGH -- verified directly from OpenCode source code
- Permission mapping: HIGH -- verified from SDK types and OpenCode docs
- Pitfalls: HIGH -- identified from direct code inspection (test assertions, type constraints)

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (stable domain -- agent config API unlikely to change)
