---
# opencode-autopilot
name: evidence-gathering
description: Systematic methodology for gathering evidence about a codebase during the RECON phase to verify assumptions and understand architecture.
stacks: []
requires: []
---

# Evidence Gathering

Methodology for systematically gathering verifiable evidence about a codebase. The goal is to replace assumptions with documented facts.

Assumptions are bugs waiting to happen. "I assumed this was a REST API" leads to wrong abstractions. "I assumed this handled authentication" leads to security holes. Evidence gathering turns guesses into knowledge you can build on.

## When to Use

- **During the RECON phase** after domain research but before architecture
- **Taking over an unfamiliar project** — understand what exists before changing it
- **Before making architectural decisions** — know the current state before proposing changes
- **Evaluating technical debt** — distinguish cosmetic issues from structural problems
- **Debugging mysterious behavior** — trace the actual code path, not the assumed one

Evidence gathering is detective work. You are building a case from clues in the codebase.

## The Evidence Gathering Process

### Step 1: Identify Entry Points

Find where the system starts executing. You cannot understand a system if you do not know where it begins.

**CLI Tools:**
- Look for `bin/` directories, `package.json` bin field, `Cargo.toml` [[bin]] sections
- Main entry files: `src/index.ts`, `src/main.py`, `cmd/app/main.go`
- Look for command-line argument parsing (yargs, commander, clap, argparse)

**Web Applications:**
- Route definitions (Express routes, FastAPI routers, Spring controllers)
- Server setup files (server.ts, app.py, main.go with HTTP server)
- Middleware chains and request processing pipelines
- Framework-specific entry points (Next.js pages, Flask app factory)

**Libraries and SDKs:**
- Public API surfaces: `index.ts`, `mod.rs`, `__init__.py`
- Exported functions and classes (the public contract)
- Version compatibility declarations

**Services and Daemons:**
- Dockerfiles and container entry points
- Systemd service units, init scripts
- Cloud function handlers (AWS Lambda, Google Cloud Functions)
- Startup scripts and deployment configurations

**DO:**

- Trace from entry point through the first 3-5 function calls
- Note the framework or runtime being used (Express, FastAPI, Spring, etc.)
- Identify the initialization sequence:
  - Configuration loading (env vars, config files)
  - Dependency injection setup
  - Database connections and pool initialization
  - Middleware registration
  - Route registration
- Map environment variables and configuration sources

**DON'T:**

- Start reading random files in the middle of the codebase
- Assume the entry point is obvious (it often is not, especially in monorepos)
- Ignore initialization code as "just setup"
- Skip the startup sequence — that is where misconfiguration lives

```
// GOOD: Entry point analysis
Project: Payment Processing Service

Entry Point: src/server.ts

Initialization Sequence:
1. Load config from .env + environment variables
   - src/config/index.ts reads PORT, DATABASE_URL, STRIPE_KEY
   - Validation using Zod schema (fails fast if required vars missing)

2. Initialize database connection pool
   - src/db/client.ts creates Prisma client
   - Connection tested immediately (fail on startup, not first request)

3. Set up middleware stack
   - src/middleware/security.ts (helmet, CORS)
   - src/middleware/logging.ts (request ID, timing)
   - src/middleware/auth.ts (JWT verification)

4. Register routes
   - src/routes/payments.ts (POST /payments, GET /payments/:id)
   - src/routes/webhooks.ts (POST /webhooks/stripe)
   - src/routes/health.ts (GET /health)

5. Start HTTP server
   - Listen on PORT (default 3000)
   - Log startup confirmation with version and environment
```

### Step 2: Trace Data Flow

Follow data from input to storage to output. Data flow reveals the system's true architecture better than any documentation.

**Input Boundaries:** Where does data enter the system?
- HTTP requests (REST, GraphQL, WebSocket)
- CLI arguments and stdin
- File system watchers and scheduled jobs
- Message queues (RabbitMQ, Kafka, SQS)
- Webhooks from external services

**Processing:** How is data transformed?
- Validation and sanitization (what's rejected and why?)
- Business logic execution (calculations, decisions, state changes)
- Orchestration (calling other services, coordinating workflows)
- Aggregation (combining data from multiple sources)

**Storage:** Where is data persisted?
- Primary databases (PostgreSQL, MySQL, MongoDB)
- Caches (Redis, Memcached)
- File systems (uploads, exports, logs)
- External APIs (third-party services as storage)

**Output Boundaries:** How does data leave the system?
- HTTP responses (JSON, HTML, files)
- Events and messages published to queues
- Webhooks sent to external services
- File writes and exports
- Side effects (emails sent, notifications pushed)

**DO:**

- Pick one representative data flow and trace it end-to-end
- Note every transformation and validation step
- Identify where data crosses boundaries (external API calls, database queries)
- Map error handling at each step (what happens when this fails?)
- Track async operations (what runs in parallel? what depends on what?)
- Document data formats at each stage (what's the schema?)

**DON'T:**

- Only trace one flow (trace at least two to find patterns)
- Ignore error paths (they often reveal more than happy paths)
- Assume synchronous flow where async might exist
- Skip the persistence layer — that's where truth lives
- Ignore side effects (emails, notifications, events)

```
// GOOD: Data flow trace
Flow: Processing a Payment

1. Input: POST /payments
   - Express receives request
   - JWT auth middleware validates token, attaches userId
   - Rate limiting middleware checks quota

2. Validation: src/payments/validator.ts
   - Zod schema validates body (amount > 0, valid currency)
   - Business rule: amount <= user's spending limit
   - Error: 400 Bad Request with validation details

3. Processing: src/payments/service.ts
   - Create PaymentIntent record (status: pending)
   - Call Stripe API to create charge
   - Update record with Stripe payment ID

4. Side Effects (Async):
   - Publish "payment.initiated" event to Redis
   - Audit log entry created
   - Send confirmation email (queued via Bull)

5. Storage:
   - PostgreSQL: payments table updated
   - Redis: event published for other services
   - External: Stripe has the actual charge record

6. Output: HTTP Response
   - 200 OK with payment ID and status
   - Webhook will be sent to merchant URL when confirmed

Error Handling:
  - Validation fails → 400 response, no record created
  - Stripe API fails → 502 response, record stays pending, retry queued
  - Database unavailable → 500 response, Stripe charge voided (compensation)
```

### Step 3: Map Module Dependencies

Understand how code is organized. Dependencies reveal coupling, which predicts how hard changes will be.

**Import Analysis:** What modules import what?
- Read import statements at the top of each file
- Distinguish internal imports (src/...) from external (node_modules)
- Note dynamic imports (these indicate optional or lazy-loaded features)

**Dependency Graph:** Which modules depend on which?
- Build a mental or written graph
- Identify hub modules (imported by many others)
- Identify leaf modules (import but are not imported)

**Circular Dependencies:** Are there any?
- A imports B, B imports A (direct circular)
- A imports B, B imports C, C imports A (indirect circular)
- These indicate design problems and can cause runtime issues

**External Dependencies:** What third-party libraries are used?
- Frameworks and runtimes (Express, React, Django)
- Databases and ORMs (Prisma, SQLAlchemy, GORM)
- Utilities (Lodash, date-fns, axios)
- Infrastructure (logging, metrics, tracing)

**DO:**

- Start from entry points and follow imports outward
- Note which modules are depended on by many others (hubs are high-risk to change)
- Identify modules that nothing imports (dead code or utilities?)
- Catalog external dependencies and their purposes
- Look for abstraction layers (repository pattern, service layer)
- Map configuration dependencies (what modules depend on what config?)

**DON'T:**

- Try to map every single import (focus on module-level, not file-level)
- Ignore vendor/third-party directories (but note what they provide)
- Assume import = usage (check if imported symbols are actually used)
- Miss devDependencies that affect runtime (build tools, type generators)

```
// GOOD: Dependency analysis

Module Structure:
  src/
    server.ts (entry, imports routes, middleware)
    routes/
      payments.ts (imports services, validators)
      webhooks.ts (imports services, stripe)
    services/
      payment-service.ts (imports db, stripe, events)
      webhook-service.ts (imports db, crypto)
    db/
      client.ts (imports @prisma/client)
      schema.prisma (generates client)
    events/
      publisher.ts (imports redis)
    validators/
      payment-validator.ts (imports zod)

Hub Modules (high impact if changed):
  - src/db/client.ts (imported by 15+ modules)
  - src/events/publisher.ts (central event bus)

External Dependencies (key ones):
  - express: HTTP framework
  - @prisma/client: Database ORM
  - stripe: Payment provider SDK
  - redis: Event publishing and caching
  - zod: Runtime validation
  - bull: Job queues for async work

Circular Dependencies:
  - NONE FOUND (clean architecture)
  
  If found:
  - src/user.ts imports src/order.ts
  - src/order.ts imports src/user.ts
  Resolution: Extract shared types to src/types/
```

### Step 4: Identify Architectural Patterns

Recognize the architectural style. Patterns provide mental models for understanding the codebase.

**Layered Architecture:**
- Presentation → Business Logic → Data Access
- Look for directories like controllers/, services/, repositories/
- Clear separation: controllers don't touch the database directly

**MVC (Model-View-Controller):**
- Models define data structure and validation
- Views handle presentation (templates, React components)
- Controllers handle requests and orchestrate models/views

**Hexagonal / Ports and Adapters:**
- Core domain logic in the center
- Ports define interfaces (what the domain needs)
- Adapters implement interfaces (how those needs are met)
- Infrastructure is pluggable and replaceable

**Event-Driven:**
- Communication through events rather than direct calls
- Publishers emit events, subscribers react to them
- Look for event buses, message queues, event handlers

**Microservices / Modular Monolith:**
- Independent deployable units (or modules that could be services)
- Clear service boundaries and APIs between them
- Shared nothing (or minimal shared libraries)

**Serverless / Functions:**
- Stateless functions triggered by events
- Function-per-route or function-per-use-case
- Heavy reliance on managed services

**DO:**

- Look for directory structure clues (controllers/, models/, adapters/)
- Check for interface/protocol definitions (ports in hexagonal)
- Note how modules communicate (function calls, events, HTTP, message queues)
- Identify the "center" of the architecture (where is the core logic?)
- Look for inversion of control (who creates dependencies?)

**DON'T:**

- Force a pattern onto code that does not fit (not everything is cleanly architected)
- Assume the documented architecture matches the actual architecture
- Ignore deviations from the pattern (they might indicate problems or evolution)
- Judge messy code as "bad architecture" — it might be intentional pragmatism

```
// GOOD: Pattern identification

Observed Pattern: Layered Architecture with Repository Pattern

Evidence:
  Directory Structure:
    src/
      controllers/   (presentation layer)
      services/      (business logic layer)
      repositories/  (data access layer)
      models/        (domain entities)
  
  Code Patterns:
    - Controllers call Services, never Repositories directly
    - Services contain business logic and orchestrate repositories
    - Repositories abstract database access (Prisma, raw SQL)
    - Models define data structures (often Prisma-generated)

  Communication:
    - HTTP request → Controller → Service → Repository → Database
    - Return path: Database → Repository → Service → Controller → HTTP response

  Configuration:
    - Database connection injected into repositories
    - Services receive repositories via constructor (dependency injection)

Deviations from Pattern:
  - src/utils/ directory has mixed concerns (should be split)
  - Some controllers have business logic (should move to services)
  - Direct Prisma usage in 2 controllers (tech debt)

Assessment:
  Generally follows pattern well. Deviations are minor and documented.
  Refactoring the 2 controllers would improve consistency.
```

### Step 5: Verify Assumptions

For every assumption you have made, find evidence. This is the heart of evidence gathering.

**Common Assumptions to Verify:**
- "This is a REST API" → Find route definitions with HTTP methods
- "It uses PostgreSQL" → Find connection strings, ORM config, migration files
- "Authentication is JWT-based" → Find token generation, middleware, validation
- "It handles retries" → Find retry logic, exponential backoff, circuit breakers
- "This validates input" → Find validation schemas, error responses

**Evidence Sources:**
- Code (most reliable — code does not lie, but comments might)
- Configuration files (reveals runtime behavior)
- Tests (show intended usage and edge cases)
- Documentation (trust but verify with code)
- Infrastructure definitions (Docker, Terraform, K8s manifests)

**DO:**

- Write down every assumption before verifying it
- Mark assumptions as:
  - VERIFIED: Found concrete evidence in code
  - REFUTED: Evidence contradicts the assumption
  - UNCERTAIN: Insufficient evidence to confirm or deny
- Note where evidence is weak or ambiguous
- Distinguish between "this exists" and "this is used"
- Check both happy path and error handling for critical features

**DON'T:**

- Trust comments over code (comments lie, code doesn't)
- Assume that because something was done one way in one place, it's done that way everywhere
- Accept configuration as evidence of behavior (config might be unused)
- Ignore failing tests — they indicate broken assumptions
- Trust naming — a function called "validate" might not validate anything

```
// GOOD: Assumption verification log

Assumption Verification Log

1. ASSUMPTION: Authentication is JWT-based
   STATUS: VERIFIED
   EVIDENCE:
     - src/middleware/auth.ts: jwt.verify() called
     - src/auth/service.ts: jwt.sign() for token generation
     - tests/auth.test.ts: "should return JWT on successful login"
   CONFIDENCE: HIGH

2. ASSUMPTION: Payment retries use exponential backoff
   STATUS: REFUTED
   EVIDENCE:
     - src/payments/service.ts: Simple for loop with 3 retries
     - No backoff: await sleep(1000) between each retry (fixed delay)
   ACTUAL: Fixed 1-second delay between 3 retries
   CONFIDENCE: HIGH

3. ASSUMPTION: All API responses include request ID for tracing
   STATUS: UNCERTAIN
   EVIDENCE:
     - src/middleware/logging.ts: Attaches requestId to req object
     - Found in success responses (checked 2 controllers)
     - Not verified in error responses yet
   CONFIDENCE: MEDIUM (need to check error handling)

4. ASSUMPTION: Database uses connection pooling
   STATUS: VERIFIED
   EVIDENCE:
     - src/db/client.ts: PrismaClient with pool configuration
     - Connection limit: 20 (from DATABASE_POOL_SIZE env var)
   CONFIDENCE: HIGH
```

### Step 6: Document the Evidence Map

Produce a structured evidence document that others can use and you can refer back to.

**Required Sections:**

1. **Entry Points** (with exact file paths)
   - Primary entry points
   - Initialization sequence
   - Configuration sources

2. **Data Flows Traced** (at least 2)
   - Input → Processing → Storage → Output
   - Error paths for each flow
   - Async operations and dependencies

3. **Module Dependency Summary**
   - Hub modules (high impact)
   - Leaf modules (candidates for removal?)
   - External dependencies catalog
   - Circular dependencies (if any)

4. **Architectural Pattern** (with evidence)
   - Pattern identified
   - Directory structure evidence
   - Communication patterns
   - Deviations from pattern

5. **Key External Dependencies and Roles**
   - What each dependency does
   - Where it's used
   - Version constraints

6. **Verified Assumptions List**
   - VERIFIED assumptions with evidence citations
   - REFUTED assumptions with actual behavior
   - UNCERTAIN assumptions with what would confirm them

7. **Knowledge Gaps**
   - What you did not investigate (scope boundaries)
   - Uncertainties that need further exploration
   - Questions that arose during gathering

**DO:**

- Include file paths for every claim (enable others to verify)
- Distinguish between observed facts and inferences
- Note what you did NOT investigate (scope boundaries)
- Use structured lists, tables, and diagrams where helpful
- Make it skim-able (clear headings, bullet points)

**DON'T:**

- Write a narrative essay (use structured sections)
- Include every file you looked at (only evidence-bearing files)
- Present inferences as facts (use "appears to", "likely", "suggests")
- Skip the knowledge gaps (others need to know what is unknown)

## Anti-Pattern Catalog

### Anti-Pattern: Confirmation Bias

**What goes wrong:** You form an early hypothesis ("this is a microservice") and only look for evidence that confirms it, ignoring evidence that contradicts it.

**Instead:** Actively look for disconfirming evidence. Ask "what would prove me wrong?" If you think it's a REST API, look for GraphQL resolvers or gRPC definitions.

### Anti-Pattern: Surface Reading

**What goes wrong:** You scan file names and directory structure but do not read the actual code. You miss critical details like error handling, race conditions, or security issues.

**Instead:** Read the code. Follow function calls. Look at error handling. Check the test files — they reveal edge cases the main code does not show.

### Anti-Pattern: Assuming Consistency

**What goes wrong:** You verify a pattern in one file and assume it applies everywhere. But the codebase might have "pockets" of different approaches.

**Instead:** Check multiple locations. If 80% of controllers follow the pattern but 20% do not, document both. Those 20% might be the oldest (legacy) or newest (experimental) code.

### Anti-Pattern: Ignoring the Test Suite

**What goes wrong:** You focus only on production code and ignore tests. Tests reveal intended behavior, edge cases, and known issues.

**Instead:** Read the tests. Failing tests indicate broken functionality. Test descriptions reveal requirements. Integration tests show how components connect.

### Anti-Pattern: No Evidence Trail

**What goes wrong:** You form conclusions but do not record the evidence. A week later, you cannot remember why you thought something was true.

**Instead:** Document as you go. For every conclusion, note the file and line that supports it. Future you (or your teammates) will thank you.

## Integration with the Pipeline

Evidence gathering enables downstream phases:

- **CHALLENGE phase:** Evidence reveals constraints that bound possible enhancements
- **ARCHITECT phase:** Current architecture evidence informs design decisions
- **PLAN phase:** Verified module dependencies guide task sequencing
- **BUILD phase:** Evidence map prevents breaking undocumented behaviors

Evidence is the foundation for informed decisions. Without it, you are guessing.

## Failure Modes

### Cannot Find Entry Points

**Symptom:** No clear main file, no obvious startup sequence.

**Fix:** Look at package.json scripts, Docker CMD, or deployment configs. Check for framework-specific conventions (Next.js, Django, Rails all have standard entry points). Run the app and attach a debugger to see where it starts.

### Data Flow is Non-Deterministic

**Symptom:** The same input produces different outputs depending on timing, cache state, or external services.

**Fix:** Document the non-determinism. Note race conditions, cache invalidation strategies, and external dependencies. This is critical evidence, not a failure.

### Architecture is "Big Ball of Mud"

**Symptom:** No discernible pattern. Everything depends on everything.

**Fix:** Document the mud. Map the worst tangled dependencies. Note hotspots where many modules connect. This evidence is crucial for any refactoring discussions.

### Evidence Contradicts Documentation

**Symptom:** README says one thing, code does another.

**Fix:** Code wins. Document what the code actually does. Note the discrepancy between documentation and reality. This might indicate tech debt or documentation rot.
