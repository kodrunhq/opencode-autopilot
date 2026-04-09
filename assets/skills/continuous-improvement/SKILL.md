---
# opencode-autopilot
name: continuous-improvement
description: Systematic methodology for turning retrospective lessons into concrete process improvements during the RETROSPECTIVE phase.
stacks: []
requires: []
---

# Continuous Improvement

Methodology for converting lessons learned into measurable process improvements. Lessons without action are just complaints.

## When to Use

- During the RETROSPECTIVE phase after lessons have been identified
- When you have a list of problems but no plan to fix them
- When previous retrospectives produced lessons that were never acted on
- When the team feels like "nothing ever changes"

## The Continuous Improvement Process

### Step 1: Convert Lessons to Improvement Items

Take each lesson from the lessons-learned phase and convert it to an actionable improvement item:

**Template:**
```
**Improvement**: [What we will change]
**Why**: [Which lesson this addresses]
**How**: [Specific steps to implement the change]
**Measure**: [How we'll know it worked]
**Owner**: [Who is responsible]
**Deadline**: [When it will be done]
```

**DO:**
- Make each improvement item testable (you can verify whether it was done)
- Limit to 3-5 items per cycle (more than that and nothing gets done)
- Include the measurement criteria before starting

**DON'T:**
- Write vague improvements ("improve communication", "write better tests")
- Create improvements that require no behavior change
- Assign improvements to "the team" (assign to a specific person)

### Step 2: Prioritize with Impact vs. Effort Matrix

Plot each improvement on a 2×2 matrix:

| | Low Effort | High Effort |
|---|---|---|
| **High Impact** | DO FIRST | PLAN |
| **Low Impact** | FILLER | SKIP |

**Quadrant actions:**
- **Do First**: Implement immediately (quick wins with real impact)
- **Plan**: Schedule for next cycle (big investments that need planning)
- **Filler**: Do if you have spare capacity (low cost, low reward)
- **Skip**: Explicitly reject (not worth the effort)

**DO:**
- Start with Do First items to build momentum
- Be honest about effort estimates (multiply by 2)
- Re-evaluate the matrix each cycle (impact and effort change)

**DON'T:**
- Do all the Fillers because they're easy (they don't move the needle)
- Skip the high-effort, high-impact items forever (plan them)
- Let the matrix become a justification for doing nothing

### Step 3: Apply the PDCA Cycle

For each improvement item, run through Plan-Do-Check-Act:

**Plan**: Define the change and how to measure it
- What exactly will change?
- How will we measure success?
- What is the baseline (current state)?
- What is the target (desired state)?

**Do**: Implement the change on a small scale
- Try the change in one project or one sprint
- Collect data during the experiment
- Note any unexpected side effects

**Check**: Compare results against the baseline
- Did the metric improve?
- Were there unintended consequences?
- Was the effort worth the impact?

**Act**: Decide what to do next
- **Adopt**: The change worked — make it standard practice
- **Adapt**: The change partially worked — adjust and try again
- **Abandon**: The change didn't work — try a different approach

**DO:**
- Run the full cycle for each improvement (don't skip Check or Act)
- Document the results (even failed experiments are valuable data)
- Share results with the team (transparency builds trust in the process)

**DON'T:**
- Implement changes without measuring results (that's guessing, not improving)
- Abandon an improvement after one failed attempt (adapt first)
- Treat PDCA as a one-time process (it's a cycle)

### Step 4: Create Feedback Loops

Build mechanisms that catch problems early:

- **Leading indicators**: Metrics that predict problems before they happen (build time, test coverage, PR age)
- **Lagging indicators**: Metrics that confirm problems after they happen (bug count, production incidents, customer complaints)
- **Feedback triggers**: Automatic alerts when a metric crosses a threshold

**DO:**
- Monitor leading indicators (they give you time to act)
- Set thresholds based on historical data, not guesses
- Review indicators regularly (weekly or per-sprint)

**DON'T:**
- Monitor everything (focus on 3-5 key metrics)
- Set thresholds so tight that you get alert fatigue
- Ignore lagging indicators (they tell you if your leading indicators are wrong)

### Step 5: Balance Process Rigor with Speed

Improvement should make work faster, not slower:

- **Automate** repetitive process steps (linting, testing, deployment)
- **Eliminate** process steps that don't add value (status meetings, manual approvals)
- **Simplify** process steps that are too complex (multi-page templates → checklists)

**The improvement test**: "Does this change make us faster at delivering value?"

**DO:**
- Measure the cost of each process step (time spent vs. value delivered)
- Remove process steps that cost more than they save
- Automate before you optimize (don't optimize a manual process)

**DON'T:**
- Add process to fix a one-time problem (fix the problem, not the process)
- Confuse ceremony with quality (more meetings ≠ better work)
- Let process become an end in itself (process serves delivery, not vice versa)

### Step 6: Track Improvement Velocity

Measure whether your improvement efforts are actually improving things:

- **Improvement completion rate**: How many improvement items are completed per cycle?
- **Impact rate**: How many completed improvements actually moved the metric?
- **Process debt**: How many improvement items are carried over without action?

**DO:**
- Track improvement velocity alongside delivery velocity
- Celebrate completed improvements (they're real work)
- Address process debt explicitly (it compounds like technical debt)

**DON'T:**
- Measure improvement by how many meetings you had
- Ignore improvement velocity (if it's zero, your process is broken)
- Let improvement items accumulate without action (that's process debt)

### Step 7: Produce the Improvement Plan

Create a structured improvement plan:

1. **Improvement backlog**: All identified improvements, prioritized
2. **Current cycle items**: 3-5 items with owners, deadlines, and measures
3. **PDCA results**: Outcomes from previous cycles (adopt/adapt/abandon)
4. **Feedback loop dashboard**: Current metrics and thresholds
5. **Process debt register**: Unaddressed improvements with aging

**DO:**
- Keep it to one page (if it's longer, it won't be used)
- Update it every cycle (stale plans are worse than no plans)
- Reference it at the start of each project (what did we learn last time?)

**DON'T:**
- Create a plan that requires a separate tool to maintain
- Include improvements that no one owns
- Let the plan become a guilt document ("look at all the things we didn't do")