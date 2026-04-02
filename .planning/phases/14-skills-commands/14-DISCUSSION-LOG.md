# Phase 14: Skills & Commands - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 14-skills-commands
**Areas discussed:** Scope & priority cut, Skill depth & format, Adaptive skill loading, Command design patterns

---

## Scope & Priority Cut

| Option | Description | Selected |
|--------|-------------|----------|
| Full 14a, trim 14b | Ship all 15 core (14a). From 14b, keep adaptive loading + TypeScript stack only. Defer rest. | |
| CRITICAL + HIGH only | Only 3 CRITICAL + 8 HIGH items. ~11 features. | |
| Full 14a + 14b | Ship all 22 features as originally scoped. Expect 6+ plans. | ✓ |
| Minimal: CRITICAL only | Just brainstorming, TDD, debugging + commands. 6 features. | |

**User's choice:** Full 14a + 14b — all 22 features
**Notes:** User chose the most ambitious scope despite this being the largest phase. Will subdivide into ~6 plans.

---

## Skill Depth & Format

### Methodology depth

| Option | Description | Selected |
|--------|-------------|----------|
| Full methodology | 200-400 lines per skill with anti-patterns, edge cases, failure modes | ✓ |
| Concise guides | 100-150 lines. Core steps + key principles. | |
| Reference cards | 50-80 lines. Workflow steps and key rules only. | |

**User's choice:** Full methodology
**Notes:** Consistent with coding-standards skill depth (~327 lines)

### Tool integration

| Option | Description | Selected |
|--------|-------------|----------|
| Reference our tools | Skills mention oc_review, oc_forensics, etc. Deeper integration. | ✓ |
| Stay generic | Tool-agnostic methodology. | |
| Layered | Core is generic, optional integration section at end. | |

**User's choice:** Reference our tools directly

### Language skill content model

| Option | Description | Selected |
|--------|-------------|----------|
| Patterns + testing + idioms | 200-300 lines covering idioms, testing, pitfalls, frameworks. | ✓ |
| Slim pattern reference | 100-150 lines. Most critical idioms and testing only. | |
| Testing-focused only | ~100 lines. Testing patterns only. | |

**User's choice:** Full patterns + testing + idioms

---

## Adaptive Skill Loading

### Detection mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Config hook injection | Auto-detect stack on load, inject matching skills via config hook. Reuse detectStackTags. | ✓ |
| Manifest detection only | Detect stack but skills self-declare required tags. Unmatched skills are inactive. | |
| User-configured stacks | User sets stack in oc-configure. No auto-detection. | |

**User's choice:** Config hook injection — automatic, no manual management

### Composable skill chains

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, implement now | Skills declare `requires: [skill-name]`. Formal dependency resolution + cycle detection. | ✓ |
| Defer to backlog | Skills standalone. References by name in prose only. | |
| Lightweight ordering | Skills declare priority number. No dependency graph. | |

**User's choice:** Implement composable chains now

---

## Command Design Patterns

### Skill-invoking commands

| Option | Description | Selected |
|--------|-------------|----------|
| Thin wrappers | Commands load matching skill and pass $ARGUMENTS. Skill has all methodology. | ✓ |
| Rich commands with skill ref | Commands have own workflow + reference skill for guidelines. | |
| Commands ARE skills | No separate files. Command markdown is the methodology. | |

**User's choice:** Thin wrappers

### Utility command backends

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated tools | oc_update_docs and oc_stocktake as tools with Zod schemas. | ✓ |
| Command-only | All logic as markdown instructions. No tool backend. | |
| Mixed approach | Stocktake gets a tool, update-docs stays command-only. | |

**User's choice:** Dedicated tools for both

### Asset linter placement

| Option | Description | Selected |
|--------|-------------|----------|
| Part of /stocktake | Lint checks integrated into stocktake — validates frontmatter, fields, structure. | ✓ |
| Separate tool | Dedicated oc_lint_assets tool. | |
| Built into creation tools | Validation on create only. No separate lint. | |

**User's choice:** Integrated into /stocktake

---

## Claude's Discretion

- Priority ordering of features within plans
- Exact content of each skill (guided by competitor analysis)
- How to batch features into ~6 plans
- Implementation details of dependency resolution algorithm

## Deferred Ideas

None — discussion stayed within phase scope.
