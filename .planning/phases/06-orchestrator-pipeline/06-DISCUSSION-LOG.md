# Phase 6: Orchestrator Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.

**Date:** 2026-04-01
**Phase:** 06-orchestrator-pipeline
**Areas discussed:** Phase subagent design, BUILD phase integration, Arena architecture, Artifact management

---

## Phase Subagent Design

| Option | Description | Selected |
|--------|-------------|----------|
| ConfigHook subagents | Each phase agent injected via configHook, visible in @ autocomplete | ✓ |
| Internal prompts in tool | Prompts embedded in orchestrateCore | |
| Hybrid | Key agents visible, supporting agents internal | |

### Follow-up: Prompt detail level

| Option | Description | Selected |
|--------|-------------|----------|
| Lean prompts + context injection | Short role prompt, tool injects context | ✓ |
| Full self-contained prompts | Detailed prompts with complete instructions | |

---

## BUILD Phase Integration

| Option | Description | Selected |
|--------|-------------|----------|
| Task-per-dispatch cycle | One task at a time, orchestrator cycles | ✓ |
| Wave-based batch dispatch | Multiple tasks in parallel per wave | |
| Single implementer session | One agent, all tasks sequentially | |

### Follow-up: Review gate

| Option | Description | Selected |
|--------|-------------|----------|
| After each task | Review per individual task | |
| After wave/batch | Review once per wave of tasks | ✓ |
| At BUILD completion | Review once at the end | |

---

## Arena Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Confidence-gated | LOW=3 proposals, MEDIUM=2, HIGH=1 | ✓ |
| Always active | Always 2-3 proposals | |
| User-configurable toggle | Config override | |

### Follow-up: Evaluation

| Option | Description | Selected |
|--------|-------------|----------|
| Adversarial critic agent | Dedicated critic stress-tests proposals | ✓ |
| Orchestrate tool scores | Deterministic scoring, no agent | |

---

## Artifact Management

| Option | Description | Selected |
|--------|-------------|----------|
| .opencode-autopilot/phases/ | Per-phase directories | ✓ |
| Single state.json | All in state file | |

### Follow-up: Context flow

| Option | Description | Selected |
|--------|-------------|----------|
| Truncated summary injection | Summary in dispatch prompt | |
| File reference only | Tell agent to read file | ✓ |

---

## Claude's Discretion

- Exact subagent prompt content
- Phase handler internal structure
- Artifact file naming conventions
- BUILD task progress tracking within a run
- SHIP package content structure
- EXPLORE phase implementation vs deferral
