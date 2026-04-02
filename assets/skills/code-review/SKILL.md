---
name: code-review
description: Structured methodology for requesting and receiving code reviews -- what to check, how to provide feedback, and how to respond to review comments
stacks: []
requires:
  - coding-standards
---

# Code Review

A structured methodology for high-quality code reviews. Whether you are requesting a review, performing one, or responding to feedback, follow these guidelines to maximize the value of every review cycle.

## When to Use

- Before merging any pull request
- After completing a feature or bug fix
- When reviewing someone else's code
- When `oc_review` flags issues that need human judgment
- After refactoring sessions to catch unintended behavior changes

## Requesting a Review

A good review request sets the reviewer up for success. The less guessing a reviewer has to do, the better the feedback you get back.

### Provide Context

Every review request should include:

- **What the change does** -- one sentence summary of the behavior change
- **Why it is needed** -- link to the issue, user story, or design decision
- **What alternatives were considered** -- and why this approach was chosen
- **Testing done** -- what was tested, how, and what edge cases were covered

### Highlight Risky Areas

Call out areas where you are uncertain or where the change is particularly impactful:

- "I am unsure about the error handling in auth.ts lines 40-60"
- "The migration is irreversible -- please double-check the column drop"
- "This changes the public API surface -- backward compatibility impact"

### Keep PRs Small

- Target under 300 lines of meaningful diff (exclude generated files, lockfiles, snapshots)
- If a change is larger, split it into stacked PRs or a feature branch with incremental commits
- Each PR should be independently reviewable and shippable
- One concern per PR -- do not mix refactoring with feature work

### Self-Review First

Before requesting a review from others:

1. Read through the entire diff yourself as if you were the reviewer
2. Run `oc_review` for automated multi-agent analysis
3. Check that tests pass and coverage is maintained
4. Verify you have not left any TODO markers, debug logging, or commented-out code
5. Use the coding-standards skill as a checklist for naming, structure, and error handling

## Performing a Review

Review in this order for maximum value. Architecture issues found early save the most rework.

### 1. Architecture

- Does the overall approach make sense for the problem being solved?
- Are responsibilities properly separated between modules?
- Does this introduce new patterns that conflict with existing conventions?
- Are the right abstractions being used (not too many, not too few)?
- Will this scale to handle the expected load or data volume?

### 2. Correctness

- Does the code do what it claims to do?
- Are edge cases handled? (null inputs, empty collections, boundary values)
- Are error paths covered? (network failures, invalid data, timeouts)
- Is the logic correct for concurrent or async scenarios?
- Are state transitions valid and complete?

### 3. Security

- Is all user input validated at the boundary? (Reference the coding-standards skill)
- Are authentication and authorization checks in place?
- Are secrets handled properly? (no hardcoding, no logging)
- Is output properly escaped to prevent XSS?
- Are SQL queries parameterized?
- Is CSRF protection enabled for state-changing endpoints?

### 4. Performance

- Any N+1 query patterns? (fetching in a loop instead of batching)
- Unbounded loops or recursion? (missing limits, no pagination)
- Missing database indexes for frequent queries?
- Unnecessary memory allocations? (large objects created in hot paths)
- Could any expensive operations be cached or deferred?

### 5. Readability

- Are names descriptive and intention-revealing?
- Are functions small and focused (under 50 lines)?
- Are files focused on a single concern (under 400 lines)?
- Is the nesting depth reasonable (4 levels or less)?
- Would a future developer understand this without asking the author?

### 6. Testing

- Do tests exist for all new behavior?
- Do existing tests still pass?
- Are edge cases tested (not just the happy path)?
- Are tests independent and deterministic (no flaky tests)?
- Is the test structure clear? (arrange-act-assert)

## Providing Feedback

### Use Severity Levels

Every review comment should be tagged with a severity so the author can prioritize:

- **CRITICAL** -- Must fix before merge. Bugs, security issues, data loss risks.
- **HIGH** -- Should fix before merge. Missing error handling, performance issues, incorrect behavior in edge cases.
- **MEDIUM** -- Consider fixing. Code quality improvements, better naming, minor refactoring opportunities.
- **LOW** -- Nit. Style preferences, optional improvements, suggestions for future work.

### Be Specific

Bad: "This is confusing."
Good: "The variable `data` on line 42 of user-service.ts does not convey what it holds. Consider renaming to `activeUserRecords` to match the query filter on line 38."

Every comment should include:

- The file and line (or line range)
- What the issue is
- A suggested fix or alternative approach

### Be Constructive

- Explain WHY something is a problem, not just WHAT is wrong
- Offer alternatives when pointing out issues
- Acknowledge good work -- positive feedback reinforces good patterns
- Use "we" language -- "We could improve this by..." not "You did this wrong"
- Ask questions when unsure -- "Is there a reason this is not using the existing helper?"

## Responding to Review Comments

### Address Every Comment

- Fix the issue, or explain why the current approach is intentional
- Never ignore a review comment without responding
- If you disagree, explain your reasoning -- the reviewer may have missed context
- If you agree but want to defer, create a follow-up issue and link it

### Stay Professional

- Do not take feedback personally -- reviews are about code, not about you
- Ask for clarification if a comment is unclear
- Thank reviewers for catching issues -- they saved you from a production bug
- If a discussion gets long, move to a synchronous conversation (call, pair session)

### Mark Resolved Comments

- After addressing a comment, mark it as resolved
- If the fix is in a follow-up commit, reference the commit hash
- Do not resolve comments that were not actually addressed

## Integration with Our Tools

### Automated Review with oc_review

Use `oc_review` for automated multi-agent code review. The review engine runs up to 21 specialist agents (universal + stack-gated) covering:

- Logic correctness and edge cases
- Security vulnerabilities and input validation
- Code quality and maintainability
- Testing completeness and test quality
- Performance and scalability concerns
- Documentation and naming

Automated review is a complement to human review, not a replacement. Use it for the mechanical checks so human reviewers can focus on architecture and design decisions.

### Coding Standards Baseline

Use the coding-standards skill as the shared baseline for quality checks. This ensures all reviewers apply the same standards for naming, file organization, error handling, immutability, and input validation.

### Review Workflow

The recommended workflow for any change:

1. Self-review the diff
2. Run `oc_review` for automated analysis
3. Address any CRITICAL or HIGH findings from automated review
4. Request human review with the context template above
5. Address human review feedback
6. Merge when all CRITICAL and HIGH items are resolved

## Anti-Pattern Catalog

### Anti-Pattern: Rubber-Stamp Reviews

**What it looks like:** Approving a PR after a cursory glance, or approving without reading the diff at all.

**Why it is harmful:** Defeats the entire purpose of code review. Bugs, security issues, and design problems ship to production uncaught.

**Instead:** Spend at least 10 minutes per 100 lines of meaningful diff. If you do not have time for a thorough review, say so and let someone else review.

### Anti-Pattern: Style-Only Reviews

**What it looks like:** Only commenting on formatting, whitespace, and naming conventions while ignoring logic, architecture, and security.

**Why it is harmful:** Misallocates review effort. Style issues are the least impactful category and can often be caught by linters.

**Instead:** Focus on correctness and architecture first (items 1-4 in the review order). Save style comments for LOW severity nits at the end.

### Anti-Pattern: Blocking on Nits

**What it looks like:** Requesting changes or withholding approval for trivial style preferences (single-line formatting, import order, comment wording).

**Why it is harmful:** Slows down delivery, creates frustration, and discourages submitting PRs. The cost of the delay exceeds the value of the nit fix.

**Instead:** Approve the PR with suggestions for LOW items. The author can address them in a follow-up or not -- it is their call.

### Anti-Pattern: Drive-By Reviews

**What it looks like:** Leaving a single comment on a large PR without reviewing the rest, giving the impression the PR was reviewed.

**Why it is harmful:** Creates false confidence that the code was reviewed when it was not.

**Instead:** If you only have time for a partial review, say so explicitly: "I only reviewed the auth changes, not the database migration. Someone else should review that part."

### Anti-Pattern: Review Ping-Pong

**What it looks like:** Reviewer leaves one comment, author fixes it, reviewer finds a new issue, author fixes that, ad infinitum.

**Why it is harmful:** Each round-trip adds latency. A thorough first review is faster than five rounds of incremental feedback.

**Instead:** Review the entire PR in one pass. Leave all comments at once. If you spot a pattern issue, note it once and add "same issue applies to lines X, Y, Z."

## Failure Modes

- **Review takes too long:** The PR is too large. Split it into smaller PRs.
- **Reviewer and author disagree:** Escalate to a tech lead or use an ADR (Architecture Decision Record) for design disagreements.
- **Same issues keep appearing:** The team needs better shared standards. Update the coding-standards skill or add linter rules.
- **Reviews feel adversarial:** Revisit the team's review culture. Reviews should feel collaborative, not combative.
