---
# opencode-autopilot
name: codebase-mapping
description: Methodology for creating a comprehensive map of an existing codebase during the EXPLORE phase
stacks: []
requires: []
---

# Codebase Mapping

This skill provides a systematic approach to mapping an unfamiliar codebase during the EXPLORE phase. The goal is not to understand every line, but to build a navigable mental model that the BUILD phase can use to implement changes safely.

A good codebase map acts like a topographic map. It does not show every tree, but it does show the valleys, ridges, and rivers. You need to know where the boundaries are and where the danger zones lie before you start building.

## The Mapping Process

### 1. Identify Entry Points

Every codebase has doors. Find them first.

**Application Entry Points**

Look for files that bootstrap the entire system:

```bash
# Common entry point patterns
grep -r "listen(" src/ --include="*.ts"  # Servers
grep -r "createApp\|bootstrap" src/     # Frameworks
grep -r "if __name__ == .__main__."     # Python scripts
grep -r "func main()"                   # Go programs
```

**API Entry Points**

Find where external requests enter:

```bash
# Route definitions
grep -r "@Get\|@Post\|@Route" src/
grep -r "app.get\|app.post\|router." src/
grep -r "urlpatterns\|path(" src/     # Django
```

**CLI Entry Points**

Find command-line interfaces:

```bash
grep -r "commander\|yargs\|argparse" src/
grep -r "program.command\|program.option" src/
```

**DO:** Map every entry point to a human-readable name like "HTTP API", "CLI Tool", "Background Worker", or "Scheduled Job".

**DON'T:** Assume there is only one entry point. Microservices often have multiple. A single entry point may branch into several execution paths.

### 2. Build the Dependency Graph

Once you know where execution starts, trace what it requires.

**Import Analysis**

Use tools to visualize the module graph:

```bash
# Madge for JavaScript/TypeScript
npx madge --circular src/index.ts
npx madge --image dependency-graph.svg src/index.ts

# Pydeps for Python
pydeps --show-deps src/main.py

# Go mod graph
go mod graph
```

**Circular Dependency Detection**

Circular imports are a smell. They indicate architectural boundaries that have been violated.

```bash
# Find circular imports
npx madge --circular src/
```

**DO:** Draw boxes around modules that cluster together. These are likely your domain boundaries. A well-organized codebase has clear islands with bridges between them.

**DON'T:** Get lost in the leaves. You do not need to map every utility function. Focus on modules that represent concepts like User, Order, Payment, or Notification.

### 3. Identify Architectural Layers

Most codebases organize into layers, even if not explicitly stated. Your job is to discover them.

**Common Layer Patterns**

```
┌─────────────────────────────────────────────┐
│  Presentation (HTTP handlers, CLI commands) │
├─────────────────────────────────────────────┤
│  Application (Use cases, Services)          │
├─────────────────────────────────────────────┤
│  Domain (Models, Business logic)            │
├─────────────────────────────────────────────┤
│  Infrastructure (Database, External APIs)   │
└─────────────────────────────────────────────┘
```

**Detecting Layers by File Naming**

```bash
# Look for naming conventions
grep -r "controller\|handler\|route" src/   # Presentation
grep -r "service\|usecase\|interactor" src/ # Application
grep -r "repository\|dao\|model" src/       # Data access
grep -r "client\|adapter\|provider" src/   # Infrastructure
```

**DO:** Document which layers exist and where the boundaries are. Note any violations (database queries in HTTP handlers, for example).

**DON'T:** Assume every codebase follows clean architecture. Some mix layers freely. Document reality, not the ideal.

### 4. Catalog External Dependencies

List everything the codebase talks to outside itself.

**External Integration Points**

```bash
# Find all external service calls
grep -r "axios\|fetch\|request" src/        # HTTP clients
grep -r "new S3Client\|@aws-sdk" src/      # Cloud services
grep -r "smtp\|sendmail\|mailgun" src/     # Email services
grep -r "redis\|kafka\|rabbitmq" src/      # Message queues
grep -r "stripe\|paypal\|braintree" src/   # Payment processors
```

**Configuration Sources**

Find where external URLs and credentials come from:

```bash
grep -r "process.env\|@Value\|os.getenv" src/
grep -r "\.env\|config\." src/
```

**DO:** Create a table of external services with their purpose and where they are configured.

**DON'T:** Miss integration points that happen through environment variables. These are often the most critical dependencies.

### 5. Map Data Flow

Trace a single request from entry to storage and back.

**The Request Path**

Pick one entry point and follow it:

1. Where does the request arrive? (HTTP handler, CLI command)
2. What validation happens?
3. What business logic executes?
4. What data is read or written?
5. What external calls are made?
6. What response is returned?

**Data Flow Diagram Example**

```
HTTP Request → Auth Middleware → OrderController
                                  ↓
                          OrderService.validate()
                                  ↓
                          OrderRepository.save()
                                  ↓
                          Database INSERT
                                  ↓
                          Stripe API charge
                                  ↓
                          EmailService.send()
                                  ↓
                          HTTP 201 Response
```

**DO:** Document at least one complete request path. This reveals where data transforms and where failures can occur.

**DON'T:** Map every possible path. One complete trace teaches you the pattern. The rest follow the same shape.

### 6. Identify Hot Spots

Some files change often or are unusually complex. These are your hot spots.

**Change Frequency**

```bash
# Find most frequently changed files
git log --name-only --pretty=format: | sort | uniq -c | sort -rn | head -20
```

**Complexity Metrics**

```bash
# SLOC (Source Lines of Code) per file
find src -name "*.ts" -exec wc -l {} + | sort -rn | head -20

# Cyclomatic complexity (Python example)
radon cc src/ -a -nc
```

**Import Hot Spots**

```bash
# Find files imported by many others
grep -r "from.*utils" src/ | wc -l   # Overused utils are a risk
grep -r "from.*common" src/ | wc -l  # Common modules change ripple widely
```

**DO:** Flag files with high churn or high coupling. These files are risky to touch and need extra care during BUILD.

**DON'T:** Ignore test files in churn analysis. High test churn often indicates unstable requirements or fragile tests.

### 7. Create the Codebase Map Document

Synthesize your findings into a readable document.

**Codebase Map Template**

```markdown
# Codebase Map: [Project Name]

## Entry Points
- **HTTP API** (`src/server.ts`): Express server on port 3000
- **CLI Tool** (`src/cli.ts`): Commander-based CLI for admin tasks
- **Worker** (`src/worker.ts`): Background job processor

## Architecture Layers
- **Presentation**: `src/handlers/`
- **Application**: `src/services/`
- **Domain**: `src/models/`
- **Infrastructure**: `src/db/`, `src/clients/`

## External Dependencies
| Service | Purpose | Configuration |
|---------|---------|---------------|
| PostgreSQL | Primary database | DATABASE_URL |
| Redis | Session cache | REDIS_URL |
| Stripe | Payments | STRIPE_SECRET_KEY |

## Data Flow Example: Create Order
1. `POST /orders` → `OrderHandler.create()`
2. Validation → `OrderSchema.validate()`
3. Business logic → `OrderService.create()`
4. Persistence → `OrderRepository.save()`
5. Side effects → `EmailService.sendConfirmation()`

## Hot Spots
- `src/services/order-service.ts` - 200+ lines, changes weekly
- `src/utils/validation.ts` - imported by 40+ files
- `src/handlers/user-handler.ts` - high bug density

## Risk Areas
- Circular dependency between User and Order modules
- Direct database access in notification service
- Missing error handling in payment flow
```

**DO:** Keep the map concise. A single page is better than a book nobody reads.

**DON'T:** Include raw grep output. Synthesize. The BUILD phase needs insights, not data dumps.

## Tools Summary

| Task | Tool | Command |
|------|------|---------|
| Dependency graph | madge | `npx madge src/index.ts` |
| Circular imports | madge | `npx madge --circular src/` |
| Git churn | git | `git log --name-only` |
| SLOC count | find/wc | `find src -name "*.ts" -exec wc -l {} +` |
| Import analysis | grep | `grep -r "from.*" src/` |
| Complexity | radon | `radon cc src/ -a -nc` |

## When to Stop Mapping

You have mapped enough when:

1. You can explain the architecture to a new teammate in five minutes
2. You know where to look for any feature mentioned in the requirements
3. You have identified the risky areas that need extra testing
4. You can trace a complete request from entry to exit

**DO:** Err on the side of mapping too little rather than too much. You can always explore deeper during BUILD if needed.

**DON'T:** Map forever. The goal is actionable understanding, not complete knowledge.
