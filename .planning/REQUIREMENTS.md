# Requirements: OpenCode Assets Plugin

**Defined:** 2026-03-31
**Core Value:** Users can create and use high-quality agents, skills, and commands from within the OpenCode session

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Creation Tooling

- [ ] **CRTL-01**: User can type `/new-agent` in-session and get a new agent markdown file created with proper frontmatter, prompt, and tool permissions
- [ ] **CRTL-02**: User can type `/new-skill` in-session and get a new skill directory + SKILL.md created with proper frontmatter and structure
- [ ] **CRTL-03**: User can type `/new-command` in-session and get a new command markdown file created with template and description
- [ ] **CRTL-04**: Creation tools validate names (lowercase alphanumeric, hyphens, 1-64 chars for skills) and prevent path conflicts
- [ ] **CRTL-05**: Creation tools support both project-local (`.opencode/`) and global (`~/.config/opencode/`) installation targets

### Agents

- [ ] **AGNT-01**: Researcher agent that searches the web thoroughly about a topic and produces a clear, comprehensive report with sources
- [ ] **AGNT-02**: Metaprompter agent that crafts high-quality prompts, system instructions, and configurations for new agents, skills, and commands
- [ ] **AGNT-03**: Documenter agent that creates documentation, READMEs, SVGs, diagrams, GitHub badges, quickstarts, and wikis
- [ ] **AGNT-04**: PR Reviewer agent that reviews pull requests with structured feedback on code quality, security, and patterns

### Commands

- [ ] **CMND-01**: `/review-pr` command that reviews a GitHub PR with structured, actionable feedback

### Skills

- [ ] **SKLL-01**: Coding standards skill with style, patterns, and naming conventions the LLM can reference during code review and generation

### Plugin Infrastructure

- [x] **PLGN-01**: Single npm package installable via one line in `opencode.json`
- [x] **PLGN-02**: Plugin registers creation tools with Zod-validated schemas
- [ ] **PLGN-03**: Bundled assets (agents, skills, commands) are installed to correct filesystem paths
- [ ] **PLGN-04**: Works with any provider configured in OpenCode (model-agnostic agents)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Additional Agents

- **AGNT-05**: Code reviewer agent focused on code quality and patterns
- **AGNT-06**: Planner agent that creates structured implementation plans
- **AGNT-07**: TDD guide agent for test-driven development workflows
- **AGNT-08**: Security reviewer agent for secrets, injection, and auth analysis
- **AGNT-09**: Refactor helper agent for extract-function, rename, move patterns

### Additional Commands

- **CMND-02**: `/commit` command with AI-generated commit messages
- **CMND-03**: `/simplify` command to reduce code complexity

### Additional Skills

- **SKLL-02**: API patterns skill (REST/GraphQL best practices)
- **SKLL-03**: Testing strategies skill (test structure, mocking, coverage)

### Hooks

- **HOOK-01**: Pre-commit validation hook
- **HOOK-02**: Post-edit auto-format hook

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-agent orchestration | Oh My OpenCode's territory; massive scope for marginal v1 gain |
| MCP server bundling | Separate concern, own config, better as standalone plugins |
| Plugin marketplace / registry | Distribution is via npm; custom registry is a separate product |
| TUI theming | Cosmetic, not functional |
| Agent-to-agent delegation chains | Brittle, hard to debug, confusing UX |
| Porting Claude Code / ECC / GSD assets | Building fresh; most existing assets aren't actively used |
| LSP / AST-Grep integration | Heavy infrastructure, Oh My OpenCode already provides this |
| Claude Code compatibility layer | OpenCode already reads CLAUDE.md and .claude/skills/ natively |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PLGN-01 | Phase 1 | Complete |
| PLGN-02 | Phase 1 | Complete |
| PLGN-03 | Phase 1 | Pending |
| PLGN-04 | Phase 1 | Pending |
| CRTL-01 | Phase 2 | Pending |
| CRTL-02 | Phase 2 | Pending |
| CRTL-03 | Phase 2 | Pending |
| CRTL-04 | Phase 2 | Pending |
| CRTL-05 | Phase 2 | Pending |
| AGNT-01 | Phase 3 | Pending |
| AGNT-02 | Phase 3 | Pending |
| AGNT-03 | Phase 3 | Pending |
| AGNT-04 | Phase 3 | Pending |
| CMND-01 | Phase 3 | Pending |
| SKLL-01 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0

---
*Requirements defined: 2026-03-31*
*Last updated: 2026-03-31 after roadmap creation*
