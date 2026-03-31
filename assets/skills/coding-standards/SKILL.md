---
name: coding-standards
description: Universal coding standards and best practices for code review and generation. Covers naming, file organization, error handling, immutability, and separation of concerns.
---

# Coding Standards

Universal, language-agnostic coding standards. Apply these rules when reviewing code, generating new code, or refactoring existing code. Every rule is opinionated and actionable.

## 1. Naming Conventions

**DO:** Use descriptive, intention-revealing names. Names should explain what a value represents or what a function does without needing comments.

- Variables: nouns that describe the value (`userCount`, `activeOrders`, `maxRetries`)
- Functions: verbs that describe the action (`fetchUser`, `calculateTotal`, `validateInput`)
- Booleans: questions that read naturally (`isActive`, `hasPermission`, `shouldRetry`, `canEdit`)
- Constants: UPPER_SNAKE_CASE for true constants (`MAX_RETRIES`, `DEFAULT_TIMEOUT`)
- Use consistent casing per convention: camelCase for variables/functions, PascalCase for types/classes

**DON'T:**

- Use single-letter variables outside of trivial loops (`x`, `d`, `t`)
- Use abbreviations that are not universally understood (`usr`, `mgr`, `btn`, `cfg`)
- Use generic names that convey no meaning (`data`, `info`, `temp`, `stuff`, `result`)
- Use negated booleans (`isNotValid` -- use `isValid` and negate at the call site)
- Encode types in names (`strName`, `arrItems`, `iCount`)

```
// DO
remainingAttempts = maxRetries - failedAttempts
isEligibleForDiscount = orderTotal > minimumThreshold

// DON'T
x = r - f
flag = t > m
```

## 2. File Organization

**DO:** Keep files focused on a single concern. One module should do one thing well.

- Target 200-400 lines per file. Hard maximum of 800 lines.
- Organize by feature or domain, not by file type (group `user/` together, not `controllers/` + `models/` + `services/`)
- Place related files close together in the directory tree
- One exported class or primary function per file
- Index files (barrel exports) for public API surfaces only

**DON'T:**

- Mix unrelated functionality in a single file
- Create files with multiple independent classes or modules
- Nest directories more than 4 levels deep
- Put all utilities in a single `utils.ts` grab-bag file

```
// DO: Organize by feature
user/
  create-user.ts
  validate-user.ts
  user-repository.ts
  user.test.ts

// DON'T: Organize by type
controllers/
  user-controller.ts
  order-controller.ts
services/
  user-service.ts
  order-service.ts
```

## 3. Function Design

**DO:** Write small functions that do exactly one thing.

- Target under 50 lines per function. If longer, extract sub-functions.
- Maximum 3-4 levels of nesting. Extract nested logic into named functions.
- Limit parameters to 3. Use an options object for more.
- Return early for guard clauses and error conditions.
- Pure functions where possible -- same input always produces same output.

**DON'T:**

- Write functions that handle multiple unrelated responsibilities
- Use deeply nested if/else chains or switch statements with complex logic
- Pass boolean flags that change behavior (`processOrder(order, true, false)`)
- Rely on side effects that are not obvious from the function name

```
// DO: Early return for guard clauses
function getDiscount(customer) {
  if (!customer) return 0
  if (!customer.isActive) return 0
  if (customer.orders < 10) return 0.05
  return 0.15
}

// DON'T: Deep nesting
function getDiscount(customer) {
  if (customer) {
    if (customer.isActive) {
      if (customer.orders >= 10) {
        return 0.15
      } else {
        return 0.05
      }
    }
  }
  return 0
}
```

## 4. Error Handling

**DO:** Handle errors explicitly at every level. Every error path deserves deliberate treatment.

- Catch errors as close to the source as possible
- Provide user-friendly messages in UI-facing code
- Log detailed context (operation, input values, stack) on the server side
- Use typed or domain-specific error classes to distinguish error categories
- Fail fast -- validate inputs before processing

**DON'T:**

- Silently swallow errors with empty catch blocks
- Use exceptions for control flow (expected conditions should use return values)
- Expose internal error details (stack traces, SQL queries) to end users
- Log errors without enough context to reproduce the issue
- Catch generic exceptions when you can catch specific ones

```
// DO: Explicit handling with context
try {
  user = await fetchUser(userId)
} catch (error) {
  logger.error("Failed to fetch user", { userId, error })
  throw new UserNotFoundError(userId)
}

// DON'T: Silent swallow
try {
  user = await fetchUser(userId)
} catch (error) {
  // ignore
}
```

## 5. Immutability

**DO:** Create new objects instead of mutating existing ones. Immutable data prevents hidden side effects and makes code easier to reason about.

- Use spread operators, `map`, `filter`, `reduce` to derive new values
- Treat function arguments as read-only
- Use `readonly` modifiers or frozen objects where the language supports it
- Return new objects from update functions

**DON'T:**

- Reassign function parameters
- Use `push`, `splice`, `pop` on arrays shared across boundaries
- Modify objects passed into a function from the caller's scope
- Use mutable global state

**Exception:** Mutation is acceptable when an API explicitly requires it (e.g., OpenCode config hooks, database transaction builders, stream writers).

```
// DO: Return new object
function addItem(cart, item) {
  return {
    ...cart,
    items: [...cart.items, item],
    total: cart.total + item.price,
  }
}

// DON'T: Mutate in place
function addItem(cart, item) {
  cart.items.push(item)
  cart.total += item.price
  return cart
}
```

## 6. Separation of Concerns

**DO:** Keep distinct responsibilities in distinct layers. Each layer should be independently testable.

- Data access (repositories, API clients) separate from business logic
- Business logic separate from presentation and formatting
- Define interfaces at layer boundaries
- Infrastructure concerns (logging, caching, auth) as cross-cutting middleware, not inline code

**DON'T:**

- Mix HTTP/request handling with business rules
- Put database queries inside UI rendering code
- Scatter validation logic across multiple layers (validate once at the boundary)
- Hard-code infrastructure dependencies inside business logic

```
// DO: Layered
orderRepository.save(order)          // data access
orderService.calculateTotal(order)   // business logic
orderView.formatSummary(order)       // presentation

// DON'T: Mixed concerns
function handleOrderRequest(req, res) {
  db.query("INSERT INTO orders ...")  // data access in handler
  total = items.reduce(...)           // business logic in handler
  res.send("<h1>" + total + "</h1>")  // presentation in handler
}
```

## 7. DRY (Don't Repeat Yourself)

**DO:** Extract shared logic when you see the same pattern duplicated 3 or more times.

- Create utility functions for repeated operations
- Use composition to share behavior between modules
- Centralize constants and configuration values

**DON'T:**

- Over-abstract before duplication exists (YAGNI -- You Aren't Gonna Need It)
- Create abstractions for things that are only superficially similar
- Use inheritance as the primary mechanism for code reuse (prefer composition)
- Extract "shared" code that is actually used in only one place

```
// DO: Extract after 3+ duplications
function formatCurrency(amount, currency) {
  return `${currencySymbol(currency)}${amount.toFixed(2)}`
}

// DON'T: Premature abstraction
// Creating a CurrencyFormatterFactory when you have one format
class CurrencyFormatterFactory {
  create(locale, options) { ... }
}
```

## 8. Input Validation

**DO:** Validate all external data at system boundaries. Never trust input from users, APIs, files, or environment variables.

- Use schema-based validation (Zod, JSON Schema, etc.) for structured input
- Validate as early as possible -- fail fast with clear error messages
- Sanitize strings that will be used in HTML, SQL, or shell commands
- Define allowed values explicitly (allowlists over blocklists)

**DON'T:**

- Trust external data without validation
- Validate deep inside business logic instead of at the boundary
- Use blocklists for security-sensitive input (always use allowlists)
- Accept arbitrary types and check with `typeof` throughout the code

```
// DO: Schema validation at boundary
schema = object({
  email: string().email(),
  age: number().int().min(0).max(150),
})
validated = schema.parse(requestBody)

// DON'T: Ad-hoc checks scattered everywhere
if (typeof input.email === "string" && input.email.includes("@")) {
  if (typeof input.age === "number" && input.age > 0) {
    // ... buried validation
  }
}
```

## 9. Constants and Configuration

**DO:** Use named constants and configuration files for values that may change or carry meaning.

- Named constants for magic numbers and strings (`MAX_RETRIES = 3`, not just `3`)
- Environment variables or config files for deployment-specific values
- Group related constants in a dedicated module
- Document units in constant names (`TIMEOUT_MS = 5000`, `MAX_FILE_SIZE_BYTES = 10485760`)

**DON'T:**

- Hardcode URLs, API keys, timeouts, or limits in application code
- Use magic numbers without explanation (`if (retries > 3)` -- why 3?)
- Store secrets in source code or config files committed to version control
- Scatter the same constant value across multiple files

```
// DO: Named constants with units
CACHE_TTL_SECONDS = 300
MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024
API_BASE_URL = config.get("api.baseUrl")

// DON'T: Magic values
setTimeout(callback, 300000)
if (file.size > 10485760) { ... }
fetch("https://api.example.com/v2/users")
```

## 10. Code Comments

**DO:** Comment the WHY, not the WHAT. Code should be readable enough that the "what" is obvious. Comments explain intent, trade-offs, and non-obvious decisions.

- Explain why a non-obvious approach was chosen over the obvious one
- Document edge cases and their handling rationale
- Use JSDoc/docstrings for public API surfaces (parameters, return values, exceptions)
- Mark temporary workarounds with `TODO(reason):` and a tracking reference

**DON'T:**

- Write comments that restate what the code does (`// increment counter` above `counter++`)
- Leave commented-out code in the codebase (use version control instead)
- Write comments that will become stale when the code changes
- Use comments as a substitute for clear naming and structure

```
// DO: Explain why
// Rate limit is 100/min per API docs. We use 80 to leave headroom
// for background jobs that share the same API key.
MAX_REQUESTS_PER_MINUTE = 80

// DON'T: Restate the code
// Set the max requests to 80
MAX_REQUESTS_PER_MINUTE = 80
```
