# Phase 42: Skill-Embedded MCPs

**Goal:** MCP servers scoped to skills. Load on-demand, no global context bloat.
**Depends on:** Phase 41 (consolidated agents use skills)
**Effort:** 2 plans, 5 tasks, ~2 days
**Risk:** HIGH — MCP integration depends on OpenCode plugin API
**PR Increment:** Skills can declare MCP dependencies, MCPs load when skill activates

---

## Plan 42-01: MCP Lifecycle (3 tasks)

### Task 1: MCP configuration schema
- **Files:** `src/mcp/types.ts` (new), `src/mcp/index.ts` (new)
- **Dependencies:** Phase 32 (mcp config section)
- **Action:** Define MCP config per skill: server name, transport (stdio/sse), command/args, env vars, scope (read/write/execute). Validate against Zod schema.
- **Test:** `tests/mcp/types.test.ts`
- **Verification:** Skill YAML frontmatter with `mcp:` section validates
- **Worktree:** Yes — `wt/mcp`

### Task 2: MCP lifecycle manager
- **Files:** `src/mcp/manager.ts` (new)
- **Dependencies:** Task 1
- **Action:** Start MCP server when skill activates, stop when skill deactivates. Connection pooling (reuse across sessions). Health check on start. Graceful shutdown on plugin unload.
- **Test:** `tests/mcp/manager.test.ts` — start/stop/health lifecycle
- **Verification:** MCP server starts and stops cleanly

### Task 3: Scope filtering
- **Files:** `src/mcp/scope-filter.ts` (new)
- **Dependencies:** Task 2
- **Action:** Filter MCP tool/resource access based on skill-declared scope. Read-only skills can't call write tools. Log scope violations.
- **Test:** `tests/mcp/scope-filter.test.ts`
- **Verification:** Write tool call from read-only skill returns permission error

---

## Plan 42-02: Integration (2 tasks)

### Task 4: Wire skills to MCPs
- **Files:** `src/skills/adaptive-injector.ts` (modify), `src/skills/loader.ts` (modify)
- **Dependencies:** Task 3
- **Action:** When skill loads: check for `mcp:` section in SKILL.md frontmatter. If present and `config.mcp.enabled`: start MCP server. Inject MCP tools into agent context.
- **Test:** `tests/skills/adaptive-injector.test.ts` — MCP section detected and loaded
- **Verification:** Skill with MCP config auto-starts server

### Task 5: MCP health in doctor
- **Files:** `src/health/checks.ts` (modify)
- **Dependencies:** Task 4
- **Action:** Doctor reports: MCP-enabled skills, server health, connection status, scope config.
- **Test:** `tests/health/checks.test.ts`
- **Verification:** Doctor shows MCP status for each skill

---

## Success Criteria

- [ ] MCP config schema defined
- [ ] Lifecycle manager starts/stops servers
- [ ] Scope filtering works
- [ ] Skills wire to MCPs
- [ ] Doctor reports MCP health
- [ ] All tests pass
- [ ] MCP servers load on-demand