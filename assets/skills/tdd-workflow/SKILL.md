---
# opencode-autopilot
name: tdd-workflow
description: Strict RED-GREEN-REFACTOR TDD methodology with anti-pattern catalog and explicit failure modes
stacks: []
requires: []
---

# TDD Workflow

Strict RED-GREEN-REFACTOR test-driven development methodology. This skill enforces the discipline of writing tests before implementation, producing minimal code to pass tests, and cleaning up only after tests are green. Every cycle produces a commit. Every phase has a clear purpose and exit criterion.

TDD is not "writing tests." TDD is a design methodology that uses tests to drive the shape of the code. The test defines the behavior. The implementation satisfies the test. The refactor improves the code without changing behavior.

## When to Use

**Activate this skill when:**

- Implementing business logic with defined inputs and outputs
- Building API endpoints with request/response contracts
- Writing data transformations, parsers, or formatters
- Implementing validation rules or authorization checks
- Building algorithms, state machines, or decision logic
- Fixing a bug (write the regression test first, then fix)
- Implementing any function where you can describe the expected behavior

**Do NOT use when:**

- UI layout and styling (visual output is hard to assert meaningfully)
- Configuration files and static data
- One-off scripts or migrations
- Simple CRUD with no business logic (getById, list, delete)
- Prototyping or exploring an unfamiliar API (spike first, then TDD the real implementation)

## The RED-GREEN-REFACTOR Cycle

Each cycle implements ONE behavior. Not two. Not "a few related things." One behavior, one test, one cycle. Repeat until the feature is complete.

### Phase 1: RED (Write a Failing Test)

**Purpose:** Define the expected behavior BEFORE writing any production code. The test is a specification.

**Process:**

1. Write ONE test that describes a single expected behavior
2. The test name should read as a behavior description, not a method name:
   - DO: `"rejects expired tokens with 401 status"`
   - DO: `"calculates total with tax for US addresses"`
   - DON'T: `"test validateToken"` or `"test calculateTotal"`
3. Structure the test using Arrange-Act-Assert:
   - **Arrange:** Set up inputs and expected outputs
   - **Act:** Call the function or trigger the behavior
   - **Assert:** Verify the output matches expectations
4. Run the test -- it MUST fail
5. Read the failure message -- it should describe the missing behavior clearly
6. If the test passes without any new implementation, the behavior already exists or the test is wrong

**Commit:** `test: add failing test for [behavior]`

**Exit criterion:** The test fails with a clear, expected error message.

**Common mistakes in RED:**

- Writing multiple tests at once (write ONE, see it fail, then proceed)
- Writing the test and implementation simultaneously (defeats the purpose)
- Writing a test that cannot fail (tautology: `expect(true).toBe(true)`)
- Testing implementation details instead of behavior (asserting internal state)

### Phase 2: GREEN (Make It Pass)

**Purpose:** Write the MINIMUM code to make the test pass. Nothing more.

**Process:**

1. Read the failing test to understand what behavior is expected
2. Write the simplest possible code that makes the test pass
3. Do NOT add error handling the test does not require
4. Do NOT handle edge cases the test does not cover
5. Do NOT optimize -- performance improvements are Phase 3 or a new cycle
6. Do NOT "clean up" -- that is Phase 3
7. Run the test -- it MUST pass
8. Run all existing tests -- they MUST still pass (no regressions)

**Commit:** `feat: implement [behavior]`

**Exit criterion:** The new test passes AND all existing tests pass.

**The hardest discipline:** Resist the urge to write "good" code in this phase. You WILL see opportunities for abstraction, error handling, and optimization. Ignore them. Write the minimum. Phase 3 exists specifically for cleanup.

**Why minimum matters:** If you write more code than the test requires, that extra code is untested. Untested code is the source of bugs. The RED-GREEN cycle guarantees that every line of production code exists to satisfy a test.

### Phase 3: REFACTOR (Clean Up)

**Purpose:** Improve the code without changing behavior. The tests are your safety net.

**Process:**

1. Review the implementation from Phase 2 -- what can be improved?
2. Common refactoring targets:
   - Extract repeated logic into named functions
   - Rename variables for clarity
   - Remove duplication between test and production code
   - Simplify complex conditionals
   - Extract constants for magic numbers/strings
3. After EVERY change, run the tests -- they MUST still pass
4. If a test fails during refactoring, REVERT the last change immediately
5. Make smaller changes -- one refactoring at a time, verified by tests

**Commit (if changes were made):** `refactor: clean up [behavior]`

**Exit criterion:** Code is clean, all tests pass, no new behavior added.

**When to skip REFACTOR:** Never. Even if the code "looks fine," do a quick review pass. The habit of always refactoring prevents technical debt accumulation. If nothing needs changing, that's fine -- move to the next RED.

## Test Writing Guidelines

### Name Tests as Behavior Descriptions

Tests are documentation. The test name should explain what the system does, not how the test works.

```
// DO: Behavior descriptions
"creates user with hashed password"
"rejects duplicate email addresses"
"returns empty array when no results match"
"sends welcome email after successful registration"

// DON'T: Implementation descriptions
"test createUser"
"test email validation"
"test empty result"
"test sendEmail"
```

### One Assertion Per Test

Each test should verify one behavior. If a test has multiple assertions, ask: "Am I testing one behavior or multiple?"

**Acceptable:** Multiple assertions that verify different aspects of the SAME behavior:

```
// OK: Both assertions verify the "create user" behavior
expect(result.id).toBeDefined()
expect(result.email).toBe("user@example.com")
```

**Not acceptable:** Assertions that verify DIFFERENT behaviors:

```
// WRONG: Testing creation AND retrieval in one test
const created = await createUser(data)
const fetched = await getUser(created.id)
expect(created.id).toBeDefined()
expect(fetched.email).toBe(data.email)
```

### Arrange-Act-Assert Structure

Every test has three distinct sections. Separate them with blank lines for readability.

```
test("calculates discount for premium customers", () => {
  // Arrange
  const customer = { tier: "premium", orderTotal: 100 }

  // Act
  const discount = calculateDiscount(customer)

  // Assert
  expect(discount).toBe(15)
})
```

### Use Descriptive Failure Messages

When a test fails, the failure message should tell you what went wrong without reading the test code.

```
// DO: Descriptive
expect(response.status, "Expected 401 for expired token").toBe(401)

// DON'T: Generic
expect(response.status).toBe(401)
```

### Test Edge Cases in Separate Cycles

Each edge case gets its own RED-GREEN-REFACTOR cycle:

1. RED: Write test for empty input
2. GREEN: Handle empty input
3. REFACTOR: Clean up
4. RED: Write test for null input
5. GREEN: Handle null input
6. REFACTOR: Clean up

Do NOT bundle edge cases into the initial implementation.

## Anti-Pattern Catalog

### Anti-Pattern: Writing Tests After Code

**What goes wrong:** Tests become assertions of what the code already does, not specifications of what it should do. The tests verify the implementation, not the behavior. When the implementation has a bug, the test has the same bug.

**Signs:** All tests pass on the first run. Tests mirror implementation structure. Changing the implementation always requires changing the tests.

**Instead:** Always write the test FIRST. The test should fail before any implementation exists. If it doesn't fail, the test is wrong.

### Anti-Pattern: Skipping RED

**What goes wrong:** Writing the test and implementation together means you never verified that the test can actually detect a failure. The test might be a tautology that always passes.

**Signs:** You never see a red test. Tests are written alongside implementation in the same commit. You feel confident the test works but have no evidence.

**Instead:** Run the test, see the red failure message, read it, confirm it describes the missing behavior. Only then write the implementation.

### Anti-Pattern: Over-Engineering in GREEN

**What goes wrong:** Adding error handling, edge case coverage, performance optimizations, and abstractions before the test requires them. This extra code is untested and may contain bugs.

**Signs:** The implementation is significantly more complex than what the test verifies. Functions handle cases no test covers. You justify additions with "we'll need this later."

**Instead:** Write only what the current test needs. If you need error handling, write a RED test for the error case first. If you need optimization, write a benchmark test first.

### Anti-Pattern: Skipping REFACTOR

**What goes wrong:** Technical debt accumulates as each GREEN phase adds minimal code without cleanup. After 20 cycles, the codebase is a pile of special cases.

**Signs:** Production code has obvious duplication. Variable names are unclear. Functions grow linearly with each new test. You dread adding new features because the code is messy.

**Instead:** Always do a REFACTOR pass, even if it's a 30-second review that concludes "looks fine." Build the habit.

### Anti-Pattern: Testing Implementation Details

**What goes wrong:** Tests assert on internal method calls, private state, or call counts instead of observable behavior. Refactoring breaks all tests even though behavior is unchanged.

**Signs:** Tests use `toHaveBeenCalledWith` on internal methods. Tests assert on intermediate variables. Renaming an internal function breaks 15 tests.

**Instead:** Test the public API. Assert on outputs, side effects (emails sent, records created), and error behaviors. Never assert on how the implementation achieves the result.

### Anti-Pattern: Large Test Suites with No RED

**What goes wrong:** All tests are written at once, all passing from the start. This is "test-after" development, not TDD. The tests validate the existing implementation rather than driving the design.

**Signs:** A PR adds 20 tests and an implementation, all in one commit. No commit shows a failing test. The test file was written after the production code.

**Instead:** One test at a time, one cycle at a time. Each cycle produces 1-3 commits (RED, GREEN, optional REFACTOR). The git history tells the story.

## Integration with Our Tools

**After GREEN phase:** Invoke `oc_review` for a quick quality check on the implementation. The review catches issues (naming, error handling gaps, security concerns) that the REFACTOR phase should address.

**During REFACTOR:** If a test fails unexpectedly after a refactoring change, use `oc_forensics` to diagnose the root cause. It identifies the exact change that broke the test.

**After completing all cycles:** Run `oc_review` on the full changeset to catch cross-cutting concerns (duplication across files, missing integration tests, inconsistent patterns).

**Commit hygiene:** Each RED-GREEN-REFACTOR cycle produces up to 3 commits. This granular history is valuable -- it shows design evolution and makes bisecting easier.

## Failure Modes

### Test Won't Fail (RED Phase)

**Symptom:** You write the test and it passes immediately without any new implementation.

**Diagnosis:**
- The behavior is already implemented (check existing code)
- The test is asserting something trivially true (tautology)
- The test is calling the wrong function or using stale imports

**Recovery:** Delete the test. Read the existing implementation. Write a test for behavior that is genuinely NOT implemented yet.

### Test Won't Pass (GREEN Phase)

**Symptom:** You write the implementation but the test still fails.

**Diagnosis:**
- Re-read the test carefully -- are you implementing what the test actually checks?
- Check for typos in function names, property names, import paths
- Simplify: can you make the test pass with a hardcoded return value? If yes, work backwards from there

**Recovery:** Start with the simplest possible implementation (even a hardcoded value). Then generalize one step at a time, running the test after each change.

### Refactoring Breaks Tests

**Symptom:** Tests fail after a refactoring change in Phase 3.

**Diagnosis:**
- The refactoring changed behavior (not just structure) -- revert
- A test was testing implementation details, not behavior -- the test needs updating
- The refactoring introduced a subtle bug (argument order, missing return, etc.)

**Recovery:** Revert the last change immediately. Make a smaller refactoring step. If the tests are too coupled to implementation, that's a separate problem to fix in a dedicated cycle.

### Can't Think of the Next Test

**Symptom:** The current behavior works, but you're not sure what to test next.

**Diagnosis:** This is normal and healthy -- it means the current scope might be complete.

**Recovery:**
1. Review the requirements -- is there untested behavior?
2. Check edge cases: empty input, null, boundary values, error conditions
3. Check integration points: does this work correctly with adjacent modules?
4. If nothing emerges, the feature may be done. Run coverage to confirm.

### TDD Feels Slow

**Symptom:** TDD seems like it takes twice as long as just writing the code.

**Reality:** TDD front-loads the time you would spend debugging later. The total time is usually equal or less. The difference: TDD time is predictable (small cycles), debug time is unpredictable (hours chasing a bug).

**If genuinely slow:** Your cycles are too large. Each cycle should take 5-15 minutes (RED: 2-3 min, GREEN: 2-5 min, REFACTOR: 1-5 min). If a cycle takes longer, the behavior being tested is too complex -- split it.
