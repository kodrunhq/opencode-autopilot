# Phase 37: Category-Based Routing

**Goal**: Tasks auto-route to optimal model/agent based on category
**Depends on**: Phase 35 (background manager for parallel delegation)
**Effort**: 2 plans, 5 tasks, ~1.5 days
**Risk**: LOW — Routing is a pure mapping layer
**PR Increment**: `oc_delegate` tool, categories configurable

---

## Plan 37-01: Routing Engine (3 tasks)

### Task 1: Category definitions and registry
- **Files**: `src/routing/categories.ts` (new), `src/routing/types.ts` (new), `src/routing/index.ts` (new)
- **Dependencies**: Phase 32 (routing types)
- **Action**: Define categories: `quick`, `deep`, `visual-engineering`, `ultrabrain`, `writing`, `unspecified-low`, `unspecified-high`. Each maps to: model group, skill set, max iterations.
- **Test**: `tests/routing/categories.test.ts` — all categories valid
- **Verification**: Every category has model group + skill set
- **Worktree**: No — additive module

### Task 2: Category classifier
- **Files**: `src/routing/classifier.ts` (new)
- **Dependencies**: Task 1
- **Action**: Classify task description into category. Heuristic-based: keyword matching, file pattern analysis. Return `{ category, confidence, reasoning }`.
- **Test**: `tests/routing/classifier.test.ts` — known patterns classified correctly
- **Verification:** "fix typo" → quick, "implement auth" → deep, "add dark mode" → visual

### Task 3: Routing decision engine
- **Files**: `src/routing/engine.ts` (new)
- **Dependencies**: Tasks 1-2
- **Action:** Given category + config: select model, load skills, set parameters. Return `RoutingDecision`.
- **Test:** `tests/routing/engine.test.ts` — decisions respect config overrides
- **Verification:** Config overrides take precedence

---

## Plan 37-02: Tool + Integration (2 tasks)

### Task 4: `oc_delegate` tool
- **Files**: `src/tools/delegate.ts` (new)
- **Dependencies:** Task 3
- **Action:** Tool accepts: `task` (description), `category` (optional, auto-classified if omitted). Spawns background task with routing decision. Returns task ID.
- **Test:** `tests/tools/delegate.test.ts`
- **Verification:** Delegation creates background task with correct model/skills

### Task 5: Routing config in doctor
- **Files:** `src/health/checks.ts` (modify)
- **Dependencies:** Task 4
- **Action:** Doctor reports: categories configured, model mappings valid, skill sets resolve.
- **Test:** `tests/health/checks.test.ts` — routing health check
- **Verification:** Doctor flags missing category configs

---

## Success Criteria

- [ ] Category definitions complete
- [ ] Classifier works with known patterns
- [ ] Routing decision engine works
- [ ] `oc_delegate` tool works
- [ ] Doctor reports routing health
- [ ] All tests pass