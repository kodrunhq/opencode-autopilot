# Phase 41: Agent Consolidation

**Goal:** Reduce agent count from 21 utility/pipeline agents to ~10 focused agents. Review engine's 21 agents consolidated while preserving adversarial + red-team approach.
**Depends on:** Phase 39 (context injection), Phase 40 (UX for visibility)
**Effort:** 2 plans, 7 tasks, ~1.5 days
**Risk:** MEDIUM — Agent changes affect user workflows
**PR Increment:** Consolidated agent definitions, deprecated agents marked

---

## Plan 41-01: Pipeline Agent Consolidation (3 tasks)

### Task 1: Merge oc-researcher + oc-explorer into oc-researcher
- **Files:** `src/agents/pipeline/oc-researcher.ts` (modify), `assets/agents/researcher.md` (modify)
- **Dependencies:** Phase 39 (context injection wired)
- **Action:** EXPLORE phase handler delegates to oc-researcher (already does research). Remove oc-explorer as separate entity. Mark as deprecated.
- **Test:** `tests/agents/agents-pipeline.test.ts` — pipeline still works with merged agent
- **Verification:** RECON and EXPLORE phases both use oc-researcher successfully
- **Worktree:** Yes — `wt/agents`

### Task 2: Merge oc-shipper + oc-retrospector
- **Files:** `src/agents/pipeline/oc-shipper.ts` (modify)
- **Dependencies:** Task 1
- **Action:** Retrospection becomes final stage of shipping. oc-retrospector logic folded into oc-shipper with clear section boundary.
- **Test:** `tests/agents/agents-pipeline.test.ts`
- **Verification:** SHIP phase produces docs + lessons in single pass

### Task 3: Consolidate utility agents
- **Files:** `src/agents/*.ts` (multiple), `assets/agents/*.md` (multiple)
- **Dependencies:** Tasks 1-2
- **Action:** Consolidate: coder (stays), debugger (stays), planner (stays), reviewer (stays), researcher (stays), autopilot (stays). Mark deprecated: documenter (→ coder with docs skill), devops (→ coder with docker skill), frontend-engineer (→ coder with frontend skill), db-specialist (→ coder with database skill).
- **Test:** `tests/agents/agents-visibility.test.ts` — only primary agents visible
- **Verification:** Tab cycle shows exactly primary agents

---

## Plan 41-02: Review Agent Consolidation (3 tasks)

### Task 4: Merge similar reviewers (8 → 4)
- **Files:** `src/review/agents/*.ts` (modify), `src/review/agent-catalog.ts` (modify)
- **Dependencies:** Task 3
- **Action:** Merge similar reviewers:
  - security-auditor + auth-flow-verifier → security-auditor
  - dead-code-scanner + silent-failure-hunter → code-hygiene-auditor
  - wiring-inspector + scope-intent-verifier + spec-checker → architecture-verifier
  - type-soundness + concurrency-checker → correctness-auditor
  - state-mgmt-auditor + react-patterns-auditor → frontend-auditor (stack-gated)
  - go-idioms-auditor + python-django-auditor + rust-safety-auditor → language-idioms-auditor
- Preserve adversarial and red-team separately.
- **Test:** `tests/review/agent-catalog.test.ts` — merged agents still work
- **Verification:** Review still produces adversarial + red-team perspectives

### Task 5: Update AGENT_REGISTRY
- **Files:** `src/registry/model-groups.ts` (modify), `src/registry/types.ts` (modify)
- **Dependencies:** Task 4
- **Action:** Remove deprecated agents from registry. Add migration that reassigns model overrides from old names to new consolidated names.
- **Test:** `tests/registry/model-groups.test.ts`, `tests/registry/resolver.test.ts`
- **Verification:** Old overrides for "documenter" resolve to "coder" model

### Task 6: Deprecation notices
- **Files:** `src/installer.ts` (modify)
- **Dependencies:** Task 5
- **Action:** Add deprecated agent names to `DEPRECATED_ASSETS`. Installer removes old agent files if auto-generated (not user-customized). Toast notice on first removal.
- **Test:** `tests/installer.test.ts` — deprecated agents cleaned up
- **Verification:** Old agent files removed, user-customized files preserved

### Task 7: Update agent catalog documentation
- **Files:** `docs/agent-catalog.md` (modify)
- **Dependencies:** Task 6
- **Action:** Document consolidated agents, their responsibilities, and why merging was done.
- **Test:** Links resolve, examples valid
- **Verification:** Documentation accurate

---

## Success Criteria

- [ ] Pipeline agents consolidated
- [ ] Utility agents consolidated
- [ ] 21 review → ~10 focused reviewers
- [ ] Adversarial + red-team preserved
- [ ] Deprecated agents cleaned up
- [ ] Model overrides migrated
- [ ] Documentation updated
- [ ] All tests pass