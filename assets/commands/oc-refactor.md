---
description: Analyze and refactor code for improved design and maintainability
agent: coder
---
Analyze and refactor the code specified by $ARGUMENTS.

Detect the project language and framework from manifest files (package.json, tsconfig.json, go.mod, Cargo.toml, pom.xml, *.csproj, pyproject.toml, requirements.txt) and adapt refactoring patterns to that language/framework.

$ARGUMENTS can be a file path, function name, module name, or a description of what to refactor.

Apply these refactoring principles:

1. **SOLID principles** -- Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion
2. **Extract functions** -- Break large functions (>50 lines) into smaller, focused units
3. **Reduce complexity** -- Flatten deep nesting, replace complex conditionals with early returns or strategy pattern
4. **Improve naming** -- Replace generic names (data, info, temp) with intention-revealing names
5. **Eliminate duplication** -- Extract shared logic when duplicated 3+ times
6. **Simplify interfaces** -- Reduce function parameters to 3 or fewer, use options objects for more

For each refactoring:

- Show the before and after code
- Explain why the change improves the code
- Run tests after each change to verify no regressions
- Commit with a descriptive message after tests pass
