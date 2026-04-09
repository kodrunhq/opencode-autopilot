---
# opencode-autopilot
name: continuous-improvement
description: Systematic methodology for turning retrospective lessons into concrete process improvements during the RETROSPECTIVE phase
stacks: []
requires: []
---

# Continuous Improvement

Lessons are worthless without action. The RETROSPECTIVE phase must produce concrete improvements that actually get implemented, not just documented and forgotten.

This skill covers how to turn lessons learned into systematic process improvements that stick.

## From Lessons to Actions: The Critical Gap

Most teams capture lessons. Few teams systematically improve. The gap is a process for prioritizing, assigning, and validating improvements.

---

## Prioritizing Improvement Actions

You cannot fix everything at once. Prioritize ruthlessly.

**The Impact vs. Effort Matrix**

| | Low Effort | High Effort |
|---|---|---|
| **High Impact** | Do First | Schedule |
| **Low Impact** | Quick Wins (maybe) | Don't Do |

**DO: Prioritize by objective criteria**

1. **Impact**: How much would this improve future projects? (1-5 scale)
   - 5 = Would have saved 1+ weeks or prevented a major failure
   - 3 = Would have saved 2-3 days or prevented minor issues
   - 1 = Nice to have, marginal improvement

2. **Frequency**: How often will this matter? (1-5 scale)
   - 5 = Applies to every project
   - 3 = Applies to most projects of this type
   - 1 = Applies only to rare edge cases

3. **Effort**: How hard is it to implement? (1-5 scale, inverted)
   - 5 = Can implement today in under 30 minutes
   - 3 = Requires a few days of work
   - 1 = Requires major organizational change

**Priority Score = Impact × Frequency × (6 - Effort)**

Actions with scores above 60 are your top priorities.

**DON'T: Try to fix everything**

- Limit active improvements to 3-5 per quarter
- More improvements = less chance any get done
- If you have 20 improvement items, you have a wishlist, not a plan

**DO: Timebox improvement work**

- Reserve 10-20% of capacity for process improvements
- If improvements are always deprioritized for "real work," nothing changes
- Schedule improvement work like any other work

---

## Creating Actionable Improvement Items

Vague improvement goals fail. Specific improvement tasks succeed.

**DO: Write improvement items with clear ownership and deadlines**

```
IMPROVEMENT: Automate staging database refresh
CONTEXT: Lesson from Project X - staging/prod drift caused production bug
ACTION: Create GitHub Action to refresh staging DB from production weekly
OWNER: @devops-lead
DEADLINE: 2024-03-15
SUCCESS CRITERIA: Staging DB refreshes automatically; zero manual refreshes needed in Q2
```

**DON'T: Write improvement items that are vague or unowned**

```
IMPROVEMENT: Fix staging
CONTEXT: Staging was bad
ACTION: Make staging better
OWNER: The team
DEADLINE: Soon
SUCCESS CRITERIA: Staging works good
```

**Required fields for every improvement item:**

1. **What**: Specific, concrete action
2. **Why**: Which lesson(s) this addresses
3. **Who**: Single owner (not "the team")
4. **When**: Specific deadline
5. **How we'll know**: Measurable success criteria

---

## The PDCA Cycle for Process Improvement

Plan-Do-Check-Act is the scientific method applied to process improvement.

**PLAN**: Define the improvement and success metrics

- What specific process are we changing?
- What is the expected outcome?
- How will we measure success?
- What is the timeline?

**DO**: Implement the change on a small scale first

- Test the improvement on one project or one team
- Document what happens
- Don't roll out organization-wide immediately

**CHECK**: Measure the results against your success criteria

- Did the change produce the expected outcome?
- What unexpected effects occurred?
- Is the improvement worth the cost?

**ACT**: Standardize or abandon

- If it worked: document, train, and make it the new standard
- If it failed: understand why, adjust, and try again
- If it partially worked: iterate and refine

**DO: Apply PDCA to every improvement**

- "We'll try requiring two code reviews for 2 sprints and measure review cycle time. If it improves without blocking work, we'll keep it."

**DON'T: Roll out changes without measuring impact**

- "We're switching to trunk-based development company-wide starting Monday."
- Without measurement, you cannot distinguish correlation from causation

---

## Measuring Whether Improvements Actually Worked

If you cannot measure it, you cannot manage it. Define metrics before implementing changes.

**DO: Define leading and lagging indicators**

**Leading indicators** (predict future outcomes):
- Code review turnaround time (predicts cycle time)
- Test coverage percentage (predicts bug escape rate)
- Integration test failure rate (predicts production stability)

**Lagging indicators** (confirm past outcomes):
- Production incident count
- Customer-reported bug count
- Project delivery date variance

**Example metrics for common improvements:**

| Improvement | Leading Indicator | Lagging Indicator |
|-------------|-------------------|-------------------|
| Require integration tests | Test coverage % | Production bugs in API layer |
| Daily standups | Blocker resolution time | Sprint commitment accuracy |
| ADRs for all decisions | ADR count / decisions | Architecture confusion incidents |
| Feature flags for risky changes | % of changes behind flags | Rollback time |

**DON'T: Rely on gut feeling**

- "Seems like code review is faster now" is not measurement
- "The team feels better about deployments" is not evidence

**DO: Set baselines before changes**

- Measure current state for 2-4 weeks before implementing change
- Without a baseline, you cannot claim improvement

---

## Avoiding Improvement Bloat

Too many process changes at once creates chaos. Teams spend more time learning new processes than doing work.

**DO: Limit concurrent changes**

- Maximum 1 major process change per quarter
- Maximum 3 minor changes per quarter
- Major = changes how people work daily (e.g., switching to async standups)
- Minor = adds a checklist or tool (e.g., adding a pre-deploy checklist)

**DO: Let changes stabilize before adding more**

- A process change needs 4-6 weeks to settle
- Teams need time to learn and adapt
- Adding another change during adaptation is counterproductive

**DON'T: Change processes reactively**

- One bad incident should not trigger a process overhaul
- Look for patterns across multiple incidents before changing process
- "Someone made a mistake" is not a reason to add more process

**The Improvement Budget**

Treat process change capacity like a budget:
- Each team has 10 "improvement points" per quarter
- Major changes cost 5 points
- Minor changes cost 1-2 points
- Don't exceed the budget

---

## Creating Feedback Loops That Catch Problems Early

The earlier you detect a problem, the cheaper it is to fix. Build feedback loops at every stage.

**DO: Build quality gates that fail fast**

| Stage | Feedback Mechanism | Catches |
|-------|-------------------|---------|
| Coding | Pre-commit hooks (lint, format) | Style violations, type errors |
| Pre-merge | CI pipeline (test, build) | Logic errors, integration issues |
| Post-merge | Staging auto-deploy + smoke tests | Environment-specific bugs |
| Pre-production | Integration test suite | Cross-service issues |
| Production | Monitoring, alerting | Runtime failures |
| Post-release | User feedback, error tracking | UX issues, edge cases |

**DO: Make feedback immediate and actionable**

- CI failures should point to the specific line and fix
- Alerts should include runbook links
- Error messages should suggest solutions

**DON'T: Create feedback loops without action paths**

- An alert that nobody knows how to respond to is noise
- A CI check that fails with "something is wrong" is useless
- A test that fails intermittently without explanation gets ignored

**DO: Review and tune feedback loops quarterly**

- Which alerts fire but require no action? (Remove or tune)
- Which tests fail but never indicate real bugs? (Fix or remove)
- Where do bugs escape to production? (Add earlier detection)

---

## DO/DON'T Summary

| DO | DON'T |
|----|-------|
| Use Impact × Frequency × (6 - Effort) to prioritize | Try to fix everything at once |
| Assign single owners and specific deadlines | Assign improvements to "the team" with no deadline |
| Define measurable success criteria before implementing | Rely on gut feeling to judge success |
| Apply PDCA: Plan, Do on small scale, Check, Act | Roll out changes organization-wide immediately |
| Measure leading and lagging indicators | Define only lagging indicators (too late to adjust) |
| Limit to 1 major + 3 minor changes per quarter | Change processes after every incident |
| Let changes stabilize 4-6 weeks before adding more | Stack multiple changes simultaneously |
| Build fast feedback loops with actionable outputs | Create alerts or checks nobody knows how to fix |
| Review and tune feedback loops quarterly | Set up monitoring and never revisit it |
| Timebox 10-20% of capacity for improvements | Always deprioritize improvements for "real work" |

---

## Balancing Process Rigor with Development Speed

Too little process and you ship broken code. Too much process and you ship nothing. Find the balance.

**The Process Sweet Spot**

Process should prevent the most expensive mistakes without preventing progress on common cases.

**DO: Differentiate between high-risk and low-risk changes**

| Risk Level | Examples | Process Level |
|------------|----------|---------------|
| High | Database migrations, auth changes, payment flows | Full checklist, mandatory review, staged rollout |
| Medium | New API endpoints, UI changes | Standard review, integration tests |
| Low | Copy changes, config updates, typo fixes | Automated checks only, optional review |

**DON'T: Apply the same process to everything**

- Requiring 2 reviewers for a typo fix wastes everyone's time
- Skipping review for a database migration invites disaster

**DO: Make the default path the easy path**

- If the "right way" is harder than the "fast way," people will take the fast way
- Automate the right way so it's also the easy way

**Example**: If you want people to write tests, make `npm test` run automatically on commit and fail the commit if tests fail. Don't rely on people remembering to run tests.

---

## Making Improvements Incremental and Testable

Big-bang process changes fail. Incremental improvements stick.

**DO: Break large improvements into small, testable experiments**

**Big change**: "We're switching to full test-driven development."
**Incremental approach**:
1. Week 1-2: Try TDD on one small feature
2. Week 3-4: Measure time-to-completion and bug count vs. previous approach
3. Week 5-6: If successful, expand to one whole team
4. Week 7-8: Measure team velocity and quality metrics
5. Week 9+: Roll out organization-wide only if metrics improve

**DO: Define kill criteria before starting**

- "If code review time increases by more than 20%, we revert."
- "If bug count doesn't decrease in 6 weeks, we try a different approach."
- Pre-defined kill criteria prevent sunk-cost fallacy

**DON'T: Commit to improvements before validating them**

- "We're doing this for the next 6 months no matter what" prevents learning
- Be willing to abandon changes that don't work

---

## Tracking Improvements Over Time

Improvements need maintenance or they decay.

**DO: Maintain an Improvement Log**

```markdown
# Improvement Log

## 2024-Q1

### COMPLETED: Automated staging refresh
- Implemented: 2024-01-15
- Owner: @devops-lead
- Result: Staging refresh time reduced from 4 hours (manual) to 0 (automated)
- Success: YES - continue

### COMPLETED: Require integration tests for API changes
- Implemented: 2024-02-01
- Owner: @backend-lead
- Result: API bug escape rate decreased 40%, but review time increased 15%
- Success: PARTIAL - keep but look for ways to reduce review overhead

### ABANDONED: Async standups
- Implemented: 2024-02-15
- Owner: @team-lead
- Result: Blockers took 2x longer to surface
- Success: NO - reverted to synchronous standups
```

**DO: Review the log quarterly**

- Which improvements stuck? Why?
- Which were abandoned? What can we learn?
- Are we improving the right things?

---

## Final Checklist for Continuous Improvement

Before marking the RETROSPECTIVE phase complete, verify:

- [ ] All high-priority lessons have improvement items created
- [ ] Every improvement has a single owner and specific deadline
- [ ] Every improvement has measurable success criteria
- [ ] PDCA cycle defined for each improvement
- [ ] Baseline metrics captured before changes
- [ ] No more than 1 major + 3 minor improvements queued
- [ ] 10-20% of capacity reserved for improvement work
- [ ] Feedback loops documented and assigned owners for maintenance
- [ ] Improvement Log created and location shared

Process improvement is a practice, not a project. Build the habit of systematic improvement, and every project gets better than the last.
