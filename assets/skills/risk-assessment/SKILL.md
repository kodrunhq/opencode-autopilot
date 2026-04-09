---
# opencode-autopilot
name: risk-assessment
description: Systematic methodology for identifying technical and product risks during the CHALLENGE phase before they become problems.
stacks: []
requires: []
---

# Risk Assessment

Systematic methodology for identifying, categorizing, and mitigating risks before they derail a project.

## When to Use

- During the CHALLENGE phase after scope is defined
- Before committing to an architecture
- When a project feels uncertain but you can't articulate why
- When stakeholders are overly optimistic about timeline

## The Risk Assessment Process

### Step 1: Run a Pre-Mortem

Imagine the project has failed spectacularly. Write the post-mortem:

- "Six months from now, this project failed because..."
- List every reason you can think of
- Be specific — "bad code" is not a reason, "the auth library we chose has no maintainer" is

**DO:**
- Give yourself permission to be pessimistic — this is a safe space
- Include technical, product, team, and external risks
- Write at least 10 failure reasons (force yourself past the obvious ones)

**DON'T:**
- Self-censor ("that's too negative")
- Focus only on technical risks (product and team risks kill more projects)
- Accept "we'll figure it out" as a mitigation

### Step 2: Categorize Each Risk

For each risk, determine:

**Type:**
- **Technical**: Complexity, unfamiliar technology, performance, scalability, security
- **Product**: Unclear requirements, wrong assumptions, user adoption, market fit
- **Process**: Timeline, dependencies, team capacity, communication gaps
- **External**: Third-party APIs, regulatory changes, platform deprecations

**Likelihood (1-5):**
1. Almost certainly won't happen
2. Unlikely but possible
3. Could go either way
4. Likely if we're not careful
5. Almost certainly will happen

**Impact (1-5):**
1. Minor inconvenience
2. Noticeable but manageable
3. Significant delay or rework
4. Project-threatening
5. Project-killing

**Risk Score = Likelihood × Impact**

**DO:**
- Score honestly, not optimistically
- Note the reasoning behind each score
- Flag any risk with score ≥ 12 as critical

**DON'T:**
- Score everything as 2×2 to avoid hard conversations
- Ignore low-likelihood, high-impact risks (black swans matter)

### Step 3: Identify Mitigation Strategies

For each risk with score ≥ 6, define a mitigation:

**Strategy types:**
- **Avoid**: Change the plan to eliminate the risk entirely
- **Reduce**: Take actions to lower likelihood or impact
- **Transfer**: Shift the risk to someone else (use a proven library, outsource)
- **Accept**: Acknowledge the risk and prepare a contingency plan

**For each mitigation, specify:**
- What action will be taken
- Who is responsible
- When it will be done
- How you'll know the risk has been reduced

**DO:**
- Make mitigations actionable and testable
- Prioritize mitigations for critical risks first
- Include "do nothing" as a valid strategy with explicit reasoning

**DON'T:**
- Write vague mitigations ("we'll be careful", "we'll test thoroughly")
- Assign mitigations to unnamed roles ("the team will handle it")
- Create more mitigations than you can actually execute

### Step 4: Identify Dependencies and Single Points of Failure

Map what the project depends on:

- **People**: Is there only one person who can do X?
- **Technology**: Does the project hinge on a specific library, API, or platform?
- **External services**: What happens if a third-party service goes down or changes?
- **Timeline**: Are there hard deadlines that, if missed, cascade?

**DO:**
- List every single point of failure
- For each, define a backup plan
- Note which dependencies are within your control and which are not

**DON'T:**
- Assume "it won't go down" is a plan
- Ignore bus factor (if one person leaves, what breaks?)

### Step 5: Produce the Risk Register

Create a structured risk document:

1. **Critical risks** (score ≥ 12): With mitigations and owners
2. **High risks** (score 8-11): With mitigations
3. **Medium risks** (score 4-7): Monitored but not actively mitigated
4. **Dependencies and single points of failure**: With backup plans
5. **Residual risk assessment**: After all mitigations, what risk remains?

**DO:**
- Make it readable — a wall of text won't be used
- Include the date and who created it
- Note which risks need re-evaluation at what milestones

**DON'T:**
- File it and forget it (risks change as the project evolves)
- Include risks with no actionable mitigations (they're just anxiety)
- Use risk assessment as a reason to not start (it's a tool for starting smarter)

### Step 6: Hand Risks to ARCHITECT Phase

The ARCHITECT phase should address technical risks through design:

- Performance risks → inform architecture pattern selection
- Scalability risks → inform data model and API design
- Security risks → inform authentication and authorization approach
- Complexity risks → inform module boundaries and interfaces

**DO:**
- Reference specific risks by ID in the ARCHITECT brief
- Ask the architect to explicitly address each critical technical risk
- Verify that the proposed architecture reduces the identified risks

**DON'T:**
- Assume the architect will automatically address risks (they need to be called out)
- Treat risk assessment as a one-time activity (update it as the project evolves)