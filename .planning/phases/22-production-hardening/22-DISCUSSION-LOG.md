# Phase 22: Production Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-03
**Phase:** 22-production-hardening
**Areas discussed:** Mock fallback test mode, Context-aware commands, Skill-aware doctor, Anti-slop comment hook

---

## Mock Fallback Test Mode

### Activation Method

| Option | Description | Selected |
|--------|-------------|----------|
| Config flag only (Recommended) | Add fallback.testMode to plugin config (v6 migration). Persists across sessions. | ✓ |
| Runtime toggle via tool | Add oc_fallback_test tool for per-session toggle. | |
| Both config + tool | Config sets default, tool overrides per-session. | |

**User's choice:** Config flag only
**Notes:** Clean separation from production behavior. No new tool needed.

### Failure Scenarios

| Option | Description | Selected |
|--------|-------------|----------|
| Rate limit (429) (Recommended) | Tests retry + backoff logic. | ✓ |
| Quota exceeded | Tests model-switch behavior. | ✓ |
| Service unavailable (503) | Tests cooldown + recovery path. | ✓ |
| Malformed response | Tests edge case resilience. | ✓ |

**User's choice:** All four scenarios
**Notes:** Full coverage of the fallback system's error handling paths.

### Triggering Mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Deterministic sequence (Recommended) | Ordered list of failures, cycles through. Predictable. | ✓ |
| Random with seed | Random failures with configurable probability. | |
| Every-Nth call | Fixed frequency failure injection. | |

**User's choice:** Deterministic sequence
**Notes:** Reproducible test scenarios for consistent validation.

---

## Context-Aware Commands

### Detection Mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Inject via $LANGUAGE variable (Recommended) | Resolve detectProjectStackTags() and inject into command prompts. | ✓ |
| Commands call detection themselves | LLM checks manifest files at runtime. | |
| New $PROJECT_CONTEXT block | Richer context block with language, framework, patterns. | |

**User's choice:** $LANGUAGE variable injection
**Notes:** Follows existing $ARGUMENTS pattern. Reuses adaptive-injector detection.

### Commands to Make Language-Aware

| Option | Description | Selected |
|--------|-------------|----------|
| oc-tdd (Recommended) | TDD workflow varies by language. Most impactful. | ✓ |
| oc-review-pr | PR review with language-specific conventions. | ✓ |
| oc-brainstorm | Language-idiomatic pattern suggestions. | ✓ |
| oc-write-plan | Language-specific tooling in plans. | ✓ |

**User's choice:** All four commands
**Notes:** Broad coverage across the command surface.

---

## Skill-Aware Doctor

### Skill Diagnostics Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Per-stack summary (Recommended) | Show detected stacks and skill match counts. Concise. | ✓ |
| Per-skill line items | List every skill with load status. Verbose. | |
| Both with verbosity flag | Summary default, detail with --verbose. | |

**User's choice:** Per-stack summary
**Notes:** Actionable without being overwhelming.

### Memory DB Health

| Option | Description | Selected |
|--------|-------------|----------|
| Existence + row count (Recommended) | Check file exists, report observation count and last date. | ✓ |
| Full integrity check | PRAGMA integrity_check, FTS5 index, schema version. | |
| Existence only | Just check file exists. Minimal. | |

**User's choice:** Existence + row count
**Notes:** Covers common failure mode without performance risk.

### Command Accessibility

| Option | Description | Selected |
|--------|-------------|----------|
| File existence in target dir (Recommended) | Verify .md files exist in target. | |
| File existence + frontmatter parse | Check files AND parse YAML frontmatter for completeness. | ✓ |
| You decide | Claude picks appropriate depth. | |

**User's choice:** File existence + frontmatter parse
**Notes:** Catches both missing and corrupted/incomplete commands.

---

## Anti-Slop Comment Hook

### Enforcement Level

| Option | Description | Selected |
|--------|-------------|----------|
| Warn only (Recommended) | Print warning with offending lines. Non-blocking. | ✓ |
| Auto-fix (remove) | Automatically strip slop comments. Aggressive. | |
| Configurable profiles | Multiple levels: warn, fix, block. | |

**User's choice:** Warn only
**Notes:** Good default for v1 since false positives are likely.

### Detection Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Regex pattern list (Recommended) | Curated regex patterns for common AI slop. Fast, deterministic. | ✓ |
| LLM-based analysis | Send diff to LLM for analysis. Accurate but recursive. | |
| Heuristic scoring | Multi-dimensional comment scoring. More nuanced. | |

**User's choice:** Regex pattern list
**Notes:** Fast, deterministic, easy to extend. Same pattern as error-classifier.

### File Type Scope

| Option | Description | Selected |
|--------|-------------|----------|
| All code files (Recommended) | Fire on .ts, .tsx, .js, .jsx, .py, .go, .rs, .java, .cs, .rb, .cpp, .c, .h | ✓ |
| Only TypeScript/JavaScript | Start narrow with plugin's own stack. | |
| Configurable file types | User specifies extensions in config. | |

**User's choice:** All code files
**Notes:** Broad coverage. Skip non-code files like .md, .json, .yaml.

---

## Claude's Discretion

- Exact regex patterns for anti-slop list
- $LANGUAGE resolution and injection mechanism
- Comment syntax detection per language
- Config v6 schema structure
- Mock failure integration with state machine
- Doctor output formatting

## Deferred Ideas

None — discussion stayed within phase scope.
