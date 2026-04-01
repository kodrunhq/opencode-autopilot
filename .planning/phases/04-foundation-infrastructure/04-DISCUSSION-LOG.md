# Phase 4: Foundation Infrastructure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-03-31
**Phase:** 04-foundation-infrastructure
**Areas discussed:** State persistence format, Agent dispatch pattern, Config schema design, Artifact storage location

---

## State Persistence Format

| Option | Description | Selected |
|--------|-------------|----------|
| Single JSON file + Zod | One state.json with full pipeline state. Zod schema validates on every read. Matches existing config.ts pattern. | ✓ |
| Split JSON files | Separate files per concern: state.json, decisions.json, confidence.json. More I/O. | |
| JSON + append-only logs | state.json for state + .jsonl append-only logs for decisions/confidence. Best for high-frequency writes. | |

**User's choice:** Single JSON file + Zod
**Notes:** Clean single source of truth. Decisions and confidence entries embed as arrays inside the same file.

---

## Agent Dispatch Pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Tool returns JSON instruction | oc_orchestrate returns {action: 'dispatch', agent: '...', prompt: '...'}. Orchestrator agent parses and dispatches. | ✓ |
| Orchestrator as agent only | Skip tool layer. Agent has pipeline logic inline, calls thin persistence tools. | |
| Hybrid: agent + thin tools | Agent drives pipeline, tools enforce correctness guardrails. | |

**User's choice:** Tool returns JSON instruction
**Notes:** All state machine logic in TypeScript, not in agent prompt. Lean orchestrator agent (~100 lines).

### Follow-up: Dispatch Validation Level

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal proof: agent->tool->agent | Single dispatch cycle proves viability. | |
| Full loop proof | Multi-step: dispatch -> complete -> re-dispatch -> advance state -> next dispatch -> complete. | ✓ |
| You decide | Claude determines level. | |

**User's choice:** Full loop proof
**Notes:** No half-measures on the hard gate.

---

## Config Schema Design

| Option | Description | Selected |
|--------|-------------|----------|
| Version bump + migration | Bump to version: 2, migration function upgrades v1 on load. | ✓ |
| Additive extension | Keep version: 1, new fields optional with Zod defaults. | |
| Nested namespaces | New fields under config.orchestrator.*, config.review.*, etc. | |

**User's choice:** Version bump + migration
**Notes:** Clean and explicit. V1 configs auto-upgrade on load.

---

## Artifact Storage Location

| Option | Description | Selected |
|--------|-------------|----------|
| .opencode-autopilot/ in project root | Dedicated directory, clear ownership, easy to .gitignore. | ✓ |
| .opencode/orchestrator/ | Inside OpenCode's config dir. Mixes plugin data with OpenCode data. | |
| You decide | Claude picks based on conventions. | |

**User's choice:** .opencode-autopilot/ in project root
**Notes:** Matches hands-free's .hands-free/ pattern.

---

## Claude's Discretion

- Internal TypeScript module structure
- Zod schema field names and nesting depth
- Whether to use mitt event bus in Phase 4 or defer
- Test structure and organization
- Exact config namespace field names

## Deferred Ideas

None -- discussion stayed within phase scope.
