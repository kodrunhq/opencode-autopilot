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
- When the timeline does not match the feature list
- When you find yourself saying "we could also..." repeatedly

## The Scope Pruning Process

### Step 1: Define the ONE Thing

Answer this honestly: if this project could do ONLY one thing well, what would it be?

**The ONE thing exercise:**
- What is the core problem that exists without this project?
- What is the smallest solution that makes that problem go away?
- If you launched with only this one feature, would it be useful?
- Would users still get value if everything else disappeared?

**DO:**
- Write the ONE thing as a single sentence
- Test it: "This project exists to [verb] [noun] for [user]"
- Get explicit agreement on this sentence before proceeding
- Use the ONE thing as a filter for every subsequent decision

**DON'T:**
- Accept "and also..." answers at this stage
- Define the ONE thing in terms of technology ("use React") instead of outcome ("let users collaborate")
- Allow the ONE thing to become a list (it must be singular)
- Assume everyone has the same understanding of the ONE thing (write it down)

**Example:**

```
GOOD: "Let users upload and share PDF documents with a single click"
BAD: "Build a document management system with user authentication, 
      version control, commenting, and PDF support"
```

### Step 2: Catalog Every Proposed Feature

List everything that has been mentioned as part of this project. Brain dump without judgment.

**Sources to check:**
- Features from the original brief or PRD
- Features added during stakeholder discussions
- Features you thought of while researching in RECON
- Features from similar products or competitors
- "Wouldn't it be cool if..." ideas from the team
- Edge cases that became features ("we need to handle this, so...")

**DO:**
- Write each feature as a user outcome, not a technical capability
- Include the source of each feature (who asked for it and when)
- Keep features atomic (one user action per feature)
- Include features you personally want (be honest about bias)

**DON'T:**
- Dismiss features prematurely (you'll evaluate them in step 3)
- Group features together (keep them atomic for evaluation)
- Include implementation details ("use Redis") as features
- Skip this step because "I already know what's important"

### Step 3: Score Each Feature Against the ONE Thing

For each feature in your catalog, answer these three questions honestly:

**Question 1: Does this directly serve the ONE thing?**
- Yes = essential to the core value
- No = does not support the ONE thing at all
- Adjacent = related but not essential

**Question 2: Can the ONE thing work without this?**
- Yes = the core works, this is extra
- No = the core is broken without it

**Question 3: Does this add complexity disproportionate to its value?**
- Yes = high complexity, low value
- No = complexity matches value

**Scoring classification:**
- **Core**: Directly serves ONE thing + cannot work without it (keep)
- **Supporting**: Directly serves ONE thing but core could work without it (maybe keep)
- **Adjacent**: Indirectly serves ONE thing (defer)
- **Distraction**: Does not serve ONE thing (cut)

**DO:**
- Be ruthless — if it's not Core, it's a candidate for cutting
- Note which "Supporting" features are actually "Core" in disguise
- Flag any feature that adds complexity disproportionate to value
- Score independently of who asked for the feature

**DON'T:**
- Score everything as Core (that defeats the purpose)
- Let technical convenience drive scoring ("it's easy to add" is not a reason to keep)
- Let HiPPO (Highest Paid Person's Opinion) override the scoring
- Score based on how cool the feature is (cool != valuable)

### Step 4: Define Explicit Scope Boundaries

Write explicit IN scope and OUT of scope statements. Be uncomfortably specific.

**IN scope format:**
- [List Core features first]
- [List Supporting features that survived the cut, with justification]

**OUT of scope format:**
- [List Adjacent features explicitly deferred to later]
- [List Distractions explicitly rejected]
- [List things that seem related but are NOT this project's job]
- [Include specific examples of what is NOT included]

**DO:**
- Make OUT of scope longer than IN scope (you're cutting, not keeping)
- Include specific examples ("authentication via email/password only" vs vague "authentication")
- Write boundaries that a developer can follow without asking clarifying questions
- Document the reasoning behind each boundary decision

**DON'T:**
- Leave boundaries vague ("nice UX" vs "drag-and-drop file upload with progress indicator")
- Assume OUT of scope is obvious (it never is, write it down)
- Use weasel words ("minimal authentication" vs "email/password only, no social login")
- Create boundaries you cannot enforce

**Example OUT of scope:**

```
OUT of scope:
- Mobile app (web responsive only for this phase)
- Real-time collaboration (async comments only)
- Third-party integrations beyond Google Drive
- Admin dashboard (direct database access for now)
- Custom theming (light/dark mode only)
```

### Step 5: Identify and Challenge Scope Creep Patterns

Watch for these common patterns that expand scope silently:

**Edge case escalation**: "But what if a user wants to..." — one edge case becomes a full feature
**Platform expansion**: "We should also support tablets, watches, TVs..." — new platforms multiply scope
**Premature scale**: "It needs to handle millions of users from day one" — scale before validation
**Nice-to-have accumulation**: "While we're at it, we could also..." — unrelated features sneak in
**Competitor envy**: "X has this feature" — copying without understanding user value
**Future-proofing**: "We'll need this later anyway" — building for hypothetical futures
**Integration creep**: "It should work with [every possible tool]" — integration breadth explodes

**DO:**
- Name the pattern when you see it ("this is edge case escalation")
- Ask: "Does this serve the ONE thing, or is it a distraction?"
- Defer, don't deny — "not now" is different from "never"
- Create a "parking lot" document for deferred ideas
- Challenge the assumption behind the request

**DON'T:**
- Let "but it's easy" justify scope expansion (easy things still have maintenance cost)
- Assume stakeholders understand scope tradeoffs (show them the cost)
- Accept "users expect this" without evidence (which users? how many?)
- Let scope expand because saying no feels uncomfortable

### Step 6: Challenge Every Assumption

Question everything that "must" be included. Nothing is sacred.

**Assumptions to challenge:**
- "We need a user authentication system" — Do you? Could you use magic links?
- "We need a database" — Do you? Could files or localStorage work for now?
- "We need an admin dashboard" — Do you? Could you edit a config file?
- "We need to support all browsers" — Do you? Could you start with modern Chrome only?
- "We need to handle every error case" — Do you? Could you fail gracefully and log it?

**Challenge technique:**
For every "must", ask:
1. What happens if we DON'T do this?
2. Can we ship without it?
3. Is there a simpler way to achieve the same outcome?
4. What is the cost of adding this later vs now?

**DO:**
- Ask "why" five times to get to the real requirement
- Separate needs from wants (needs block launch, wants don't)
- Find the minimum viable version of each requirement
- Document which assumptions you challenged and why

**DON'T:**
- Accept "that's how it's done" as a reason
- Assume industry standards apply to your situation
- Build for hypothetical users ("someone might want...")
- Treat stakeholder requests as immutable requirements

### Step 7: Write the Scope Contract

Produce a scope document that the ARCHITECT and BUILD phases can follow:

**Scope contract sections:**
1. **The ONE thing** (single sentence, agreed upon)
2. **IN scope** (bullet list, specific, prioritized)
3. **OUT of scope** (bullet list, with examples and reasoning)
4. **Scope creep patterns observed** and how they were handled
5. **Assumptions challenged** and what replaced them
6. **Decision criteria** for future scope questions ("if it doesn't serve the ONE thing, it's out")
7. **Parking lot** (deferred features with rough priority)

**DO:**
- Make it referenceable — future decisions should cite this document
- Include the reasoning behind cuts, not just the cuts themselves
- Get explicit agreement from stakeholders before proceeding
- Version the document (it will evolve)

**DON'T:**
- Write a requirements document (this is a scope boundary document)
- Leave scope decisions implicit (if it's not written down, it's not decided)
- Create a document no one will read (keep it under 2 pages)
- Treat the scope contract as immutable (it's a guide, not a cage)

## Common Failure Modes

### "Everything is Core"

**Symptom**: Every feature gets scored as Core and nothing gets cut.
**Fix**: Revisit the ONE thing. If truly everything is Core, your ONE thing is too broad.

### "Scope Creep in Disguise"

**Symptom**: Features get renamed but not cut. "Advanced search" becomes "smart filtering".
**Fix**: Judge by user outcome, not feature name. Does it do the same thing?

### "We'll Do It Later"

**Symptom**: Everything is deferred, nothing is cut. Later becomes never, but scope isn't reduced.
**Fix**: Be honest. If it's OUT of scope, say OUT. "Later" should go in the parking lot, not the plan.

### "But the Users Want It"

**Symptom**: Scope expands based on hypothetical user needs without evidence.
**Fix**: Ask for evidence. Which users? How many? What percentage? What's the cost?

## Handoff to ARCHITECT Phase

The scope contract informs architecture decisions:

- Small IN scope → simpler architecture, fewer abstractions
- Large OUT of scope list → architecture can ignore those concerns
- Challenged assumptions → architecture can use simpler solutions
- Parking lot items → architecture should allow for extension (but not build it)

**DO:**
- Give the architect the full scope contract, not just the IN scope list
- Highlight which boundaries are hard (cannot change) vs soft (can negotiate)
- Ensure the architecture supports the ONE thing first, everything else second

**DON'T:**
- Let architecture drive scope ("we built this abstraction, so we should use it")
- Hide OUT of scope items from the architect (they need to know what NOT to build for)
