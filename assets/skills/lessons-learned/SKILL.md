---
# opencode-autopilot
name: lessons-learned
description: Methodology for extracting actionable lessons from a completed project during the RETROSPECTIVE phase
stacks: []
requires: []
---

# Lessons Learned

The RETROSPECTIVE phase is your only opportunity to harvest knowledge from a completed project. Do it wrong and you get vague platitudes that help nobody. Do it right and you build an organizational memory that prevents repeated mistakes and amplifies successes.

This skill covers how to extract lessons that are specific, actionable, and free from the blame games that kill retrospective value.

## The Goal: Build a Lessons Log, Not a Complaint Session

A lessons learned session should produce a document that future project leads actually reference. If nobody reads it six months later, you failed.

---

## Identifying What Went Well

Focus on specific patterns and decisions, not general praise. The goal is to identify what to repeat.

**DO: Identify reproducible patterns**

- "We caught the API contract mismatch early because we wrote integration tests before implementation. Do this on every project with external dependencies."
- "Daily 15-minute syncs prevented the frontend/backend drift that plagued Project X. The key was keeping them strictly timeboxed."
- "Using feature flags let us deploy the search rewrite incrementally. We should make feature flags standard for any user-facing change over 2 story points."

**DON'T: Write generic praise**

- "The team worked hard." (Not actionable)
- "Communication was good." (What specifically? How can we repeat it?)
- "We had a great tech lead." (Not reproducible)

**Technique: The "Would This Work on Project X?" Test**

For every positive you identify, ask: would this specific approach have helped on a previous struggling project? If the answer is no, your lesson is too specific to this project's unique constraints. Broaden it.

---

## Identifying What Went Wrong

The hardest part of any retrospective. The goal is process improvement, not blame assignment.

**DO: Focus on the gap between expectation and reality**

- "We estimated 3 days for the auth integration but it took 2 weeks. The gap: we assumed the OAuth provider matched their docs. It didn't. Lesson: always schedule a 2-hour spike to test external APIs before committing to estimates."
- "The staging environment had different timeouts than production, causing a production-only bug. Lesson: staging must mirror production timeout configs exactly."

**DON'T: Assign blame or write inactionable complaints**

- "The backend team was slow delivering the API." (Blame-focused, not actionable)
- "We had bad requirements." (Too vague)
- "The third-party service was terrible." (What do we do differently next time?)

**Technique: Process Failure vs. Execution Failure**

**Process Failure**: The system allowed a bad decision. Even a competent person following the process would have failed.
- Example: "We merged broken code because there was no CI check for TypeScript errors."
- Fix: Update CI pipeline, not "train developers better."

**Execution Failure**: A competent person ignored or bypassed an existing good process.
- Example: "We merged broken code because someone used `--no-verify` to skip pre-commit hooks."
- Fix: Address why the process was bypassed, or add enforcement if it happens repeatedly.

**Critical**: 80% of "execution failures" are actually process failures in disguise. If bypassing a process is the path of least resistance, your process is broken.

---

## The 5 Whys Technique

When something went wrong, ask "why?" five times to reach the root cause. Stop when you hit a process or systemic issue, not a person.

**Example: Production outage from a bad deploy**

1. Why did the site go down? → A bad deploy made it to production.
2. Why did a bad deploy make it to production? → The staging tests didn't catch the database migration issue.
3. Why didn't staging tests catch it? → Staging uses a fresh database, not a copy of production data.
4. Why does staging use a fresh database? → We have no process for refreshing staging with production data.
5. Why is there no process? → We never prioritized it because "it takes too long."

**Root cause**: Process gap in staging environment management.
**Lesson**: Implement weekly staging refresh from production (automated). Test migrations against real data patterns, not empty schemas.

**DON'T**: Stop at "because someone made a mistake." That's not a root cause, that's a symptom.

---

## Writing Specific, Actionable Lessons

Vague lessons are useless. Every lesson should pass the "Could someone act on this without asking clarifying questions?" test.

**DO: Write lessons with context, action, and trigger**

```
LESSON: Integration testing before implementation
CONTEXT: Our OAuth integration took 3x longer than estimated because the provider's docs were outdated.
ACTION: For any external API integration, schedule a 2-hour spike to test the actual API before providing estimates.
TRIGGER: New project with external dependencies, or estimate request for integration work.
```

**DON'T: Write vague platitudes**

```
LESSON: Communicate better
CONTEXT: Sometimes communication was unclear.
ACTION: Improve communication.
TRIGGER: Always.
```

**Examples of Specific vs. Vague:**

| Vague | Specific |
|-------|----------|
| "Test more" | "Require integration tests for any API endpoint before merging to main" |
| "Better estimates" | "Break down tasks over 5 points before estimation; reject stories with unclear acceptance criteria" |
| "Improve documentation" | "Document architectural decisions in ADRs; review docs monthly for staleness" |
| "Be more careful" | "Use checklists for production deploys; require two approvals for infrastructure changes" |

---

## Categorizing Lessons

Group lessons by category to make the lessons log searchable and to identify systemic patterns.

**Technical**: Code, architecture, infrastructure, tooling
- Examples: tech debt accumulation, deployment pipeline gaps, monitoring blind spots

**Process**: Methodology, ceremonies, workflows
- Examples: estimation accuracy, code review delays, unclear decision rights

**Communication**: Information flow, stakeholder management, team dynamics
- Examples: requirements drift, cross-team handoff failures, status visibility

**Estimation**: Planning, forecasting, resource allocation
- Examples: consistent underestimation, scope creep handling, dependency risk

**Why categorize**: If 60% of your lessons are "Estimation," you have a systemic planning problem. Categories reveal patterns that individual lessons hide.

---

## Creating a Lessons Log

A lessons log is a living document that future project leads consult during planning.

**Structure:**

```markdown
# Lessons Log - Project: [Name] - Completed: [Date]

## Executive Summary
- 3-line summary of what the project was
- Top 3 lessons (most impactful)
- Overall sentiment: would we do this again? What would we change?

## Detailed Lessons by Category

### Technical
1. [Lesson with context, action, trigger]
2. [Lesson with context, action, trigger]
...

### Process
...

### Communication
...

### Estimation
...

## Patterns Identified
- [Recurring themes across categories]

## Action Items for Process Improvement
- [Specific improvements to implement, with owners and deadlines]

## Appendix: Raw Notes
- [Unfiltered retrospective notes for reference]
```

**Maintenance:**
- Archive completed project logs in a searchable location
- Review previous logs before starting similar projects
- Update logs if lessons prove wrong (some "fixes" create new problems)

---

## Avoiding Blame-Focused Retrospectives

Blame kills honesty. If people fear retribution, they hide problems or minimize failures.

**DO: Use neutral language**

- "The deployment failed because..." not "You broke the deployment when..."
- "The process allowed..." not "Someone forgot to..."
- "We assumed..." not "You told us..."

**DO: Focus on system, not individuals**

- "Our code review process didn't catch..." not "The reviewer missed..."
- "The staging environment doesn't match production..." not "The devops engineer configured staging wrong..."

**DO: Assume good intent**

- People generally do their best with the information and constraints they have
- If someone "should have known better," ask why the system allowed them not to know
- If a mistake repeats, the problem is the system's failure to learn, not the person

**DON'T: Name names in lessons logs**

- Keep individual performance discussions in private 1:1s
- Public lessons logs should discuss systems and processes only

**DON'T: Let managers use retrospectives for evaluation**

- If retrospectives affect performance reviews, honesty dies
- Make this explicit: "Retrospectives are for process improvement, not performance management"

---

## DO/DON'T Summary

| DO | DON'T |
|----|-------|
| Focus on reproducible patterns | Write generic praise or complaints |
| Distinguish process failures from execution failures | Stop at "someone made a mistake" |
| Use the 5 Whys to find root causes | Accept surface-level explanations |
| Write lessons with context, action, and trigger | Write vague platitudes like "communicate better" |
| Categorize lessons to identify systemic issues | Dump lessons in an unstructured list |
| Create a searchable lessons log | Let lessons live only in people's heads |
| Use neutral, blame-free language | Name names or assign blame |
| Assume good intent | Treat mistakes as character flaws |
| Focus 80% on process/system issues | Focus on individual errors |
| Make lessons actionable for future projects | Write lessons nobody can act on |

---

## Final Checklist for Lessons Learned

Before finalizing your lessons log, verify:

- [ ] Every lesson has a specific context (when does this apply?)
- [ ] Every lesson has a concrete action (what do we do differently?)
- [ ] Every lesson has a trigger (when do we remember to apply this?)
- [ ] No individual is named or blamed
- [ ] Root causes are identified using 5 Whys where applicable
- [ ] Lessons are categorized and searchable
- [ ] The log is stored where future project leads will find it
- [ ] Action items have owners and deadlines for process improvements

A good lessons log prevents repeated mistakes. A great lessons log amplifies your successes. Build the great one.
