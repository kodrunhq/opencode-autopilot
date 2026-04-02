# Phase 14: Skills & Commands - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement the skills and commands identified as high-priority gaps by Phase 11 research. Known candidates include brainstorming skill, PR comment review command, update-docs command, validate-agents-md command. Final scope defined by Phase 11 gap matrix.

</domain>

<decisions>
## Implementation Decisions

### Scope definition
- **D-01:** Final skill and command list comes from Phase 11 gap matrix — only items rated CRITICAL or HIGH priority
- **D-02:** Known candidates (pre-research): brainstorming skill (like superpowers), PR comment review command, /update-docs, /validate-agents-md
- **D-03:** Research may surface additional skills/commands we haven't thought of

### PR comment review command
- **D-04:** Similar to claude's existing PR comment review workflow — agent retrieves comments from a PR, assesses them, fixes or defers them, and replies
- **D-05:** Should use `gh` CLI for GitHub API interaction (consistent with existing patterns)

### Quality bar
- **D-06:** Every skill and command must be production-ready — not stubs or minimal implementations
- **D-07:** Each new asset should feel native to the plugin, following established patterns (tool registration, template system, frontmatter format)

### Claude's Discretion
- Exact list of skills and commands to implement (informed by Phase 11 research)
- Priority ordering within the phase
- Which skills are complex enough to need their own plan vs. can be batched

</decisions>

<specifics>
## Specific Ideas

- "Like the brainstorming skill from superpowers" — creative, guided ideation workflow
- PR comment review: "agent retrieves comments from a PR, assesses them, fixes them or defers them and replies to them"
- /update-docs, /validate-agents-md — utility commands for plugin maintenance
- "Good research onto what's missing from our plugin that people may need"

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 11 research output (primary input)
- `.planning/phases/11-ecosystem-research/` — Gap matrix and research report (must exist before this phase plans)

### Existing skills and commands (know what we have)
- `assets/skills/` — Current bundled skills
- `assets/commands/` — Current bundled commands
- `src/templates/skill-template.ts` — Skill generation template
- `src/templates/command-template.ts` — Command generation template

### Plugin patterns
- `CLAUDE.md` — Architecture overview, tool registration pattern, asset name validation

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Skill template (`src/templates/skill-template.ts`) — generates SKILL.md with proper frontmatter
- Command template (`src/templates/command-template.ts`) — generates command markdown
- Asset installer (`src/installer.ts`) — copies bundled assets to global config

### Established Patterns
- Skills are directories with SKILL.md files in `assets/skills/<name>/SKILL.md`
- Commands are markdown files in `assets/commands/<name>.md`
- Both use YAML frontmatter for metadata
- Asset name validation: `^[a-z0-9]+(-[a-z0-9]+)*$` (1-64 chars)

### Integration Points
- `assets/skills/` — where new skill directories go
- `assets/commands/` — where new command files go
- `src/installer.ts` — automatically copies new assets on plugin load

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 14-skills-commands*
*Context gathered: 2026-04-02*
