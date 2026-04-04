---
# opencode-autopilot
name: plan-writing
description: Methodology for decomposing features into bite-sized implementation tasks with file paths, dependencies, and verification criteria
stacks: []
requires: []
---

# Plan Writing

A systematic methodology for breaking down features, refactors, and bug fixes into bite-sized implementation tasks. Each task has exact file paths, clear actions, verification commands, and dependency ordering. Plans are the bridge between "what we want" and "what we build."

## When to Use

- **New feature implementation** — any feature touching more than 3 files needs a plan
- **Refactoring existing code** — without a plan, refactors sprawl and break things
- **Multi-step bug fixes** — when the fix spans multiple files or modules
- **Any work that will take more than 60 minutes** — break it into trackable tasks
- **Work that others need to review** — a plan makes the approach reviewable before code is written
- **Work you might not finish in one session** — a plan lets you (or someone else) resume cleanly

A plan is not overhead — it is the work. Writing the plan forces you to think through the approach, identify dependencies, and surface problems before you write any code. The time spent planning is recovered 3x during implementation.

## The Plan Writing Process

### Step 1: Define the Goal

State what must be TRUE when this work is complete. Goals are outcome-shaped, not task-shaped.

**Good goals:**
- "Users can log in with email and password, receiving a JWT on success and a clear error on failure"
- "The review engine filters agents by detected project stack, loading only relevant agents"
- "All API endpoints validate input with Zod schemas and return structured error responses"

**Bad goals:**
- "Build the auth system" (too vague — what does "build" mean?)
- "Refactor the code" (refactor what, to achieve what outcome?)
- "Fix the bug" (which bug? what is the expected behavior?)

**Process:**
1. Write the goal as a single sentence starting with a noun ("Users can...", "The system...", "All endpoints...")
2. Include the observable behavior (what a user or developer would see)
3. Include the key constraint or quality attribute (performance, security, correctness)
4. If you cannot state the goal in one sentence, you have multiple goals — write multiple plans

### Step 2: List Required Artifacts

For each goal, list the concrete files that must exist or be modified. Use exact file paths.

**Process:**
1. List every source file that must be created or modified
2. List every test file that must be created or modified
3. List every configuration file affected (schemas, migrations, config)
4. List every type/interface file needed
5. Use exact paths relative to the project root: `src/auth/login.ts`, not "the login module"

**Example:**
```
Goal: Users can log in with email and password

Artifacts:
- src/auth/login.ts          (new — login endpoint handler)
- src/auth/login.test.ts     (new — tests for login)
- src/auth/token.ts          (new — JWT creation and verification)
- src/auth/token.test.ts     (new — tests for token utilities)
- src/types/auth.ts          (new — LoginRequest, LoginResponse types)
- src/middleware/auth.ts      (modify — add JWT verification middleware)
- src/index.ts               (modify — register login route)
```

**Why file paths matter:** Vague artifact descriptions ("create the auth module") leave too much ambiguity. Exact file paths make the scope visible, reviewable, and trackable. If you cannot name the file, you do not understand the implementation well enough to plan it.

### Step 3: Map Dependencies

For each artifact, identify what must exist before it can be built.

**Process:**
1. For each file, ask: "What does this file import or depend on?"
2. Draw arrows from dependencies to dependents
3. Files with no dependencies are starting points
4. Files that everything depends on are critical path items

**Example:**
```
src/types/auth.ts           → depends on: nothing (pure types)
src/auth/token.ts           → depends on: src/types/auth.ts
src/auth/login.ts           → depends on: src/types/auth.ts, src/auth/token.ts
src/middleware/auth.ts       → depends on: src/auth/token.ts
src/auth/token.test.ts      → depends on: src/auth/token.ts
src/auth/login.test.ts      → depends on: src/auth/login.ts
src/index.ts                → depends on: src/auth/login.ts, src/middleware/auth.ts
```

**Dependency rules:**
- Types and interfaces have no dependencies (they go first)
- Utility functions depend on types but not on business logic
- Business logic depends on types and utilities
- Tests depend on the code they test
- Wiring/registration depends on everything it wires together

### Step 4: Group into Tasks

Each task is a unit of work that can be completed, verified, and committed independently.

**Task sizing rules:**
- **1-3 files per task** — enough to make progress, small enough to verify
- **15-60 minutes of work** — less than 15 means combine with another task, more than 60 means split
- **Single concern** — one task should not mix unrelated changes
- **Independently verifiable** — each task has a way to prove it works

**Each task must have:**
1. **Name** — action-oriented verb phrase ("Create auth types and token utilities")
2. **Files** — exact file paths created or modified
3. **Action** — specific instructions for what to implement
4. **Verification** — command or check that proves the task is done
5. **Done criteria** — measurable statement of completeness

**Example task:**
```
Task 1: Create auth types and token utilities
Files: src/types/auth.ts, src/auth/token.ts, src/auth/token.test.ts
Action: Define LoginRequest (email: string, password: string) and
        LoginResponse (token: string, expiresAt: number) types.
        Implement createToken(userId) and verifyToken(token) using jose.
        Write tests for both functions including expired token and invalid token cases.
Verification: bun test tests/auth/token.test.ts
Done: Token creation and verification work with test coverage for happy path and error cases.
```

### Step 5: Assign Waves

Group tasks into dependency waves for execution ordering.

**Process:**
1. **Wave 1** — tasks with no dependencies on other tasks (can run in parallel)
2. **Wave 2** — tasks that depend only on Wave 1 tasks
3. **Wave 3** — tasks that depend on Wave 1 or Wave 2 tasks
4. Continue until all tasks are assigned

**Principles:**
- More waves of smaller tasks is better than fewer waves of larger tasks
- Tasks in the same wave can theoretically run in parallel
- Each wave should leave the codebase in a working state
- The final wave typically handles wiring, integration, and end-to-end verification

**Example:**
```
Wave 1 (no dependencies):
  Task 1: Create auth types and token utilities
  Task 2: Create password hashing utilities

Wave 2 (depends on Wave 1):
  Task 3: Create login endpoint handler
  Task 4: Create auth middleware

Wave 3 (depends on Wave 2):
  Task 5: Wire login route and middleware into app
  Task 6: Add end-to-end login test
```

### Step 6: Add Verification

Every task needs a verification command. The plan as a whole needs an end-to-end verification step.

**Per-task verification:**
- A test command: `bun test tests/auth/token.test.ts`
- A build check: `bunx tsc --noEmit`
- A lint check: `bun run lint`
- A runtime check: "Start the server and POST to /login with valid credentials"

**Plan-level verification:**
- Run the full test suite: `bun test`
- Run the linter: `bun run lint`
- Verify the goal: "A user can log in with email/password and receive a JWT"
- Check for regressions: "All previously passing tests still pass"

## Task Sizing Guide

### Too Small (Less Than 15 Minutes)

**Symptoms:** "Create the User type" (one file, one type, 5 minutes)

**Fix:** Combine with a related task. Types + the first function that uses them is a natural grouping.

### Right Size (15-60 Minutes)

**Symptoms:** Touches 1-3 files. Single concern. Clear done criteria. You can explain the task in one sentence.

**Examples:**
- "Create auth types and token utilities with tests" (3 files, 30 min)
- "Add input validation to all API endpoints" (3-4 files, 45 min)
- "Implement the review agent selection logic with stack gating" (2 files, 60 min)

### Too Large (More Than 60 Minutes)

**Symptoms:** Touches 5+ files. Multiple concerns mixed together. Done criteria is vague. You need sub-steps to explain it.

**Fix:** Split by one of these dimensions:
- **By file:** Types in one task, implementation in another, tests in a third
- **By concern:** Validation in one task, business logic in another
- **By layer:** Data access first, business logic second, wiring third
- **By feature slice:** User creation first, user login second (vertical slices over horizontal layers)

## Anti-Pattern Catalog

### Anti-Pattern: Vague Tasks

**What goes wrong:** "Set up the database" — what tables? What columns? What constraints? What migrations? The implementer has to make all the decisions that should have been made during planning.

**Instead:** "Add User and Project models to schema.prisma with UUID primary keys, email unique constraint on User, and a one-to-many relation from User to Project."

### Anti-Pattern: No File Paths

**What goes wrong:** "Create the auth module" — which files? What directory structure? What naming convention? The implementer makes different choices than the planner intended.

**Instead:** "Create `src/auth/login.ts` with a POST handler accepting `{ email: string, password: string }` and returning `{ token: string }`."

### Anti-Pattern: Horizontal Layers

**What goes wrong:** "Create all models, then all APIs, then all UIs." This means nothing works end-to-end until the last layer is done. Integration issues are discovered late.

**Instead:** Vertical slices — "User feature (model + API + test), then Product feature (model + API + test)." Each slice delivers a working feature.

### Anti-Pattern: Missing Verification

**What goes wrong:** Tasks without a way to prove they are done. The implementer finishes the code and says "looks good" — but nothing was verified.

**Instead:** Every task has a verification command. If you cannot write a verification step, the task is not well-defined enough.

### Anti-Pattern: No Dependencies Mapped

**What goes wrong:** The implementer starts Task 3 and discovers it depends on something from Task 5. They either hack around it or rearrange on the fly, losing time and introducing bugs.

**Instead:** Map dependencies explicitly in Step 3. If Task 3 depends on Task 5, reorder them.

### Anti-Pattern: Plan as Documentation

**What goes wrong:** The plan is written after the code, as documentation of what was built. This defeats the purpose — the plan should guide the implementation, not describe it.

**Instead:** Write the plan before writing any code. Review the plan (are the tasks right-sized? dependencies correct? verification clear?) before implementing.

## Integration with Our Tools

- **`oc_orchestrate`** — Execute the plan automatically. The orchestrator reads the plan and dispatches tasks to implementation agents
- **`oc_plan`** — Track task completion status as implementation progresses
- **plan-executing skill** — Use the companion skill for the execution methodology (how to work through the plan task by task)
- **`oc_review`** — After writing the plan, review it for completeness before implementation begins

## Failure Modes

### Plan Too Large

**Symptom:** More than 5-6 tasks in a single plan, or estimated total time exceeds 4 hours.

**Fix:** Split into multiple plans of 2-4 tasks each. Each plan should deliver a working increment. Plan A provides the foundation, Plan B builds on it.

### Circular Dependencies

**Symptom:** Task A depends on Task B, which depends on Task A. The dependency graph has a cycle.

**Fix:** The cycle means the tasks are not properly separated. Extract the shared dependency into its own task (usually types or interfaces). Both Task A and Task B depend on the new task instead of each other.

### Tasks Keep Growing

**Symptom:** "This task was supposed to be 30 minutes but it is been 2 hours." Implementation reveals more work than planned.

**Fix:** You are combining concerns. Stop, re-plan the remaining work. Split the current task into smaller tasks. The sunk time is gone — do not let it cascade into more wasted time.

### Verification Cannot Be Automated

**Symptom:** The verification step is "manually check that it works" — no test command, no build check, nothing automated.

**Fix:** If you truly cannot automate verification, write a manual verification checklist with specific steps ("Open the browser, navigate to /login, enter email and password, verify token appears in response"). But first, ask: can this be a test? Usually it can.

### Scope Creep During Planning

**Symptom:** The plan keeps growing as you discover more work. What started as 3 tasks is now 12.

**Fix:** Separate "must have for the goal" from "nice to have." The plan delivers the goal — everything else goes into a follow-up plan. A plan that does one thing well is better than a plan that does five things partially.
