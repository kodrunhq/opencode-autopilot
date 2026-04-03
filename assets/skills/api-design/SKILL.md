---
name: api-design
description: REST and GraphQL API design conventions covering resource naming, HTTP methods, status codes, pagination, versioning, error format, and rate limiting
stacks: []
requires: []
---

# API Design Patterns

Practical conventions for designing, reviewing, and consuming REST and GraphQL APIs. Covers resource naming, HTTP method semantics, status codes, pagination, filtering, versioning, error responses, GraphQL schema design, rate limiting, idempotency, and HATEOAS. Apply these when building new APIs, reviewing API contracts, or integrating with external services.

## 1. REST Resource Naming

**DO:** Use plural nouns for collection resources. URLs represent resources, not actions.

```
GET    /users              # List users
GET    /users/123          # Get user 123
POST   /users              # Create a user
PUT    /users/123          # Replace user 123
PATCH  /users/123          # Partially update user 123
DELETE /users/123          # Delete user 123

GET    /users/123/orders   # List orders for user 123
GET    /orders/456         # Get order 456 directly
```

- Use kebab-case for multi-word resources: `/order-items`, `/payment-methods`
- Limit nesting to 2 levels: `/users/123/orders` is fine; `/users/123/orders/456/items/789/notes` is not -- flatten to `/order-items/789/notes`
- Use query parameters for filtering, not nested paths: `/orders?userId=123&status=pending`

**DON'T:**

- Use verbs in URLs (`/getUser`, `/createOrder`, `/deleteItem`)
- Use singular nouns for collections (`/user` instead of `/users`)
- Mix casing styles (`/orderItems` vs `/order-items`) -- pick one and be consistent
- Nest resources deeper than 2 levels

## 2. HTTP Method Semantics

**DO:** Use HTTP methods according to their defined semantics.

| Method | Purpose | Idempotent | Safe | Request Body |
|--------|---------|-----------|------|-------------|
| GET | Read resource(s) | Yes | Yes | No |
| POST | Create resource / trigger action | No | No | Yes |
| PUT | Replace entire resource | Yes | No | Yes |
| PATCH | Partial update | No* | No | Yes |
| DELETE | Remove resource | Yes | No | Optional |

*PATCH can be made idempotent with proper implementation (JSON Merge Patch).

- GET must never cause side effects (no writes, no state changes)
- PUT replaces the entire resource -- send the full representation
- PATCH sends only the fields to update -- use JSON Merge Patch (RFC 7396) or JSON Patch (RFC 6902)
- DELETE should be idempotent: deleting an already-deleted resource returns 204, not 404

**DON'T:**

- Use POST for everything (REST anti-pattern)
- Use GET with a request body (not reliably supported)
- Use PUT for partial updates (PUT means full replacement)
- Return different status codes for repeated DELETE calls on the same resource

## 3. Status Code Selection

**DO:** Return the most specific appropriate status code. Clients rely on status codes for control flow.

### 2xx Success

| Code | When to Use |
|------|------------|
| 200 OK | Successful GET, PUT, PATCH with response body |
| 201 Created | Successful POST that created a resource (include `Location` header) |
| 202 Accepted | Request accepted for async processing (not yet completed) |
| 204 No Content | Successful DELETE or PUT/PATCH with no response body |

### 3xx Redirection

| Code | When to Use |
|------|------------|
| 301 Moved Permanently | Resource URL changed permanently (cache forever) |
| 304 Not Modified | Conditional GET -- client cache is still valid |
| 307 Temporary Redirect | Temporary redirect preserving HTTP method |
| 308 Permanent Redirect | Permanent redirect preserving HTTP method |

### 4xx Client Errors

| Code | When to Use |
|------|------------|
| 400 Bad Request | Malformed syntax, invalid JSON, missing required field |
| 401 Unauthorized | Missing or invalid authentication credentials |
| 403 Forbidden | Authenticated but not authorized for this resource |
| 404 Not Found | Resource does not exist |
| 405 Method Not Allowed | HTTP method not supported on this endpoint |
| 409 Conflict | Request conflicts with current state (duplicate, version mismatch) |
| 415 Unsupported Media Type | Content-Type not accepted |
| 422 Unprocessable Entity | Valid JSON but semantic validation failed |
| 429 Too Many Requests | Rate limit exceeded (include `Retry-After` header) |

### 5xx Server Errors

| Code | When to Use |
|------|------------|
| 500 Internal Server Error | Unexpected server failure (log details, return generic message) |
| 502 Bad Gateway | Upstream service returned invalid response |
| 503 Service Unavailable | Server temporarily overloaded or in maintenance |
| 504 Gateway Timeout | Upstream service did not respond in time |

**DON'T:**

- Return 200 for errors with an error body (the "200 OK everything" anti-pattern)
- Return 500 for client errors (validates input before processing)
- Return 403 when 401 is correct (unauthenticated vs unauthorized)
- Return 404 to hide resource existence when 403 is more appropriate for authenticated users

## 4. Pagination

**DO:** Paginate all list endpoints. Never return unbounded collections.

### Cursor-Based (Preferred)

```
GET /orders?limit=20&after=eyJpZCI6MTIzfQ

Response:
{
  "data": [...],
  "pagination": {
    "hasNextPage": true,
    "hasPreviousPage": false,
    "startCursor": "eyJpZCI6MTAwfQ",
    "endCursor": "eyJpZCI6MTIzfQ"
  }
}
```

- Use opaque, base64-encoded cursors (not raw IDs)
- Cursor pagination is stable under concurrent inserts/deletes
- Include `hasNextPage` / `hasPreviousPage` booleans

### Offset-Based (Simpler, Less Stable)

```
GET /orders?page=2&limit=20

Response:
{
  "data": [...],
  "pagination": {
    "page": 2,
    "limit": 20,
    "totalCount": 156,
    "totalPages": 8
  }
}
```

- Offset pagination can skip or duplicate items under concurrent writes
- Acceptable for admin dashboards and infrequently changing data
- Always include `totalCount` for UI page indicators

**DON'T:**

- Return all records in a single response (unbounded queries)
- Use offset pagination for real-time feeds or high-write tables
- Default to a page size larger than 100 (default 20-50 is reasonable)
- Expose raw database IDs in cursor values

## 5. Filtering and Sorting

**DO:** Use query parameters for filtering and sorting with consistent conventions.

```
# Filtering
GET /orders?status=pending&createdAfter=2024-01-01&minTotal=100

# Sorting (prefix with - for descending)
GET /orders?sort=-createdAt,total

# Field selection (sparse fieldsets)
GET /orders?fields=id,status,total,createdAt

# Combined
GET /orders?status=shipped&sort=-createdAt&limit=20&fields=id,status
```

- Use camelCase for query parameter names (match JSON field names)
- Support multiple sort fields with comma separation
- Use ISO 8601 for date/time filters
- Document all supported filter fields and operators

**DON'T:**

- Invent custom filter syntax when simple key=value works
- Allow filtering on unindexed columns (performance risk)
- Accept arbitrary field names without validation (information disclosure)
- Use different naming conventions for query params vs response fields

## 6. Versioning Strategies

**DO:** Version your API when making breaking changes. Pick one strategy and be consistent.

### URL Path Versioning (Most Common)

```
GET /v1/users/123
GET /v2/users/123
```

- Simple, explicit, easy to route, easy to document
- Recommended for public APIs and APIs with multiple consumers

### Header Versioning

```
GET /users/123
Accept: application/vnd.myapi.v2+json
```

- Keeps URLs clean
- Harder to test with browsers and curl
- Better for internal APIs with controlled clients

### Selection Guide

| Strategy | Public APIs | Internal APIs | Simplicity |
|----------|------------|--------------|-----------|
| URL path | Best | Good | Easiest |
| Header | Acceptable | Best | Moderate |
| Query param | Avoid | Acceptable | Easy |

**DON'T:**

- Break existing API contracts without versioning
- Maintain more than 2 active versions simultaneously
- Version every endpoint change -- version only for breaking changes
- Use date-based versions for REST APIs (confusing, hard to compare)

## 7. Error Response Format (RFC 7807)

**DO:** Use a consistent error response format across all endpoints. RFC 7807 (Problem Details) is the standard.

```json
{
  "type": "https://api.example.com/errors/validation-failed",
  "title": "Validation Failed",
  "status": 422,
  "detail": "The 'email' field must be a valid email address.",
  "instance": "/users",
  "errors": [
    {
      "field": "email",
      "message": "Must be a valid email address",
      "value": "not-an-email"
    },
    {
      "field": "age",
      "message": "Must be between 0 and 150",
      "value": -5
    }
  ]
}
```

- `type`: URI identifying the error type (documentation link)
- `title`: Human-readable summary (same for all instances of this type)
- `status`: HTTP status code (duplicated for convenience)
- `detail`: Human-readable explanation specific to this occurrence
- `instance`: URI of the request that caused the error
- `errors`: Array of field-level validation errors (optional, for 422 responses)

**DON'T:**

- Return different error formats from different endpoints
- Include stack traces or internal paths in production error responses
- Use generic messages without enough context to fix the problem
- Return error details in the response body with a 200 status code

## 8. GraphQL Schema Design

**DO:** Design GraphQL schemas for client needs with consistent patterns.

- Use input types for mutations:
  ```graphql
  input CreateUserInput {
    name: String!
    email: String!
    role: UserRole = MEMBER
  }

  type Mutation {
    createUser(input: CreateUserInput!): CreateUserPayload!
  }

  type CreateUserPayload {
    user: User
    errors: [UserError!]!
  }
  ```

- Use Relay-style connections for paginated lists (`OrderConnection` with `edges: [OrderEdge!]!`, `pageInfo: PageInfo!`, `totalCount: Int!`)
- Return mutation payloads (not raw types) for error handling and metadata
- Use enums for fixed sets of values (`enum OrderStatus { PENDING SHIPPED DELIVERED }`)
- Use interfaces and unions for polymorphic types

**DON'T:**

- Return raw types from mutations (no error handling path)
- Create deeply nested resolvers that cause N+1 queries (use DataLoader)
- Expose internal database structure directly in the schema
- Allow unbounded query depth -- enforce depth and complexity limits

## 9. Rate Limiting

**DO:** Implement rate limiting on all API endpoints. Communicate limits via headers.

```
HTTP/1.1 200 OK
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 742
X-RateLimit-Reset: 1672531200

HTTP/1.1 429 Too Many Requests
Retry-After: 30
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1672531200
```

- Apply per-user limits for authenticated endpoints
- Apply per-IP limits for unauthenticated endpoints
- Use sliding window or token bucket algorithms (not fixed window)
- Return 429 with `Retry-After` header when limit exceeded
- Apply stricter limits to expensive operations (search, export, batch)

**DON'T:**

- Skip rate limiting on internal APIs (internal services can overload each other)
- Use only IP-based limiting (shared IPs affect multiple users)
- Reset all limits at the same time (thundering herd)
- Return 403 instead of 429 for rate limiting (403 means forbidden, not throttled)

## 10. Idempotency

**DO:** Support idempotency for non-idempotent operations (POST) to handle retries safely.

```
POST /payments
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json

{
  "amount": 99.99,
  "currency": "USD"
}
```

- Accept an `Idempotency-Key` header on POST requests
- Store the key with the response for a retention period (e.g., 24 hours)
- Return the stored response for duplicate keys (same key = same response)
- Use UUIDv4 for idempotency keys

**DON'T:**

- Ignore duplicate requests without idempotency (double charges, duplicate records)
- Use request body hashing as a substitute for explicit idempotency keys
- Keep idempotency records forever (set a TTL)
- Return different status codes for replayed requests vs original

## 11. Request and Response Best Practices

**DO:** Follow consistent conventions across all endpoints.

- Use JSON as the default format (`Content-Type: application/json`)
- Use camelCase for JSON field names (most common convention)
- Use ISO 8601 for all date/time fields: `"2024-01-15T10:30:00Z"`
- Return the created/updated resource in response to POST/PUT/PATCH
- Include a `Location` header in 201 responses: `Location: /users/456`
- Include HATEOAS links (`self`, action links) in responses for discoverability
- Use `Accept-Encoding: gzip` and compress responses over 1KB
- Set `Cache-Control` headers on GET responses where appropriate

**DON'T:**

- Mix camelCase and snake_case in the same API
- Return dates as Unix timestamps or locale-specific strings
- Return different response shapes for the same endpoint based on query params
- Omit `Content-Type` headers on responses
- Return `null` for missing optional fields -- omit them or use a default value
