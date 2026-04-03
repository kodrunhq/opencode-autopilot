---
description: Review a GitHub PR with structured, actionable feedback
agent: pr-reviewer
---
Review the pull request specified by $ARGUMENTS.

Before running any commands, validate that $ARGUMENTS is a valid PR identifier (a number or a URL). If it contains shell metacharacters or does not look like a PR reference, ask the user to provide a valid PR number.

First, gather the PR context:

1. Run `gh pr view $ARGUMENTS` to get the PR title, description, author, and status
2. Run `gh pr diff $ARGUMENTS` to get the full diff
3. If the diff is large, run `gh pr diff $ARGUMENTS --name-only` first to identify changed files, then review them in logical groups

Then analyze the PR against these dimensions:

The project uses $LANGUAGE. Apply language-specific idioms, framework conventions, and ecosystem best practices when reviewing.

- **Correctness:** Does the code do what the PR description claims? Are there logic errors, off-by-one bugs, or missing edge cases?
- **Security:** Are there hardcoded secrets, unsanitized inputs, missing auth checks, or injection vulnerabilities?
- **Code quality:** Does the code follow the coding-standards skill? Check naming, file size, function size, error handling, immutability, and separation of concerns.
- **Testing:** Are there tests for new functionality? Do existing tests still cover the changed code paths?
- **Performance:** Are there N+1 queries, unnecessary allocations, missing indexes, or unbounded loops?

Provide your review in this structure:

## Summary

What the PR does in 2-3 sentences.

## Findings

List issues by severity. For each finding, include the file, line range, what is wrong, and a suggested fix.

- **CRITICAL** -- Must fix before merge (security vulnerabilities, data loss, crashes)
- **HIGH** -- Should fix before merge (logic errors, missing error handling, broken edge cases)
- **MEDIUM** -- Consider fixing (code quality, naming, minor refactoring opportunities)
- **LOW** -- Nit-level suggestions (style, optional improvements)

If no issues are found at a severity level, omit that level.

## Positive Notes

What the PR does well -- good patterns, clean abstractions, thorough tests.

## Verdict

One of:
- **APPROVE** -- No critical or high issues. Ready to merge.
- **REQUEST_CHANGES** -- Has critical or high issues that must be addressed.
- **NEEDS_DISCUSSION** -- Architectural or design concerns that need team input.
