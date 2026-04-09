---
# opencode-autopilot
name: domain-research
description: Methodology for researching a project's domain during the RECON phase to understand what it does, who it serves, and what problem it solves.
stacks: []
requires: []
---

# Domain Research

Systematic methodology for understanding a project's domain before writing any code. The goal is to answer: what problem does this solve, for whom, and why does it matter?

Domain research comes first. You cannot architect a solution, estimate effort, or evaluate trade-offs without understanding the domain. Jumping straight to code is building a bridge without knowing what river you are crossing.

## When to Use

- **First phase of any new project (RECON)** — the foundation everything else builds on
- **Taking over an unfamiliar codebase** — understand the "why" before the "how"
- **Evaluating feature requests** — does this align with the core domain or is it scope creep?
- **Planning refactors** — which parts are domain logic vs. infrastructure that can change?
- **Onboarding new team members** — domain knowledge transfers faster than code knowledge

Skip domain research and you will build the wrong thing beautifully. Or you will build the right thing in a way that makes future changes impossible.

## The Domain Research Process

### Step 1: Identify the Problem Space

Read the README, project description, and any mission statements. Answer:

- What problem does this project exist to solve?
- Who experiences this problem?
- What happens if this problem is NOT solved?
- What is the success criteria from the user's perspective?

**DO:**

- Start with the project's own documentation (README, docs/, wiki, CONTRIBUTING.md)
- Look at the package name and description in package.json, Cargo.toml, pyproject.toml, go.mod
- Check the repository description on GitHub/GitLab and any issue templates
- Search for "mission", "vision", "purpose" in documentation
- Look at the project's homepage or marketing site if available

**DON'T:**

- Jump into source code before understanding the problem
- Assume you know the domain from the project name alone
- Skip this step because "the code will tell me"
- Ignore the problem statement because you want to start building

```
// GOOD: Problem-focused understanding
"This is a payment processing SDK that lets merchants accept
multi-currency transactions with automatic fraud detection.
The problem it solves: merchants lose sales when they cannot
accept international payments, and they lose money to fraud.
Success means: higher conversion rates and lower chargebacks."

// BAD: Implementation-focused misunderstanding
"This is a TypeScript project that uses Stripe's API and
has some database models for transactions."
```

### Step 2: Map Key Domain Concepts

Identify the nouns and verbs of the domain. These are the building blocks of everything else:

**Entities**: What are the main things this project manages?
- Users, orders, transactions, products, projects, files, accounts
- Look for these in variable names, database schemas, type definitions

**Value Objects**: What describes entities but has no identity?
- Email addresses, money amounts, dates, addresses, configuration
- These are immutable and compared by value, not identity

**Aggregates**: What clusters of entities act as a single unit?
- An Order with its OrderItems
- A Project with its Tasks and Comments
- Transactions with their AuditLogs

**Domain Events**: What significant things happen that other parts care about?
- OrderPlaced, PaymentReceived, UserRegistered, FileUploaded
- These often drive workflows and side effects

**Relationships**: How do entities relate?
- One-to-many (User has many Orders)
- Many-to-many (Product belongs to many Categories)
- Composition vs. association (Order owns OrderItems vs. User references Address)

**Operations**: What can be done to/with entities?
- Create, validate, transform, publish, approve, cancel, refund
- These become use cases and business logic

**DO:**

- Create a glossary of domain terms as you discover them
- Note synonyms and aliases (client = user = customer = account?)
- Identify bounded contexts (where does one domain concept end and another begin?)
- Look for ubiquitous language — terms used consistently in code AND conversations
- Map the lifecycle of key entities (draft → pending → active → archived)

**DON'T:**

- Confuse implementation details with domain concepts
  - "cache", "queue", "repository" are technical, not domain
  - "RedisService" tells you about infrastructure, not the domain
- Assume technical naming reflects domain naming
  - A `PaymentGateway` might actually represent a `PaymentProcessor` in domain terms
- Ignore inconsistencies — if code calls it "User" but docs call it "Member", that's a finding

```
// GOOD: Domain concept map
Domain: E-commerce Checkout

Entities:
  - Cart: Collection of items a customer intends to buy
  - Order: Confirmed purchase intent with payment info
  - LineItem: Single product + quantity in a cart/order
  - Payment: Record of money movement attempt
  - Customer: Person making the purchase

Value Objects:
  - Money: amount + currency (immutable)
  - Address: street, city, country (compared by full value)
  - Email: validated email string

Aggregates:
  - Order (root) contains LineItems
    - LineItem cannot exist without Order
    - Total calculated from LineItems

Domain Events:
  - CartCreated
  - ItemAddedToCart
  - CheckoutStarted
  - PaymentInitiated
  - PaymentSucceeded / PaymentFailed
  - OrderConfirmed

Operations:
  - Add item to cart
  - Apply discount code
  - Select shipping method
  - Submit payment
  - Confirm order
```

### Step 3: Identify Stakeholders and Workflows

Map who interacts with the system and how. Understanding the human context prevents building features nobody needs.

**Primary Users**: Who directly uses this project?
- End customers interacting with a UI
- Developers importing a library
- Operators running CLI commands
- Other services calling an API

**Secondary Users**: Who benefits indirectly?
- Customer support teams using admin tools
- Business analysts accessing reports
- Ops teams monitoring the system
- Downstream systems consuming events

**Actors and Roles**: What different hats do users wear?
- Admin vs. regular user vs. guest
- Seller vs. buyer in a marketplace
- Editor vs. viewer in a CMS

**Workflows**: What are the step-by-step processes?
- The happy path: what happens when everything goes right?
- Alternative paths: what are the common variations?
- Error paths: what happens when things fail?
- Edge cases: what are the rare but important scenarios?

**DO:**

- Trace at least one complete workflow from start to finish
- Identify decision points (where does the system branch based on input?)
- Note state transitions (draft → submitted → approved → published)
- Map error paths (what happens when validation fails? payment declines?)
- Identify where human judgment is required vs. automated decisions
- Look for synchronous vs. asynchronous steps

**DON'T:**

- Only trace the happy path (most bugs live in error handling)
- Assume workflows are linear (they rarely are)
- Ignore time-based aspects (delays, timeouts, scheduling)
- Forget about authorization checks at each step
- Miss the handoffs between systems or teams

```
// GOOD: Workflow analysis
Workflow: Customer Checkout

1. Customer views cart
   - Decision: proceed to checkout or continue shopping?
   - Error: cart empty → show message, stay on cart page

2. Customer enters shipping address
   - Validation: address format, deliverable check
   - Error: invalid address → show errors, allow correction

3. System calculates shipping options
   - Async: call carrier APIs
   - Timeout: after 5s, show "calculating..." and update when ready
   - Error: carrier down → show fallback options, log for ops

4. Customer selects shipping + payment method
   - Decision: saved card vs. new card vs. alternative (PayPal)

5. System validates payment
   - Async: call payment processor
   - Error: card declined → allow retry with different method
   - Error: fraud suspicion → trigger manual review workflow

6. System creates order and sends confirmation
   - Success: redirect to order confirmation page
   - Async: send confirmation email, notify warehouse
   - Error: order creation fails → payment voided, customer notified
```

### Step 4: Distinguish Core Domain from Supporting Infrastructure

Not all code is equally important to the domain. Knowing the difference guides where to focus effort and what can change.

**Core Domain**: The unique business logic that makes this project valuable
- What your competitors cannot copy easily
- The reason the project exists
- Examples: fraud detection algorithm, recommendation engine, pricing model
- Changes here are high-risk and require deep domain knowledge

**Supporting Subdomains**: Necessary but not differentiating
- Required for the core to function but not unique
- Examples: user management, audit logging, notifications
- Could potentially be outsourced or replaced with off-the-shelf solutions

**Generic Subdomains**: Commodity functionality
- Common across many projects
- Examples: email sending, file I/O, database access, caching
- Usually implemented with libraries/frameworks

**Complexity Concentration**: Where does the project's complexity live?
- Look for complex conditionals, state machines, business rules
- Complex algorithms, data transformations, calculations
- Integration points with external business systems

**DO:**

- Focus research effort on the core domain (80% of thinking, 20% of code)
- Note which parts are commodity vs. competitive advantage
- Identify where the project's complexity concentrates
- Ask: "if we replaced this module with a library, would anyone notice?"
- Look for domain-specific language embedded in complex logic

**DON'T:**

- Spend equal time on auth configuration and core business logic
- Mistake framework boilerplate for domain logic
- Assume all code is equally important
- Ignore the core because it's "too complex" to understand quickly

```
// Example: E-commerce Platform Analysis

Core Domain (protect, invest, understand deeply):
  - Pricing engine with dynamic discounts, tiers, promotions
  - Inventory allocation algorithm (reserved vs. available stock)
  - Fraud detection scoring
  - Tax calculation for multi-jurisdictional sales

Supporting Subdomains (maintain, standardize):
  - User authentication and authorization
  - Email notification templates
  - Report generation
  - Admin interface for product management

Generic Subdomains (replace with libraries if possible):
  - Database connection pooling
  - HTTP request routing
  - Image resizing
  - PDF generation

Complexity Concentration:
  - src/pricing/calculator.ts (200+ lines of discount logic)
  - src/inventory/allocator.ts (state machine for stock states)
  - src/fraud/scorer.ts (machine learning model integration)
```

### Step 5: Document Findings

Produce a domain summary that answers:

1. What problem does this solve? (in one sentence)
2. Who are the stakeholders? (primary and secondary)
3. What are the key domain entities and their relationships? (with diagram if helpful)
4. What are the primary workflows? (at least one end-to-end trace)
5. Where does complexity concentrate? (core domain identification)
6. What assumptions am I making that need verification?
7. What domain knowledge am I missing?

**DO:**

- Write for someone who has never seen this project
- Use domain language, not technical jargon
- Flag uncertainties explicitly ("Assumption:", "Need to verify:")
- Include specific file references where domain logic lives
- Note domain invariants (rules that must always be true)
- Document bounded contexts and their boundaries

**DON'T:**

- Write a code walkthrough (that's exploration, not domain research)
- Present assumptions as facts
- Use only technical terms without domain context
- Skip the verification questions

```
// GOOD: Domain Summary Structure

Project: Payment Processing SDK

Problem Statement:
Merchants lose 15-30% of international sales because they cannot
accept local payment methods. They also lose 2-5% to fraud.
This SDK solves both by providing a unified API for 100+
payment methods with built-in fraud detection.

Stakeholders:
- Primary: Backend developers integrating payments
- Secondary: Finance teams reconciling transactions, Support teams
  investigating failed payments

Key Entities:
- PaymentIntent: Represents a payment attempt (amount, currency, methods)
- PaymentMethod: Specific way to pay (card, bank transfer, wallet)
- Transaction: Record of money movement (succeeded, failed, pending)
- Customer: Entity making payments, may have saved methods

Primary Workflow (Simplified Payment Flow):
1. Merchant creates PaymentIntent with amount/currency
2. Customer selects PaymentMethod
3. SDK validates and processes payment
4. Transaction recorded with status
5. Webhook sent to merchant with result

Core Domain (Complex, Business-Critical):
- Fraud scoring algorithm (src/fraud/scorer.ts)
- Multi-method routing logic (src/routing/router.ts)
- Currency conversion with hedging (src/fx/converter.ts)

Assumptions to Verify:
- Do merchants typically use the webhook or poll for status?
- How are refunds handled — separate flow or reversal?
- What compliance requirements (PCI, GDPR) affect the domain?

Knowledge Gaps:
- Specific fraud signals and their weights (proprietary?)
- Settlement timing and reconciliation process
```

## Anti-Pattern Catalog

### Anti-Pattern: Solution-First Thinking

**What goes wrong:** You read "this is a Redis caching layer" and immediately think about cache invalidation strategies without asking: what problem does caching solve? What data is being cached? Why does it need to be fast?

**Instead:** Start with the problem. "Users complain that product searches are slow. The domain analysis shows product data rarely changes but search queries are complex. Caching is a solution to the slow search problem, not the domain itself."

### Anti-Pattern: Technical Confusion

**What goes wrong:** You see `UserService`, `UserRepository`, `UserController` and think "User" is a core domain entity. But the actual domain entity is `Member` and "User" is just what the auth system calls people.

**Instead:** Map the ubiquitous language. What do stakeholders call it? What do requirements documents call it? Code might use "User" but if everyone talks about "Members", the domain entity is Member.

### Anti-Pattern: Ignoring the Money Flow

**What goes wrong:** You analyze the technical architecture but never ask who pays for what and when. In e-commerce, the money flow (who captures payment, when is the seller paid, how are fees calculated) is core domain.

**Instead:** Always trace the money, the data ownership, and the liability. These business realities drive more architectural decisions than technical constraints.

### Anti-Pattern: Shallow Workflow Analysis

**What goes wrong:** You trace the happy path and declare understanding. But the real complexity is in the error paths, the retry logic, the manual intervention workflows.

**Instead:** Spend equal time on error paths. Ask "what if this fails?" at every step. Look for timeout handling, circuit breakers, dead letter queues, and manual review processes.

### Anti-Pattern: No Bounded Context Boundaries

**What goes wrong:** You treat the entire codebase as one domain. But the "Order" in the checkout context might be different from the "Order" in the fulfillment context.

**Instead:** Identify bounded contexts. An entity can have different meanings in different contexts. Map where contexts hand off to each other and how they translate between their internal languages.

## Integration with the Pipeline

Domain research feeds directly into subsequent phases:

- **CHALLENGE phase:** Domain understanding enables proposing meaningful enhancements
- **ARCHITECT phase:** Core domain identification guides where to invest architectural effort
- **PLAN phase:** Workflows translate into task sequences
- **BUILD phase:** Domain invariants become test cases

Without solid domain research, you are building on quicksand.

## Failure Modes

### Cannot Identify the Problem

**Symptom:** After reading all documentation, you still cannot state what problem this solves in one sentence.

**Fix:** Look at the tests. Tests reveal intent better than documentation. Also check recent issues and pull requests — what are people trying to do? What problems are they reporting?

### Domain Language is Inconsistent

**Symptom:** Code calls it "Order", API calls it "Purchase", docs call it "Transaction".

**Fix:** This is a finding, not a failure. Document the inconsistency. Determine which term is canonical (usually the one in the public API or user-facing docs). Note that refactoring for consistency might be needed.

### Core Domain is Hidden

**Symptom:** All the code looks like infrastructure. Where is the business logic?

**Fix:** Look for configuration files, database migrations, or external service integrations. Complex business rules are often encoded in YAML/JSON configs or database constraints rather than code. Also check for "policy" or "rule" objects.

### Workflows Are Distributed

**Symptom:** A single workflow spans multiple services or repositories. You cannot trace it end-to-end.

**Fix:** Document what you can trace. Identify the integration points. Note where handoffs happen between systems. The distributed nature is itself a domain finding — the bounded context boundaries are service boundaries.
