# Implementation Handoff Brief — Native Plan/Build Suppression

## Objective

Ensure OpenCode native `plan` and `build` agents do **not** appear in primary Tab cycling, while custom `planner` and `coder` remain primary and unaffected.

Primary source plan: `2026-04-04-native-plan-build-suppression-remediation-plan.md`

---

## Scope

### In scope
- Deterministic suppression logic in config hook.
- Regression tests for visibility/suppression behavior.
- New health/doctor diagnostics for suppression status.
- README + QA playbook updates.

### Out of scope
- Any orchestrator phase logic changes.
- Model-group assignment behavior changes.
- Non-visibility refactors.

---

## Required File Touches

### Core logic
- `src/agents/index.ts`

### Diagnostics
- `src/health/checks.ts`
- `src/health/runner.ts`
- `src/tools/doctor.ts`

### Tests
- `tests/agents/config-hook.test.ts`
- `tests/orchestrate-pipeline.test.ts`
- `tests/agents-visibility.test.ts`
- `tests/health/checks.test.ts`
- `tests/tools/doctor.test.ts`

### Docs
- `docs/QA-PLAYBOOK.md`
- `README.md`

---

## Execution Order (must follow)

1. **Config hook behavior** (`src/agents/index.ts`)
   - Make suppression deterministic (not dependent on built-in key snapshot only).
   - Suppress **native** `plan`/`build` keys only.
   - Do not suppress custom `planner`/`coder`.

2. **Direct regression tests**
   - Update/add tests in:
     - `tests/agents/config-hook.test.ts`
     - `tests/orchestrate-pipeline.test.ts`
     - `tests/agents-visibility.test.ts`

3. **Health check + runner wiring**
   - Add suppression-specific check in `src/health/checks.ts`.
   - Include it in `src/health/runner.ts`.

4. **Doctor integration + tests**
   - Surface the check in `src/tools/doctor.ts` with fix suggestions.
   - Update `tests/tools/doctor.test.ts` expected checks/counts.

5. **Docs**
   - Align `docs/QA-PLAYBOOK.md` and `README.md` with actual expected Tab-visible agents.

---

## Key Implementation Rules

- Keep code immutable-style and explicit (repo standard).
- Do not use broad variant matching that can hit `planner` or `coder` accidentally.
- If adding compatibility for legacy `mode.plan/build`, keep it additive + safe.
- Keep suppression idempotent across repeated loads.
- `oc_doctor` output must provide actionable remediation text.

---

## Verification Commands

### Task-level
- `bun test tests/agents/config-hook.test.ts`
- `bun test tests/orchestrate-pipeline.test.ts -t "configHook pipeline agents"`
- `bun test tests/agents-visibility.test.ts`
- `bun test tests/health/checks.test.ts`
- `bun test tests/tools/doctor.test.ts`

### Final gate
- `bun test`
- `bun run lint`
- `bunx tsc --noEmit`

### Manual runtime check (required)
1. Restart OpenCode.
2. Tab-cycle primary agents: expect `autopilot`, `coder`, `debugger`, `planner`, `researcher`, `reviewer`.
3. Confirm native `plan` and `build` are not present in Tab primary list.
4. Run `oc_doctor`; confirm suppression check is `pass`.

---

## Done Criteria

- Native `plan`/`build` are consistently hidden from primary Tab menu.
- Custom `planner`/`coder` remain primary.
- All listed tests pass, plus full test/lint/type gates.
- `oc_doctor` can detect and explain suppression failures.
- Docs reflect true runtime behavior.
