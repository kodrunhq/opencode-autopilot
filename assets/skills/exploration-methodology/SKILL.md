---
# opencode-autopilot
name: exploration-methodology
description: Systematic methodology for exploring unfamiliar code during the EXPLORE phase to understand behavior before modifying it.
stacks: []
requires: []
---

# Exploration Methodology

Systematic methodology for understanding unfamiliar code before modifying it. The goal is to build a mental model accurate enough to make changes safely.

## When to Use

- During the EXPLORE phase before BUILD begins
- When working with code you didn't write
- When debugging behavior you don't understand
- Before refactoring or restructuring existing code

## The Exploration Process

### Step 1: Start with the Entry Points

Begin where execution starts, not where you think the interesting code is:

- **Web apps**: Route definitions, middleware chains, server setup
- **CLI tools**: Command definitions, argument parsing, main function
- **Libraries**: Public API surface, exported functions and types
- **Services**: Startup sequence, initialization, health checks

**DO:**
- Trace the first 5-10 function calls from each entry point
- Note the framework conventions (how routes map to handlers, how middleware is applied)
- Identify the request/response lifecycle

**DON'T:**
- Start reading from the middle of the codebase
- Assume entry points are obvious (they often aren't in large projects)
- Skip entry points because "I already know how this works"

### Step 2: Apply Breadth-First, Then Depth

**First pass (breadth):**
- Scan the top-level structure of each major module
- Read module-level comments and documentation
- Note the public API of each module (exported functions, classes)
- Identify the relationships between modules

**Second pass (depth):**
- Pick the modules most relevant to your planned changes
- Read the implementation of key functions
- Trace data flow through the module
- Note edge cases and error handling

**DO:**
- Complete the breadth pass before going deep (context before detail)
- Take notes during the breadth pass (module responsibilities, key types)
- Use the breadth pass to decide where to go deep

**DON'T:**
- Go deep on the first module you encounter (you'll miss the bigger picture)
- Skip the breadth pass because "I need to understand this one function"
- Assume the module structure reflects the architecture

### Step 3: Trace the Happy Path

Follow the most common execution path through the system:

1. Pick a representative user action or API call
2. Trace it from entry point to response
3. Note every function call, data transformation, and side effect
4. Document the path with file names and line numbers

**DO:**
- Pick a path that exercises the core functionality
- Note where data changes shape (validation, transformation, serialization)
- Identify the boundaries between layers (presentation → business → data)

**DON'T:**
- Only trace one path (trace at least two to find patterns)
- Ignore the response path (how does data get back to the user?)
- Assume the happy path is the only path (it rarely is)

### Step 4: Identify Anti-Patterns and Code Smells

As you explore, note problems that the BUILD phase should address:

**Structural smells:**
- **God objects**: Classes or modules that do too much
- **Feature envy**: Functions that use more of another module than their own
- **Long methods**: Functions that are hard to understand at a glance
- **Duplicate logic**: Copy-pasted code that should be extracted

**Architectural smells:**
- **Layer violations**: Infrastructure code in business logic
- **Circular dependencies**: Modules that import each other
- **Hidden dependencies**: Functions that rely on global state
- **Tight coupling**: Modules that can't be understood independently

**DO:**
- Note the file and line number for each smell
- Categorize by severity (blocks change vs. makes change harder)
- Suggest a fix direction (not a full refactor, just the direction)

**DON'T:**
- Refactor while exploring (understand first, fix later)
- List every style issue (focus on structural problems, not formatting)
- Assume smells are intentional (they might be accidents of growth)

### Step 5: Identify Test Coverage Gaps

Assess the test landscape:

- **What is tested?** (unit tests, integration tests, e2e tests)
- **What is NOT tested?** (critical paths, error cases, edge cases)
- **How are tests organized?** (mirrors source structure, feature-based, type-based)
- **What is the test quality?** (assertions vs. just running, mock-heavy vs. real)

**DO:**
- Identify the most critical untested code paths
- Note where tests are brittle (frequent false failures)
- Identify the test patterns used (fixtures, factories, mocks)

**DON'T:**
- Assume test coverage percentage tells the whole story
- Ignore integration tests (they catch what unit tests miss)
- Assume untested code is unused (it might be critical)

### Step 6: Know When You've Explored Enough

Stop exploring when you reach **saturation**:

- You can predict where a function is defined before looking
- New code follows patterns you've already seen
- You can trace a new execution path without getting lost
- You can answer "where would I change X?" for the planned modifications

**Signs you need MORE exploration:**
- You can't explain how a key feature works
- You're surprised by where code is located
- You can't identify the dependencies of a module
- You don't know where errors are handled

**DO:**
- Test your understanding by predicting where things are
- Ask "if I needed to change X, where would I go?" and verify
- Document the boundaries of your understanding (what you know vs. what you don't)

**DON'T:**
- Explore forever (there's always more to learn)
- Stop when you understand one path (understand the system, not just a feature)
- Assume understanding without verification (predict, then check)

### Step 7: Produce the Exploration Report

Create a structured report for the BUILD phase:

1. **Entry points** with file paths and brief descriptions
2. **Key execution paths** traced (with file references)
3. **Module responsibilities** (what each major module does)
4. **Data flow summary** (how data moves through the system)
5. **Anti-patterns identified** (with severity and suggested fix direction)
6. **Test coverage assessment** (what's tested, what's not, test patterns)
7. **BUILD phase guidance** (which files will need modification, what to watch out for)

**DO:**
- Make it actionable — the BUILD phase should be able to start coding from this
- Include file paths for every claim
- Note uncertainties explicitly ("I haven't verified how X handles Y")

**DON'T:**
- Write a code walkthrough (this is a guide for modification, not a tour)
- Include every file you looked at (only include structurally significant ones)
- Make recommendations without evidence (show the code that supports each claim)