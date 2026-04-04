---
# opencode-autopilot
name: e2e-testing
description: End-to-end testing patterns for critical user flows -- test the system as a user would use it
stacks: []
requires: []
---

# E2E Testing

End-to-end testing patterns for critical user flows. E2E tests verify the system works correctly from the user's perspective, exercising the full stack from UI (or API surface) through business logic to data storage and back. This skill covers when to write E2E tests, how to design them, and how to keep them reliable.

## When to Use

- Critical user flows that must never break (login, signup, checkout, data creation)
- Integration points between multiple services or layers
- Flows where unit tests cannot catch the issue (routing, middleware chains, full request lifecycle)
- Before major releases as a confidence gate
- After infrastructure changes (database migrations, service upgrades, environment changes)
- When a bug was reported that unit and integration tests did not catch

## When NOT to Use

- Pure logic that can be tested with unit tests (calculations, transformations, validators)
- Single API endpoint behavior (use integration tests)
- UI component rendering in isolation (use component tests)
- Performance benchmarking (use dedicated performance tests)

E2E tests are the most expensive tests to write and maintain. Use them surgically for flows where no other test type provides sufficient confidence.

## E2E Test Design Principles

### Test User Journeys, Not Components

An E2E test should mirror a real user workflow from start to finish:

```
// Good: Complete user journey
test("new user can sign up, verify email, and access dashboard", () => {
  navigateTo("/signup")
  fillForm({ email: "alice@example.com", password: "SecurePass123!" })
  clickButton("Create Account")
  verifyEmailLink()
  expectRedirectTo("/dashboard")
  expectVisible("Welcome, Alice")
})

// Bad: Testing a single component in E2E
test("signup button renders correctly", () => {
  navigateTo("/signup")
  expectVisible("Create Account")  // This is a component test
})
```

### Use Realistic Data

- Use data that resembles production data in structure and edge cases
- Include special characters, long strings, and boundary values
- Avoid "test123" or "foo@bar.com" -- use realistic names and formats
- If the system has user roles, test each role's journey separately

### Keep Tests Independent

- Each test should work regardless of execution order
- Never depend on state created by a previous test
- Set up all required state within the test itself (or in a beforeEach hook)
- Clean up created state after the test (or use isolated test environments)

### Use the Page Object Pattern

Encapsulate UI interactions behind a clean interface:

```
// Page object
const loginPage = {
  navigate: () => goto("/login"),
  fillEmail: (email) => fill("[data-testid=email]", email),
  fillPassword: (password) => fill("[data-testid=password]", password),
  submit: () => click("[data-testid=login-button]"),
  getErrorMessage: () => getText("[data-testid=error-message]"),
}

// Test uses page object
test("login with valid credentials", () => {
  loginPage.navigate()
  loginPage.fillEmail("alice@example.com")
  loginPage.fillPassword("SecurePass123!")
  loginPage.submit()
  expectRedirectTo("/dashboard")
})
```

Benefits: tests are readable, selector changes only need one update, complex interactions are reusable.

## Test Structure

Every E2E test follows the same four-phase structure:

### Arrange

Set up the preconditions for the test:

- Create test data (users, records, configurations)
- Navigate to the starting page or API endpoint
- Ensure the system is in a clean, known state
- Set up any mocks for external services (payment gateways, email providers)

### Act

Perform the user actions being tested:

- Click buttons, fill forms, navigate between pages
- Submit API requests with realistic payloads
- Wait for async operations to complete (use explicit waits, not sleep)

### Assert

Verify the expected outcome:

- Check page content, URLs, and UI state
- Verify API responses (status codes, body content)
- Check that side effects occurred (database records created, emails sent)
- Verify error states when testing failure scenarios

### Cleanup

Remove test artifacts:

- Delete created test data
- Reset any modified configurations
- Close opened connections or sessions
- Leave the system in the same state it was in before the test

## Common E2E Patterns

### Pattern: Happy Path First

Always implement the successful flow before testing error cases.

1. Write the happy path test (user completes the flow successfully)
2. Verify the happy path is stable and passes consistently
3. Then add error case tests (invalid input, network failures, auth failures)
4. Then add edge case tests (concurrent requests, timeout scenarios)

Rationale: the happy path test validates that the entire stack works. If the happy path fails, error case tests are meaningless.

### Pattern: Smoke Tests

A minimal set of E2E tests that verify the application starts and basic flows work:

- Application loads without errors
- Login works with valid credentials
- The primary feature is accessible and functional
- Critical API endpoints respond with expected status codes

Run smoke tests on every commit. They should complete in under 2 minutes. If a smoke test fails, the build is broken.

### Pattern: Critical Path Tests

Tests for the most important user flows -- the ones that directly impact revenue or user trust:

- User registration and onboarding
- Core feature workflow (the thing users pay for)
- Payment and billing (if applicable)
- Data export and deletion (compliance-critical)

Run critical path tests before every release and on the release candidate branch. They may take 5-15 minutes.

### Pattern: Contract Tests for Service Boundaries

When your E2E tests span multiple services, use contract tests to verify the API contract between them:

- Producer tests: verify the API produces responses matching the contract
- Consumer tests: verify the client correctly handles the contract responses
- Contract changes require both sides to update

This reduces the need for full cross-service E2E tests, which are expensive and flaky.

## Anti-Pattern Catalog

### Anti-Pattern: Testing Everything E2E

**What it looks like:** Writing E2E tests for every feature, including pure logic and simple CRUD operations.

**Why it is harmful:** E2E tests are slow (seconds to minutes per test), expensive to maintain, and brittle. A large E2E suite becomes a bottleneck that slows down development.

**Instead:** Use the testing pyramid -- unit tests for logic, integration tests for APIs and data access, E2E only for critical user flows. A healthy ratio is roughly 70% unit, 20% integration, 10% E2E.

### Anti-Pattern: Flaky Tests

**What it looks like:** Tests that pass or fail randomly without any code change. Developers re-run the suite hoping for green.

**Why it is harmful:** Flaky tests destroy trust in the test suite. Teams start ignoring failures, and real bugs slip through.

**Instead:**
- Use explicit waits instead of arbitrary sleep/delays
- Ensure clean state before each test (no leftover data from previous runs)
- Avoid timing-dependent assertions (use polling with timeout instead)
- Run flaky tests in isolation to identify the root cause
- Quarantine flaky tests until fixed -- do not leave them in the main suite

### Anti-Pattern: No Cleanup

**What it looks like:** Tests create data (users, records, files) but never clean up, causing subsequent tests to fail due to duplicate data or unexpected state.

**Why it is harmful:** Tests become order-dependent and fail in CI but pass locally (or vice versa).

**Instead:** Clean up in afterEach hooks. Use database transactions that roll back. Use unique identifiers (timestamps, UUIDs) for test data. Run each test in an isolated environment if possible.

### Anti-Pattern: Hardcoded Selectors

**What it looks like:** Tests use CSS selectors like `.btn-primary`, `#submit`, or DOM structure paths like `div > form > button:nth-child(3)`.

**Why it is harmful:** Any UI restructuring or CSS class change breaks the tests, even if the functionality is unchanged.

**Instead:** Use dedicated test attributes (`data-testid="login-button"`) that are decoupled from styling and structure. These survive redesigns.

### Anti-Pattern: No Test Data Strategy

**What it looks like:** Tests use the same hardcoded user ("admin@test.com") and assume it exists in the database.

**Why it is harmful:** Tests fail in fresh environments, cannot run in parallel (shared state conflicts), and mask data-dependent bugs.

**Instead:** Each test creates its own data, uses it, and cleans it up. Use factories or fixtures that generate unique, realistic test data.

## Integration with Our Tools

### Automated Review of E2E Tests

Use `oc_review` to check E2E test quality. The review engine evaluates:
- Test isolation (no shared state between tests)
- Proper cleanup (data created is data deleted)
- Realistic assertions (not just "page loaded")
- Flakiness risks (timing dependencies, non-deterministic data)

### TDD for E2E Tests

Reference the tdd-workflow skill for the RED-GREEN-REFACTOR approach when writing E2E tests:
1. **RED:** Write the E2E test for the user journey. It fails because the feature does not exist.
2. **GREEN:** Implement the feature (building up from unit and integration tests). The E2E test passes.
3. **REFACTOR:** Clean up the implementation. The E2E test still passes, confirming behavior is preserved.

## Failure Modes

### Test Is Flaky

**Symptom:** Test passes locally, fails in CI (or passes 9 out of 10 times).

**Diagnosis:** Check for timing dependencies (race conditions between UI updates and assertions), environment differences (ports, timeouts, screen resolution), and shared state (parallel test runs interfering).

**Fix:** Add explicit waits for async operations. Use unique test data per run. Ensure the CI environment matches local as closely as possible.

### Test Passes Locally but Fails in CI

**Symptom:** Consistent pass on developer machines, consistent fail in CI.

**Diagnosis:** Environment differences -- different browser versions, screen sizes, network latency, database contents, or missing environment variables.

**Fix:** Run tests in containers that match the CI environment. Use headless browsers with fixed viewport sizes. Check that all environment variables are set in CI config.

### Test Suite Is Too Slow

**Symptom:** E2E suite takes more than 15 minutes, blocking the deployment pipeline.

**Diagnosis:** Too many E2E tests, or tests are doing work that could be done at a lower level.

**Fix:** Move non-critical tests to integration level. Run smoke tests on every commit, critical path tests on release branches only. Parallelize test execution across multiple workers. Use shared authentication setup across tests instead of logging in for each one.
