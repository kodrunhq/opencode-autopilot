---
# opencode-autopilot
name: evidence-gathering
description: Systematic methodology for gathering evidence about a codebase during the RECON phase to verify assumptions and understand architecture.
stacks: []
requires: []
---

# Evidence Gathering

Methodology for systematically gathering verifiable evidence about a codebase. The goal is to replace assumptions with documented facts.

## When to Use

- During the RECON phase after domain research
- When taking over an unfamiliar project
- Before making architectural decisions about existing code

## The Evidence Gathering Process

### Step 1: Identify Entry Points

Find where the system starts executing:

- **CLI tools**: Look for `bin/` directories, `package.json` bin field, main entry files
- **Web apps**: Look for route definitions, server setup, middleware chains
- **Libraries**: Look for `index.ts`, `mod.rs`, `__init__.py`, public API surfaces
- **Services**: Look for Dockerfiles, systemd units, startup scripts

**DO:**
- Trace from entry point through the first 3-5 function calls
- Note the framework or runtime being used
- Identify the initialization sequence (config loading, dependency injection)

**DON'T:**
- Start reading random files in the middle of the codebase
- Assume the entry point is obvious (it often isn't)

### Step 2: Trace Data Flow

Follow data from input to storage to output:

- **Input**: Where does data enter the system? (HTTP requests, CLI args, file reads, message queues)
- **Processing**: How is data transformed? (validation, business logic, aggregation)
- **Storage**: Where is data persisted? (databases, files, caches, external APIs)
- **Output**: How does data leave the system? (HTTP responses, file writes, events)

**DO:**
- Pick one representative data flow and trace it end-to-end
- Note every transformation and validation step
- Identify where data crosses boundaries (external API calls, database queries)

**DON'T:**
- Only trace one flow (trace at least two to find patterns)
- Ignore error paths (they often reveal more than happy paths)

### Step 3: Map Module Dependencies

Understand how code is organized:

- **Import analysis**: What modules import what? (look at import statements)
- **Dependency graph**: Which modules depend on which? (build a mental or written graph)
- **Circular dependencies**: Are there any? (these indicate design problems)
- **External dependencies**: What third-party libraries are used and why?

**DO:**
- Start from entry points and follow imports outward
- Note which modules are depended on by many others (hubs)
- Identify modules that nothing imports (dead code?)

**DON'T:**
- Try to map every single import (focus on module-level, not file-level)
- Ignore vendor/third-party directories

### Step 4: Identify Architectural Patterns

Recognize the architectural style:

- **Layered**: Presentation → Business Logic → Data Access
- **MVC**: Model → View → Controller separation
- **Hexagonal/Ports & Adapters**: Core domain with pluggable interfaces
- **Event-driven**: Communication through events rather than direct calls
- **Microservices**: Independent deployable services

**DO:**
- Look for directory structure clues (controllers/, models/, services/)
- Check for interface/protocol definitions (ports)
- Note how modules communicate (function calls, events, message queues)

**DON'T:**
- Force a pattern onto code that doesn't fit (not everything is cleanly architected)
- Assume the documented architecture matches the actual architecture

### Step 5: Verify Assumptions

For every assumption you've made, find evidence:

- **Assumption**: "This is a REST API" → **Evidence**: Route definitions with HTTP methods
- **Assumption**: "It uses PostgreSQL" → **Evidence**: Connection string, ORM config, migration files
- **Assumption**: "Authentication is JWT-based" → **Evidence**: Token generation code, middleware

**DO:**
- Write down every assumption before verifying it
- Mark assumptions as verified, refuted, or uncertain
- Note where evidence is weak or ambiguous

**DON'T:**
- Trust comments over code (comments lie, code doesn't)
- Assume that because something was done one way in one place, it's done that way everywhere

### Step 6: Document the Evidence Map

Produce a structured evidence document:

1. Entry points found (with file paths)
2. Data flows traced (with transformation steps)
3. Module dependency summary (with hub modules identified)
4. Architectural pattern (with evidence)
5. Key external dependencies and their roles
6. Verified assumptions list
7. Uncertainties that need further investigation

**DO:**
- Include file paths for every claim
- Distinguish between observed facts and inferences
- Note what you did NOT investigate (scope boundaries)

**DON'T:**
- Write a narrative (use structured lists and diagrams)
- Include every file you looked at (only include evidence-bearing files)