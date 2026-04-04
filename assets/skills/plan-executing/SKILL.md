---
# opencode-autopilot
name: plan-executing
description: Batch execution methodology for implementing plans with verification checkpoints after each task
stacks: []
requires:
  - plan-writing
---

# Plan Executing

A systematic methodology for working through implementation plans task by task. Each task is executed, verified, and committed before moving to the next. Deviations are logged, failures are diagnosed, and progress is tracked throughout.

## When to Use

- **After writing a plan** (using the plan-writing skill) — the plan provides the task list, this skill provides the execution discipline
- **When implementing a multi-task feature** — any work with more than 2 tasks benefits from structured execution
- **When running through a task list systematically** — avoids skipping steps, forgetting verification, or losing track of progress
- **When multiple people are implementing the same plan** — consistent execution methodology keeps everyone aligned
- **When resuming work after a break** — the execution log tells you exactly where you left off and what state things are in

## The Execution Process

### Step 1: Read the Full Plan

Before implementing anything, read every task in the plan. Do not start coding after reading just the first task.

**Process:**
1. Read the plan objective — what must be true when this work is complete?
2. Read every task, including its files, action, verification, and done criteria
3. Understand the dependency graph — which tasks depend on which?
4. Identify the critical path — which tasks, if delayed, delay everything?
5. Note any tasks that can run in parallel (same wave, no shared files)

**Why read everything first:**
- You may spot dependency errors before they block you
- You will understand how early tasks set up later tasks
- You can identify shared patterns and avoid redundant work
- You will catch scope issues before investing implementation time

### Step 2: Execute Wave by Wave

Start with Wave 1 tasks (no dependencies). Complete each task fully before starting the next.

**Per-task execution flow:**
1. **Read the task** — files, action, verification, done criteria
2. **Check prerequisites** — are all dependency tasks complete? Are their outputs available?
3. **Implement** — follow the action description. If it says "create X with Y," create X with Y
4. **Run verification** — execute the task's verification command
5. **Check done criteria** — does the implementation meet the stated criteria?
6. **Commit** — one commit per task, referencing the task number

**Wave transition:**
- After all Wave N tasks are complete and verified, move to Wave N+1
- Do not start a Wave N+1 task until all its Wave N dependencies are complete
- If a Wave N task fails, fix it before moving forward

### Step 3: Verify After Each Task

Verification is not optional. Every task has a verification step, and you must run it.

**Verification hierarchy:**
1. **Task-specific verification** — the command listed in the task (e.g., `bun test tests/auth/token.test.ts`)
2. **Build check** — `bunx tsc --noEmit` to catch type errors across the project
3. **Full test suite** — `bun test` to catch regressions in other modules
4. **Lint check** — `bun run lint` to catch formatting and style issues

**Rules:**
- Run at least the task-specific verification after every task
- Run the full test suite after every 2-3 tasks (or after every task if the project is small)
- If any verification fails, fix it before proceeding — do NOT continue with a broken base
- If a test that was passing before your change is now failing, you introduced a regression — fix it

### Step 4: Track Progress

Keep a running log of what is done, what deviated from the plan, and what remains.

**Track:**
- Completed tasks with commit hashes
- Time spent per task (helps calibrate future estimates)
- Deviations from the plan (scope changes, unexpected issues, reordered tasks)
- New tasks discovered during implementation (add to the plan, do not just do them ad hoc)
- Blockers encountered and how they were resolved

**Why track:**
- If you are interrupted, you (or someone else) can resume from the log
- Deviations documented during implementation are easier to review than deviations discovered later
- Time tracking reveals whether your task sizing is accurate (improving future plans)
- New tasks discovered during implementation are visible for review (preventing scope creep)

### Step 5: Handle Failures

When something goes wrong (and it will), follow a structured response.

**Task verification fails:**
1. Read the error message carefully — what specifically failed?
2. Is this a problem with the implementation or the test?
3. Use the systematic-debugging skill for non-obvious failures
4. Fix the issue, re-run verification, confirm it passes
5. Log the failure and fix as a deviation

**Unexpected dependency discovered:**
1. The task requires something that is not in the plan
2. Check: is this a missing task, or a missing prerequisite from an existing task?
3. Add the missing work to the plan (new task or expanded existing task)
4. Re-evaluate wave assignments — does this change the dependency graph?
5. Log as a deviation

**Scope creep detected:**
1. While implementing Task N, you discover that "it would be nice to also do X"
2. Ask: is X required for the plan's goal, or just a nice-to-have?
3. If required: add it to the plan as a new task with proper sizing and dependencies
4. If nice-to-have: log it as a follow-up item, do NOT implement it now
5. Every unplanned addition increases risk — be disciplined

**Blocked by external factor:**
1. Cannot proceed due to missing API key, unavailable service, pending PR review, etc.
2. Document the blocker with: what is blocked, what is needed, who can unblock it
3. Skip to the next non-blocked task (if one exists in the current wave)
4. Do NOT implement workarounds that will need to be undone later

### Step 6: Final Verification

After all tasks are complete, run the plan-level verification.

**Process:**
1. Run the full test suite: `bun test`
2. Run the linter: `bun run lint`
3. Run the type checker: `bunx tsc --noEmit`
4. Verify the plan objective — is the stated goal actually achieved?
5. Check for regressions — are all previously passing tests still passing?
6. Review all deviations — do they make sense? Are they documented?

**This is the "ship it" gate.** If final verification passes, the work is complete. If it fails, the work is not complete — regardless of how many tasks are checked off.

## Commit Strategy

One commit per task. No exceptions.

**Commit message format:**
```
type(scope): concise description (task N/M)

- Key change 1
- Key change 2
```

**Examples:**
```
feat(auth): create login types and token utilities (task 1/5)

- Add LoginRequest and LoginResponse types
- Implement createToken and verifyToken with jose
- Add tests for token creation and expired token handling
```

```
fix(auth): add rate limiting to login endpoint (task 4/5)

- Limit to 5 attempts per minute per IP
- Return 429 with retry-after header
```

**Rules:**
- Each commit should leave the codebase in a working state (tests pass, builds succeed)
- Never commit broken code — if verification fails, fix first, then commit
- Never batch multiple tasks into one commit — the commit history should match the plan
- If a task requires no code changes (e.g., documentation-only), commit the docs

## Anti-Pattern Catalog

### Anti-Pattern: Skipping Verification

**What goes wrong:** "I will test it all at the end." You implement 5 tasks, run the tests, and 3 fail. Now you have to debug failures across 5 tasks worth of changes with no idea which task introduced which failure.

**Instead:** Verify after every task. When a test fails, you know exactly which change caused it (the one you just made).

### Anti-Pattern: Continuing on Failures

**What goes wrong:** Task 2 verification fails, but you start Task 3 anyway because "I will fix it later." Task 3 depends on Task 2 working correctly, so now Task 3 is also broken. The failure cascades.

**Instead:** Fix Task 2 before starting Task 3. A broken foundation makes everything built on top of it unreliable.

### Anti-Pattern: Not Committing

**What goes wrong:** You complete 5 tasks and make one giant commit. If something goes wrong, you cannot revert a single task — you revert everything. Code review is painful because the diff is enormous.

**Instead:** Commit after each verified task. Small, focused commits are easier to review, revert, and bisect.

### Anti-Pattern: Deviating Without Logging

**What goes wrong:** You change the plan on the fly — reorder tasks, add new ones, modify scope — without documenting why. Later, reviewers do not understand why the implementation differs from the plan.

**Instead:** Log every deviation with: what changed, why, and what impact it has. Deviations are normal — undocumented deviations are not.

### Anti-Pattern: Gold Plating

**What goes wrong:** Task 3 says "implement the login endpoint." You implement login, registration, password reset, and email verification because "we will need them eventually."

**Instead:** Implement exactly what the task says. Nothing more. Additional features go into additional tasks in additional plans. Scope discipline is the difference between plans that finish on time and plans that never finish.

### Anti-Pattern: Parallelizing Without Understanding

**What goes wrong:** You see two tasks in the same wave and assume they can be done simultaneously. But they modify the same file, causing merge conflicts.

**Instead:** Check for file conflicts before parallelizing. Two tasks in the same wave can run in parallel only if they do not modify the same files.

## Integration with Our Tools

- **`oc_orchestrate`** — Autonomous plan execution. The orchestrator reads the plan, dispatches tasks to agents, verifies each task, and tracks progress automatically. Use for hands-off execution of well-defined plans.
- **`oc_quick`** — For single-task execution when you want to implement one specific task from the plan.
- **`oc_review`** — Run after each task for automated code review. Catches issues the verification command might miss (code quality, security, naming).
- **`oc_state`** — Track pipeline state during execution. Shows current phase, completed tasks, and any blockers.
- **`oc_phase`** — Check phase transitions. Useful when a plan spans the boundary between two pipeline phases.
- **`oc_session_stats`** — Monitor session health during long execution runs. Check for accumulating errors or performance degradation.

## Failure Modes

### All Tasks Fail

**Symptom:** Every task's verification fails. Nothing works.

**Diagnosis:** The plan itself may be fundamentally flawed — wrong assumptions, missing infrastructure, incorrect dependency ordering. Go back to the plan-writing skill and re-plan from scratch. Examine: are the dependencies right? Are the task actions actually implementable?

### Velocity Is Too Slow

**Symptom:** Tasks that were estimated at 30 minutes are taking 2 hours each. The plan will take 3x longer than expected.

**Diagnosis:** Tasks are too large or too vaguely defined. Split them. A task taking 2 hours probably has 3-4 sub-tasks hiding inside it. Re-plan the remaining tasks with smaller granularity.

### Tests Pass but Feature Does Not Work

**Symptom:** All unit tests pass, but the feature fails when used for real. The tests are testing the wrong things.

**Diagnosis:** Missing integration or end-to-end test. Unit tests verify individual pieces; integration tests verify that the pieces work together. Add an integration test that exercises the actual feature path.

### Cascading Failures After One Task

**Symptom:** Task 3 passes verification, but then tasks 4, 5, and 6 all fail because Task 3 changed something they depend on.

**Diagnosis:** Task 3's verification was insufficient — it checked its own output but not its impact on downstream consumers. Add broader verification (full test suite) after tasks that modify shared interfaces.

### Plan Becomes Obsolete Mid-Execution

**Symptom:** After implementing 3 of 6 tasks, you realize the remaining tasks no longer make sense because the first 3 revealed a better approach.

**Diagnosis:** This is normal. Plans are a best estimate based on current knowledge. When the plan becomes obsolete, stop and re-plan the remaining tasks. Do not force an outdated plan. The work already completed is not wasted — it informed the better approach.

## Quick Reference

**Per-task cycle:**
1. Read task
2. Check prerequisites
3. Implement
4. Verify
5. Commit
6. Log progress

**Verification after every task. Commit after every task. Log deviations in real time.**
