# Phase 21: Content Expansion - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-03
**Phase:** 21-content-expansion
**Areas discussed:** OOP/SOLID scope, Java/C# skill depth, agents.md review, Starter templates, Frontend design skill

---

## OOP/SOLID Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Expand coding-standards | Add OOP/SOLID as new sections in existing skill | ✓ |
| Separate oop-patterns skill | Create new standalone skill | |
| You decide | Claude's discretion | |

**User's choice:** Expand coding-standards
**Notes:** None

---

## Java/C# Skill Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Match existing depth | ~250 lines each, matching go/python/rust patterns | ✓ |
| Deeper coverage | ~400-500 lines with testing and build tool patterns | |
| You decide | Claude's discretion | |

**User's choice:** Match existing depth
**Notes:** None

### Follow-up: Manifest Detection

| Option | Description | Selected |
|--------|-------------|----------|
| Standard manifests | pom.xml, build.gradle, *.csproj, *.sln | ✓ |
| You decide | Claude's discretion | |

**User's choice:** Standard manifests
**Notes:** None

---

## agents.md Review Command

| Option | Description | Selected |
|--------|-------------|----------|
| Validate + suggest | Structure validation AND improvement suggestions with score | ✓ |
| Validate only | Just check structure correctness | |
| You decide | Claude's discretion | |

**User's choice:** Validate + suggest
**Notes:** None

### Follow-up: Implementation Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Prompt-only command | Markdown command, no TypeScript tool. Follows oc-review-pr pattern | ✓ |
| Tool-backed command | New oc_review_agents tool in src/tools/ | |

**User's choice:** Prompt-only command
**Notes:** None

---

## Starter Templates

| Option | Description | Selected |
|--------|-------------|----------|
| web-api | REST/GraphQL backend agents | ✓ |
| cli-tool | CLI application agents | ✓ |
| library | Reusable package agents | ✓ |
| fullstack | Full-stack application agents | ✓ |

**User's choice:** All four templates
**Notes:** None

---

## Frontend Design Skill (User-Requested Addition)

| Option | Description | Selected |
|--------|-------------|----------|
| Add to Phase 21 | Add frontend-design skill alongside Java/C# | ✓ |
| Defer to future phase | Track as deferred idea | |
| You decide | Claude's discretion | |

**User's choice:** Add to Phase 21
**Notes:** User specifically requested "a frontend engineer with a state of the art skill in frontend design, like ux-ui-pro-max skill"

---

## Claude's Discretion

- OOP/SOLID section content and examples
- Java and C# specific patterns
- Frontend design skill structure and depth
- Glob-based manifest detection for .csproj/.sln
- Template agent compositions
- Review command scoring rubric

## Deferred Ideas

None — all discussed items included in phase scope.
