---
# opencode-autopilot
name: rust-patterns
description: Rust patterns covering ownership, error handling with Result/Option, unsafe guidelines, and testing conventions
stacks:
  - rust
requires: []
---

# Rust Patterns

Idiomatic Rust patterns for writing safe, efficient, and maintainable code. Covers ownership and borrowing, error handling with `Result` and `Option`, unsafe guidelines, testing conventions, crate organization, and common anti-patterns. Apply these when writing, reviewing, or refactoring Rust code.

## 1. Ownership and Borrowing

**DO:** Leverage Rust's ownership system to write safe code without garbage collection.

- Prefer borrowing (`&T`, `&mut T`) over taking ownership when the function doesn't need to own the data:
  ```rust
  // DO: Borrow -- caller keeps ownership
  fn process(items: &[Item]) -> Summary { ... }

  // DON'T: Take ownership unnecessarily
  fn process(items: Vec<Item>) -> Summary { ... }
  ```
- Prefer `&str` over `String` in function parameters:
  ```rust
  fn greet(name: &str) -> String {
      format!("Hello, {name}!")
  }
  // Accepts both String and &str via deref coercion
  ```
- Use lifetimes explicitly when the compiler cannot infer them:
  ```rust
  struct Parser<'a> {
      input: &'a str,
      position: usize,
  }
  ```
- Understand move semantics -- types implementing `Copy` are copied, others are moved:
  ```rust
  let a = String::from("hello");
  let b = a;  // a is MOVED to b, a is no longer valid
  // For Copy types (i32, f64, bool): both remain valid
  ```
- Use `Cow<'_, str>` when a function sometimes needs to allocate and sometimes doesn't:
  ```rust
  fn normalize(input: &str) -> Cow<'_, str> {
      if input.contains(' ') {
          Cow::Owned(input.replace(' ', "_"))
      } else {
          Cow::Borrowed(input)
      }
  }
  ```

**DON'T:**

- Use `Clone` to silence the borrow checker -- fix the ownership design instead
- Pass `&String` -- pass `&str` (more general, no extra indirection)
- Use `'static` lifetime unless the data truly lives for the entire program
- Fight the borrow checker with `Rc<RefCell<T>>` everywhere -- rethink the data flow

## 2. Error Handling

**DO:** Use `Result<T, E>` for recoverable errors and the `?` operator for ergonomic propagation.

- Use `Result<T, E>` for all operations that can fail:
  ```rust
  fn parse_config(path: &Path) -> Result<Config, ConfigError> {
      let content = fs::read_to_string(path)?;
      let config: Config = toml::from_str(&content)?;
      Ok(config)
  }
  ```
- Use `?` for error propagation -- it's Rust's equivalent of Go's `if err != nil`:
  ```rust
  fn process() -> Result<Output, AppError> {
      let input = read_input()?;       // propagates on Err
      let parsed = parse(input)?;       // propagates on Err
      let result = transform(parsed)?;  // propagates on Err
      Ok(result)
  }
  ```
- Use `thiserror` for custom error types in library code:
  ```rust
  #[derive(Debug, thiserror::Error)]
  enum AppError {
      #[error("config error: {0}")]
      Config(#[from] ConfigError),
      #[error("database error: {0}")]
      Database(#[from] sqlx::Error),
      #[error("not found: {resource}")]
      NotFound { resource: String },
  }
  ```
- Use `anyhow::Result` in application code (binaries, CLI tools) where you don't need typed errors:
  ```rust
  fn main() -> anyhow::Result<()> {
      let config = load_config().context("failed to load config")?;
      run(config)?;
      Ok(())
  }
  ```
- Add context to errors with `.context()` or `.with_context()`:
  ```rust
  fs::read_to_string(path)
      .with_context(|| format!("failed to read {}", path.display()))?;
  ```

**DON'T:**

- Use `panic!` for recoverable errors -- `panic!` is for bugs, not expected failures
- Use `.unwrap()` in production code -- use `?`, `.unwrap_or_default()`, or explicit match
- Create error types without `#[derive(Debug)]` -- debug formatting is essential for logging
- Return `Box<dyn Error>` in library code -- use typed errors for caller inspection

## 3. Option Patterns

**DO:** Use `Option<T>` instead of null/sentinel values, and prefer combinators over manual matching.

- Use combinators for clean transformations:
  ```rust
  let display_name = user.nickname
      .map(|n| format!("@{n}"))
      .unwrap_or_else(|| user.full_name.clone());
  ```
- Use `if let` for conditional extraction:
  ```rust
  if let Some(config) = load_optional_config() {
      apply(config);
  }
  ```
- Use `?` with `Option` in functions returning `Option`:
  ```rust
  fn get_user_email(db: &Database, id: UserId) -> Option<String> {
      let user = db.find_user(id)?;  // returns None if not found
      Some(user.email.clone())
  }
  ```
- Chain operations with `.and_then()` for flat-mapping:
  ```rust
  let port: Option<u16> = env::var("PORT").ok().and_then(|s| s.parse().ok());
  ```

**DON'T:**

- Use `.unwrap()` outside of tests -- it panics on `None`
- Use sentinel values (`-1`, `""`, `0`) when `Option` expresses the intent clearly
- Match when a combinator is more concise -- `option.map(f)` beats `match option { Some(v) => Some(f(v)), None => None }`
- Use `Option<Option<T>>` -- it's confusing. Use an enum with explicit variants instead

## 4. Unsafe Guidelines

**DO:** Minimize unsafe code and encapsulate it behind safe abstractions.

- Wrap every `unsafe` block in a safe function with documented invariants:
  ```rust
  /// Returns a reference to the element at `index` without bounds checking.
  ///
  /// # Safety
  /// Caller must ensure `index < self.len()`.
  pub unsafe fn get_unchecked(&self, index: usize) -> &T { ... }
  ```
- Document every `unsafe` block with a `// SAFETY:` comment explaining the invariant:
  ```rust
  // SAFETY: We checked that index < len on the line above.
  let value = unsafe { slice.get_unchecked(index) };
  ```
- Keep `unsafe` blocks as small as possible -- one operation per block
- Prefer safe alternatives in all cases:
  - `Vec<T>` over raw pointers and manual allocation
  - `Arc<Mutex<T>>` over shared mutable raw pointers
  - `std::sync::atomic` over `unsafe` for atomic operations
  - `crossbeam` or channels over `unsafe` for concurrent data structures

**DON'T:**

- Use `unsafe` for performance without benchmarks proving it's necessary
- Use `transmute` -- it's almost never the right answer. Use `from_ne_bytes`, `TryFrom`, or safe casts
- Dereference raw pointers without validating alignment and lifetime
- Implement `Send` or `Sync` manually unless you deeply understand the invariants
- Use `unsafe` to bypass the borrow checker -- it means the design is wrong

## 5. Testing

**DO:** Write unit tests in the same file and integration tests in `tests/`.

- Unit tests in the same file with `#[cfg(test)]`:
  ```rust
  #[cfg(test)]
  mod tests {
      use super::*;

      #[test]
      fn parse_valid_config() {
          let config = parse_config("key = \"value\"").unwrap();
          assert_eq!(config.key, "value");
      }

      #[test]
      fn parse_empty_returns_error() {
          assert!(parse_config("").is_err());
      }
  }
  ```
- Use `#[should_panic]` for expected panics:
  ```rust
  #[test]
  #[should_panic(expected = "index out of bounds")]
  fn panics_on_invalid_index() {
      get_item(&[], 0);
  }
  ```
- Use `assert_eq!` with descriptive messages:
  ```rust
  assert_eq!(result, expected, "failed for input: {input:?}");
  ```
- Integration tests in `tests/` directory access only the public API:
  ```
  tests/
    integration_test.rs
    common/
      mod.rs  // shared test helpers
  ```
- Use `proptest` or `quickcheck` for property-based testing:
  ```rust
  proptest! {
      #[test]
      fn roundtrip_serialize(value: MyType) {
          let bytes = serialize(&value);
          let decoded = deserialize(&bytes).unwrap();
          assert_eq!(value, decoded);
      }
  }
  ```
- Use `#[ignore]` for slow tests with a reason: `#[ignore = "requires database"]`

**DON'T:**

- Put test utilities in the main `src/` tree -- use `tests/common/` or a `dev-dependencies` crate
- Use `.unwrap()` in tests without context -- prefer `.expect("reason")` for better panic messages
- Test private implementation details -- test through the public API
- Skip `#[cfg(test)]` on the test module -- tests will be compiled into release builds

## 6. Crate Organization

**DO:** Organize crates for clarity and minimal compilation units.

- Use a workspace for multi-crate projects:
  ```toml
  # Cargo.toml (workspace root)
  [workspace]
  members = ["crates/*"]
  ```
- Separate library and binary crates:
  ```
  src/
    lib.rs    # library logic
    main.rs   # thin entry point calling lib
  ```
- Use `pub(crate)` for internal visibility -- not everything needs to be fully public
- Group related types in modules:
  ```rust
  // src/lib.rs
  pub mod config;
  pub mod error;
  pub mod client;
  ```
- Keep `main.rs` thin -- parse args, configure logging, call library functions

**DON'T:**

- Put everything in `lib.rs` -- split into modules when the file exceeds 400 lines
- Use `pub` on everything -- default to private, expose only what's needed
- Create deep module hierarchies -- flat is better than nested
- Use `mod.rs` files (old style) -- prefer `module_name.rs` (2018 edition style)

## 7. Anti-Pattern Catalog

**Anti-Pattern: Unnecessary Clone**
Calling `.clone()` to satisfy the borrow checker without understanding why it's needed. Cloning hides design problems -- if you need to clone, ask whether the ownership model is correct. Instead: restructure code to use references, or use `Cow<'_, T>` when cloning is sometimes needed.

**Anti-Pattern: Unwrap Everywhere**
Sprinkling `.unwrap()` in production code because "it should never be None/Err". It will be, and it will panic at 3am. Instead: use `?` for propagation, `.unwrap_or_default()` for safe defaults, or `match`/`if let` for explicit handling.

**Anti-Pattern: Stringly Typed**
Using `String` for everything -- status codes, identifiers, categories. Strings have no compile-time validation. Instead: use newtypes (`struct UserId(String)`) and enums (`enum Status { Active, Inactive }`) for domain concepts.

**Anti-Pattern: Over-Generic Functions**
`fn process<T: Debug + Clone + Send + Sync + 'static>(item: T)` when the function only ever processes `Widget`. Generics should be introduced when there are 2+ concrete types that need the same logic. Instead: start concrete, generalize when needed.

**Anti-Pattern: Ignoring Clippy**
Adding `#[allow(clippy::...)]` instead of fixing the lint. Clippy catches real bugs (unnecessary allocations, logic errors, unidiomatic code). Instead: fix the issue. If the lint is genuinely wrong, add a comment explaining why.
