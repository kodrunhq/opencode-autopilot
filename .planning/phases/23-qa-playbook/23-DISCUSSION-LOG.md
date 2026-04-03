# Phase 23: QA Playbook - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-03
**Phase:** 23-qa-playbook
**Areas discussed:** Playbook structure, Test procedure depth, Coverage scope, Location and maintenance

---

## Playbook Structure and Format

### Organization

| Option | Description | Selected |
|--------|-------------|----------|
| Single markdown file (Recommended) | One QA-PLAYBOOK.md with TOC, searchable, single-session execution | ✓ |
| Directory with per-area files | Separate files per area. Better for parallel QA | |
| Hybrid | Main playbook + separate checklist | |

**User's choice:** Single markdown file

### Grouping

| Option | Description | Selected |
|--------|-------------|----------|
| By feature area (Recommended) | Commands, Agents, Tools, Skills, Memory, Fallback, Doctor, Observability | ✓ |
| By user journey | First install, Daily use, PR review, Debugging, Configuration | |
| By phase/milestone | Group by introducing phase | |

**User's choice:** By feature area

---

## Test Procedure Depth

### Detail Level

| Option | Description | Selected |
|--------|-------------|----------|
| Step-by-step with expected output (Recommended) | Prerequisites, Steps, Expected output, Pass/Fail criteria | ✓ |
| Input/output pairs only | Just command and expected result | |
| Narrative with screenshots | Full walkthrough with annotations | |

**User's choice:** Step-by-step with expected output

### Error Scenarios

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, one error case per feature (Recommended) | Each feature gets one negative test | ✓ |
| Happy path only | Success path only | |
| Comprehensive error matrix | All documented error conditions | |

**User's choice:** One error case per feature

---

## Coverage Scope

### Tool Coverage

| Option | Description | Selected |
|--------|-------------|----------|
| User-facing full, internal smoke (Recommended) | Full for user-invoked, smoke for internal | |
| All 20 tools get full procedures | Every tool gets detailed procedure | ✓ |
| Commands only | Only the 11 slash commands | |

**User's choice:** All 20 tools get full procedures

### Orchestrator Pipeline

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, abbreviated (Recommended) | One E2E procedure, verify all 8 phases complete | ✓ |
| Yes, per-phase | Separate procedure per pipeline phase | |
| No, skip pipeline | Pipeline tested by automated tests | |

**User's choice:** Abbreviated E2E

---

## Location and Maintenance

### File Location

| Option | Description | Selected |
|--------|-------------|----------|
| docs/QA-PLAYBOOK.md (Recommended) | In docs/ directory, visible on GitHub | ✓ |
| .planning/QA-PLAYBOOK.md | In planning directory | |
| assets/QA-PLAYBOOK.md | In assets directory | |

**User's choice:** docs/QA-PLAYBOOK.md

### Sync Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Manual update per phase (Recommended) | Future phases include playbook update task | ✓ |
| Version header with changelog | Formal versioning | |
| Auto-generated from code | Always in sync but less human-quality | |

**User's choice:** Manual update per phase

---

## Claude's Discretion

- Pass/fail criteria wording, section ordering, setup/teardown detail
- Whether to include a quick smoke test summary
- Expected output patterns for dynamic content

## Deferred Ideas

None — discussion stayed within phase scope.
