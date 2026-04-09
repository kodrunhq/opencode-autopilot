---
# opencode-autopilot
name: risk-assessment
description: Systematic methodology for identifying technical and product risks during the CHALLENGE phase before they become problems.
stacks: []
requires: []
---

# Risk Assessment

Systematic methodology for identifying, categorizing, and mitigating risks before they derail a project. Risk assessment is not pessimism. It is preparation.

## When to Use

- During the CHALLENGE phase after scope is defined and before architecture is committed
- Before committing to an architecture or technology stack
- When a project feels uncertain but you cannot articulate why
- When stakeholders are overly optimistic about timeline or complexity
- When entering unfamiliar technical territory
- When project dependencies are outside your control
- When the cost of failure is high (production systems, user data, revenue impact)

## The Risk Assessment Process

### Step 1: Run a Pre-Mortem

Imagine the project has failed spectacularly. Write the post-mortem now, before you start.

**Pre-mortem exercise:**
- "Six months from now, this project failed because..."
- List every reason you can think of, no matter how unlikely
- Be specific — "bad code" is not a reason, "the auth library we chose has no active maintainer" is
- Push past the obvious first 5 reasons to find the hidden ones

**DO:**
- Give yourself permission to be pessimistic — this is a safe space for worst-case thinking
- Include technical, product, team, and external risk categories
- Write at least 10 failure reasons (force yourself past the obvious ones)
- Involve the whole team (different perspectives catch different risks)
- Set a timer for 15 minutes and do not stop writing until it rings

**DON'T:**
- Self-censor ("that's too negative" or "that won't happen")
- Focus only on technical risks (product and team risks kill more projects)
- Accept "we'll figure it out" as a valid response to any risk
- Dismiss a risk because it is "unlikely" (low likelihood × high impact still matters)

**Example pre-mortem output:**

```
This project failed because:
1. The third-party API we depend on changed their pricing and we cannot afford it
2. The lead developer left and no one else understands the custom auth system
3. Users did not want the feature — we built it because we thought it was cool
4. The database query that worked with 1000 rows times out with 1 million rows
5. The compliance review found we are not GDPR compliant and we need to rebuild
```

### Step 2: Categorize Each Risk

For each risk identified in the pre-mortem, classify it completely.

**Risk Types:**

**Technical risks** — Can we build it? Will it work?
- Unfamiliar technology or paradigm
- Algorithmic complexity or performance concerns
- Integration with legacy systems or third-party APIs
- Scalability limitations (data volume, traffic, concurrency)
- Security vulnerabilities or compliance gaps
- Technical debt accumulation

**Product risks** — Should we build it? Will users want it?
- Unclear or conflicting requirements
- Wrong assumptions about user needs or behavior
- Market fit uncertainty (solves a problem no one has)
- Competition or alternative solutions
- User adoption barriers (habit change, learning curve)

**Process risks** — Can we deliver it? Will we finish?
- Timeline compression or unrealistic deadlines
- Resource constraints (people, budget, tools)
- Dependency on other teams or projects
- Communication gaps or stakeholder alignment
- Scope creep or changing requirements

**External risks** — What outside our control could hurt us?
- Third-party service outages or API changes
- Regulatory changes (privacy laws, industry standards)
- Platform changes (OS updates, browser deprecations)
- Supply chain issues (library maintenance, hosting costs)

**Scoring Matrix (Likelihood × Impact):**

**Likelihood (1-5):**
1. Almost certainly won't happen (<5% chance)
2. Unlikely but possible (5-25% chance)
3. Could go either way (25-50% chance)
4. Likely if we're not careful (50-75% chance)
5. Almost certainly will happen (>75% chance)

**Impact (1-5):**
1. Minor inconvenience (hours to fix, no user impact)
2. Noticeable but manageable (days to fix, limited user impact)
3. Significant delay or rework (weeks to fix, user disruption)
4. Project-threatening (months to fix, major user impact)
5. Project-killing (cannot recover, product failure)

**Risk Score = Likelihood × Impact**

**Risk Priority Levels:**
- **Critical** (Score 20-25): Must address before proceeding
- **High** (Score 12-16): Needs mitigation plan
- **Medium** (Score 6-9): Monitor and prepare contingency
- **Low** (Score 1-4): Accept and move on

**DO:**
- Score honestly, not optimistically
- Note the reasoning behind each score (why is likelihood 4?)
- Flag any risk with score ≥ 12 as critical (these block architecture decisions)
- Separate correlation from causation (two risks might have the same root cause)

**DON'T:**
- Score everything as 2×2 to avoid hard conversations
- Ignore low-likelihood, high-impact risks (black swans matter — see COVID-19)
- Let one person do all the scoring (diverse perspectives catch blind spots)
- Score based on how easy the mitigation is (hard mitigations do not reduce risk scores)

### Step 3: Identify Mitigation Strategies

For each risk with score ≥ 6, define a concrete mitigation strategy.

**Strategy Types:**

**Avoid**: Change the plan to eliminate the risk entirely
- Example: "Risk: Unfamiliar database technology" → "Use PostgreSQL instead of CockroachDB (team knows Postgres)"

**Reduce**: Take actions to lower likelihood or impact
- Example: "Risk: API rate limits" → "Implement caching layer and request batching"

**Transfer**: Shift the risk to someone else
- Example: "Risk: Auth system security bugs" → "Use Auth0 instead of building custom auth"

**Accept**: Acknowledge the risk and prepare a contingency plan
- Example: "Risk: Third-party API pricing change" → "Monitor pricing page, budget 50% buffer, identify alternative APIs"

**For each mitigation, specify:**
- What specific action will be taken
- Who is responsible for executing it
- When it will be done (milestone or date)
- How you'll know the risk has been reduced (measurable indicator)

**DO:**
- Make mitigations actionable and testable (not "be careful", but "add rate limiting at 100 req/min")
- Prioritize mitigations for critical risks first
- Include "do nothing" as a valid strategy with explicit reasoning (not laziness, a choice)
- Create mitigations for the risk, not the symptom

**DON'T:**
- Write vague mitigations ("we'll be careful", "we'll test thoroughly")
- Assign mitigations to unnamed roles ("the team will handle it")
- Create more mitigations than you can actually execute (mitigation debt is real)
- Assume a mitigation eliminates the risk (it reduces it, rarely eliminates it)

**Example mitigation:**

```
Risk: Database query performance degrades at scale
  Likelihood: 4, Impact: 4, Score: 16 (High)
  
Mitigation (Reduce):
  Action: Implement query pagination and add database indexes on user_id and created_at
  Owner: Backend team lead
  Timeline: Before public launch
  Validation: Load test with 10x expected data volume, all queries <100ms
```

### Step 4: Identify Dependencies and Single Points of Failure

Map everything the project depends on. Dependencies are risks in disguise.

**Dependency Categories:**

**People dependencies**: Is there only one person who can do X?
- Single developer with critical knowledge
- Specialist expertise not widely available
- Key stakeholder who must approve everything

**Technology dependencies**: Does the project hinge on specific technology?
- Single library or framework for core functionality
- Beta or experimental technology
- Technology with known limitations or deprecation plans

**External service dependencies**: What happens if a third-party service changes?
- APIs with rate limits or usage caps
- Services with uptime SLAs below your requirements
- Vendors with history of breaking changes

**Timeline dependencies**: Are there hard deadlines that cascade?
- External events (conference launch, regulatory deadline)
- Other projects blocking or depending on this one
- Seasonal factors (holiday freezes, end-of-quarter pressure)

**DO:**
- List every single point of failure explicitly
- For each, define a backup plan or contingency
- Note which dependencies are within your control and which are not
- Calculate bus factor (if one person leaves, what breaks?)

**DON'T:**
- Assume "it won't go down" is a valid dependency plan
- Ignore bus factor (if one person leaving kills the project, that is a critical risk)
- Assume third-party services care about your project as much as you do
- Forget to include dependencies on other internal teams or projects

**Single point of failure example:**

```
Dependency: Only Sarah understands the billing integration
  Risk: If Sarah leaves, billing breaks and no one can fix it
  Mitigation: Pair program with Sarah, document the integration, 
             have another dev shadow the next billing change
  Backup plan: Contract with Sarah for consulting if she leaves
```

### Step 5: Produce the Risk Register

Create a structured risk document that evolves with the project.

**Risk register sections:**

1. **Critical risks** (score 20-25): Full mitigation plan with owners and dates
2. **High risks** (score 12-16): Mitigation plans or explicit acceptance with reasoning
3. **Medium risks** (score 6-9): Monitoring plan, who watches for triggers
4. **Low risks** (score 1-4): Acknowledged but not actively managed
5. **Dependencies and single points of failure**: With backup plans
6. **Residual risk assessment**: After all mitigations, what risk remains?
7. **Trigger conditions**: When do we re-evaluate each risk?

**DO:**
- Make it readable — a wall of text won't be used
- Include the date created and last updated
- Note which risks need re-evaluation at what milestones
- Keep it accessible to the whole team (not buried in a wiki)

**DON'T:**
- File it and forget it (risks change as the project evolves)
- Include risks with no actionable mitigations (they're just anxiety, not risks)
- Use risk assessment as a reason to not start (it's a tool for starting smarter)
- Make it so long no one reads it (prioritize critical and high risks)

### Step 6: Prioritize What Kills vs What Slows

Not all risks are equal. Distinguish between project-killers and project-slowers.

**Project-killers** (address first):
- Fundamental technical infeasibility
- Complete market rejection
- Regulatory or legal blockers
- Key dependency failures with no alternative

**Project-slowers** (manage but do not block):
- Performance degradation under load
- Feature scope creep
- Minor integration friction
- Learning curve for new technology

**Prioritization framework:**
1. Will this risk prevent us from ever shipping? → Block and resolve
2. Will this risk make shipping significantly harder? → Mitigate
3. Will this risk slow us down but we can ship anyway? → Monitor
4. Is this risk annoying but manageable? → Accept

**DO:**
- Be honest about which category each risk falls into
- Do not let project-slowers distract from project-killers
- Create escalation criteria (when does a slower become a killer?)

**DON'T:**
- Treat all risks with the same urgency
- Let project-slowers consume all your risk mitigation bandwidth
- Ignore project-slowers entirely (they compound over time)

### Step 7: Hand Risks to ARCHITECT Phase

The ARCHITECT phase should address technical risks through design decisions.

**How risks inform architecture:**

- **Performance risks** → Inform caching strategy, database choice, API design
- **Scalability risks** → Inform data model, horizontal scaling approach, state management
- **Security risks** → Inform authentication method, authorization patterns, audit logging
- **Complexity risks** → Inform module boundaries, interface definitions, abstraction layers
- **Integration risks** → Inform API contracts, fallback strategies, circuit breakers

**DO:**
- Reference specific risks by ID in the ARCHITECT brief
- Ask the architect to explicitly address each critical technical risk
- Verify that the proposed architecture reduces (not increases) the identified risks
- Include risk mitigation as acceptance criteria for architecture review

**DON'T:**
- Assume the architect will automatically address risks (they need to be called out)
- Treat risk assessment as a one-time activity (update it as the project evolves)
- Let architecture decisions create new risks without acknowledging them

## Common Anti-Patterns

### "It Won't Happen to Us"

**Symptom**: Dismissing risks because of overconfidence.
**Fix**: Ask for evidence. Why won't it happen? What makes us special?

### "We'll Deal With It Later"

**Symptom**: Acknowledging risks but planning to address them after launch.
**Fix**: Set explicit trigger conditions. When exactly will we deal with it? What triggers that decision?

### "Analysis Paralysis"

**Symptom**: So focused on identifying risks that the project never starts.
**Fix**: Time-box risk assessment. 2-4 hours maximum. Perfect risk knowledge is impossible.

### "Risk Theater"

**Symptom**: Creating elaborate risk documents that no one uses or updates.
**Fix**: Make the risk register actionable. If it doesn't inform decisions, simplify it.

## DO / DON'T Summary

**DO:**
- Be pessimistic during pre-mortem (realistic during planning)
- Score risks honestly using the likelihood × impact matrix
- Create specific, actionable mitigations with owners and dates
- Identify and plan for single points of failure
- Hand critical technical risks to the ARCHITECT phase with specific requirements
- Update the risk register as the project evolves

**DON'T:**
- Skip risk assessment because "we don't have time" (you don't have time NOT to)
- Score optimistically to avoid hard conversations
- Write vague mitigations that cannot be executed or measured
- Ignore low-likelihood, high-impact risks
- Treat risk assessment as a one-time checkbox activity
- Let risk assessment become a reason to not start (it's preparation, not prevention)
