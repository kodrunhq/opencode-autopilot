# Phase 24: Coder Agent, Hash-Anchored Edits & Wave Automation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-03
**Phase:** 24-coder-agent-built-in-replacements
**Areas discussed:** Coder Agent design, Hash-anchored edits, Wave auto-assignment, Built-in replacements, Wiring audit & content gaps

---

## Coder Agent Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Pure implementer | Writes code, runs tests, fixes builds. Embeds tdd-workflow + coding-standards. Permissions: read, write, edit, bash. | ✓ |
| Implementer + reviewer hybrid | Also runs oc_review after writing code. Combines coding and self-review. | |
| Full-stack dev agent | Implements, tests, reviews, AND handles frontend design. Broadest scope. | |

**User's choice:** Pure implementer
**Notes:** Clean separation of concerns — reviewer agent handles reviews separately.

## Coder Agent Name

| Option | Description | Selected |
|--------|-------------|----------|
| coder | Tab cycle: autopilot, coder, debugger, planner, reviewer. Clear role name. | ✓ |
| builder | Tab cycle: autopilot, builder, debugger, planner, reviewer. Closer to built-in 'Build'. | |

**User's choice:** coder
**Notes:** Avoids confusion with OpenCode's built-in 'Build' agent.

## Coder Skills to Embed

| Option | Description | Selected |
|--------|-------------|----------|
| tdd-workflow | Red-green-refactor enforcement, test-first methodology. | ✓ |
| coding-standards | Style, patterns, naming conventions. | ✓ |
| verification | Post-implementation verification checklist. | |
| strategic-compaction | Context management for long sessions. | |

**User's choice:** tdd-workflow + coding-standards
**Notes:** Focused embedding — only the two most relevant skills.

## Coder Permissions

| Option | Description | Selected |
|--------|-------------|----------|
| read, write, edit, bash only | Focused implementer, no web access. | ✓ |
| Add webfetch too | Can look up library docs mid-implementation. | |

**User's choice:** read, write, edit, bash only
**Notes:** Web access is the researcher's job.

## Hash-Anchored Edit Tool Design

| Option | Description | Selected |
|--------|-------------|----------|
| New oc_hashline_edit tool | Standalone tool, coexists with built-in edit. | ✓ |
| PreToolUse hook on built-in edit | Intercept every edit call, validate hashes. | |
| Both: tool + optional hook | Maximum safety but more complexity. | |

**User's choice:** New standalone tool
**Notes:** Non-invasive — agents opt in via their prompts.

## Hash Format

| Option | Description | Selected |
|--------|-------------|----------|
| Omo's CID alphabet | ZPMQVRWSNKTXJBYH, two-char hashes (42#VK), 256 unique values. | ✓ |
| SHA-256 truncated to 4 hex | 65536 unique values, standard algorithm. | |
| Simple line content checksum | CRC32 or similar, 8 hex chars. | |

**User's choice:** Omo's CID alphabet
**Notes:** Ecosystem compatibility with omo, proven in production.

## Hash-Anchored Edit Users

| Option | Description | Selected |
|--------|-------------|----------|
| Coder agent | Primary code writer. | ✓ |
| Autopilot agent | Longest-running sessions, highest corruption risk. | ✓ |
| Debugger agent | Lower volume edits but still benefits. | ✓ |
| Pipeline agents (oc-implementer) | BUILD phase agents in orchestrator pipeline. | ✓ |

**User's choice:** All four — every code-writing agent
**Notes:** Maximum safety across all autonomous and interactive coding paths.

## Task Dependency Declaration

| Option | Description | Selected |
|--------|-------------|----------|
| Add depends_on to task schema | Auto-wave-assigner computes waves via topological sort. | ✓ |
| Keep manual wave + add validation | Planner still assigns waves manually with validation. | |
| Hybrid: depends_on with manual override | Auto-compute waves but allow planner override. | |

**User's choice:** Add depends_on to task schema
**Notes:** Full automation — planner declares deps, system computes waves.

## Completion Verification

| Option | Description | Selected |
|--------|-------------|----------|
| Git-based verification | Verify each task made commits after dispatch_multi. Retry once if no commits. | ✓ |
| Filesystem + git dual check | Check SUMMARY.md AND git commits. GSD-style. | |
| Skip for now | Current dispatch_multi signal sufficient. | |

**User's choice:** Git-based verification
**Notes:** Lightweight and reliable without requiring SUMMARY.md convention.

## Built-in Plan Agent Suppression

| Option | Description | Selected |
|--------|-------------|----------|
| Override via config hook | Set built-in 'Plan' agent to disabled/hidden if API supports. | ✓ |
| Name collision override | Register our planner as 'Plan' to shadow built-in. | |
| Coexist with documentation | Keep both, document preference. | |

**User's choice:** Override via config hook
**Notes:** Research needed on OpenCode's config API mechanism.

## Wiring Audit

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, include audit task | Final plan: oc_stocktake + oc_doctor, verify all wiring. | ✓ |
| No, rely on existing QA playbook | Phase 23 QA playbook already covers this. | |

**User's choice:** Include wiring audit as final phase task

## Content Expansion

| Option | Description | Selected |
|--------|-------------|----------|
| Defer to Phase 25 | Phase 24 is already substantial. Content expansion deserves its own phase. | ✓ |
| Add frontend-engineer agent only | Small scope addition. | |
| Include full content expansion | Multiple new skills, commands, agents. | |

**User's choice:** Defer to Phase 25
**Notes:** User wants more skills/commands to match competitors but agrees Phase 24 is already large enough.

---

## Claude's Discretion

- Exact Coder agent system prompt content
- `maxSteps` value for Coder agent
- Hash computation algorithm for CID alphabet mapping
- Wave-assigner cycle detection and error handling
- Git verification implementation details
- How to detect/suppress built-in Plan agent in OpenCode's config API

## Deferred Ideas

- Content expansion (more skills, commands, agents) → Phase 25
- Frontend engineer agent → Phase 25
- TDD enforcement hook (PostToolUse) → Future phase
- Context engineering improvements (selective history, structured files) → Future phase
