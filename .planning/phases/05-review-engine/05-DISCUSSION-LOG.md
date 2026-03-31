# Phase 5: Review Engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-03-31
**Phase:** 05-review-engine
**Areas discussed:** Review agent architecture, Team lead selection logic, Review pipeline flow, Standalone invocation UX

---

## Review Agent Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Internal registry only | TS objects in src/review/agents/. Not via configHook. Users never see them. | ✓ |
| ConfigHook subagents | Each injected via configHook. Visible in @ autocomplete. | |
| Hybrid | Internal by default, config flag to expose | |

**User's choice:** Internal registry only

### Follow-up: Agent shape

| Option | Description | Selected |
|--------|-------------|----------|
| Prompt template + metadata | TS object with name, description, prompt, relevantStacks, severity focus | ✓ |
| Markdown prompts + TS metadata | Markdown files + TS mapping | |
| You decide | | |

**User's choice:** Prompt template + metadata

---

## Team Lead Selection Logic

| Option | Description | Selected |
|--------|-------------|----------|
| Deterministic scoring | TS function scores agents against stack | |
| LLM-based selection | LLM reads diff and picks agents | |
| Stack gate + diff heuristic | Two-pass: eliminate by stack, boost by diff patterns | ✓ |

**User's choice:** Stack gate + diff heuristic

### Follow-up: Stack detection

| Option | Description | Selected |
|--------|-------------|----------|
| File-based detection | Scan for marker files + file extensions | ✓ |
| You decide | | |

**User's choice:** File-based detection

---

## Review Pipeline Flow

| Option | Description | Selected |
|--------|-------------|----------|
| 4-stage pipeline | Parallel → Cross-verify → Red team + product → Fix cycle | ✓ |
| 3-stage simplified | Parallel → Red team → Fix cycle | |
| You decide | | |

**User's choice:** 4-stage pipeline

### Follow-up: Fix cycle

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-fix + re-verify (1 cycle) | Fix CRITICAL/HIGH, re-verify affected agents, max 1 cycle | ✓ |
| Multi-cycle with cap | Fix → re-verify → fix again, max 3 cycles | |
| Report only, no auto-fix | Only report findings | |

**User's choice:** Auto-fix + re-verify (1 cycle)

---

## Standalone Invocation UX

| Option | Description | Selected |
|--------|-------------|----------|
| Tool: oc_review | Registered tool, returns JSON report | ✓ |
| Tool + command | oc_review tool + /review command for human UX | |
| You decide | | |

**User's choice:** Tool: oc_review

### Follow-up: Scope options

| Option | Description | Selected |
|--------|-------------|----------|
| Git diff scopes | staged, unstaged, branch, all + file filter | |
| Git diff + directory | All above + directory scope for audits | ✓ |
| You decide | | |

**User's choice:** Git diff + directory

---

## Claude's Discretion

- Exact review agent prompts
- Internal module structure
- Cross-verification data passing
- Finding deduplication strategy
- Fix application logic

## Deferred Ideas

None
