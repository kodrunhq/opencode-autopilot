# Native Plan/Build Suppression Remediation Plan (2026-04-04)

## 1) Goal

When OpenCode loads this plugin, native built-in `plan` and `build` agents are reliably removed from primary Tab cycling (and from @-autocomplete if configured), while custom `planner`/`coder` remain visible and functional. This behavior must be deterministic across config-hook timing differences and detectable via automated tests + `oc_doctor`.

---

## 2) Required Artifacts (exact paths)

### Code
- `src/agents/index.ts` (modify)
- `src/health/checks.ts` (modify)
- `src/health/runner.ts` (modify)
- `src/tools/doctor.ts` (modify)

### Tests
- `tests/agents/config-hook.test.ts` (modify)
- `tests/orchestrate-pipeline.test.ts` (modify)
- `tests/agents-visibility.test.ts` (modify)
- `tests/health/checks.test.ts` (modify)
- `tests/tools/doctor.test.ts` (modify)

### Docs
- `docs/QA-PLAYBOOK.md` (modify)
- `README.md` (modify)

---

## 3) Dependency Mapping

1. `src/agents/index.ts`
   - Depends on: existing OpenCode `Config` type + current registration flow.
   - Creates: deterministic native suppression behavior.

2. `tests/agents/config-hook.test.ts`, `tests/orchestrate-pipeline.test.ts`
   - Depend on: `src/agents/index.ts` behavior.
   - Create: regression safety for suppression + agent counts/shape.

3. `tests/agents-visibility.test.ts`
   - Depends on: custom agent visibility contract from `src/agents/index.ts`.
   - Creates: guardrail that plugin primary agents remain correct after suppression changes.

4. `src/health/checks.ts`
   - Depends on: suppression contract defined in `src/agents/index.ts`.
   - Creates: machine-checkable “native suppression healthy/unhealthy” signal.

5. `src/health/runner.ts`
   - Depends on: new check exported in `src/health/checks.ts`.
   - Creates: inclusion in health pipeline.

6. `src/tools/doctor.ts`
   - Depends on: new health check name from runner/checks.
   - Creates: user-facing diagnostic + fix suggestion.

7. `tests/health/checks.test.ts`, `tests/tools/doctor.test.ts`
   - Depend on: health/doctor wiring.
   - Create: automated validation of diagnostics.

8. `docs/QA-PLAYBOOK.md`, `README.md`
   - Depend on: final implemented behavior and doctor signal names.
   - Create: operational clarity for QA + users.

---

## 4) Execution Waves and Tasks

## Wave 1 (foundation: suppression logic + direct regressions)

### Task 1 — Make native Plan/Build suppression deterministic in config hook
**Files (3):**
- `src/agents/index.ts`
- `tests/agents/config-hook.test.ts`
- `tests/orchestrate-pipeline.test.ts`

**Needs:** current configHook behavior and existing tests.

**Creates:**
- deterministic suppression independent of `builtInKeys` presence,
- explicit safety so custom `planner`/`coder` are never suppressed,
- updated tests for new behavior.

**Action:**
1. Refactor suppression in `src/agents/index.ts` to target only native keys (`plan`/`build`, optionally exact-case variants that do not conflict), instead of broad `planner`/`builder` variants.
2. Apply suppression policy deterministically each load:
   - enforce `disable: true`, and
   - enforce Tab-hiding semantics (`mode: "subagent"`, `hidden: true`) as a compatibility fallback.
3. Keep custom plugin agents (`planner`, `coder`, etc.) unaffected.
4. Update config-hook tests to validate:
   - native `plan`/`build` are suppressed even when config starts empty,
   - custom `planner` remains enabled.
5. Update pipeline configHook test expectations if total injected key count changes due deterministic native entries.

**Verification:**
- `bun test tests/agents/config-hook.test.ts`
- `bun test tests/orchestrate-pipeline.test.ts -t "configHook pipeline agents"`

**Done criteria:**
- Suppression no longer depends on whether native keys were present in a pre-registration snapshot.
- Tests explicitly prove `planner` is not accidentally disabled.

---

### Task 2 — Add explicit visibility regression guardrails
**Files (1):**
- `tests/agents-visibility.test.ts`

**Needs:** Task 1 completed.

**Creates:** stronger invariants around primary agent visibility contract.

**Action:**
1. Add/adjust assertions that primary-visible custom agents remain:
   - `autopilot`, `coder`, `debugger`, `planner`, `researcher`, `reviewer`.
2. Add assertions that native `plan`/`build` are not treated as plugin primary agents in visibility tests.
3. Ensure tests document expected behavior clearly (why native suppression exists, and that plugin replacements remain primary).

**Verification:**
- `bun test tests/agents-visibility.test.ts`

**Done criteria:**
- Any future change that re-exposes native plan/build or breaks custom primary list fails tests immediately.

---

## Wave 2 (diagnostics + doctor integration)

### Task 3 — Add health check for native plan/build suppression state
**Files (2):**
- `src/health/checks.ts`
- `src/health/runner.ts`

**Needs:** Task 1 suppression contract finalized.

**Creates:** health-level observability for this exact bug class.

**Action:**
1. Add a new check in `src/health/checks.ts` (e.g., `native-agent-suppression`) that inspects `openCodeConfig.agent` and validates suppression contract for native `plan` and `build`.
2. Make check pass/fail rules explicit and robust (accepting configured fallback forms if needed).
3. Wire the new check into `runHealthChecks` order in `src/health/runner.ts`.

**Verification:**
- `bun test tests/health/checks.test.ts`

**Done criteria:**
- Health report includes a dedicated suppression check with actionable failure messages.

---

### Task 4 — Surface suppression diagnostics in oc_doctor output
**Files (2):**
- `src/tools/doctor.ts`
- `tests/tools/doctor.test.ts`

**Needs:** Task 3 wired check name + behavior.

**Creates:** user-visible troubleshooting path for this issue.

**Action:**
1. Extend doctor fix suggestions for the new suppression check.
2. Update doctor tests for changed check counts and expected content.
3. Add one negative-path assertion (suppression unhealthy => doctor reports fail with fix hint).

**Verification:**
- `bun test tests/tools/doctor.test.ts`

**Done criteria:**
- `oc_doctor` explicitly tells users when native plan/build suppression is not active and how to recover (restart + config checks).

---

## Wave 3 (documentation and release-facing QA)

### Task 5 — Update QA and README guidance for agent visibility behavior
**Files (2):**
- `docs/QA-PLAYBOOK.md`
- `README.md`

**Needs:** Tasks 1–4 complete (final behavior and check names are stable).

**Creates:** clear operational guidance and acceptance criteria.

**Action:**
1. Update QA smoke checks to assert that native `plan` and `build` do not appear in Tab-cycle primary agent list.
2. Add troubleshooting note:
   - restart OpenCode after plugin update,
   - run `oc_doctor` and inspect suppression check.
3. Align README “visible primary agents” messaging with actual expected list.

**Verification:**
- `bun run lint`

**Done criteria:**
- QA and user docs reflect exact visibility behavior and recovery steps.

---

## 5) Plan-Level Verification (ship gate)

After all tasks:

1. **Targeted suites**
   - `bun test tests/agents/config-hook.test.ts`
   - `bun test tests/orchestrate-pipeline.test.ts -t "configHook pipeline agents"`
   - `bun test tests/agents-visibility.test.ts`
   - `bun test tests/health/checks.test.ts`
   - `bun test tests/tools/doctor.test.ts`

2. **Full regression**
   - `bun test`
   - `bun run lint`
   - `bunx tsc --noEmit`

3. **Manual runtime verification (required for this bug class)**
   - Restart OpenCode.
   - In Tab primary cycle, confirm custom list includes: `autopilot`, `coder`, `debugger`, `planner`, `researcher`, `reviewer`.
   - Confirm native `plan` and native `build` are not shown in primary Tab cycle.
   - Run `oc_doctor` and verify suppression check is `pass`.

Success condition: all automated checks pass and runtime Tab visibility matches expected list without native `plan`/`build` resurfacing.
