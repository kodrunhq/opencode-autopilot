# Gap Analysis Deep Dive

## Comprehensive Research Document

---

## 1. Executive Summary

This document provides a thorough analysis of the research conducted on advanced AI coding agent patterns, focusing on identifying genuine capability gaps that opencode-autopilot could address. The analysis draws from multiple authoritative sources including omo (oh-my-opencode), GSD (Get Shit Done), Superpowers, and community research on Claude Code skills.

### Key Corrections from Previous Analysis

A significant correction was identified regarding the previously claimed "autonomous execution" gap. Upon closer examination, the opencode-autopilot autopilot agent already possesses loop capability similar to Ralph Loop. The agent calls `oc_orchestrate` in a loop until the action returns "complete"—this is fundamentally the same pattern as omo's Ralph Loop. The previous gap analysis was incorrect on this point.

### Overview of Identified Gaps

Four primary areas were analyzed in depth:

| Area | Status | Impact |
|------|--------|--------|
| Hash-anchored edits (omo) | Gap identified | Prevents stale-line corruption in autonomous sessions |
| Wave-based parallel execution (GSD) | Gap identified | 5-10x BUILD phase speedup |
| TDD enforcement (Superpowers) | Gap identified | Quality enforcement for test-first development |
| Context engineering (GSD) | Gap identified | Maintains quality in long-running sessions |
| Autonomous execution | **Not a gap** | Already implemented via oc_orchestrate loop |

---

## 2. Hash-Anchored Edits (omo) - Full Analysis

### The Problem: Stale-Line Errors

Hash-anchored edits address one of the most insidious failure modes in autonomous AI coding agents: the **stale-line error**. This occurs when the file state changes between the time an agent reads a file and when it attempts to edit it.

#### What Happens When File Changes Between Read and Edit

1. **Read Phase**: Agent reads file content with line numbers 1-100
2. **External Change**: Another agent, background process, or parallel tool modifies the file (adds 5 lines at line 50)
3. **Edit Phase**: Agent attempts to edit line 75, but:
   - Line 75 now contains different content (shifted by 5 lines)
   - Or the edit targets the wrong position entirely
   - Or the edit corrupts the file structure

#### Examples of When This Occurs

| Scenario | Cause of Drift |
|----------|----------------|
| Parallel agents editing same file | Agent A reads, Agent B edits, Agent A edits stale content |
| Background tooling | Pre-commit hooks, formatters, or linters modify files mid-session |
| Autonomous sessions | Long-running sessions where context refreshes cause re-reads of changed files |
| Multi-file refactoring | Changes to imports shift line numbers across dependent files |

#### Why Standard Edit Tools Fail Silently or Corrupt Code

Standard edit tools use simple line number references:
- `edit(filePath, "42", "new content")` — references line 42 by number only
- No validation that line 42 still contains what was originally read
- Edits apply to the wrong code, often producing syntactically invalid output
- Silent failures are common: the edit "succeeds" but produces broken code

### How Hash-Anchored Edits Work

The omo project (oh-my-opencode) implements hash-anchored edits through the `hashline_edit` tool, which provides safe, precise file editing using LINE#ID validation.

#### LINE#ID Format

Every line in the codebase receives a unique reference combining line number and content hash:

```
{line_number}#{hash_id}
```

- **line_number**: 1-based line number
- **hash_id**: Two characters from the CID alphabet: `ZPMQVRWSNKTXJBYH` (16 characters = 256 unique values)

**Example from read output:**

```
42#VK| function hello() {
43#PM|   console.log("world")
44#QR| }
```

#### Hash Alphabet Details

The CID (Content ID) alphabet provides 16 characters, yielding 256 unique hash values (16² = 256). This is sufficient for distinguishing individual lines within a file while keeping identifiers compact.

**Hash alphabet**: `Z P M Q V R W S N K T X J B Y H`

#### Validation Pipeline

When a hashline_edit is submitted, the following validation occurs:

1. **Parse**: Extract line number and hash ID from LINE#ID reference
2. **Compute Hash**: Read current file content and compute hash for referenced lines
3. **Compare**: Match computed hash against provided hash ID
4. **Decision**:
   - **Match**: Proceed with edit operation
   - **Mismatch**: Reject edit with updated LINE#ID tags showing what changed

#### Error Recovery with Updated Anchors

When hash mismatch is detected, the tool provides recovery information:

```
2 lines have changed since last read. Use updated {line_number}#{hash_id} references below (>>> marks changed lines).

    40#MQ| function processData(data) {
    41#NK|   const result = transform(data)
>>> 42#XJ|   return validate(result)  // Changed: added validation
    43#PM|   return result
    44#QR| }
```

The agent can copy the updated LINE#ID tags from the error output and retry the edit.

#### Edit Operations

The hashline_edit tool supports three operation types:

| Operation | Description | Parameters |
|-----------|-------------|------------|
| `replace` | Replace single line or range | `pos`, optional `end`, `lines` |
| `append` | Insert after anchor | `pos` (optional), `lines` |
| `prepend` | Insert before anchor | `pos` (optional), `lines` |

**Replace examples:**

```typescript
// Replace single line
{ op: "replace", pos: "42#VK", lines: "function hello(name: string) {" }

// Replace range
{ op: "replace", pos: "42#VK", end: "44#QR", lines: ["line1", "line2", "line3"] }

// Delete line
{ op: "replace", pos: "43#PM", lines: null }
```

### Why It Matters (Quantified)

omo reported significant improvements with hash-anchored editing:

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Edit success rate | 6.7% | 68.3% | 10x improvement |
| Silent corruption | Common | Prevented | N/A |

The dramatic improvement in success rate demonstrates that stale-line errors were a primary failure mode in autonomous sessions.

### Architecture

```
Input: {pos: "42#VK", lines: "new content"}
  ↓
Validation Layer:
  1. Parse LINE#ID → {line: 42, hash: "VK"}
  2. Read current file content
  3. Compute hash for line 42
  4. Compare: computed hash vs "VK"
  ↓ (match → proceed, mismatch → reject with updated anchors)
Edit Operations:
  - replace/append/prepend
  - Bottom-up ordering (highest line numbers first)
  - Autocorrect (indentation, line endings)
  ↓
Diff Generation:
  - Unified diff shown for verification
```

**Execution Pipeline (omo implementation):**

```
hashline-edit-executor.ts
  → normalize-edits.ts       # Parse RawHashlineEdit → HashlineEdit
  → validation.ts            # Validate LINE#ID references
  → edit-ordering.ts         # Sort bottom-up (descending line numbers)
  → edit-deduplication.ts    # Remove duplicate operations
  → edit-operations.ts       # Apply each operation
  → autocorrect-replacement-lines.ts  # Auto-fix indentation
  → hashline-edit-diff.ts    # Generate diff output
```

### FAQ: Why It Matters When We Have Worktrees?

A common question arises: Git worktrees already solve file-level conflicts—why do we need hash-anchored edits?

| Concern | Git Worktrees | Hash-Anchored Edits |
|---------|---------------|---------------------|
| **Problem solved** | File-level conflicts between multiple agents on different filesystems | Line-level drift within a single agent's session |
| **Scope** | Agent isolation (different directories, different branches) | Edit validation (same file, different timing) |
| **When it matters** | Parallel agents modifying same file simultaneously | Agent reads file, something changes, agent edits |

**They're orthogonal concerns:**

- Git worktrees provide filesystem-level isolation for parallel agent execution
- Hash-anchored edits provide edit-level validation for sequential execution within a session
- Both are necessary for robust autonomous operation

---

## 3. Wave-Based Parallel Execution (GSD) - Full Analysis

### The Problem: Sequential Execution Waste

In traditional AI coding workflows, tasks execute sequentially—one after another. This creates significant waste when tasks are independent.

#### Current Sequential Flow

Consider a typical BUILD phase with 20 tasks:

```
Task 1 → Task 2 → Task 3 → ... → Task 20
  2min    2min     2min          2min
Total: 40+ minutes
```

The problem: if tasks 1-5 are independent, they're still executed sequentially, wasting time that could be used for parallel work.

#### Time Wasted When Tasks Are Independent

| Scenario | Tasks | Sequential Time | Ideal Parallel Time |
|----------|-------|-----------------|---------------------|
| 20 independent tasks | 20 | 40 min | 2 min |
| 20 tasks with 4 chains | 20 | 40 min | 10 min |

Even with realistic dependencies, significant speedup is achievable.

### How Wave-Based Execution Works

GSD implements wave-based parallelization through a dependency-aware system.

#### Dependency Analysis

Each plan declares its dependencies via a `depends_on` field:

```yaml
---
plan_id: "01-02"
title: "Implement user authentication"
depends_on: ["01-01"]
---
```

#### Wave Assignment Algorithm

The wave assignment algorithm performs topological sorting with wave grouping:

```
1. Find all plans with zero dependencies → Wave 1
2. Remove Wave 1 plans from consideration
3. Find remaining plans with zero dependencies → Wave 2
4. Repeat until all plans are assigned
```

**Example dependency graph:**

```
Plan A: no deps
Plan B: no deps
Plan C: depends on A
Plan D: depends on A, B
Plan E: depends on C
```

**Wave assignment:**

| Wave | Plans | Reasoning |
|------|-------|-----------|
| Wave 1 | [A, B] | No dependencies |
| Wave 2 | [C, D] | C depends on A (Wave 1), D depends on A,B (Wave 1) |
| Wave 3 | [E] | Depends on C (Wave 2) |

**Execution order:**

```
Wave 1: [A, B]     ← parallel execution
    ↓ (wait for completion)
Wave 2: [C, D]     ← parallel execution
    ↓ (wait for completion)
Wave 3: [E]        ← parallel execution
```

#### Execution Implementation

The orchestrator manages wave execution:

```typescript
// Pseudocode for wave execution
for (wave = 1; wave <= maxWave; wave++) {
  const plans = getPlansByWave(wave)
  
  // Spawn parallel tasks for all plans in wave
  const tasks = plans.map(plan => spawnTask(plan))
  
  // Wait for all tasks to complete
  await Promise.all(tasks)
  
  // Verify completion via filesystem check
  for (const plan of plans) {
    if (!verifyCompletion(plan)) {
      handleFailure(plan)
    }
  }
  
  // Proceed to next wave
}
```

#### Completion Verification

GSD uses dual verification to handle runtime bugs:

1. **Filesystem check**: Verify `SUMMARY.md` exists for the plan
2. **Git check**: Verify commits were made for the specific plan ID

This handles cases where the `Task()` tool fails to return completion signals due to runtime bugs (e.g., `classifyHandoffIfNeeded` errors in Claude Code).

### Why It Matters (Quantified)

| Scenario | Sequential | Wave-Based | Speedup |
|----------|-----------|------------|---------|
| 20 independent tasks | 40 min | 2 min | 20x |
| 20 tasks with 4 chains | 40 min | 10 min | 4x |
| 20 tasks with complex dependencies | 40 min | 15 min | 2.7x |

**Realistic improvement: 5-10x speedup in BUILD phase**

### Architecture

```
Phase: PLAN
  ↓
Dependency Analysis:
  - Parse depends_on field from each plan
  - Build dependency graph
  ↓
Topological Sort:
  - Order plans respecting dependencies
  ↓
Wave Assignment:
  - Group into waves (zero-deps → Wave 1, etc.)
  ↓

Phase: BUILD
  ↓
For wave = 1 to maxWave:
  1. Get plans[wave]
  2. Spawn Task() for each (parallel)
  3. Wait for all complete
     - Primary: Task() return signal
     - Fallback: SUMMARY.md + git check
  4. Next wave
  ↓

Failure Handling:
  - Task fails → retry once
  - Unresolvable → mark failed, continue wave
  - Track in agent-history.json
```

#### Context Rotation: Key Insight

A critical architectural principle is **context rotation**:

- GSD spawns each executor with a fresh 200K context
- The orchestrator stays at 30-40% context usage
- Heavy work happens in fresh subagent contexts

This prevents "context rot"—the quality degradation that occurs when a single agent's context fills up over time.

```
┌─────────────────────────────────────────────────────────────────┐
│                      ORCHESTRATOR                               │
│                   (stays at 30-40% context)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Spawns agents → Each gets fresh 200K context                  │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  Executor A  │  │  Executor B  │  │  Executor C  │         │
│  │  (200K ctx)  │  │  (200K ctx)  │  │  (200K ctx)  │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Runtime-Specific Behavior

Wave-based parallelization adapts to the AI runtime environment:

| Runtime | Behavior | Reason |
|---------|----------|--------|
| **Claude Code** | Parallel spawning via `Task()` tool | Reliable completion signals |
| **Copilot** | Sequential inline execution | Completion signals unreliable |

For Copilot, GSD forces `COPILOT_SEQUENTIAL=true` and follows `execute-plan.md` directly for each plan instead of spawning agents.

---

## 4. TDD Enforcement (Superpowers) - Full Analysis

### The Problem: AI Skips Tests

Test-Driven Development (TDD) is widely acknowledged as a best practice, yet AI coding agents consistently skip it. Common patterns include:

- "I'll add tests after to verify it works"
- Writing tests after implementation that pass immediately
- Missing edge cases due to implementation bias

#### Why Tests Written After Pass Immediately

When tests are written after code is implemented:

1. The tests verify what the code **does**, not what it **should do**
2. Implementation details bias the test design
3. Edge cases are forgotten under time pressure
4. The tests prove nothing—they pass because the code was written to pass them

### How Superpowers Enforces TDD

The Superpowers skill provides an ironclad enforcement mechanism that goes beyond suggestion.

#### The Iron Law (Non-Negotiable)

```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

**Enforcement rules:**

- Write code before the test? Delete it. Start over.
- No keeping code as "reference"
- No "adapting" it while writing tests
- No looking at it during test creation

**Implementation:** Delete production code, implement fresh from tests. Period.

#### Red-Green-Refactor Cycle

The TDD cycle is enforced through mandatory verification at each stage:

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│     RED      │ ──→ │    GREEN     │ ──→ │  REFACTOR   │
│Write failing │     │  Minimal     │     │   Clean up  │
│    test     │     │ code to pass │     │  (after     │
│              │     │              │     │   green)    │
└──────────────┘     └──────────────┘     └──────────────┘
       ↓                    ↓                    ↓
  npm test FAIL       npm test PASS         npm test PASS
```

##### RED: Write Failing Test First

Write one minimal test showing what should happen:

```typescript
// Good
test('retries failed operations 3 times', async () => {
  let attempts = 0;
  const operation = () => {
    attempts++;
    if (attempts < 3) throw new Error('fail');
    return 'success';
  };

  const result = await retryOperation(operation);

  expect(result).toBe('success');
  expect(attempts).toBe(3);
});
```

Clear name, tests real behavior, one thing.

```typescript
// Bad
test('retry works', async () => {
  const mock = jest.fn()
    .mockRejectedValueOnce(new Error())
    .mockRejectedValueOnce(new Error())
    .mockResolvedValueOnce('success');
  await retryOperation(mock);
  expect(mock).toHaveBeenCalledTimes(3);
});
```

Vague name, tests mock not code.

##### Verify RED: Watch It Fail (MANDATORY)

```bash
npm test path/to/test.test.ts
```

Confirm:
- Test fails (not errors)
- Failure message is expected
- Fails because feature missing (not typos)

**If test passes?** You're testing existing behavior. Fix test.

**If test errors?** Fix error, re-run until it fails correctly.

##### GREEN: Minimal Code

Write simplest code to pass the test:

```typescript
// Just enough to pass
async function retryOperation(fn: () => Promise): Promise {
  for (let i = 0; i < 3; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === 2) throw e;
    }
  }
  throw new Error('unreachable');
}
```

```typescript
// Over-engineered
async function retryOperation(
  fn: () => Promise,
  options?: {
    maxRetries?: number;
    backoff?: 'linear' | 'exponential';
    onRetry?: (attempt: number) => void;
  }
): Promise {
  // YAGNI
}
```

Don't add features, refactor other code, or "improve" beyond the test.

##### Verify GREEN: Watch It Pass (MANDATORY)

```bash
npm test path/to/test.test.ts
```

Confirm:
- Test passes
- Other tests still pass
- Output pristine (no errors, warnings)

**If test fails?** Fix code, not test.

**If other tests fail?** Fix now.

##### REFACTOR: Clean Up

After green only:
- Remove duplication
- Improve names
- Extract helpers

Keep tests green. Don't add behavior.

#### Verification (MANDATORY)

Before marking work complete, verify:

- [ ] Every new function/method has a test
- [ ] Watched each test fail before implementing
- [ ] Each test failed for expected reason (feature missing, not typo)
- [ ] Wrote minimal code to pass each test
- [ ] All tests pass
- [ ] Output pristine (no errors, warnings)
- [ ] Tests use real code (mocks only if unavoidable)
- [ ] Edge cases and errors covered

Can't check all boxes? You skipped TDD. Start over.

### Enforcement vs Suggestion

| TDD as Suggestion | TDD as Enforcement |
|-------------------|-------------------|
| "You should write tests first" | "Delete production code if no failing test" |
| Tests can be skipped | Unskipable |
| After-the-fact accepted | Must fail before implementation |
| Best-effort compliance | Mandatory cycle |

### Rationalizations Addressed

Superpowers directly addresses common rationalizations:

| Excuse | Reality |
|--------|---------|
| "Too simple to test" | Simple code breaks. Test takes 30 seconds. |
| "I'll test after" | Tests passing immediately prove nothing |
| "Tests after achieve same goals" | Tests-after = "what does this do?" Tests-first = "what should this do?" |
| "Already manually tested" | Ad-hoc ≠ systematic. No record, can't re-run. |
| "Deleting X hours is wasteful" | Sunk cost fallacy. Keeping unverified code is technical debt. |
| "Keep as reference, write tests first" | You'll adapt it. That's testing after. Delete means delete. |
| "Need to explore first" | Fine. Throw away exploration, start with TDD. |
| "TDD will slow me down" | TDD faster than debugging. Pragmatic = test-first. |

### Red Flags - STOP and Start Over

- Code before test
- Test after implementation
- Test passes immediately
- Can't explain why test failed
- Tests added "later"
- Rationalizing "just this once"
- "I already manually tested it"
- "Tests after achieve the same purpose"
- "It's about spirit not ritual"
- "Keep as reference" or "adapt existing code"
- "Already spent X hours, deleting is wasteful"
- "TDD is dogmatic, I'm being pragmatic"
- "This is different because..."

**All of these mean: Delete code. Start over with TDD.**

---

## 5. Context Engineering (GSD) - Full Analysis

### The Problem: Claude Quality Degrades with Context

Claude Code exhibits predictable quality degradation as context fills:

| Context Usage | Quality | Claude's Behavior |
|---------------|---------|-------------------|
| 0-30% | PEAK | Thorough, comprehensive |
| 30-50% | GOOD | Confident, solid work |
| 50-70% | DEGRADING | Efficiency mode begins |
| 70%+ | POOR | Rushed, minimal |

Most AI coding workflows ignore this curve. GSD is built around managing it.

### How GSD Context Engineering Works

GSD solves context rot through three mechanisms:

#### 1. Structured Context Files with Size Limits

Every GSD project maintains carefully designed context files:

| File | Purpose | Size Limit |
|------|---------|------------|
| `PROJECT.md` | Project vision | ~500 lines |
| `REQUIREMENTS.md` | Scoped requirements | ~1000 lines |
| `ROADMAP.md` | Where you're going | ~800 lines |
| `STATE.md` | Memory across sessions | ~300 lines |
| `PLAN.md` | Atomic task | ~200 lines |
| `SUMMARY.md` | What happened | ~300 lines |
| `CONTEXT.md` | Implementation preferences | ~400 lines |
| `RESEARCH.md` | Ecosystem knowledge | ~500 lines |

#### 2. Multi-Agent Architecture

The orchestrator stays lean while heavy work happens in fresh subagent contexts:

```
┌─────────────────────────────────────────────────────────────────┐
│                      ORCHESTRATOR                               │
│                   (stays at 30-40% context)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Spawns agents → Each gets fresh 200K context                  │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  Researcher  │  │   Planner    │  │  Executor A  │         │
│  │  (200K ctx)  │  │  (200K ctx)  │  │  (200K ctx)  │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐                           │
│  │  Executor B  │  │  Verifier    │                           │
│  │  (200K ctx)  │  │  (200K ctx)  │                           │
│  └──────────────┘  └──────────────┘                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Result:** An entire phase can execute with the main context at 30-40%.

#### 3. Atomic Task Scoping

Plans are sized to complete within ~50% context (not 80%):

| Task Complexity | Tasks/Plan | Context/Task | Total |
|----------------|------------|-------------|-------|
| Simple (CRUD, config) | 3 | ~10-15% | ~30-45% |
| Complex (auth, payments) | 2 | ~20-30% | ~40-50% |
| Very complex (migrations) | 1-2 | ~30-40% | ~30-50% |

#### 4. Selective History Loading (Two-Step)

GSD doesn't load every prior SUMMARY.md. It uses a digest strategy:

**Step 1: Generate digest index**
- Lightweight summaries for all completed phases
- Includes: tech_stack, decisions, patterns, affects

**Step 2: Score relevance**
- For current phase, score each prior phase by:
  - **affects overlap**: Does it touch same subsystems?
  - **provides dependency**: Does current phase need what it created?
  - **patterns**: Are its patterns applicable?

**Step 3: Load top 2-4 phases**
- Load full SUMMARY.md only for highest-scoring phases
- Keep digest-level context for everything else

### Context Assembly by Agent Type

#### Planner Context (15-20%)

```
Always loaded:
- PROJECT.md (~500 lines)
- REQUIREMENTS.md (~1000 lines)
- ROADMAP.md (~800 lines)
- STATE.md (~300 lines)

Phase-specific:
- {phase}-CONTEXT.md (~400 lines)
- {phase}-RESEARCH.md (~500 lines)

Selective history:
- 2-4 relevant prior SUMMARY files (~300 lines each)

Total: ~4,500-5,500 lines (~15-20% context)
```

#### Executor Context (20-30%)

```
Always loaded:
- PROJECT.md (~500 lines)
- STATE.md (~300 lines)

Task-specific:
- {phase}-{plan}-PLAN.md (~200 lines)
- @-referenced source files from PLAN.md
- Prior SUMMARY.md if PLAN depends on it

Total: Varies by task, targets ~20-30%
```

#### Verifier Context (10-15%)

```
Always loaded:
- PROJECT.md (~500 lines)
- REQUIREMENTS.md (~1000 lines)
- ROADMAP.md (~800 lines)

Phase-specific:
- All SUMMARY.md files for the phase
- Phase must_haves from PLAN frontmatter

Total: ~3,000-4,000 lines (~10-15% context)
```

### Why It Matters

| Without GSD | With GSD |
|-------------|----------|
| Session at 80-90% after 2 hours | Session stays 30-40% even after full phase |
| Claude abbreviates, skips steps | Heavy work in fresh subagent contexts |
| Manual context management | Automatic context assembly/cleanup |
| Quality degrades over time | Consistent quality from first task to last |

---

## 6. Skills Value Analysis

### Finding: 156 Skills is Mostly Bloat

Community testing and research reveal that massive skill repositories provide minimal value:

| Category | Percentage | Evidence |
|----------|-----------|----------|
| Genuinely useful | ~15% | Tested 200 skills (Indie Hackers) |
| Duplicate built-in | ~30% | Redundant functionality |
| Bloat | ~55% | "Interesting experiment" to "system prompt in SKILL.md" |

### Token Overhead is Real and Significant

- **30 plugins = ~3,000 tokens** of permanent overhead before any conversation starts
- Measured overhead can reach **66,000+ tokens** with heavily loaded configurations
- Each skill adds ~100 words of metadata that's **always loaded**

### The 4-6 Plugin Sweet Spot

Experienced users consistently recommend:

- **4-6 active plugins maximum** for optimal performance
- "The leaner the system prompt, the better the actual coding output"
- After reducing from 30 to 5 plugins: ~2,500 tokens recovered, faster responses, better context

### What Actually Works (Tier 1)

| Skill | Stars | Purpose |
|-------|-------|---------|
| Anthropic's document skills (PDF, DOCX, PPTX, XLSX) | Official | Knowledge worker workflows |
| Superpowers | ~43K | Planning enforcement, TDD, debugging |
| claude-mem | ~20K | Persistent memory across sessions |
| Built-in: /simplify, /review, /batch, /loop, /debug | N/A | Core workflows |

### Niche Language Skills: Rarely Used

Evidence suggests niche language skills underperform:

1. **Small user base** = fewer contributors/maintainers
2. **LLMs already trained** on these languages' patterns
3. **Token overhead** for rarely-used skills = pure waste
4. Most developers use 1-3 primary languages

Kotlin, Haskell, Erlang, Scala skills have minimal adoption.

### Verdict: High Skill Count = Marketing, Not Utility

- No reliable data shows 156+ skills are actively used
- 4-6 carefully chosen skills outperform 150+
- The ecosystem lacks quality signals (no install counts, unreliable stars)
- Treat mega-repositories as **menus**, not mandates

---

## 7. Corrected Gap Prioritization

### Priority Matrix

| Priority | Gap | Why It Matters | Value | Effort |
|:--------:|-----|----------------|-------|--------|
| **P0** | Wave-based parallel execution | 5-10x speedup in BUILD phase | High | Medium |
| **P1** | Hash-anchored edit validation | Prevents corruption in autonomous sessions | High | Low |
| **P2** | Context engineering improvements | Maintain quality in long sessions | Medium | Medium |
| **P2** | TDD enforcement | Quality enforcement | Medium | Medium |

### Gap Descriptions

#### P0: Wave-Based Parallel Execution

**What it enables:**
- Parallel Task() spawning within dependency waves
- Topological sorting of plans
- Context rotation to prevent degradation

**Implementation complexity:**
- Requires dependency graph building
- Requires Task() spawning integration
- Moderate effort, high payoff

#### P1: Hash-Anchored Edit Validation

**What it enables:**
- LINE#ID format for edit anchors
- Hash computation and validation
- Error recovery with updated anchors

**Implementation complexity:**
- Well-documented in omo
- Lower effort to implement
- Prevents silent corruption

#### P2: Context Engineering

**What it enables:**
- Structured context file management
- Size limits enforcement
- Selective history loading

**Implementation complexity:**
- Requires multi-agent architecture changes
- Moderate effort

#### P2: TDD Enforcement

**What it enables:**
- Mandatory test-first verification
- Red-green-refactor enforcement
- Quality gates for test coverage

**Implementation complexity:**
- Requires integration with test runners
- Moderate effort

### Note: Multi-Platform Support is NOT a Gap

This plugin is **designed for OpenCode only** by design. Multi-platform support was never a gap—the architecture is intentionally OpenCode-specific to leverage oc_* tools (oc_orchestrate, oc_state, oc_plan, etc.).

---

## 8. What opencode-autopilot Already Does Well

### Unique Strengths

The opencode-autopilot system has several distinctive capabilities:

#### 8-Phase SDLC Pipeline

Most comprehensive pipeline in the ecosystem:

| Phase | Purpose |
|-------|---------|
| RECON | Initial research and discovery |
| CHALLENGE | Requirement challenge and validation |
| ARCHITECT | Architecture design |
| EXPLORE | Codebase exploration |
| PLAN | Task planning |
| BUILD | Implementation |
| SHIP | Delivery |
| RETROSPECTIVE | Review and improvement |

#### 21 Specialized Review Auditors

Deepest code analysis with specialized reviewers:

| Category | Auditors |
|----------|----------|
| Logic | Logic correctness, edge cases |
| Security | Security vulnerabilities, secrets |
| Concurrency | Race conditions, deadlocks |
| Rust Safety | Memory safety, borrow checking |
| React Patterns | Component patterns, hooks |
| Django | Django-specific patterns |
| Go Idioms | Go best practices |
| And 14 more... | Various domains |

#### SQLite Memory with FTS5 and Decay

- **Dual-scope memory**: Global + project-specific
- **FTS5 full-text search**: Fast content search
- **Relevance decay**: Older entries weighted lower

#### Confidence Ledger

- Structured confidence tracking per phase/agent
- Tracks HIGH/MEDIUM/LOW confidence with rationale
- Enables quality assessment throughout pipeline

#### Pipeline Decision Trace

- Full audit trail of autonomous decisions
- Phase-by-phase breakdown
- Agent and rationale tracking

### Autonomous Execution: Already Implemented

**Key correction:** The autopilot agent already has loop capability similar to Ralph Loop (omo). It calls `oc_orchestrate` in a loop until the action returns "complete". This is fundamentally the same pattern:

```typescript
// opencode-autopilot pattern
while (true) {
  const result = oc_orchestrate(idea)
  if (result.action === 'complete') break
  // Continue with next iteration
}

// omo Ralph Loop pattern
while (true) {
  const result = ralphLoop.analyze()
  if (result.shouldStop) break
  // Continue execution
}
```

The previous gap analysis incorrectly claimed this as a gap. The autonomous execution capability is already present in opencode-autopilot.

---

## Sources

1. [omo hashline_edit](https://www.mintlify.com/code-yeongyu/oh-my-opencode/api/tools/hashline-edit) - Hash-anchored editing implementation
2. [GSD Wave-Based Parallelization](https://deepwiki.com/glittercowboy/get-shit-done/2.3-wave-based-parallelization) - Wave execution architecture
3. [GSD Context Engineering](https://www.mintlify.com/gsd-build/get-shit-done/concepts/context-engineering) - Context management patterns
4. [Superpowers TDD](https://github.com/obra/superpowers/blob/main/skills/test-driven-development/SKILL.md) - TDD enforcement methodology
5. [Git Worktrees for Parallel Agents](https://dev.to/battyterm/git-worktrees-changed-how-i-run-parallel-ai-agents-39pm) - Filesystem isolation for parallel agents
6. [Skills Value Analysis](/Users/joseibanezortiz/develop/projects/opencode-autopilot/research-outputs/skill-value-analysis.md) - Community research on skill utility

---

*Document generated: April 2026*
