---
# opencode-autopilot
name: system-design
description: Systematic methodology for designing software architecture during the ARCHITECT phase to produce implementable design blueprints
stacks: []
requires: []
---

# System Design

System design translates domain understanding into concrete technical architecture. During the ARCHITECT phase, you produce the blueprint that BUILD phase developers will follow. A good design is specific enough to implement but flexible enough to evolve.

## From Domain to Components

Start with the domain model and requirements from the CHALLENGE phase. Transform abstract concepts into concrete system components.

### Component Identification

Ask these questions to find your components:

**What are the major functional areas?**
- User management, billing, content delivery, analytics
- Each functional area often becomes a service or module

**What has independent lifecycles?**
- Components that deploy independently
- Components owned by different teams
- Components with different scaling needs

**What encapsulates a specific business capability?**
- Payment processing, recommendation engine, search
- Components that encapsulate business rules

```
Domain Concept          Component
---------------         -----------
User                    User Service
Payment                 Payment Processor
Product Catalog         Catalog Service
Order                   Order Service
Notification            Notification Service
```

### Component Specification

For each component, document:

```markdown
## Component: Order Service

**Responsibility:**
Process customer orders from creation through fulfillment.

**Interfaces:**
- REST API: POST /orders, GET /orders/{id}
- Events: OrderCreated, OrderUpdated, OrderCancelled
- Dependencies: User Service, Payment Service, Inventory Service

**Data Ownership:**
- Orders table (primary)
- Order items table
- Order history table

**Scaling Characteristics:**
- Read-heavy (10:1 read/write ratio)
- Can be partitioned by user_id
- Cacheable for 5 minutes
```

## Interface Design

Interfaces are contracts between components. Design them carefully.

### API Design Principles

**DO: Design for the consumer**

```typescript
// Good: Simple, intuitive endpoint
POST /orders
{
  "items": [
    {"productId": "sku-123", "quantity": 2}
  ],
  "shippingAddress": {...}
}

// Bad: Leaks implementation details
POST /order-service/v2/order-create-endpoint
{
  "orderPayload": {
    "lineItems": [...],
    "destinationAddress": {...}
  }
}
```

**DO: Version from day one**

```typescript
// Include version in URL or header
GET /v1/orders/{id}
Accept: application/vnd.api.v1+json
```

**DON'T: Return internal IDs or implementation details**

```typescript
// Bad: Exposes database internals
{
  "id": 12345,
  "created_by_user_id": 67890,
  "db_partition": "orders_2024_q1"
}

// Good: Clean, opaque identifiers
{
  "orderId": "ord_abc123def456",
  "customerId": "usr_xyz789"
}
```

### Event Design

For async communication, design events carefully:

**DO: Use event names that describe what happened**

```typescript
// Good: Past tense, describes the event
OrderCreated
PaymentProcessed
UserPasswordChanged

// Bad: Command-style names or vague names
CreateOrder
HandlePayment
SomethingHappened
```

**DO: Include enough context in events**

```typescript
// Good: Consumers don't need to fetch additional data
{
  "eventType": "OrderCreated",
  "orderId": "ord_abc123",
  "customerId": "usr_xyz789",
  "items": [...],
  "total": 99.99,
  "timestamp": "2024-01-15T10:30:00Z"
}

// Bad: Minimal information forces lookups
{
  "eventType": "OrderCreated",
  "orderId": "ord_abc123"
}
```

## Data Modeling

Design data models that support your components and interfaces.

### Entity Identification

Start with nouns from your domain:

```
Domain: E-commerce
Entities: User, Product, Order, OrderItem, Payment, Shipment
```

### Relationship Mapping

Define relationships explicitly:

```
User 1--* Order
Order 1--* OrderItem
OrderItem *--1 Product
Order 1--1 Payment
Order 1--* Shipment
```

### Data Flow Design

Trace data through the system:

```
1. User creates order -> Order Service
2. Order Service validates inventory -> Inventory Service
3. Order Service processes payment -> Payment Service
4. Order Service emits OrderCreated event
5. Notification Service sends confirmation email
6. Fulfillment Service prepares shipment
```

## Architectural Pattern Selection

Choose patterns based on constraints and requirements.

### Monolith vs Microservices

**Choose Monolith when:**
- Team size is small (< 10 developers)
- Deployment frequency is low
- Components share data heavily
- Network latency is unacceptable

**Choose Microservices when:**
- Multiple teams need independent deployment
- Components have different scaling requirements
- Technology diversity is needed
- Failure isolation is critical

### Layered vs Hexagonal Architecture

**Layered (Traditional)**
```
Presentation -> Business Logic -> Data Access
```

- Good for: CRUD applications, simple domains
- Easy to understand, widely known
- Risk: Business logic leaks into presentation layer

**Hexagonal (Ports and Adapters)**
```
         [UI/API]         [Database]
              \              /
               \            /
            [Application Core]
               /            \
              /              \
        [External Services]  [Message Queue]
```

- Good for: Complex domains, testability requirements
- Business logic isolated from infrastructure
- Higher initial complexity

### Pattern Selection Matrix

| Scenario | Recommended Pattern |
|----------|---------------------|
| Small team, simple app | Monolith + Layered |
| Large team, complex domain | Microservices + Hexagonal |
| High transaction volume | CQRS + Event Sourcing |
| Real-time requirements | Event-driven |
| Multi-tenant SaaS | Modular Monolith |

## Designing for Constraints

The CHALLENGE phase identified constraints. Your design must respect them.

### Performance Constraints

```markdown
Constraint: 95th percentile response time < 200ms

Design Response:
- Implement Redis caching for hot data
- Use database read replicas for queries
- Async processing for non-critical operations
- CDN for static assets
```

### Scale Constraints

```markdown
Constraint: Support 10,000 concurrent users

Design Response:
- Horizontal scaling with load balancer
- Stateless application servers
- Database connection pooling
- Message queue for async work
```

### Compliance Constraints

```markdown
Constraint: GDPR compliance required

Design Response:
- Data encryption at rest and in transit
- Right to erasure implementation
- Audit logging for data access
- EU data residency for EU customers
```

## Trade-off Analysis

Every design involves trade-offs. Document your reasoning.

### Consistency vs Availability

```markdown
Decision: Favor availability over strong consistency for product catalog

Rationale:
- Catalog data changes infrequently
- Stale data is acceptable for short periods
- Availability directly impacts revenue

Implementation:
- Use eventual consistency with 5-minute cache TTL
- Background jobs update cache on changes
- Critical operations (checkout) use strong consistency
```

### Simplicity vs Flexibility

```markdown
Decision: Start with simple solution, add flexibility when needed

Rationale:
- Current requirements are well-defined
- Adding flexibility now adds unnecessary complexity
- Refactoring later is acceptable for this component

Implementation:
- Hardcoded configuration for now
- Clear extension points for future flexibility
```

## DO and DON'T

**DO: Create specific, implementable designs**

```markdown
## Order Service API

POST /v1/orders
Creates a new order. Returns 201 with order details.

Request:
{
  "items": [
    {"productId": "string", "quantity": "integer"}
  ],
  "shippingAddress": Address
}

Response 201:
{
  "orderId": "string",
  "status": "pending",
  "total": "number",
  "createdAt": "ISO8601"
}

Response 400: Invalid request body
Response 409: Insufficient inventory
```

**DON'T: Leave vague requirements for BUILD phase**

```markdown
## Order Service

The order service handles orders. It should be fast and reliable.
We'll need to think about the API design later.
```

**DO: Document assumptions and dependencies**

```markdown
## Assumptions

- User Service provides authentication (assumes ADR-003)
- Payment Service handles all payment processing
- Inventory Service is the source of truth for stock levels
- Database is PostgreSQL 15+ with JSONB support
```

**DON'T: Design in isolation from constraints**

```markdown
## System Design

We'll use microservices with Kubernetes deployment.

[No mention of the constraint that team has no K8s experience]
[No mention of the budget constraint limiting infrastructure costs]
```

**DO: Design for failure modes**

```markdown
## Failure Handling

If Payment Service is unavailable:
1. Queue order for async processing
2. Return 202 Accepted to client
3. Retry payment processing with exponential backoff
4. Notify user via email on completion or permanent failure
```

**DON'T: Assume everything works perfectly**

```markdown
## System Design

Services communicate via HTTP. The system will handle all requests.
```

## Design Deliverables

Your ARCHITECT phase output should include:

1. **System Architecture Diagram**
   - Component relationships
   - Data flows
   - External dependencies

2. **Component Specifications**
   - Responsibilities
   - Interfaces
   - Data ownership

3. **API Specifications**
   - Endpoints
   - Request/response schemas
   - Error codes

4. **Data Model**
   - Entity definitions
   - Relationships
   - Key queries/patterns

5. **ADRs**
   - Significant architectural decisions
   - Trade-off explanations

6. **Deployment Architecture**
   - Infrastructure components
   - Scaling approach
   - Monitoring strategy

## Integration with BUILD Phase

The BUILD phase will use your design as the blueprint. Ensure:

- Designs are detailed enough to implement without guesswork
- Interfaces are well-defined and documented
- Technology choices are specified
- Extension points are clearly marked
- Constraints are visible to implementers

A good ARCHITECT phase design lets BUILD phase developers focus on implementation quality, not design decisions.
