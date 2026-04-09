---
# opencode-autopilot
name: exploration-methodology
description: Systematic methodology for exploring unfamiliar code during the EXPLORE phase
stacks: []
requires: []
---

# Exploration Methodology

You are not the code's author. Approach with humility and method. The goal is understanding, not judgment. The EXPLORE phase exists to create a mental model of the existing system so you can modify it confidently in BUILD.

This skill teaches systematic code exploration.

## 1. Top-Down Then Bottom-Up

Start high, verify low. Two passes reveal the truth.

The first pass gives you structure. The second pass fills in details. Neither alone is sufficient.

### DO: Start from Entry Points (Top-Down)

Begin where execution begins and follow the call chain downward.

```
Pass 1: Top-Down Exploration
============================

Start: main.ts
  ↓ reads config
  ↓ initializes database
  ↓ sets up routes
  ↓ starts server

Follow each route:
  GET /users
    ↓ calls userController.list
      ↓ calls userService.findAll
        ↓ calls userRepository.query
          ↓ returns to service
        ↓ service transforms
      ↓ controller formats response
    ↓ sends HTTP response

Document what you find:
- Route patterns and naming conventions
- Controller responsibilities
- Service layer boundaries
- Repository patterns
```

Example - top-down pass for an API endpoint:

```typescript
// Start here: src/routes/user.ts
router.get("/users", async (req, res) => {
  const users = await userController.list(req.query);  // → Follow this
  res.json(users);
});

// Next: src/controllers/user.ts
export async function list(query: QueryParams) {
  const filters = parseFilters(query);  // → Note: validation happens here
  return userService.findAll(filters);  // → Follow this
}

// Next: src/services/user.ts  
export async function findAll(filters: UserFilters) {
  const where = buildWhereClause(filters);  // → Query building
  return userRepository.findMany(where);    // → Follow this
}

// Finally: src/repositories/user.ts
export async function findMany(where: WhereClause) {
  return db.query("SELECT * FROM users WHERE ?", where);  // Bottom reached
}
```

### DO: Verify from Leaf Functions (Bottom-Up)

Now start from the bottom and verify understanding upward.

```
Pass 2: Bottom-Up Verification
==============================

Start: src/repositories/user.ts (leaf function)
  ↑ What calls this? → userService.findAll
  ↑ What calls findAll? → userController.list
  ↑ What calls list? → GET /users route

Ask at each level:
- Are my assumptions about this function correct?
- What other callers exist? (Use find references)
- Are there edge cases I missed in top-down?
- What error handling exists?
```

### DON'T: Stay at One Level

Exploration that stays horizontal misses vertical relationships.

```
# ❌ Wrong: Reading all files in a directory
"I'll read all controllers, then all services, then all repositories"

This misses how they connect. You won't understand data flow.

# ✅ Correct: Vertical slices through the system
"I'll trace GET /users end-to-end, then POST /users, then GET /orders"

Each trace reveals how layers interact.
```

## 2. Read Code You Didn't Write

The author had reasons. Understand them before changing anything.

Code that looks wrong might solve a problem you don't see yet. Approach with curiosity.

### DO: Assume Reasonable Intent

Start with the assumption that the code makes sense in context.

```
# Encountered code:
if (user.status === "active" || user.status === "pending") {
  // Why not just check isActive?
}

# ✅ Correct: Investigate before judging
Investigation:
1. Check git blame: "Added pending status for email verification flow"
2. Check related code: pending users can still view limited content
3. Check tests: "pending user can access /profile but not /billing"

Conclusion: The check is correct. Pending is a limited active state.
```

### DO: Look for Comments and Commit Messages

Git history explains the "why" when comments don't.

```bash
# See why a line exists
git blame -L 45,50 src/services/user.ts

# Read the commit message
git show abc123 --stat

# See related changes
git log --oneline --follow src/services/user.ts | head -10
```

### DON'T: Refactor on Sight

Exploration phase is for understanding, not improving.

```
# ❌ Wrong: Immediate refactoring
"This function is 100 lines, I'll split it now"

# ✅ Correct: Document for BUILD phase
EXPLORATION NOTE:
File: src/services/payment.ts:89
Issue: processPayment() is 150 lines, handles 5 different payment types
Complexity: High
Risk: Critical path - all payments go through this
Recommendation for BUILD: Split by payment type, add unit tests first
```

## 3. Identify the Happy Path

Every system has a primary flow. Find it first.

The happy path is the most common case. Understand it before worrying about edge cases.

### DO: Trace the Ideal Scenario

Pick the simplest successful case and trace it completely.

```
Happy Path: User places an order
===============================

1. User submits POST /orders with valid data
2. Validation passes (all required fields present)
3. User is authenticated and authorized
4. Items are in stock
5. Payment succeeds
6. Order is created in database
7. Confirmation email is sent
8. Success response returned

Trace this path end-to-end first. Document each step.
```

### DO: Note Where Branches Occur

Mark decision points for later exploration.

```
ORDER CREATION FLOW:

Entry: POST /orders
  ↓
Validation Layer
  ↓ ✓ (happy path - valid data)
Authentication Check
  ↓ ✓ (happy path - logged in)
Authorization Check
  ↓ ✓ (happy path - has permission)
Inventory Check
  ↓ ✓ (happy path - in stock)  ← BRANCH: out of stock
Payment Processing
  ↓ ✓ (happy path - success)  ← BRANCH: failure, retry
Order Persistence
  ↓ ✓ (happy path - saved)
Notification
  ↓ ✓ (happy path - sent)      ← BRANCH: queue for retry
Response
  ↓ ✓ 201 Created

Mark branches for later exploration, but finish the happy path first.
```

### DON'T: Chase Edge Cases First

Edge cases are infinite. The happy path teaches you the system.

```
# ❌ Wrong: Edge case obsession
"What if the user is deleted mid-request?"
"What if the database connection drops during payment?"
"What if the email service times out?"

These matter, but not yet. You're still building the mental model.

# ✅ Correct: Happy path first, edges later
Priority order:
1. Map the happy path (current task)
2. Identify all branch points (mark for later)
3. Explore most likely error cases
4. Deep dive on critical path failures only if time permits
```

## 4. Spot Anti-Patterns Quickly

Learn to see problems at a glance. Pattern recognition speeds exploration.

Some code smells are obvious once you know what to look for.

### DO: Know the Common Smells

Recognize these patterns immediately.

```
# 1. God Objects (does everything)
class User {
  // 50+ methods
  // handles auth, billing, preferences, notifications, etc.
}

# 2. Shotgun Surgery (change requires many files)
Adding a field requires touching:
- Model
- DTO
- Validator  
- Service
- Controller
- Tests
- (Should be centralized)

# 3. Feature Envy (uses another class's data)
function calculateDiscount(user) {
  return user.orders.length * user.membership.tier * 0.1;
  // This wants to be on User or a DiscountCalculator
}

# 4. Primitive Obsession (overuse of strings/numbers)
function createUser(name: string, status: string, role: string)
// Better: createUser(data: CreateUserInput)

# 5. Arrow Code (deep nesting)
if (user) {
  if (user.isActive) {
    if (user.hasPermission) {
      if (resource.isAvailable) {
        // finally do work
      }
    }
  }
}
```

### DO: Use Tooling

Let tools surface issues automatically.

```bash
# Find long functions
grep -r "^function" --include="*.ts" src/ | \
  xargs -I {} sh -c 'wc -l $(echo {} | cut -d: -f1)'

# Find TODO/FIXME comments (indicates technical debt)
grep -r "TODO\|FIXME\|HACK\|XXX" --include="*.ts" src/

# Find duplicated code blocks (install jscpd or similar)
npx jscpd src/ --min-lines 5 --min-tokens 25
```

### DON'T: Flag Everything

Not every smell needs immediate fixing. Prioritize.

```
# ❌ Wrong: Flagging every issue
"I found 47 code smells that need fixing"

# ✅ Correct: Severity classification
CRITICAL (fix in BUILD):
- payment.ts: No error handling on charge
- auth.ts: Timing attack vulnerability

MODERATE (address if time permits):
- user.ts: God class (2000 lines)
- order.ts: Feature envy pattern

MINOR (document only):
- utils.ts: Some primitive obsession
- tests: Duplicated setup code
```

## 5. Document for BUILD Phase

Your notes become the BUILD phase blueprint.

Exploration without documentation is wasted. The BUILD phase needs your findings.

### DO: Use Structured Notes

Format findings for easy consumption.

```markdown
## File: src/services/order.ts

### Purpose
Handles order business logic between controller and repository.

### Key Functions
- `createOrder()` - Main entry, ~100 lines
- `validateItems()` - Inventory check
- `calculateTotals()` - Price computation

### Issues Found
1. **Lines 45-89**: No error handling on database call
2. **Line 120**: Hardcoded tax rate (0.08)
3. **Lines 150-180**: Duplicated validation logic (also in validator.ts)

### Dependencies
- Calls: inventoryService, paymentService, emailService
- Called by: orderController, adminController

### Test Coverage
- Unit: 3 tests (happy path only)
- Missing: error cases, edge cases

### BUILD Phase Notes
- Refactor opportunity: Extract tax calculation to config
- Add: Error handling wrapper
- Test: Add cases for payment failure, inventory mismatch
```

### DO: Include Specific Line Numbers

Precise references save time later.

```
# ✅ Good
Performance issue: src/services/report.ts:234
N+1 query in generateReport() function
Database call inside for loop

# ❌ Bad
Performance issue in report service
It does too many database queries
```

### DON'T: Write Vague Observations

Specific notes enable specific fixes.

```
# ❌ Wrong: Vague
"The code could be cleaner"
"There are some bugs"
"Needs refactoring"

# ✅ Correct: Actionable
"Memory leak: src/cache.ts:45 - setInterval without clearInterval"
"Race condition: src/orders.ts:89 - concurrent updates don't lock"
"Dead code: src/utils.ts:120-150 - never called, confirmed via grep"
```

## 6. Breadth First, Then Depth

Get the lay of the land before examining individual trees.

Don't deep dive on the first file. Survey the territory first.

### DO: Survey the Structure First

Start with a shallow pass across the entire codebase.

```
Phase 1: Breadth-First Survey (30 minutes)
==========================================

1. List all directories
   find src -type d | head -30

2. Count files by type
   find src -name "*.ts" | wc -l
   find src -name "*.test.ts" | wc -l

3. Identify major modules
   ls -la src/
   # See: user/, order/, payment/, auth/

4. Read one file per module (just the exports/structure)
   # Don't read implementations yet

5. Note the overall architecture pattern
   # MVC? Clean? Hexagonal? Feature-based?

Result: Mental map of where things live
```

### DO: Deep Dive Selectively

Only explore deeply when you know it's relevant.

```
Phase 2: Depth-First Exploration (2+ hours)
===========================================

Based on survey, prioritize:
1. Files related to your BUILD task
2. Entry points and their immediate dependencies
3. Hot spots identified in codebase-mapping
4. Integration points (database, external APIs)

For each priority file:
- Read complete implementation
- Trace all imports/exports
- Document findings
- Note BUILD phase implications
```

### DON'T: Get Lost in the First File

Exploration discipline prevents rabbit holes.

```
# ❌ Wrong: Deep diving immediately
"I'm reading src/utils/helpers.ts"
[2 hours later]
"It has 50 helper functions, each with edge cases..."

You now know helpers well but nothing about the system.

# ✅ Correct: Disciplined breadth first
"I'll spend 15 minutes on helpers to understand conventions"
"Then I'll map the main entry points"
"Then I'll trace the critical flows"
"Helpers deep dive only if BUILD requires changes there"
```

## 7. Identify Test Coverage Gaps

Tests reveal intent. Missing tests reveal risk.

Explore the test suite as carefully as the source code.

### DO: Map Test Coverage

Know what's tested and what isn't.

```bash
# Find all test files
find . -name "*.test.*" -o -name "*.spec.*" | sort

# Check test-to-source ratio
src_count=$(find src -name "*.ts" | grep -v test | wc -l)
test_count=$(find . -name "*.test.ts" | wc -l)
echo "Source: $src_count, Tests: $test_count"

# Find untested files
grep -L "describe\|test\|it" src/**/*.ts

# Check coverage reports if available
cat coverage/lcov-report/index.html 2>/dev/null | grep -A2 "Total"
```

### DO: Analyze Test Quality

Not all tests are equal. Assess their value.

```
TEST ANALYSIS: src/services/user.test.ts

✅ Good tests found:
- should create user with valid data
- should reject duplicate email
- should hash password before storing

❌ Weak tests found:
- should work (no assertion, just runs)
- tests implementation details (checks internal state)
- mocks everything (no integration validation)

🚫 Missing tests:
- Password validation edge cases
- Database error handling
- Concurrent user creation
```

### DON'T: Assume Tests Exist

Check explicitly. Many codebases have coverage gaps.

```
# ❌ Wrong: Assuming coverage
"The payment service probably has tests"

# ✅ Correct: Verifying
ls src/services/payment.test.ts  # File does not exist

EXPLORATION NOTE:
CRITICAL GAP: Payment service has zero tests
Risk: High (financial transactions)
BUILD phase: MUST add tests before any modifications
```

## 8. Know When to Stop

Exploration is infinite. Learn to recognize saturation.

You can always learn more, but BUILD needs to start eventually.

### DO: Look for Saturation Signals

You know enough when these are true.

```
✅ Saturation Checklist:

1. Can you explain the system to someone else?
   "This is a web API with 3 entry points..."

2. Can you trace the critical paths?
   "User login goes: route → controller → service → repository → DB"

3. Do you know where your BUILD changes will go?
   "I need to modify src/services/order.ts and add tests in..."

4. Have you identified the risks?
   "Payment flow has no tests, need to be careful there"

5. Can you predict where changes will have side effects?
   "Modifying User model affects auth, orders, and admin"

If all true, you've explored enough for BUILD.
```

### DO: Set Time Boxes

Prevent unlimited exploration.

```
EXPLORATION TIME BUDGET:
- Small feature (1-2 files): 30 minutes exploration
- Medium feature (3-5 files): 2 hours exploration
- Large feature (new module): 4 hours exploration
- New codebase (first BUILD): Full day exploration

When time expires:
- Document what you know
- Document what you don't know
- Flag risks from unknown areas
- Move to BUILD
```

### DON'T: Explore Everything

Perfect knowledge is impossible. Good enough is good enough.

```
# ❌ Wrong: Total comprehension goal
"I need to understand every line before I change anything"

This is paralysis. You'll never finish exploring.

# ✅ Correct: Sufficient understanding
"I understand:
- The entry points
- The data flow for my task
- The test patterns
- The risk areas

I don't understand:
- Background job processing (not relevant to my task)
- Admin panel implementation (out of scope)

Decision: Sufficient for BUILD. Document unknowns, proceed.
```

## Summary

Effective exploration follows this rhythm:

1. **Top-down**: Start at entry points, follow calls downward
2. **Bottom-up**: Verify from leaf functions, understand callers
3. **Assume intent**: Code exists for reasons. Find them.
4. **Happy path first**: Ideal flow before edge cases
5. **Spot smells**: Recognize anti-patterns quickly
6. **Document everything**: Notes become BUILD blueprint
7. **Breadth then depth**: Survey before deep dive
8. **Test coverage**: Map what's tested and what isn't
9. **Stop at saturation**: Good enough is good enough

The EXPLORE phase ends when you can say: "I know enough to build this."
