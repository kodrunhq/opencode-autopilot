---
# opencode-autopilot
name: lessons-learned
description: Methodology for extracting actionable lessons from a completed project during the RETROSPECTIVE phase.
stacks: []
requires: []
---

# Lessons Learned

Methodology for extracting actionable lessons from completed work. The goal is not to assign blame but to identify patterns worth repeating and patterns worth avoiding.

## When to Use

- During the RETROSPECTIVE phase after a project or phase is complete
- After a significant milestone or release
- When something went noticeably well or poorly
- Before starting a similar project (to apply past lessons)

## The Lessons Learned Process

### Step 1: Gather Data

Collect facts about what happened:

- **Timeline**: What was planned vs. what actually happened?
- **Metrics**: Lines of code, number of commits, bugs found, time per task
- **Events**: Significant decisions, blockers, breakthroughs, incidents
- **Feedback**: User feedback, code review comments, test results

**DO:**
- Start with data, not opinions
- Include both quantitative (numbers) and qualitative (observations) data
- Gather data from multiple sources (git history, issue tracker, chat logs)

**DON'T:**
- Rely on memory alone (it's unreliable and biased)
- Start with "what went wrong" (start with facts, not judgments)
- Exclude data that contradicts your narrative

### Step 2: Identify What Went Well

List the successes and understand WHY they happened:

- What decisions turned out to be correct?
- What processes worked smoothly?
- What technical choices paid off?
- What collaboration patterns were effective?

**For each success, ask:**
- Was this deliberate or accidental?
- Can we repeat this intentionally?
- What conditions made this possible?

**DO:**
- Be specific ("the decision to use PostgreSQL avoided 3 days of schema migration work")
- Identify the conditions that enabled the success
- Note whether the success was repeatable or a one-off

**DON'T:**
- List generic successes ("we worked hard", "we communicated well")
- Attribute success to individual heroics (look for systemic factors)
- Skip this step because "there's nothing to celebrate"

### Step 3: Identify What Went Wrong

List the failures and understand WHY they happened:

- What decisions turned out to be incorrect?
- What processes caused friction or delays?
- What technical choices created problems?
- What assumptions were wrong?

**For each failure, apply the 5 Whys:**
1. What happened? (the symptom)
2. Why did it happen? (the immediate cause)
3. Why did THAT happen? (a deeper cause)
4. Why did THAT happen? (a systemic cause)
5. Why did THAT happen? (the root cause)

**DO:**
- Focus on process and system failures, not individual failures
- Trace each problem to its root cause, not its symptom
- Note which failures were predictable (could have been prevented)

**DON'T:**
- Blame individuals ("John broke the build")
- Stop at the first why ("it failed because the test didn't run")
- Include problems that were outside the project's control

### Step 4: Categorize Lessons

Organize lessons into categories:

- **Technical**: Architecture choices, technology selection, code quality, testing
- **Process**: Planning, estimation, workflow, communication, review
- **Product**: Requirements, user understanding, scope management
- **Team**: Collaboration, knowledge sharing, onboarding, decision-making

**For each lesson, write:**
- **Observation**: What happened (fact, not judgment)
- **Insight**: Why it happened (the underlying pattern)
- **Action**: What we should do differently next time (specific, testable)

**DO:**
- Write actions that are specific and testable ("write ADRs for all database decisions" not "document more")
- Include the context that made the lesson relevant
- Note which lessons apply to future projects vs. this project only

**DON'T:**
- Write lessons that are too generic to act on ("communicate better")
- Create more action items than the team can realistically implement
- Include lessons that are really just complaints

### Step 5: Prioritize Lessons

Not all lessons are equally important. Prioritize by:

- **Impact**: How much would acting on this lesson improve future work?
- **Frequency**: How often will this lesson be relevant?
- **Effort**: How hard is it to act on this lesson?

**Priority matrix:**
- **High impact, high frequency**: Must act on these immediately
- **High impact, low frequency**: Act on these when the situation arises
- **Low impact, high frequency**: Consider automating or process-izing
- **Low impact, low frequency**: Document but don't prioritize

**DO:**
- Limit top-priority lessons to 3-5 (more than that and nothing gets done)
- Assign an owner to each top-priority lesson
- Set a deadline for acting on each lesson

**DON'T:**
- Treat all lessons as equally important
- Create a lessons document that no one will read again
- Blame the lessons on external factors only

### Step 6: Produce the Lessons Document

Create a structured lessons document:

1. **Project summary**: What was built, timeline, team
2. **What went well**: 3-5 specific successes with root causes
3. **What went wrong**: 3-5 specific failures with root causes (5 Whys)
4. **Categorized lessons**: Technical, Process, Product, Team
5. **Prioritized actions**: Top 3-5 actions with owners and deadlines
6. **Patterns to watch**: Recurring themes across multiple projects

**DO:**
- Keep it concise (2-3 pages max)
- Use specific examples, not generalizations
- Make it searchable and referenceable for future projects

**DON'T:**
- Write a novel (if it's too long, no one will read it)
- Include lessons that are really just feature requests
- File it and forget it (reference it at the start of the next project)