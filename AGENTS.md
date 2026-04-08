# AGENTS.md — Agent Coding Guidelines

This file provides coding conventions and operational commands for AI agents working in this repository.

---

## Build / Lint / Test Commands

```bash
# Run all tests
bun test

# Run a single test file
bun test tests/handlers-late.test.ts

# Run a single test by name
bun test tests/handlers-late.test.ts -t "handleBuild"

# Lint all files
bun run lint

# Format all files
bun run format

# TypeScript type check
bunx tsc --noEmit
```

---

## Code Style Guidelines

### Formatting
- **Indent**: Tab indentation (configured in biome.json)
- **Line width**: 100 characters max
- **Use Biome**: Run `bun run format` before committing

### Imports
- **Order**: Group imports: node:*, external packages, then relative paths
- **Use `import type`**: For type-only imports to enable tree-shaking
- **Avoid barrel imports**: Import directly from modules (e.g., `from "../types"` not `from "../index"`)

```typescript
// ✅ Correct
import { join } from "node:path";
import { tool } from "@opencode-ai/plugin";
import type { PipelineState } from "../types";

// ❌ Wrong
import * as path from "node:path";
import { tool, someOther } from "@opencode-ai/plugin";
```

### Types
- **Strict mode**: Enabled in tsconfig.json — no implicit any
- **Use Zod**: Define schemas in `src/orchestrator/schemas.ts` for runtime validation
- **Avoid `any`**: Use `unknown` if type is truly unknown, or define proper types
- **Nullable**: Prefer `null` over `undefined` for optional values

### Naming Conventions
- **Files**: kebab-case (e.g., `fs-helpers.ts`, `orchestrate.ts`)
- **Types/Classes**: PascalCase (e.g., `PipelineState`, `DispatchResult`)
- **Functions/variables**: camelCase (e.g., `loadState`, `buildProgress`)
- **Constants**: UPPER_SNAKE_CASE for compile-time constants, camelCase for immutables
- **Booleans**: Prefix with `is`, `has`, `should` (e.g., `isValid`, `hasTasks`)

### Error Handling
- **Never swallow errors silently**: Always log or re-throw
- **Use custom error guards**: Create type guards like `isEnoentError()` in `src/utils/fs-helpers.ts`
- **Catch specific errors**: Handle `ENOENT`, `EACCES`, etc. explicitly

```typescript
// ✅ Good
export function isEnoentError(error: unknown): error is NodeJS.ErrnoException {
	return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
}

async function loadFile(path: string): Promise<string> {
	try {
		return await readFile(path, "utf-8");
	} catch (error: unknown) {
		if (isEnoentError(error)) {
			return ""; // File doesn't exist, return default
		}
		throw error; // Re-throw unexpected errors
	}
}

// ❌ Bad
try {
	return await readFile(path, "utf-8");
} catch {
	return ""; // Silently swallowing error!
}
```

### Immutability
- **Prefer immutable patterns**: Use spread operators, `Object.freeze()`, read-only types
- **Functions**: Take `readonly` arrays/objects, return new arrays/objects
- **State updates**: Always create new objects rather than mutating

```typescript
// ✅ Good
function updateTasks(tasks: readonly Task[], id: number, status: Task["status"]): readonly Task[] {
	return tasks.map((t) => (t.id === id ? { ...t, status } : t));
}

// ❌ Bad
function updateTasks(tasks: Task[], id: number, status: Task["status"]): void {
	for (const t of tasks) {
		if (t.id === id) t.status = status; // Mutating in place!
	}
}
```

### Async / Promises
- **Always await async functions**: Never use `.then()` chain unless necessary
- **Handle rejections**: Always have try/catch at top-level or use `.catch()`
- **Use `Promise.all`** for parallel operations, not sequential awaits when independent

---

## Project Architecture

### Key Directories
- `src/orchestrator/` — Pipeline state machine, phase handlers, task management
- `src/tools/` — OpenCode plugin tools (orchestrate, review, hashline-edit)
- `src/skills/` — Skill loading and adaptive injection
- `src/agents/` — Specialized agent definitions
- `tests/` — Test files mirror `src/` structure

### State Management
- **Pipeline state**: Stored in `.opencode-autopilot/state.json` per project
- **Phase handlers**: Return `DispatchResult` with `_stateUpdates` for state mutations
- **Schema validation**: All state changes validated via Zod schemas in `schemas.ts`

---

## Testing Conventions

### Test File Naming
- `*.test.ts` — Unit tests
- `tests/` mirrors `src/` structure

### Test Patterns
```typescript
import { describe, expect, test } from "bun:test";

describe("functionName", () => {
	test("describes expected behavior", async () => {
		const result = myFunction(input);
		expect(result).toBe(expected);
	});
});
```

---

## Commit Messages

Use conventional commits format:
- `fix: description` — Bug fixes
- `feat: description` — New features  
- `test: description` — Test additions/changes
- `chore: description` — Maintenance

Example: `fix: load tasks from tasks.md into pipeline state`
