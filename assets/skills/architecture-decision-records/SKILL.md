---
# opencode-autopilot
name: architecture-decision-records
description: Methodology for creating Architecture Decision Records (ADRs) during the ARCHITECT phase to document WHY choices were made.
stacks: []
requires: []
---

# Architecture Decision Records

Methodology for documenting the WHY behind architectural choices. Code tells you what was built. ADRs tell you why it was built that way.

## When to Use

- During the ARCHITECT phase when making significant design choices
- When choosing between competing approaches (database, framework, pattern)
- When a decision is irreversible or expensive to reverse
- When multiple team members need to understand the reasoning

## ADR Structure

Every ADR follows this template:

```
# ADR-NNN: [Short title]

## Context
What is the situation that requires a decision? What forces are at play?
What constraints exist? What problem are we trying to solve?

## Decision
What did we decide? Be specific and unambiguous.
"We will use X" not "We might consider X"

## Consequences

### Positive
- What benefits does this decision bring?
- What problems does it solve?

### Negative
- What trade-offs does this introduce?
- What problems does it create?
- What does this decision prevent us from doing easily?
```

## The ADR Process

### Step 1: Identify Decisions Worth Recording

Not every choice needs an ADR. Record decisions that are:

- **Irreversible**: Hard or expensive to change later (database choice, architectural pattern)
- **Expensive**: Significant time or resource investment
- **Team-wide**: Affects how multiple people work
- **Non-obvious**: The reasoning isn't clear from the code alone
- **Contested**: There were reasonable alternatives that were rejected

**DO:**
- Write an ADR when you can imagine a future developer asking "why did they do it this way?"
- Include the date and who was involved in the decision
- Reference the alternatives that were considered

**DON'T:**
- Write ADRs for obvious choices ("we'll use HTTP for a web API")
- Use ADRs as design documents (they record decisions, not designs)
- Write ADRs after the code is already built (capture the reasoning while it's fresh)

### Step 2: Write the Context Section

The context section is the most important part. It explains the forces that shaped the decision.

**DO:**
- Describe the problem, not the solution
- List constraints (budget, timeline, team skills, existing infrastructure)
- Include non-functional requirements (performance, security, maintainability)
- Reference relevant findings from RECON and CHALLENGE phases

**DON'T:**
- Jump to the solution in the context
- Assume the reader knows the project history
- Omit constraints because they seem obvious

### Step 3: Write the Decision Section

Be specific and decisive.

**DO:**
- State the decision in one clear sentence
- Reference the chosen technology, pattern, or approach by name
- Include version numbers if relevant ("PostgreSQL 15+" not "a SQL database")

**DON'T:**
- Hedge ("we'll probably use X")
- Leave the decision open ("we need to decide on X")
- Write the decision in terms of what you're NOT doing

### Step 4: Document Consequences Honestly

List both positive and negative consequences. If there are no negatives, you haven't thought hard enough.

**DO:**
- Be honest about trade-offs (every decision has downsides)
- Include operational consequences (monitoring, deployment, debugging)
- Note what this decision prevents or makes harder
- Estimate the cost of reversing this decision

**DON'T:**
- List only positive consequences (that's advocacy, not analysis)
- Downplay negatives to make the decision look better
- Ignore long-term consequences for short-term gains

### Step 5: Handle Superseded ADRs

When a decision is reversed, don't delete the old ADR. Create a new one:

```
# ADR-NNN: [New decision]

**Status: Supersedes ADR-MMM**

## Context
Why are we reversing the previous decision? What changed?

## Decision
[New decision]

## Consequences
[New consequences, including the cost of the reversal]
```

**DO:**
- Link to the superseded ADR
- Explain what changed (new requirements, new technology, lessons learned)
- Acknowledge that the original decision was reasonable given its context

**DON'T:**
- Delete or modify superseded ADRs (they're historical records)
- Blame the original decision-makers (context changes)

### Step 6: Store ADRs with the Code

Place ADRs in a `docs/adr/` directory at the project root.

**Naming convention:**
- `0001-use-postgresql.md`
- `0002-event-driven-architecture.md`
- `0003-superseded-by-0007.md`

**DO:**
- Use sequential numbering
- Include the decision topic in the filename
- Reference ADR numbers in code comments where relevant

**DON'T:**
- Store ADRs in a wiki separate from the code (they'll drift)
- Use dates in filenames (sequential is clearer for ordering)
- Write ADRs in a format that's hard to diff (use Markdown)