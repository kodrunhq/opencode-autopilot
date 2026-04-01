# Phase 7: Learning & Resilience - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-04-01
**Phase:** 07-learning-resilience
**Areas discussed:** Lesson memory structure, Retrospective integration, Forensics tool design, Decay & lifecycle

---

## Lesson Memory Structure

### Storage Location

| Option | Description | Selected |
|--------|-------------|----------|
| Project-local | Store at .opencode-assets/lesson-memory.json per project. Matches review memory pattern. | ✓ |
| Global + project | Global store for cross-project wisdom + per-project store. More complex. | |
| Project-local only, promote later | Start project-local, add global promotion in future phase. | |

**User's choice:** Project-local
**Notes:** Lessons are project-specific (architecture choices, testing patterns). Matches review memory's project-local pattern.

### Lesson Injection

| Option | Description | Selected |
|--------|-------------|----------|
| Prompt context | Load relevant lessons, append to agent dispatch prompt filtered by domain. | ✓ |
| Artifact file reference | Write filtered lessons file, reference in prompt. Agent reads file. | |
| You decide | Claude's discretion. | |

**User's choice:** Prompt context
**Notes:** Lightweight, no schema changes to DispatchResult needed.

### Domain Categories

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed 4 domains | architecture, testing, review, planning. Matches LRNR-02. | ✓ |
| Fixed 4 + general | Same 4 plus catch-all. Prevents forced miscategorization. | |
| Open tags | Free-form string tags. More flexible but inconsistent. | |

**User's choice:** Fixed 4 domains
**Notes:** Simple enum, easy to filter when injecting into phase prompts.

---

## Retrospective Integration

### Feed Mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Handler parses + persists | Agent writes structured JSON. Handler reads, validates via Zod, saves to memory. | ✓ |
| Two-step: markdown then parse | Keep lessons.md, add parsing pass. More fragile. | |
| Both: structured + readable | Agent writes both JSON and markdown. Handler persists from JSON. | |

**User's choice:** Handler parses + persists
**Notes:** No markdown parsing needed. Agent returns structured data directly.

### Trigger Condition

| Option | Description | Selected |
|--------|-------------|----------|
| Success only | RETROSPECTIVE only on full pipeline completion. Failed runs -> forensics. | ✓ |
| Success + partial | Also extract lessons from partial runs (BUILD or later). | |
| Always | Even early failures. May produce low-quality lessons. | |

**User's choice:** Success only
**Notes:** Keeps retrospective focused on "what worked" learning.

---

## Forensics Tool Design

### Invocation

| Option | Description | Selected |
|--------|-------------|----------|
| Separate oc_forensics tool | New tool following *Core + tool() pattern. Clean separation. | ✓ |
| Flag on oc_orchestrate | oc_orchestrate(forensics=true). Simpler but overloads responsibility. | |
| Both | oc_forensics primary, oc_orchestrate detects failed state and suggests it. | |

**User's choice:** Separate oc_forensics tool
**Notes:** Clean separation of concerns.

### Failure Metadata

| Option | Description | Selected |
|--------|-------------|----------|
| Phase + agent + error | Persist: failedPhase, failedAgent, errorMessage, timestamp, lastSuccessfulPhase. | ✓ |
| Full diagnostic snapshot | Everything above plus full dispatch prompt, partial output, confidence scores. | |
| Minimal + log file | State captures only failedPhase + errorMessage. Full diagnostics in separate file. | |

**User's choice:** Phase + agent + error
**Notes:** Enough to diagnose without bloating state. Add failureContext field to PipelineState.

### Recoverability Classification

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, with heuristics | Heuristic rules: early phases recoverable, BUILD strike overflow terminal. | ✓ |
| Yes, with agent analysis | Dispatch forensics agent for judgment call. More nuanced. | |
| No classification | Report what failed, let user decide. Simpler. | |

**User's choice:** Yes, with heuristics
**Notes:** Gives clear "try again" or "start fresh" signal.

### Output Format

| Option | Description | Selected |
|--------|-------------|----------|
| JSON | Structured JSON matching *Core pattern. Consistent with all oc_* tools. | ✓ |
| Markdown narrative | Human-readable diagnosis. Better for reading, harder programmatically. | |
| Both | JSON primary + markdown summary file. | |

**User's choice:** JSON
**Notes:** Consistent with all other oc_* tools.

---

## Decay & Lifecycle

### Decay Mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Time-based, 90 days | Lessons expire after 90 days. Pruned on load. Simple, predictable. | ✓ |
| Usage-based | Lessons refreshed when injected. Unused decay. More complex. | |
| Hybrid: time + boost | Base 90-day TTL + 30-day boost per injection. Cap at 180 days. | |

**User's choice:** Time-based, 90 days
**Notes:** Longer than review memory's 30 days since lessons are higher-value.

### Store Cap

| Option | Description | Selected |
|--------|-------------|----------|
| 50 lessons | Cap total, keep newest. Covers ~6-15 runs. | ✓ |
| 100 lessons | Larger buffer. Risk: prompt injection too long. | |
| 25 per domain | Cap per category. Ensures no domain dominates. More complex. | |

**User's choice:** 50 lessons
**Notes:** Domain filtering at injection time keeps prompt context concise (~12 per phase max).

---

## Claude's Discretion

- Exact lesson JSON schema field names and structure
- How orchestrateCore persists failure metadata
- Domain-to-phase mapping for lesson injection
- Whether forensics reads state directly or uses loadState

## Deferred Ideas

None -- discussion stayed within phase scope.
