---
# opencode-autopilot
name: system-design
description: Methodology for designing software architecture during the ARCHITECT phase, translating domain understanding into implementable system components.
stacks: []
requires: []
---

# System Design

Methodology for translating domain understanding into a concrete, implementable system architecture.

## When to Use

- During the ARCHITECT phase after RECON and CHALLENGE are complete
- When you need to decide how to structure a new system
- When an existing system needs significant restructuring
- When scope and risks are defined but the "how" is unclear

## The System Design Process

### Step 1: Define System Boundaries

What is inside the system and what is outside?

- **Internal**: Components you will build
- **External**: Systems you will integrate with (APIs, databases, services)
- **Boundary**: How internal and external communicate (protocols, formats)

**DO:**
- Draw a box around your system and label everything outside it
- Identify every external dependency and its role
- Define the protocol for each boundary (HTTP, gRPC, message queue, file)

**DON'T:**
- Assume external systems are stable (design for failure)
- Include external systems inside your boundary
- Ignore the cost of each external dependency

### Step 2: Identify Components

Break the system into major components based on:

- **Domain boundaries**: Components aligned with domain concepts (from RECON)
- **Responsibility**: Each component has one clear job
- **Independence**: Components can be understood and modified independently
- **Communication**: Components interact through well-defined interfaces

**DO:**
- Start with 3-7 components (more than 7 means you haven't abstracted enough)
- Name components after what they DO, not how they're implemented
- Define each component's responsibility in one sentence

**DON'T:**
- Create components that mirror your database tables (that's data design, not system design)
- Make components too granular (a "component" should be a meaningful unit)
- Create a "utils" or "common" component (that's a dumping ground)

### Step 3: Design Interfaces

Define how components communicate:

- **Synchronous**: Direct calls (function calls, HTTP requests, gRPC)
- **Asynchronous**: Event-driven (message queues, event buses, pub/sub)
- **Shared state**: Database, file system, cache

**For each interface, specify:**
- Direction (unidirectional or bidirectional)
- Data format (JSON, protobuf, plain text)
- Error handling (what happens when the call fails?)
- Contract (what does the caller provide? what does the callee return?)

**DO:**
- Prefer unidirectional interfaces (easier to reason about)
- Define error contracts as carefully as success contracts
- Minimize the number of interfaces (each one is a coupling point)

**DON'T:**
- Let components share mutable state (use interfaces, not shared databases)
- Assume interfaces are stable (version them from day one)
- Design interfaces that expose internal implementation details

### Step 4: Choose Architectural Pattern

Select a pattern that matches your constraints (from CHALLENGE risk assessment):

| Pattern | When to Use | When to Avoid |
|---------|-------------|---------------|
| **Layered** | Simple CRUD apps, clear separation of concerns | Complex domain logic, need for independent deployment |
| **Hexagonal** | Complex domain, need to swap external dependencies | Simple apps, team unfamiliar with the pattern |
| **Event-driven** | High decoupling needed, async processing, scalability | Simple request-response, strict ordering required |
| **Microservices** | Independent teams, independent deployment, different tech stacks | Small team, simple domain, tight coupling between features |
| **Monolith** | Small team, simple domain, fast iteration needed | Large team, independent scaling, different release cycles |

**DO:**
- Choose the simplest pattern that meets your constraints
- Justify your choice with an ADR
- Consider the team's familiarity with the pattern

**DON'T:**
- Choose microservices because they're trendy
- Mix patterns without clear boundaries (layered + event-driven = confusion)
- Ignore the operational cost of your pattern choice

### Step 5: Design Data Model

Define how data flows through and is stored by the system:

- **Entities**: What data does the system manage? (from RECON domain research)
- **Relationships**: How do entities relate? (one-to-many, many-to-many)
- **Storage**: Where is each entity stored? (database, cache, file, external API)
- **Flow**: How does data move through the system? (input → transform → store → output)

**DO:**
- Design the data model around domain concepts, not technical convenience
- Identify which data is authoritative (single source of truth)
- Plan for data migration from the start

**DON'T:**
- Design the data model before understanding the domain
- Store the same data in multiple places without a synchronization strategy
- Ignore data retention and deletion requirements

### Step 6: Address Technical Risks

For each critical technical risk from the CHALLENGE risk assessment, show how the design addresses it:

- **Performance risk**: Caching strategy, database indexing, async processing
- **Scalability risk**: Horizontal scaling, stateless components, load balancing
- **Security risk**: Authentication, authorization, input validation, encryption
- **Complexity risk**: Module boundaries, interface simplicity, documentation

**DO:**
- Reference each risk by ID and show the design response
- Include monitoring and alerting in the design (how will you know if a risk materializes?)
- Design for observability (logs, metrics, traces)

**DON'T:**
- Address risks with "we'll monitor it" (monitoring detects problems, it doesn't prevent them)
- Ignore non-functional requirements (performance, security, reliability)
- Assume the first design is the final design (iterate)

### Step 7: Produce the Design Document

Create a design document that the BUILD phase can implement:

1. System context diagram (what's inside, what's outside)
2. Component diagram (components and their interfaces)
3. Data model (entities, relationships, storage)
4. Sequence diagrams for key workflows
5. Technology choices with justification (ADRs)
6. Risk mitigation through design
7. Deployment architecture (how does this run in production?)

**DO:**
- Make it implementable — a developer should be able to start coding from this
- Include enough detail to resolve ambiguities but not so much that it's a spec
- Reference the RECON findings, CHALLENGE scope, and risk assessment

**DON'T:**
- Write a document that only architects can understand
- Include implementation details that belong in the BUILD phase
- Produce a design that ignores the constraints identified in CHALLENGE