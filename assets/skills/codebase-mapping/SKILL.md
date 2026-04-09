---
# opencode-autopilot
name: codebase-mapping
description: Methodology for creating a comprehensive map of an existing codebase during the EXPLORE phase to guide BUILD phase modifications.
stacks: []
requires: []
---

# Codebase Mapping

Methodology for creating a structured map of an existing codebase. The BUILD phase needs this map to know where to make changes without breaking existing functionality.

## When to Use

- During the EXPLORE phase before BUILD begins
- When modifying an unfamiliar codebase
- When the codebase has grown beyond a single developer's mental model
- Before refactoring or restructuring existing code

## The Codebase Mapping Process

### Step 1: Map the Directory Structure

Create a high-level map of the project's organization:

```
project/
├── src/           # Application source code
│   ├── api/       # HTTP API layer (routes, handlers, middleware)
│   ├── core/      # Business logic (domain models, services)
│   ├── infra/     # Infrastructure (database, cache, external APIs)
│   └── config/    # Configuration loading and validation
├── tests/         # Test files (mirrors src/ structure)
├── docs/          # Documentation
└── scripts/       # Build and deployment scripts
```

**DO:**
- Group directories by responsibility, not just list them
- Note which directories are actively maintained vs. legacy
- Identify the "hot" directories (most frequently changed)

**DON'T:**
- List every single file (that's detail, not structure)
- Ignore test directories (they reveal intended behavior)
- Assume the directory structure reflects the architecture (it often doesn't)

### Step 2: Trace Module Dependencies

Build a dependency graph at the module level:

- **Entry points**: Where does execution start? (main files, route definitions, CLI commands)
- **Hub modules**: Which modules are imported by many others?
- **Leaf modules**: Which modules import nothing from the project?
- **Circular dependencies**: Where do modules import each other?

**DO:**
- Start from entry points and follow imports outward
- Note the direction of dependencies (do they flow inward or outward?)
- Identify modules that violate the dependency direction

**DON'T:**
- Map every single import (focus on module-level, not file-level)
- Ignore third-party imports (they reveal architectural choices)
- Assume the dependency graph is a tree (it's usually a DAG with cycles)

### Step 3: Map Data Models

Identify the data structures that flow through the system:

- **Domain entities**: Core business objects (User, Order, Transaction)
- **DTOs**: Data transfer objects (API request/response shapes)
- **Configuration**: Settings and environment variables
- **State**: Application state management (stores, caches, sessions)

**For each data model, document:**
- Where it is defined
- Where it is created
- Where it is consumed
- Where it is persisted
- How it is validated

**DO:**
- Trace each entity from creation to persistence
- Note where data is transformed (and why)
- Identify the authoritative source for each piece of data

**DON'T:**
- Document every interface or type (focus on domain-significant ones)
- Ignore how data is validated (validation reveals business rules)
- Assume the data model matches the database schema (it often doesn't)

### Step 4: Identify Architectural Layers

Recognize the layers (explicit or implicit) in the codebase:

- **Presentation**: HTTP handlers, CLI commands, UI components
- **Application**: Use cases, services, orchestrators
- **Domain**: Business logic, entities, value objects
- **Infrastructure**: Database access, external APIs, file I/O

**For each layer, identify:**
- Which directories belong to it
- Which modules depend on it
- Whether dependencies flow in the expected direction
- Where layer boundaries are violated

**DO:**
- Note where the actual architecture differs from the intended architecture
- Identify "leaky" layers (infrastructure logic in domain code)
- Document the dependency rule (what can depend on what)

**DON'T:**
- Force a layered model onto code that isn't layered
- Assume layers are enforced (they're often just conventions)
- Ignore the cost of layer violations (they accumulate as technical debt)

### Step 5: Identify Hot Spots and Cold Spots

- **Hot spots**: Files that change frequently, have high complexity, or are depended on by many modules
- **Cold spots**: Files that haven't changed in months, have no dependents, or are never executed
- **Tangles**: Groups of files that always change together (high coupling)

**DO:**
- Use git history to identify hot spots (`git log --oneline --stat`)
- Note which hot spots are also high-complexity (double risk)
- Flag cold spots that might be dead code

**DON'T:**
- Assume hot spots are bad (they might be the core of the system)
- Delete cold spots without verifying they're unused
- Ignore tangles (they indicate missing abstractions)

### Step 6: Produce the Codebase Map

Create a structured map document:

1. **Directory structure** with responsibility annotations
2. **Dependency graph** (entry points → hubs → leaves)
3. **Data model inventory** (entities, DTOs, configuration, state)
4. **Architectural layers** with violation notes
5. **Hot spots and cold spots** with git history evidence
6. **BUILD phase guidance**: Which files will need modification for the planned changes?

**DO:**
- Make it referenceable — the BUILD phase should cite this map
- Include file paths for every claim
- Note uncertainties and areas that need further exploration

**DON'T:**
- Write a code walkthrough (this is a map, not a tour)
- Include every file (only include structurally significant ones)
- Make the map so detailed that it's obsolete the day after it's written