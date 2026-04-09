---
# opencode-autopilot
name: scope-pruning
description: Methodology for identifying and eliminating scope creep during the CHALLENGE phase to define what is IN and OUT of scope.
stacks: []
requires: []
---

# Scope Pruning

Systematic methodology for cutting scope without cutting value. Every project dies from feature bloat before it dies from being too focused.

## When to Use

- During the CHALLENGE phase after RECON findings
- When a project's requirements feel unbounded
- Before committing to an architecture (scope drives architecture)
- When stakeholders keep adding "just one more thing"

## The Scope Pruning Process

### Step 1: Define the ONE Thing

Answer: if this project could do ONLY one thing well, what would it be?

- What is the core problem that exists without this project?
- What is the smallest solution that makes that problem go away?
- If you launched with only this one feature, would it be useful?

**DO:**
- Write the ONE thing as a single sentence
- Test it: "This project exists to [verb] [noun] for [user]"
- Get agreement on this sentence before proceeding

**DON'T:**
- Accept "and also..." answers at this stage
- Define the ONE thing in terms of technology ("use React") instead of outcome ("let users collaborate")

### Step 2: Catalog Every Proposed Feature

List everything that has been mentioned as part of this project:

- Features from the original brief
- Features added during discussions
- Features you thought of while researching
- Features from similar projects

**DO:**
- Write each feature as a user outcome, not a technical capability
- Include the source of each feature (who asked for it?)
- Don't judge yet — just catalog

**DON'T:**
- Dismiss features prematurely (you'll evaluate them next)
- Group features together (keep them atomic for evaluation)

### Step 3: Score Each Feature Against the ONE Thing

For each feature, ask:

1. **Does this directly serve the ONE thing?** (Yes / No / Adjacent)
2. **Can the ONE thing work without this?** (Yes / No)
3. **Does this add complexity disproportionate to its value?** (Yes / No)

**Scoring:**
- **Core**: Directly serves ONE thing + cannot work without it
- **Supporting**: Directly serves ONE thing but could work without it
- **Adjacent**: Indirectly serves ONE thing
- **Distraction**: Does not serve ONE thing

**DO:**
- Be ruthless — if it's not Core, it's a candidate for cutting
- Note which "Supporting" features are actually "Core" in disguise
- Flag any feature that adds complexity disproportionate to value

**DON'T:**
- Score everything as Core (that defeats the purpose)
- Let technical convenience drive scoring ("it's easy to add" is not a reason to keep)

### Step 4: Define Explicit Scope Boundaries

Write explicit IN scope and OUT of scope statements:

**IN scope:**
- [List Core features]
- [List Supporting features that made the cut]

**OUT of scope:**
- [List Adjacent features deferred to later]
- [List Distractions explicitly rejected]
- [List things that seem related but are NOT this project's job]

**DO:**
- Make OUT of scope longer than IN scope (you're cutting, not keeping)
- Include specific examples of what is NOT included
- Write boundaries that a developer can follow without asking

**DON'T:**
- Leave boundaries vague ("authentication" vs "email/password auth only, no OAuth")
- Assume OUT of scope is obvious (it never is)

### Step 5: Identify Scope Creep Patterns

Watch for these common patterns that expand scope silently:

- **Edge case escalation**: "But what if..." — one edge case becomes a feature
- **Platform expansion**: "We should also support..." — new platforms multiply scope
- **Premature scale**: "It needs to handle millions of..." — scale before users
- **Nice-to-have accumulation**: "While we're at it..." — unrelated features sneak in
- **Competitor envy**: "X has this feature" — copying without understanding why

**DO:**
- Name the pattern when you see it ("this is edge case escalation")
- Ask: "Does this serve the ONE thing, or is it a distraction?"
- Defer, don't deny — "not now" is different from "never"

**DON'T:**
- Let "but it's easy" justify scope expansion (easy things still have maintenance cost)
- Assume stakeholders understand scope tradeoffs (show them the cost)

### Step 6: Write the Scope Contract

Produce a scope document that the BUILD phase can follow:

1. The ONE thing (single sentence)
2. IN scope (bullet list, specific)
3. OUT of scope (bullet list, with examples)
4. Scope creep patterns observed and how they were handled
5. Decision criteria for future scope questions ("if it doesn't serve the ONE thing, it's out")

**DO:**
- Make it referenceable — future decisions should cite this document
- Include the reasoning behind cuts, not just the cuts themselves
- Get explicit agreement before proceeding to ARCHITECT

**DON'T:**
- Write a requirements document (this is a scope boundary document)
- Leave scope decisions implicit (if it's not written down, it's not decided)