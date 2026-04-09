---
# opencode-autopilot
name: architecture-decision-records
description: Methodology for creating Architecture Decision Records (ADRs) during the ARCHITECT phase to document WHY architectural choices were made
stacks: []
requires: []
---

# Architecture Decision Records (ADR)

Architecture Decision Records capture the reasoning behind significant technical choices. They serve as a decision log, not a design document. Future developers need to understand WHY you chose a particular path, not just WHAT you built.

## What is an ADR

An ADR is a short document (1-2 pages) that records a single architectural decision. It captures:
- The context and forces at play when the decision was made
- The decision itself
- The consequences of that decision

Unlike design documents that describe how a system works, ADRs explain why it works that way. They prevent the cycle of "why did we do this?" questions that slow down teams.

## When to Write an ADR

Not every choice needs an ADR. Document decisions that are:

**IRREVERSIBLE OR EXPENSIVE TO CHANGE**
- Data storage choices (SQL vs NoSQL, single vs multi-region)
- Framework or language selection
- Deployment architecture (monolith vs microservices)

**TEAM-WIDE IMPACT**
- Affects how multiple developers write code
- Changes coding standards or patterns
- Impacts the technology stack for future features

**NON-OBVIOUS CHOICES**
- You rejected a seemingly better option for a specific reason
- The decision involves trade-offs that are not immediately clear
- Future developers might question the choice without context

## ADR Template

Use this structure for every ADR:

```markdown
# ADR-NNN: Title

## Status
Proposed | Accepted | Superseded by ADR-XXX

## Context
What is the issue that we're seeing that is motivating this decision or change?
What forces are at play? What constraints exist?

## Decision
What is the change that we're proposing or have agreed to implement?
Be specific. State the decision as a clear statement.

## Consequences

### Positive
- List the benefits of this decision
- What does this enable?
- What problems does this solve?

### Negative
- List the trade-offs and drawbacks
- What are we giving up?
- What new problems does this create?
```

## Writing Effective ADRs

### Context: Set the Stage

Describe the situation that required a decision. Include:
- The problem or opportunity
- Constraints (budget, time, team skills, existing tech)
- Options considered

```markdown
## Context

Our user authentication needs have outgrown the simple JWT approach we started with.
Requirements:
- Support for social login (Google, GitHub)
- Session management across multiple devices
- Token revocation capability
- Compliance with SOC2 audit requirements

We evaluated three approaches:
1. Build custom OAuth2 server
2. Use Auth0 SaaS
3. Adopt Keycloak self-hosted
```

### Decision: Be Specific

State the decision clearly. Avoid vague language.

```markdown
## Decision

We will use Keycloak as our identity provider, self-hosted on our Kubernetes cluster.

Keycloak was chosen over Auth0 due to data residency requirements for our
European customers. We rejected a custom OAuth2 implementation due to the
security expertise required to maintain it properly.
```

### Consequences: Be Honest

List both positive and negative outcomes. Future developers need to know the trade-offs.

```markdown
## Consequences

### Positive
- SOC2 compliant authentication out of the box
- Supports all required identity providers
- No per-user licensing costs (critical for our freemium model)
- Active open source community with regular security patches

### Negative
- Requires dedicated DevOps time for upgrades and maintenance
- Adds ~2GB memory overhead to our infrastructure
- Team needs to learn Keycloak configuration and troubleshooting
- Potential single point of failure; needs HA setup
```

## Handling Superseded ADRs

Decisions change. When you reverse a decision:

1. Update the status of the old ADR to "Superseded by ADR-XXX"
2. Write a new ADR explaining the reversal
3. Reference the old ADR in the new one's context

```markdown
# ADR-042: Replace Keycloak with Auth0

## Status
Accepted

## Context

ADR-023 established Keycloak as our identity provider in 2023. However,
the operational burden has proven higher than anticipated. Our DevOps team
spends approximately 8 hours per month on Keycloak maintenance, and we've
had two production incidents related to Keycloak upgrades.

Additionally, our European data residency concerns were addressed when
Auth0 opened their EU region data center in Frankfurt.
```

## DO and DON'T

**DO: Keep ADRs short and focused**

```markdown
# ADR-001: Use PostgreSQL for primary data store

## Context
We need a relational database for user data, orders, and inventory.
Requirements: ACID compliance, JSON support for flexible schemas,
excellent Node.js driver ecosystem.

## Decision
Use PostgreSQL 15+ as our primary database.

## Consequences

### Positive
- ACID compliance ensures data integrity
- JSONB columns allow flexible schema evolution
- Excellent tooling (pgAdmin, migration libraries)
- Team has prior experience

### Negative
- Requires careful connection pool management
- Vertical scaling limits compared to some NoSQL options
```

**DON'T: Write novels or include implementation details**

```markdown
# ADR-001: Database Selection

## Context
[Three paragraphs about the history of databases...]

## Decision
We will use PostgreSQL. Here is the connection configuration:
```javascript
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  // ... 50 more lines of config
})
```

## Consequences
[List of 20 generic PostgreSQL features...]
```

**DO: Explain why alternatives were rejected**

```markdown
## Context

We considered MongoDB for its flexible schema but rejected it because:
1. Our data is highly relational (users have orders, orders have items)
2. Team lacks MongoDB operational experience
3. ACID guarantees are required for financial transactions
```

**DON'T: Just list what you chose without context**

```markdown
## Decision

We chose PostgreSQL.

## Consequences

It's good.
```

**DO: Update status when decisions change**

```markdown
## Status
Superseded by ADR-015

This ADR is kept for historical context. The caching strategy described
here was replaced due to cost concerns. See ADR-015 for current approach.
```

**DON'T: Leave stale ADRs marked as "Accepted"**

```markdown
## Status
Accepted

[ADR content from 2019 that no longer reflects the system]
```

## Common ADR Categories

During the ARCHITECT phase, you'll typically write ADRs for:

**Data Storage**
- Database selection (PostgreSQL, MongoDB, Redis, etc.)
- Caching strategy
- Data retention policies
- Multi-region data placement

**API Design**
- REST vs GraphQL vs gRPC
- API versioning strategy
- Authentication mechanism
- Rate limiting approach

**Deployment**
- Container orchestration (Kubernetes vs ECS vs Nomad)
- CI/CD pipeline design
- Environment strategy
- Infrastructure as code tool selection

**Security**
- Secret management (Vault, AWS Secrets Manager, etc.)
- Encryption at rest vs in transit
- Network segmentation
- Compliance approach (GDPR, SOC2)

## Numbering and Organization

Use sequential numbers: ADR-001, ADR-002, etc.

Store ADRs in a dedicated directory:
```
docs/adr/
  ADR-001-use-postgresql.md
  ADR-002-rest-api-design.md
  ADR-003-keycloak-authentication.md
  ADR-042-replace-keycloak-with-auth0.md
```

Include an index in README.md:
```markdown
# Architecture Decision Records

| ADR | Title | Status |
|-----|-------|--------|
| 001 | Use PostgreSQL | Accepted |
| 002 | REST API Design | Accepted |
| 003 | Keycloak Authentication | Superseded by 042 |
| 042 | Replace Keycloak with Auth0 | Accepted |
```

## Integration with ARCHITECT Phase

During the ARCHITECT phase:

1. Identify decisions that need ADRs as you design
2. Write ADRs before or alongside technical specifications
3. Link ADRs to relevant design documents
4. Review ADRs with the team before finalizing architecture

Remember: ADRs are for future you and your teammates. Write them so that someone joining the project in two years can understand why the system works the way it does.
