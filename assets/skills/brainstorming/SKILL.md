---
# opencode-autopilot
name: brainstorming
description: Socratic design refinement methodology for exploring ideas through structured divergent and convergent thinking phases
stacks: []
requires: []
---

# Brainstorming

Structured Socratic design refinement for exploring ideas, challenging assumptions, and arriving at well-reasoned implementation plans. This skill guides you through a 5-phase process that moves from problem clarification through divergent exploration to convergent evaluation, synthesis, and actionable output.

Apply this skill whenever you need to explore design space before committing to an approach. The methodology prevents premature convergence (jumping to the first solution) and analysis paralysis (exploring forever without deciding).

## When to Use

**Activate this skill when:**

- Designing a new feature with multiple possible approaches
- Making architectural decisions with significant trade-offs
- The user gives vague or open-ended requirements that need refinement
- Exploring creative solutions to a technical problem
- Evaluating whether to build, buy, or adapt an existing solution
- Refactoring a system with multiple viable restructuring strategies
- The team disagrees on the right approach and needs structured evaluation

**Do NOT use when:**

- The implementation path is obvious and well-defined
- The task is a straightforward bug fix with a clear root cause
- Requirements are precise and leave no design decisions
- Time pressure demands immediate action over exploration
- The change is trivial (rename, config tweak, dependency bump)

## The Brainstorming Process

The process has five sequential phases. Each phase has a clear purpose and a defined output. Do not skip phases -- the discipline of following all five is what prevents the anti-patterns listed below.

### Phase 1: Clarify the Problem

**Purpose:** Understand the real problem before generating solutions. Most bad designs trace back to solving the wrong problem.

**Process:**

1. Ask 3-5 Socratic questions to challenge assumptions and surface the actual need
2. Each question should probe a different dimension: user need, constraints, scope, success criteria, risk
3. Do NOT propose solutions in this phase -- only ask questions
4. Synthesize answers into a one-paragraph problem statement

**Socratic Questions to Ask:**

- "What problem does this solve for the user?" -- Forces focus on user value, not technical elegance
- "What happens if we don't build this?" -- Tests whether the problem is real or imagined
- "What's the simplest version that delivers value?" -- Prevents scope creep from the start
- "Who else has solved this problem?" -- Avoids reinventing the wheel
- "What are we assuming that might not be true?" -- Surfaces hidden assumptions

**Output:** A clear problem statement that the user confirms is accurate. If the user cannot confirm, ask more questions.

**Time box:** 5-10 minutes. If you cannot clarify the problem in 10 minutes, the scope is too large -- split it.

### Phase 2: Divergent Exploration

**Purpose:** Generate multiple distinct approaches without evaluating them. Quantity over quality in this phase.

**Process:**

1. Generate 3-5 distinct approaches to the clarified problem
2. Each approach must be genuinely different -- not variations of the same idea
3. For each approach, document:
   - **Name:** A short, memorable label (2-4 words)
   - **Description:** One sentence explaining the core idea
   - **Key trade-off:** The main thing you give up with this approach
   - **Effort estimate:** Small (hours), Medium (days), or Large (weeks)
4. Include at least one "wild card" approach that challenges a fundamental assumption
5. Do NOT evaluate or rank approaches in this phase

**Output:** A numbered list of 3-5 approaches with name, description, trade-off, and effort.

**Time box:** 10-15 minutes. If you cannot generate 3 approaches, the problem definition is too narrow -- go back to Phase 1 and broaden it.

**Forcing creativity:** If all approaches look similar, try these prompts:
- "What if we had unlimited time/budget?"
- "What if we had to ship in one hour?"
- "What if we used a completely different technology?"
- "What would a competitor build?"
- "What if we solved the opposite problem?"

### Phase 3: Convergent Evaluation

**Purpose:** Systematically assess each approach against consistent criteria.

**Process:**

1. For each approach from Phase 2, evaluate three dimensions:
   - **Feasibility:** Can we build this with the current stack, team, and timeline? (LOW / MEDIUM / HIGH)
   - **Alignment:** Does this solve the clarified problem from Phase 1? (LOW / MEDIUM / HIGH)
   - **Risk:** What could go wrong? How likely is failure? (LOW / MEDIUM / HIGH risk)
2. For each dimension, write one sentence justifying the rating
3. Identify any approach that scores LOW on Alignment -- eliminate it immediately
4. Flag any approach with HIGH Risk for deeper analysis in Phase 4

**Output:** A comparison table with ratings and justifications for each approach.

**Evaluation format:**

```
| Approach | Feasibility | Alignment | Risk | Notes |
|----------|-------------|-----------|------|-------|
| Name 1   | HIGH        | HIGH      | LOW  | ...   |
| Name 2   | MEDIUM      | HIGH      | MEDIUM | ... |
| Name 3   | HIGH        | LOW       | LOW  | Eliminated: doesn't solve core problem |
```

**Time box:** 10-15 minutes. If evaluation takes longer, you have too many approaches -- drop the weakest two.

### Phase 4: Synthesis

**Purpose:** Select the best approach and refine it. Combine strengths from multiple approaches if possible.

**Process:**

1. Recommend the top approach based on Phase 3 evaluation
2. State the rationale in 2-3 sentences: why this approach, why not the alternatives
3. If two approaches have complementary strengths, propose a hybrid that combines the best of both
4. Document rejected approaches and why -- this becomes decision log material
5. Identify risks from Phase 3 and propose specific mitigations

**Output:**

- Selected approach with rationale
- Risk mitigations (1-2 sentences each)
- Decision log entry: what was decided, what was rejected, why

**Decision log format:**

```
## Decision: [Topic]
**Date:** [date]
**Selected:** [approach name]
**Rationale:** [2-3 sentences]
**Rejected alternatives:**
- [Approach 2]: [reason for rejection]
- [Approach 3]: [reason for rejection]
**Risks and mitigations:**
- [Risk 1]: [mitigation]
```

### Phase 5: Action Items

**Purpose:** Convert the chosen approach into concrete, executable next steps.

**Process:**

1. Break the selected approach into 3-7 discrete tasks
2. Each task must be independently completable and verifiable
3. For each task, specify:
   - **What:** One sentence describing the deliverable
   - **Files:** Which files to create or modify
   - **Tests:** What test(s) verify this task is done
   - **Dependencies:** Which other tasks must complete first
4. Order tasks by dependency (independent tasks first)
5. Identify the first task to start with -- it should be the smallest, lowest-risk task that validates the approach

**Output:** An ordered task list ready for execution.

**Task format:**

```
1. [Task name]
   - What: [deliverable description]
   - Files: [file paths]
   - Tests: [verification approach]
   - Depends on: [task numbers or "none"]
```

## Socratic Question Templates

Use these categorized questions when Phase 1 needs more depth.

### Requirements Questions

- "Who is the primary user of this feature?"
- "What does success look like from the user's perspective?"
- "What is the user doing today without this feature?"
- "What is the minimum viable version that delivers value?"
- "Are there existing patterns in the codebase we should follow?"

### Architecture Questions

- "What are the scaling constraints we need to respect?"
- "Where are the system boundaries?"
- "What data flows through this feature?"
- "Which existing modules does this touch?"
- "What's the deployment story -- does this need to be backwards compatible?"

### Risk Questions

- "What's the worst failure mode?"
- "What do we not know yet?"
- "What assumptions are we making about the user's environment?"
- "What happens when this feature interacts with [adjacent system]?"
- "If this fails in production, how do we detect and recover?"

### Scope Questions

- "Is this one feature or multiple features bundled together?"
- "What's explicitly out of scope?"
- "Can we ship this incrementally, or is it all-or-nothing?"
- "What's the maintenance cost after we ship?"

## Anti-Pattern Catalog

### Anti-Pattern: Premature Convergence

**What goes wrong:** Jumping to the first reasonable solution without exploring alternatives. The "obvious" approach often has hidden trade-offs that only surface during implementation.

**Signs:** Phase 2 produces only one approach. The "exploration" is really just elaborating on a pre-decided solution.

**Instead:** Force yourself to generate at least 3 genuinely different approaches before evaluating any of them. Use the creativity prompts from Phase 2 if stuck.

### Anti-Pattern: Analysis Paralysis

**What goes wrong:** Exploring endlessly without converging. Every approach spawns more questions. The brainstorming session becomes a research project.

**Signs:** Phase 2 generates 8+ approaches. Phase 3 evaluation raises more questions than it answers. The session exceeds 45 minutes with no decision.

**Instead:** Time-box each phase strictly. After Phase 3, force a decision -- even if imperfect. A good decision now beats a perfect decision never.

### Anti-Pattern: Group Think

**What goes wrong:** All generated approaches are variations of the same fundamental idea. No real diversity in the solution space.

**Signs:** Every approach uses the same technology, the same architecture, the same data model. The "wild card" approach isn't actually wild.

**Instead:** Deliberately propose at least one approach that breaks a core assumption. Try "What if we used no database?" or "What if the user did this manually?" to force divergent thinking.

### Anti-Pattern: Scope Creep

**What goes wrong:** Brainstorming expands beyond the original problem. New features, edge cases, and "nice to haves" accumulate until the scope is unrecognizable.

**Signs:** Phase 5 produces 15+ tasks. The action items address problems not mentioned in Phase 1. The effort estimate doubled during brainstorming.

**Instead:** Revisit the Phase 1 problem statement after each phase. If a new idea doesn't serve the clarified problem, log it for future consideration but exclude it from the current session.

### Anti-Pattern: Solutioning Before Clarifying

**What goes wrong:** Skipping Phase 1 and jumping straight to generating approaches. Without a clear problem statement, the approaches solve different problems.

**Signs:** Phase 2 approaches are hard to compare because each one addresses a slightly different interpretation of the problem.

**Instead:** Never skip Phase 1. Invest the time to get a confirmed problem statement before generating any solutions.

## Integration with Our Tools

After completing Phase 5 (Action Items), use the following tools to continue:

- **Plan writing skill:** Convert Phase 5 action items into a formal execution plan with file paths, verification steps, and dependency ordering
- **`oc_orchestrate`:** For autonomous execution of the chosen approach -- pass the Phase 5 task list as the plan input
- **`oc_review`:** After implementing any Phase 5 task, invoke a review to catch issues early
- **Decision log:** The Phase 4 synthesis output is a ready-made decision log entry -- save it for future reference

## Failure Modes

### Unclear Problem Definition

**Symptom:** Phase 1 ends but you still cannot explain the problem in one sentence.

**Recovery:** Ask the user directly: "Can you describe the problem without mentioning any solution?" If they cannot, the problem is not well-defined enough for brainstorming. Help them define the problem first.

### All Approaches Are Variations of the Same Idea

**Symptom:** Phase 2 produces approaches that differ only in implementation details, not in fundamental strategy.

**Recovery:** Add artificial constraints to force creativity:
- "What if we couldn't use [the obvious technology]?"
- "What if the budget was 10x smaller / larger?"
- "What would a team with completely different expertise build?"

### No Approach Feels Feasible

**Symptom:** Phase 3 evaluation rates all approaches LOW on Feasibility.

**Recovery:** The problem scope is too large. Go back to Phase 1 and split the problem into smaller sub-problems. Brainstorm each sub-problem independently.

### Brainstorming Produces Consensus But Wrong Direction

**Symptom:** The selected approach from Phase 4 fails during implementation.

**Recovery:** This is expected and normal. Return to Phase 3 with the failure as new information. Re-evaluate the remaining approaches. The rejected alternatives from the decision log become the starting point for the next round.

### User Disengages During the Process

**Symptom:** The user stops responding to Socratic questions or says "just pick one."

**Recovery:** Respect the signal. Compress: state your top recommendation with a one-sentence rationale. Ask for a yes/no confirmation. Skip to Phase 5 with the recommended approach.
