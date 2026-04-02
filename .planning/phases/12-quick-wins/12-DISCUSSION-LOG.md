# Phase 12: Quick Wins & Fixes - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 12-quick-wins
**Areas discussed:** Doctor & diagnostics, Config repair scope, Quick task mode

---

## Doctor & Diagnostics

### Health Check Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Core essentials only | 14 agents, config v4, asset dirs, no corrupted JSON. Fast <100ms | ✓ |
| Full diagnostic suite | Add model connectivity, hook verification, tool schema validation. ~500ms | |
| Minimal — config only | Just validate config + migration | |

**User's choice:** Core essentials only
**Notes:** None

### /doctor Report Format

| Option | Description | Selected |
|--------|-------------|----------|
| Pass/fail checklist | ✓/✗ per check with fix suggestions. Like brew doctor | ✓ |
| Detailed diagnostic dump | Full system state, config contents, checksums | |
| JSON output | Structured JSON with --json flag | |

**User's choice:** Pass/fail checklist
**Notes:** None

### Auto-repair Logging

| Option | Description | Selected |
|--------|-------------|----------|
| Silent with toast | Repairs silent, single toast if anything fixed | ✓ |
| Always silent | Never mention repairs | |
| Verbose log | Log every check to file, toast on repairs | |

**User's choice:** Silent with toast
**Notes:** None

---

## Config Repair Scope

### Edge Case Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Migration + structural repair | Migration chain + fix missing fields, remove unknown keys, repair invalid values | ✓ |
| Migration only | Just run chain, report structural issues | |
| Full rebuild option | Add --reset-config nuclear option | |

**User's choice:** Migration + structural repair
**Notes:** None

### Agent Re-injection

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, re-inject on load | Config hook already does this every load — it IS the repair | ✓ |
| Only via /doctor --fix | Manual action required | |

**User's choice:** Yes, re-inject on load
**Notes:** None

---

## Quick Task Mode

### Pipeline Simplification

| Option | Description | Selected |
|--------|-------------|----------|
| Skip RECON+CHALLENGE+ARCHITECT | Go straight to PLAN→BUILD→SHIP. Still review + retrospective | ✓ |
| BUILD-only mode | No planning, no review. Maximum speed | |
| Defer to v3.1 | Focus on CRITICAL items only | |

**User's choice:** Skip RECON+CHALLENGE+ARCHITECT
**Notes:** None

### Detection Method

| Option | Description | Selected |
|--------|-------------|----------|
| User explicitly invokes /quick | No auto-detection. Predictable, no false positives | ✓ |
| Auto-detect + confirm | Suggest quick mode for simple requests | |
| Auto-detect silently | Auto-use shortened pipeline | |

**User's choice:** User explicitly invokes /quick
**Notes:** None

---

## Claude's Discretion

- Health check registry design pattern
- Toast implementation approach
- /doctor output formatting
- /quick pipeline configuration method

## Deferred Ideas

None — discussion stayed within phase scope
