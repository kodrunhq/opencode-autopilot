---
# opencode-autopilot
name: go-patterns
description: Idiomatic Go patterns covering error handling, concurrency, interfaces, and testing conventions
stacks:
  - go
requires: []
---

# Go Patterns

Idiomatic Go patterns for writing clean, concurrent, and testable code. Covers error handling, concurrency primitives, interface design, testing, package organization, and common anti-patterns. Apply these when writing, reviewing, or refactoring Go code.

## 1. Error Handling

**DO:** Treat errors as values. Check every error and provide context for debugging.

- Always check errors immediately after the call:
  ```go
  f, err := os.Open(path)
  if err != nil {
      return fmt.Errorf("open config %s: %w", path, err)
  }
  defer f.Close()
  ```
- Wrap errors with `%w` for unwrapping with `errors.Is()` and `errors.As()`:
  ```go
  if err := db.Connect(); err != nil {
      return fmt.Errorf("database connection: %w", err)
  }
  ```
- Use sentinel errors for expected conditions:
  ```go
  var ErrNotFound = errors.New("not found")
  var ErrConflict = errors.New("conflict")

  // Caller checks:
  if errors.Is(err, ErrNotFound) { ... }
  ```
- Create custom error types for rich context:
  ```go
  type ValidationError struct {
      Field   string
      Message string
  }
  func (e *ValidationError) Error() string {
      return fmt.Sprintf("validation: %s: %s", e.Field, e.Message)
  }
  ```
- Add context that helps debugging -- include the operation, the input, and the wrapped cause

**DON'T:**

- Ignore errors with `_` unless there is a comment explaining why: `_ = f.Close() // best-effort cleanup`
- Use `panic` for recoverable errors -- reserve `panic` for truly unrecoverable bugs (nil dereference, impossible state)
- Return generic `errors.New("something failed")` without context
- Log AND return the same error -- choose one to avoid duplicate noise
- Use `fmt.Errorf` without `%w` when the caller might need to inspect the cause

## 2. Concurrency Patterns

**DO:** Use goroutines and channels for communication, mutexes for shared state protection.

- Always pass `context.Context` as the first parameter for cancellation and timeouts:
  ```go
  func fetchUser(ctx context.Context, id string) (*User, error) {
      select {
      case <-ctx.Done():
          return nil, ctx.Err()
      default:
      }
      // ... fetch logic
  }
  ```
- Use `errgroup.Group` for parallel tasks with error collection:
  ```go
  g, ctx := errgroup.WithContext(ctx)
  for _, url := range urls {
      g.Go(func() error {
          return fetch(ctx, url)
      })
  }
  if err := g.Wait(); err != nil {
      return fmt.Errorf("parallel fetch: %w", err)
  }
  ```
- Every goroutine must have a clear shutdown path:
  ```go
  func worker(ctx context.Context, jobs <-chan Job) {
      for {
          select {
          case <-ctx.Done():
              return
          case job, ok := <-jobs:
              if !ok { return }
              process(job)
          }
      }
  }
  ```
- Use `sync.WaitGroup` for fan-out when you don't need error collection
- Use `sync.Once` for lazy initialization of shared resources
- Use `sync.Mutex` only when channels are impractical (protecting a shared map, counter, or cache)

**DON'T:**

- Start a goroutine without a way to stop it -- every goroutine needs a cancellation signal
- Use `time.Sleep()` for synchronization -- use channels or `sync.WaitGroup`
- Share memory by communicating -- communicate by sharing channels (Go proverb)
- Use unbuffered channels when the producer and consumer run at different speeds
- Forget `defer mu.Unlock()` after `mu.Lock()` -- always pair them on adjacent lines

## 3. Interface Design

**DO:** Keep interfaces small, define them at the consumer, and accept them as parameters.

- Keep interfaces to 1-3 methods. The smaller the interface, the more types satisfy it:
  ```go
  type Reader interface {
      Read(p []byte) (n int, err error)
  }
  ```
- Define interfaces where they are used, not where they are implemented:
  ```go
  // In the service package (consumer), not the repository package (provider)
  type UserStore interface {
      FindByID(ctx context.Context, id string) (*User, error)
  }
  ```
- Accept interfaces, return structs:
  ```go
  func NewService(store UserStore) *Service { ... }  // accepts interface
  func NewPostgresStore(db *sql.DB) *PostgresStore { ... }  // returns concrete type
  ```
- Use the standard library interfaces (`io.Reader`, `io.Writer`, `fmt.Stringer`) when possible
- Implicit satisfaction -- no `implements` keyword. If the methods match, the type satisfies the interface

**DON'T:**

- Create interfaces with 5+ methods -- break them into smaller, composable interfaces
- Define interfaces before you need them -- extract when you have 2+ implementations or need testing
- Put all interfaces in a single `interfaces.go` file -- define them next to their consumers
- Use empty interface (`interface{}` or `any`) when a more specific type is possible

## 4. Testing Patterns

**DO:** Write table-driven tests, use `t.Helper()`, and keep tests close to the code they test.

- Table-driven tests for multiple inputs:
  ```go
  func TestValidate(t *testing.T) {
      tests := []struct {
          name  string
          input string
          want  error
      }{
          {"valid email", "a@b.com", nil},
          {"missing @", "ab.com", ErrInvalidEmail},
          {"empty", "", ErrRequired},
      }
      for _, tt := range tests {
          t.Run(tt.name, func(t *testing.T) {
              err := Validate(tt.input)
              if !errors.Is(err, tt.want) {
                  t.Errorf("Validate(%q) = %v, want %v", tt.input, err, tt.want)
              }
          })
      }
  }
  ```
- Use `t.Helper()` in test helper functions for better error locations:
  ```go
  func assertNoError(t *testing.T, err error) {
      t.Helper()
      if err != nil {
          t.Fatalf("unexpected error: %v", err)
      }
  }
  ```
- Use `t.Parallel()` for independent tests to run faster
- Use `testdata/` directory for test fixtures (Go tooling ignores this directory)
- Use `package foo_test` for black-box testing of the public API
- Use `package foo` for white-box testing of internal behavior

**DON'T:**

- Use `assert` libraries that hide what's being tested -- prefer standard `t.Errorf` with context
- Test private functions directly -- test through the public API
- Use global test state -- each test case should be independent
- Skip `t.Run` -- subtest names appear in failure output and make debugging easier

## 5. Package Organization

**DO:** Keep packages flat, focused, and named by what they provide.

- Flat structure -- avoid deep nesting:
  ```
  // DO
  auth/
  user/
  order/

  // DON'T
  pkg/services/auth/handlers/middleware/
  ```
- Use `internal/` for implementation details that other packages should not import
- Use `cmd/` for entry points -- one `main.go` per binary:
  ```
  cmd/server/main.go
  cmd/cli/main.go
  ```
- Name packages by what they provide, not what they contain: `auth` not `authutils`, `http` not `httphandlers`
- One package per concern -- don't create `utils` or `helpers` grab-bag packages
- Keep `main.go` thin -- parse flags, wire dependencies, call `Run()`

**DON'T:**

- Create a `models` or `types` package -- put types with the code that uses them
- Use package names that stutter: `user.UserService` -- prefer `user.Service`
- Import from `internal/` across module boundaries -- it won't compile
- Put everything in one package to avoid import cycles -- fix the design instead

## 6. Anti-Pattern Catalog

**Anti-Pattern: Naked Returns**
Using `return` without values in functions with named return parameters. Named returns are fine for documentation, but naked returns obscure what's being returned. Be explicit: `return user, nil`.

**Anti-Pattern: Interface Pollution**
Defining an interface before it has two implementations or a testing need. Interfaces are for decoupling -- premature interfaces add indirection without benefit. Wait until you need polymorphism, then extract.

**Anti-Pattern: Global State**
Package-level `var db *sql.DB` or `var logger *Logger`. Global state makes testing painful, creates hidden coupling, and breaks concurrent test execution. Pass dependencies via function parameters or struct fields.

**Anti-Pattern: Init Function Overuse**
Putting complex logic in `func init()` -- database connections, HTTP clients, file parsing. Init functions run at import time with no error handling. Move initialization to explicit `New()` or `Setup()` functions that return errors.

**Anti-Pattern: Error String Matching**
Checking `err.Error() == "not found"` instead of using `errors.Is(err, ErrNotFound)`. String matching is fragile -- error messages change, wrapping adds context. Use sentinel errors or custom types.

**Anti-Pattern: Goroutine Leak**
Starting a goroutine that blocks forever on a channel or context that's never cancelled. Every goroutine must have a clear exit condition. Use `context.WithCancel`, `context.WithTimeout`, or close the channel.
