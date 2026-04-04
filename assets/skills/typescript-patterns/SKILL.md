---
# opencode-autopilot
name: typescript-patterns
description: TypeScript and Bun runtime patterns, testing idioms, type-level programming, and performance best practices
stacks:
  - typescript
  - bun
requires:
  - coding-standards
---

# TypeScript & Bun Patterns

TypeScript-specific patterns for projects running on the Bun runtime. Covers type-level programming, Bun-specific APIs, testing with bun:test, error handling, module design, and immutability idioms. Apply these when writing, reviewing, or refactoring TypeScript code.

## 1. Type-Level Patterns

**DO:** Use the type system to make invalid states unrepresentable.

- Prefer `interface` over `type` for object shapes -- better error messages, declaration merging, and extendability
- Use discriminated unions for state machines:
  ```ts
  type RequestState =
    | { status: "idle" }
    | { status: "loading" }
    | { status: "success"; data: Response }
    | { status: "error"; error: Error }
  ```
- Use `readonly` arrays and properties by default. Only remove `readonly` when mutation is explicitly required
- Use `as const` for literal types and frozen configuration objects
- Use branded types for domain identifiers to prevent mixing:
  ```ts
  type UserId = string & { readonly __brand: "UserId" }
  type OrderId = string & { readonly __brand: "OrderId" }

  function fetchUser(id: UserId): Promise<User> { ... }
  // fetchUser(orderId) is now a compile error
  ```
- Use template literal types for string patterns:
  ```ts
  type ApiRoute = `/api/${string}`
  type EventName = `on${Capitalize<string>}`
  ```
- Use `satisfies` to validate types without widening:
  ```ts
  const config = {
    port: 3000,
    host: "localhost",
  } satisfies ServerConfig
  // config.port is still `3000` (literal), not `number`
  ```

**DON'T:**

- Use `any` -- use `unknown` and narrow with type guards. If `any` is unavoidable, add a `// biome-ignore lint/suspicious/noExplicitAny: [reason]` comment
- Use `enum` -- use `as const` objects or union types instead (enums have runtime cost and quirky behavior)
- Use `!` non-null assertion -- handle the null case explicitly or use optional chaining
- Cast with `as` when a type guard or conditional check is possible
- Use `Function` type -- use specific signatures: `(arg: string) => void`

## 2. Bun Runtime Patterns

**DO:** Use Bun-native APIs where they provide clear advantages.

- Use `bun test` for testing -- built-in, fast, Jest-compatible API, no configuration needed
- Use `node:fs/promises` for all file I/O -- not `Bun.file()` or `Bun.write()` (portability and testability per project constraints)
- Use `Bun.serve()` for HTTP servers -- not Express or other Node frameworks
- Import from `bun:sqlite` for SQLite -- zero-dependency, built into the runtime
- Use `Bun.spawn()` for subprocesses -- streams stdout/stderr natively
- Use `Bun.hash()` for fast hashing -- faster than Node's crypto for non-cryptographic hashes
- Use `Bun.env` for environment variables -- typed access with auto-completion

**DON'T:**

- Install `jest`, `vitest`, or `mocha` -- `bun test` covers all standard test patterns
- Use `Bun.file()` or `Bun.write()` in library code -- prefer `node:fs/promises` for portability
- Use `node:child_process` when `Bun.spawn()` is available
- Mix CommonJS `require()` with ES module `import` -- use `import` exclusively

## 3. Error Handling

**DO:** Use result types for expected failures. Reserve exceptions for unexpected bugs.

- Return result types instead of throwing:
  ```ts
  type Result<T, E = string> =
    | { success: true; data: T }
    | { success: false; error: E }
  ```
- Catch at boundaries (HTTP handlers, CLI entry points), not in business logic
- Use `isEnoentError()` pattern for filesystem errors -- check error code, not message:
  ```ts
  function isEnoentError(error: unknown): boolean {
    return error instanceof Error && "code" in error && error.code === "ENOENT"
  }
  ```
- Use `unknown` for catch clause variables and narrow before accessing properties:
  ```ts
  try { ... } catch (error: unknown) {
    if (error instanceof ValidationError) { ... }
    throw error // re-throw unknown errors
  }
  ```
- Validate external data at system boundaries with Zod schemas:
  ```ts
  const result = schema.safeParse(input)
  if (!result.success) return { success: false, error: result.error.message }
  ```

**DON'T:**

- Catch without re-throwing or logging -- silent catch is a bug
- Throw strings -- always throw `Error` instances or custom error classes
- Use `try/catch` for control flow -- use conditional checks or result types
- Ignore the return value of `safeParse` -- always check `.success`

## 4. Module Patterns

**DO:** Design modules for composability and testability.

- Export pure functions and interfaces, not classes (unless state encapsulation is genuinely needed)
- Use barrel files (`index.ts`) only for public API surfaces -- internal modules import directly
- Follow strict top-down dependency flow -- no cycles. Use the dependency tree:
  ```
  entry point -> tools -> templates + utils -> Node built-ins
  ```
- Follow the `*Core` function pattern: export a testable core function that accepts dependencies, and a thin wrapper that supplies defaults:
  ```ts
  // Testable core
  export async function createAgentCore(name: string, baseDir: string): Promise<Result> { ... }

  // Thin wrapper for production
  export function tool() {
    return { execute: (args) => createAgentCore(args.name, getGlobalConfigDir()) }
  }
  ```
- Target 200-400 lines per file, hard maximum of 800

**DON'T:**

- Create circular dependencies -- if A imports B and B imports A, extract shared types to C
- Use dynamic `import()` for modules that can be statically imported
- Re-export everything from a barrel file -- explicitly list public API
- Put multiple unrelated exports in a single file

## 5. Testing Patterns

**DO:** Write focused tests that verify behavior, not implementation.

- Use `describe`/`test` (not `it`) for consistency across the project:
  ```ts
  describe("validateAssetName", () => {
    test("accepts lowercase with hyphens", () => {
      expect(validateAssetName("my-agent")).toEqual({ valid: true })
    })

    test("rejects uppercase characters", () => {
      const result = validateAssetName("MyAgent")
      expect(result.valid).toBe(false)
    })
  })
  ```
- Test pure functions: input goes in, output comes out, no mocks needed
- Test side effects: mock the boundary (filesystem, network), verify the interaction:
  ```ts
  import { mock } from "bun:test"
  const writeMock = mock(() => Promise.resolve())
  // inject mock, call function, verify writeMock was called with expected args
  ```
- Use `beforeEach` for test isolation, `afterEach` for cleanup
- Use `expect().toThrow()` for exception testing:
  ```ts
  expect(() => parseConfig(invalid)).toThrow("Invalid config")
  ```
- Use `expect().toMatchSnapshot()` only for complex output where manual assertion is impractical

**DON'T:**

- Test implementation details (private methods, internal state)
- Use `it` instead of `test` -- project convention is `describe`/`test`
- Write tests that depend on execution order or shared mutable state
- Skip tests with `.skip` without a tracking comment (`// TODO(#123): flaky on CI`)
- Use `any` in test files to bypass type checking -- tests should be as typed as production code

## 6. Immutability Patterns

**DO:** Build new objects instead of mutating existing ones.

- Use object spread for updates:
  ```ts
  const updated = { ...existing, status: "active" }
  ```
- Use array spread for additions:
  ```ts
  const withNew = [...existing, newItem]
  ```
- Use `Object.freeze()` for constants and configuration:
  ```ts
  const DEFAULTS = Object.freeze({
    maxRetries: 3,
    timeoutMs: 5000,
  })
  ```
- Use `ReadonlyArray<T>` and `Readonly<Record<K, V>>` for function parameters:
  ```ts
  function process(items: ReadonlyArray<Item>): Result { ... }
  ```
- Use `map`, `filter`, `reduce` instead of mutating loops:
  ```ts
  const active = users.filter(u => u.isActive)
  const names = active.map(u => u.name)
  ```

**DON'T:**

- Push to arrays: `items.push(x)` -- use `[...items, x]`
- Reassign properties: `obj.status = "done"` -- use `{ ...obj, status: "done" }`
- Use `splice`, `pop`, `shift` on shared arrays
- Mutate function arguments -- always return new values

**Exception:** Mutation is acceptable when an API explicitly requires it (OpenCode config hooks, database transaction builders, stream writers). Document the mutation with a comment.

## 7. Anti-Pattern Catalog

**Anti-Pattern: Over-typed Generics**
Writing `function get<T extends Record<string, unknown>, K extends keyof T>(obj: T, key: K): T[K]` when `function get(obj: Record<string, unknown>, key: string): unknown` suffices. Generics should earn their complexity by providing caller-site type narrowing.

**Anti-Pattern: Barrel File Hell**
Every directory gets an `index.ts` that re-exports everything. This creates implicit coupling, breaks tree-shaking, and makes imports ambiguous. Use barrel files only for the package's public API surface.

**Anti-Pattern: Type Assertion Chains**
`(value as unknown as TargetType)` is a code smell. If you need two casts, the types are wrong. Fix the source type or add a proper type guard.

**Anti-Pattern: Promise Constructor Anti-Pattern**
Wrapping an async function in `new Promise()` when you can just return the promise directly. If the function returns a promise, use `async/await` -- don't wrap it.

**Anti-Pattern: Callback-Style Error Handling**
Passing `(error, result)` tuples in TypeScript. Use `Result<T, E>` types or throw -- callbacks are a Node.js legacy, not a TypeScript pattern.

**Anti-Pattern: Default Export Confusion**
Using `export default` in library code makes imports inconsistent across consumers (each file names it differently). Use named exports: `export function createAgent()` not `export default function()`. Default exports are acceptable only for plugin/framework entry points that require them.

## 8. Performance Patterns

**DO:** Write efficient TypeScript that leverages Bun's runtime characteristics.

- Pre-compute values at module level for constants used in hot paths:
  ```ts
  // Module level -- computed once
  const VALID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/
  const DEFAULT_CONFIG = Object.freeze({ maxRetries: 3, timeoutMs: 5000 })

  // Not inside the function -- recomputed every call
  ```
- Use `Map` and `Set` for frequent lookups instead of plain objects and arrays:
  ```ts
  const BUILT_IN_COMMANDS = new Set(["help", "quit", "config"])
  // O(1) lookup vs O(n) array.includes()
  ```
- Use `structuredClone()` for deep copies -- built into the runtime, handles circular references
- Avoid unnecessary `await` in return position:
  ```ts
  // DO: Return the promise directly
  function fetchUser(id: string): Promise<User> {
    return db.query("SELECT * FROM users WHERE id = ?", [id])
  }

  // DON'T: Unnecessary await
  async function fetchUser(id: string): Promise<User> {
    return await db.query("SELECT * FROM users WHERE id = ?", [id])
  }
  ```

**DON'T:**

- Create regex objects inside loops or frequently-called functions
- Use `JSON.parse(JSON.stringify(obj))` for deep cloning -- use `structuredClone()`
- Allocate in hot paths -- pre-compute, cache, or use pooling for frequently created objects
- Use `Array.from()` when spread `[...iterable]` works -- spread is faster in Bun
