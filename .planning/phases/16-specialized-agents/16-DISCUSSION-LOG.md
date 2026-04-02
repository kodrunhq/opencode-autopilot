# Phase 16: Autopilot Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 16-specialized-agents
**Areas discussed:** Skill routing, Memory in dispatch, Scope check, Confidence tuning

---

## Skill Routing

| Option | Description | Selected |
|--------|-------------|----------|
| Replace single skill (Recommended) | Replace loadSkillContent with loadAdaptiveSkillContext | ✓ |
| Phase-aware filtering | Different pipeline phases get different skills | |
| You decide | Claude picks | |

**User's choice:** Replace single skill
**Notes:** Simplest upgrade, moves to Phase 17 scope.

---

## Memory in Dispatch

| Option | Description | Selected |
|--------|-------------|----------|
| System prompt only (Recommended) | Existing hook is sufficient, no dispatch changes needed | ✓ |
| Dispatch + system prompt | Add memory to dispatch prompts too | |
| You decide | Claude picks | |

**User's choice:** System prompt only
**Notes:** Agents already get memory via system prompt hook. No double-injection needed.

---

## Scope Check

| Option | Description | Selected |
|--------|-------------|----------|
| Merge into Phase 17 (Recommended) | Skill routing is ~20 lines, combine with Phase 17 | ✓ |
| Keep Phase 16 standalone | Ship separately even if small | |
| Expand Phase 16 | Add more features to give substance | |

**User's choice:** Merge into Phase 17
**Notes:** Phase 11 predicted this might be too thin. Confirmed — merging.

---

## Confidence Tuning

| Option | Description | Selected |
|--------|-------------|----------|
| Move to Phase 17 | Include in merged scope | ✓ |
| Drop it | Skip for v3.0 | |
| You decide | Claude picks | |

**User's choice:** Move to Phase 17

## Deferred Ideas

- Phase-aware skill filtering
- Memory context in dispatch prompts
