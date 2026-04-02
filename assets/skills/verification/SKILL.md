---
name: verification
description: Pre-completion verification checklist methodology to catch issues before marking work as done
stacks: []
requires: []
---

# Verification

A systematic pre-completion checklist methodology. Apply this before marking any task, feature, or PR as complete. Every step is a gate — if it fails, the work is not done.

## When to Use

- Before marking any task as complete
- Before committing code
- Before opening or merging a pull request
- Before deploying to any environment
- Before saying "this is done" to anyone
- After refactoring existing code
- After fixing a bug (to verify the fix and check for regressions)

The cost of catching issues before completion is 10x cheaper than catching them after merge and 100x cheaper than catching them in production. This checklist exists because developers consistently overestimate the completeness of their own work.

## The Verification Checklist

### Step 1: Requirements Check

Re-read the original requirement, task description, or issue. Do not rely on your memory of what was asked.

**Process:**
1. Open the original requirement (ticket, issue, plan task, PR description)
2. List every stated requirement — each one is a checkbox
3. For each requirement, identify the specific code that satisfies it
4. Mark each requirement as satisfied or not
5. If any requirement is not satisfied, the work is not done

**What to check:**
- Every explicit requirement has a corresponding implementation
- Edge cases mentioned in the requirement are handled
- Acceptance criteria (if provided) are met
- The implementation does not introduce behavior that contradicts the requirement
- Optional requirements are either implemented or explicitly deferred with a reason

**Red flags:**
- You cannot point to specific code for a requirement — it is missing
- You implemented something adjacent to the requirement but not the requirement itself
- You added features that were not requested (scope creep)

### Step 2: Code Quality Check

Run automated quality checks. Do not skip these because "it is a small change."

**Process:**
1. Run the linter: `bun run lint` (or the project equivalent)
2. Run the type checker: `bunx tsc --noEmit` (for TypeScript projects)
3. Run the formatter: `bun run format` (or the project equivalent)
4. Search for debug artifacts: `console.log`, `debugger`, `print()` statements
5. Search for deferred work: `TODO`, `FIXME`, `HACK`, `XXX` comments that should be resolved
6. Check file sizes — no file should exceed 800 lines

**What to check:**
- Zero linter errors (warnings are acceptable only if pre-existing)
- Zero type errors
- No formatting violations
- No debug statements left in production code
- No new TODO/FIXME comments that should be resolved before merge
- All new files are under 400 lines (target), none over 800 lines (hard limit)

**Red flags:**
- Suppressing linter rules with inline comments (`// eslint-disable`) without justification
- Type assertions (`as any`, `as unknown`) used to silence type errors instead of fixing them
- Large functions (over 50 lines) or deeply nested code (over 4 levels)

### Step 3: Test Verification

Run the test suite. No exceptions.

**Process:**
1. Run the full test suite: `bun test`
2. Check that all existing tests pass (zero regressions)
3. Verify that new code has test coverage
4. If new functionality has no tests, write them before proceeding
5. Check test quality — are tests testing behavior or implementation details?

**What to check:**
- All tests pass (not just the ones you think are relevant)
- New public functions and endpoints have at least one test
- Error paths are tested (not just the happy path)
- Edge cases identified in Step 1 have corresponding tests
- Tests are deterministic — no flaky tests introduced

**Red flags:**
- Skipped tests (`it.skip`, `xit`, `@pytest.mark.skip`) without a tracking issue
- Tests that pass by coincidence (testing the wrong thing)
- Tests that mock so heavily they do not test real behavior
- Missing tests for error handling paths

**Reference:** Use the tdd-workflow skill for writing tests when coverage is missing.

### Step 4: Integration Check

Does the change work with the rest of the system? Unit tests passing is necessary but not sufficient.

**Process:**
1. Trace all imports — are new exports consumed correctly by their callers?
2. Check type compatibility at module boundaries — do interfaces match between producer and consumer?
3. Run the application and manually verify the feature works end-to-end
4. Check that the feature integrates with existing features without breaking them
5. Verify configuration — are all required config values, environment variables, and feature flags set?

**What to check:**
- No broken imports or missing exports
- Type interfaces match between modules (producer returns what consumer expects)
- The feature works when invoked through its actual entry point (not just in isolation)
- Existing features that interact with the changed code still work
- Database migrations (if any) apply cleanly and are reversible

**Red flags:**
- The feature works in tests but fails when run for real
- You only tested the feature in isolation, never with the full system
- New environment variables or configuration are undocumented

### Step 5: Edge Case Review

Think adversarially. What inputs or conditions could break this?

**Process:**
1. For each input, consider: empty, null/undefined, very large, malformed, special characters
2. For each external call, consider: timeout, network failure, unexpected response, rate limiting
3. For each concurrent operation, consider: race conditions, duplicate submissions, stale data
4. For each state transition, consider: invalid state, repeated transitions, partial failure

**What to check:**
- Empty input does not crash (returns appropriate error or default)
- Very large input does not cause memory issues or timeouts
- Null/undefined values are handled (not passed through to crash later)
- Concurrent access is safe (no race conditions on shared state)
- Network failures are handled gracefully (retry, timeout, fallback)
- Partial failures do not leave the system in an inconsistent state

**Red flags:**
- Functions that assume input is always valid without checking
- No timeout on external calls (HTTP requests, database queries)
- Shared mutable state without synchronization
- Error handling that swallows the error and continues with bad data

### Step 6: Security Scan

Check for common security issues. This is not a full security audit — it is a pre-commit sanity check.

**Process:**
1. Search for hardcoded secrets: API keys, passwords, tokens, connection strings
2. Verify all user inputs are validated before use
3. Check that error messages do not leak sensitive data (stack traces, SQL queries, internal paths)
4. Verify authentication and authorization on new endpoints or tools
5. Check for injection risks: SQL injection, XSS, command injection, path traversal

**What to check:**
- No secrets in source code (use environment variables or secret managers)
- All user input is validated at the boundary (schema validation preferred)
- Error messages are safe for end users (no internal details)
- New endpoints require authentication
- Authorized actions check permissions (not just authentication)
- Dynamic queries use parameterized statements (never string concatenation)

**Red flags:**
- API keys or tokens in source code or committed config files
- User input passed directly to database queries, shell commands, or HTML output
- Detailed error messages exposed to end users
- New endpoints accessible without authentication

## Integration with Our Tools

Use these tools as part of the verification process:

- **`oc_review`** — Invoke before marking any task as complete. Provides automated code review that catches issues you might miss reviewing your own code. This is the single most important verification step.
- **`oc_doctor`** — Run to verify plugin health and configuration integrity. Catches broken tool registrations, missing assets, and config corruption.
- **`oc_session_stats`** — Check for error patterns in the current session. If the session shows repeated errors, investigate before declaring the work complete.
- **`oc_forensics`** — When a verification step fails and the root cause is not obvious, use forensics to trace the issue systematically.

## Anti-Pattern Catalog

### Anti-Pattern: "Works on My Machine"

**What goes wrong:** You test only in your local environment and miss environment-specific issues (different OS, different Node/Bun version, different config, missing env vars).

**Instead:** Check for environment-specific assumptions. Hardcoded paths, OS-specific APIs, version-specific features. If CI exists, verify it passes there too.

### Anti-Pattern: Skipping Tests for Small Changes

**What goes wrong:** "It is just a one-line change" — and that one line breaks three other things. Small changes cause big bugs because they slip through review.

**Instead:** Always run the full test suite. The smaller the change, the faster the tests run anyway.

### Anti-Pattern: Reviewing Your Own Code

**What goes wrong:** You will miss the same things you missed when writing the code. Confirmation bias means you see what you expect to see, not what is actually there.

**Instead:** Use `oc_review` for an independent automated review. For critical changes, request a human review as well.

### Anti-Pattern: Verifying Only the Happy Path

**What goes wrong:** The feature works perfectly with valid input. It crashes spectacularly with empty input, null values, or unexpected types.

**Instead:** Step 5 (Edge Case Review) exists for this reason. Test the boundaries, not just the center.

### Anti-Pattern: Deferring Verification to Later

**What goes wrong:** "I will add tests later" or "I will check security before release." Later never comes, and the technical debt compounds.

**Instead:** Verify now. Every step of this checklist should pass before the work leaves your hands.

## Failure Modes

### Linter Fails
Fix the issues before proceeding. If a linter rule is genuinely wrong for your case, add a justified inline suppression comment — but question whether the rule is actually wrong or your code needs restructuring.

### Tests Fail
Do not comment out or skip the failing test. Diagnose the failure using the systematic-debugging skill. The test may be wrong (update it), or your code may be wrong (fix it). Determine which before changing anything.

### Type Errors
Trace the type mismatch to its source. Do not use `as any` to suppress the error. The type system is telling you something — usually that your mental model of the data does not match reality.

### Security Issue Found
Stop and fix it immediately. Do not defer security issues. If the fix requires significant changes, that is a sign the code needs restructuring, not that the security issue should be ignored.

### Integration Failure
If the feature works in isolation but fails in integration, the issue is at a module boundary. Check: are you producing the data the consumer expects? Are interfaces aligned? Is the contract documented?

## Quick Reference

For a fast pre-commit check, verify at minimum:

1. `bun run lint` passes
2. `bun test` passes
3. No hardcoded secrets
4. `oc_review` has no CRITICAL findings
5. Every requirement has corresponding code

The full 6-step checklist is for marking work as complete. The quick reference is for every commit.
