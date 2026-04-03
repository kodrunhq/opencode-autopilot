# Phase 21: Content Expansion - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Expand coding standards with OOP/SOLID principles, add Java and C# language-specific skills, add a frontend design skill, create an agents.md review command, and provide starter agents.md templates for four project types. All content assets — no new TypeScript tools.

</domain>

<decisions>
## Implementation Decisions

### OOP/SOLID Expansion
- **D-01:** Expand the existing `assets/skills/coding-standards/SKILL.md` with new sections for OOP/SOLID rather than creating a separate skill. Keeps all universal principles in one place.
- **D-02:** New sections: "OOP Principles" (all 5 SOLID principles with DO/DON'T examples) and "Composition & Architecture" (composition over inheritance, dependency injection, Clean Architecture layers).
- **D-03:** Estimated growth: ~200 lines → ~350-400 lines. Well within the 800-line guideline for assets.

### Java Language Skill
- **D-04:** Create `assets/skills/java-patterns/SKILL.md` (~250 lines) matching the depth of existing language skills (go-patterns, python-patterns, etc.).
- **D-05:** Cover: idiomatic Java (records, sealed classes, Optional), Spring Boot patterns (DI, layered arch), JPA/Hibernate conventions, common pitfalls (null handling, streams).
- **D-06:** Stack detection: add `pom.xml`, `build.gradle`, `build.gradle.kts` to `MANIFEST_TAGS` in `src/skills/adaptive-injector.ts` with tag `["java"]`.

### C# Language Skill
- **D-07:** Create `assets/skills/csharp-patterns/SKILL.md` (~250 lines) matching the same depth.
- **D-08:** Cover: idiomatic C# (records, pattern matching), .NET patterns (DI, middleware pipeline), Entity Framework conventions, common pitfalls (async/await, disposal).
- **D-09:** Stack detection: add `.csproj` and `.sln` detection to `MANIFEST_TAGS`. Note: these use glob patterns (not exact filenames) — may need special handling in the injector since current detection uses `access()` on exact filenames.

### Frontend Design Skill
- **D-10:** Create `assets/skills/frontend-design/SKILL.md` (~300 lines) — a state-of-the-art UX/UI design skill covering component architecture, responsive design, accessibility, state management patterns, animation/interaction design, color theory, typography, mobile-first methodology, and design system integration.
- **D-11:** Stack detection: loaded when React, Vue, Svelte, or Angular manifest files are detected (already covered by existing `package.json` → `["javascript"]` tag, but should also check for framework-specific indicators).

### agents.md Review Command
- **D-12:** Prompt-only command at `assets/commands/oc-review-agents.md`. No new TypeScript tool — the command IS the prompt, following the /oc-review-pr pattern.
- **D-13:** The command validates structure (frontmatter, prompt, permissions) AND suggests improvements (prompt quality, missing tools, agent coverage for project type). Outputs a score.

### Starter Templates
- **D-14:** Four starter templates: `web-api`, `cli-tool`, `library`, `fullstack`. Each is a curated agents.md file with appropriate agents for that project type.
- **D-15:** Templates are bundled in `assets/templates/` (new directory) and referenced by the `/oc-review-agents` command when suggesting improvements.

### Claude's Discretion
- Exact content of OOP/SOLID sections (within the DO/DON'T opinionated tone)
- Exact Java and C# patterns to include (within the ~250 line budget)
- Frontend design skill content structure and depth
- How to handle glob-based manifest detection for .csproj/.sln (D-09)
- Which agents go in each starter template
- The review command's scoring rubric
- Whether frontend-design needs a new stack tag or piggybacks on existing javascript/typescript tags

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Skills (Reference Patterns)
- `assets/skills/coding-standards/SKILL.md` — Skill being expanded with OOP/SOLID (D-01)
- `assets/skills/go-patterns/SKILL.md` — Reference for language skill structure and depth
- `assets/skills/python-patterns/SKILL.md` — Reference for language skill structure
- `assets/skills/typescript-patterns/SKILL.md` — Reference for language skill structure

### Adaptive Skill Injection
- `src/skills/adaptive-injector.ts` — `MANIFEST_TAGS` constant for stack detection; `detectProjectStackTags()` function
- `src/skills/loader.ts` — Skill loading from assets directory

### Command Pattern
- `assets/commands/oc-review-pr.md` — Reference for prompt-only command structure
- `assets/commands/oc-stocktake.md` — Reference for tool-backed command (contrast)

### Asset Installer
- `src/installer.ts` — Copies assets to `~/.config/opencode/`; handles new directories automatically

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- 4 existing language skills provide the exact template for java-patterns and csharp-patterns
- coding-standards skill structure (numbered sections with DO/DON'T format) guides OOP/SOLID expansion
- 10 existing commands show the oc- prefixed markdown format
- Asset installer already handles new skill directories and command files

### Established Patterns
- Language skills use frontmatter with `name` and `description` fields
- Skill content follows: When to Use → Principles → Patterns → Anti-Patterns → Integration
- `MANIFEST_TAGS` maps exact filenames to tag arrays — .csproj/.sln need special handling (glob)
- Commands use `---` YAML frontmatter with `name`, `description`, and optional `argument-hint`

### Integration Points
- `src/skills/adaptive-injector.ts` `MANIFEST_TAGS` — add java and csharp entries
- `assets/skills/` — add java-patterns, csharp-patterns, frontend-design directories
- `assets/commands/` — add oc-review-agents.md
- `assets/templates/` — new directory for starter templates
- `src/installer.ts` — may need update if templates directory needs special handling

</code_context>

<specifics>
## Specific Ideas

- Frontend design skill should be "state of the art" — inspired by ux-ui-pro-max style content covering practical design patterns, not just theory
- agents.md review should provide a numerical score (e.g., 6/10) alongside specific suggestions
- Starter templates should be immediately usable — a user copies one and has a working agent setup

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. The frontend design skill was explicitly added to Phase 21 scope per user request.

</deferred>

---

*Phase: 21-content-expansion*
*Context gathered: 2026-04-03*
