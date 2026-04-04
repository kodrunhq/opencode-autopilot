---
# opencode-autopilot
name: python-patterns
description: Pythonic patterns covering type hints, error handling, async, testing with pytest, and project organization
stacks:
  - python
requires: []
---

# Python Patterns

Pythonic patterns for writing clean, typed, and testable Python code. Covers type hints, error handling, async programming, testing with pytest, project organization, and common anti-patterns. Apply these when writing, reviewing, or refactoring Python code.

## 1. Type Hints

**DO:** Use type hints on all function signatures and module-level variables for clarity and static analysis.

- Annotate all function parameters and return types:
  ```python
  def fetch_user(user_id: str) -> User | None:
      ...
  ```
- Use `from __future__ import annotations` at the top of every module for forward references and PEP 604 union syntax in older Python versions
- Use `TypedDict` for structured dictionaries that cross boundaries:
  ```python
  class UserResponse(TypedDict):
      id: str
      name: str
      email: str
      is_active: bool
  ```
- Use `@dataclass` for value objects with automatic `__init__`, `__eq__`, and `__repr__`:
  ```python
  @dataclass(frozen=True)
  class Coordinate:
      lat: float
      lon: float
  ```
- Use `Protocol` for structural subtyping (duck typing with type safety):
  ```python
  class Readable(Protocol):
      def read(self, n: int = -1) -> bytes: ...

  def process(source: Readable) -> bytes:
      return source.read()
  # Any object with a read() method satisfies Readable
  ```
- Use `Literal` for constrained string/int values:
  ```python
  def set_log_level(level: Literal["debug", "info", "warning", "error"]) -> None:
      ...
  ```

**DON'T:**

- Use `Any` without justification -- prefer `object` for truly unknown types or narrow with `isinstance`
- Use `dict` when `TypedDict` or a dataclass better describes the structure
- Use `Optional[X]` -- prefer `X | None` (clearer, shorter)
- Omit return type annotations -- even `-> None` is valuable documentation
- Use `Union[X, Y]` -- prefer `X | Y` (PEP 604 syntax)

## 2. Error Handling

**DO:** Use specific exceptions and context managers for clean resource management.

- Raise specific exceptions with descriptive messages:
  ```python
  raise ValueError(f"age must be positive, got {age}")
  ```
- Create a domain exception hierarchy:
  ```python
  class AppError(Exception):
      """Base for all application errors."""

  class AuthError(AppError):
      """Authentication or authorization failure."""

  class NotFoundError(AppError):
      """Requested resource does not exist."""
  ```
- Use context managers for resource cleanup:
  ```python
  with open(path, "r") as f:
      data = json.load(f)
  ```
- Chain exceptions to preserve the original cause:
  ```python
  try:
      result = parse_config(raw)
  except json.JSONDecodeError as e:
      raise ConfigError(f"invalid config at {path}") from e
  ```
- Use `logging.exception()` in catch blocks to capture the full traceback:
  ```python
  except DatabaseError:
      logger.exception("Failed to connect to database")
      raise
  ```

**DON'T:**

- Use bare `except:` -- it catches `KeyboardInterrupt` and `SystemExit`. Use `except Exception:` at minimum
- Catch and silently swallow: `except Exception: pass` is almost always a bug
- Use exceptions for control flow -- check conditions with `if` before potentially failing operations
- Raise `Exception("something")` -- use specific types
- Log and re-raise without `from` -- you lose the traceback chain

## 3. Async Patterns

**DO:** Use `async`/`await` for I/O-bound operations and structured concurrency for parallelism.

- Use `async`/`await` for network, file, and database operations:
  ```python
  async def fetch_user(session: aiohttp.ClientSession, user_id: str) -> User:
      async with session.get(f"/users/{user_id}") as resp:
          data = await resp.json()
          return User(**data)
  ```
- Use `asyncio.gather()` for concurrent independent tasks:
  ```python
  users, orders = await asyncio.gather(
      fetch_users(session),
      fetch_orders(session),
  )
  ```
- Use `asyncio.TaskGroup` (Python 3.11+) for structured concurrency with automatic cancellation:
  ```python
  async with asyncio.TaskGroup() as tg:
      task1 = tg.create_task(fetch_users())
      task2 = tg.create_task(fetch_orders())
  # Both tasks complete or all are cancelled on first failure
  ```
- Use `async with` for async context managers (database connections, HTTP sessions)
- Use `asyncio.Semaphore` for rate limiting concurrent operations:
  ```python
  sem = asyncio.Semaphore(10)
  async def limited_fetch(url: str) -> bytes:
      async with sem:
          return await fetch(url)
  ```

**DON'T:**

- Mix sync and async in the same module -- pick one paradigm
- Use `asyncio.run()` inside an already-running event loop
- Block the event loop with CPU-bound work -- use `asyncio.to_thread()` or `ProcessPoolExecutor`
- Use `time.sleep()` in async code -- use `await asyncio.sleep()`
- Create tasks without awaiting them -- orphan tasks are goroutine leaks

## 4. Testing with pytest

**DO:** Write focused tests using pytest fixtures, parametrize, and clear assertion patterns.

- Use `@pytest.fixture` for test setup and dependency injection:
  ```python
  @pytest.fixture
  def db_connection():
      conn = create_test_db()
      yield conn
      conn.close()

  def test_insert_user(db_connection):
      db_connection.execute("INSERT INTO users ...")
      assert db_connection.query("SELECT count(*) FROM users") == 1
  ```
- Parametrize tests for multiple inputs:
  ```python
  @pytest.mark.parametrize("input,expected", [
      ("hello", "HELLO"),
      ("", ""),
      ("Hello World", "HELLO WORLD"),
  ])
  def test_uppercase(input: str, expected: str):
      assert uppercase(input) == expected
  ```
- Use `conftest.py` for shared fixtures across test modules
- Use `pytest.raises` for exception testing:
  ```python
  with pytest.raises(ValueError, match="must be positive"):
      validate_age(-1)
  ```
- Use `tmp_path` fixture for temporary file tests:
  ```python
  def test_write_config(tmp_path: Path):
      config_file = tmp_path / "config.json"
      write_config(config_file, {"key": "value"})
      assert config_file.read_text() == '{"key": "value"}'
  ```
- Use `monkeypatch` for mocking environment variables and module attributes

**DON'T:**

- Use `unittest.TestCase` in new code -- pytest's function-based tests are simpler and more powerful
- Create test fixtures with complex inheritance hierarchies
- Test implementation details -- test behavior through the public API
- Use `mock.patch` on internal functions -- inject dependencies instead
- Write tests that depend on execution order

## 5. Project Organization

**DO:** Use modern Python project structure with `pyproject.toml` and the `src/` layout.

- Standard project structure:
  ```
  project/
    pyproject.toml
    src/
      mypackage/
        __init__.py
        models/
        services/
        api/
    tests/
      conftest.py
      test_models.py
      test_services.py
  ```
- Use `pyproject.toml` as the single source for project metadata, dependencies, and tool configuration
- Use `__init__.py` for public API exports only -- keep them minimal:
  ```python
  # src/mypackage/__init__.py
  from mypackage.client import Client
  from mypackage.errors import AppError

  __all__ = ["Client", "AppError"]
  ```
- Separate concerns: `models/` for data structures, `services/` for business logic, `api/` for HTTP layer
- Use `pydantic` for data validation at system boundaries (API input, config files, external data)
- Pin dependencies with lock files (`uv.lock`, `poetry.lock`, `requirements.txt` with hashes)

**DON'T:**

- Use `setup.py` for new projects -- `pyproject.toml` is the standard
- Put everything in `__init__.py` -- it becomes a maintenance burden
- Import from `tests/` in production code
- Use relative imports across package boundaries -- absolute imports are clearer

## 6. Anti-Pattern Catalog

**Anti-Pattern: Mutable Default Arguments**
`def f(items=[])` shares the same list across all calls. The default is evaluated once at function definition, not per call. Instead: `def f(items: list[str] | None = None): items = items if items is not None else []`

**Anti-Pattern: Bare Except**
`except:` catches everything including `KeyboardInterrupt`, `SystemExit`, and `GeneratorExit`. This prevents Ctrl+C from working and hides real bugs. Instead: `except Exception:` for broad catching, or specific exception types.

**Anti-Pattern: Star Imports**
`from module import *` pollutes the namespace, makes it impossible to trace where names come from, and breaks static analysis. Instead: import explicitly: `from module import ClassName, function_name`

**Anti-Pattern: God Class**
A single class with 20+ methods handling validation, database access, formatting, and business logic. Instead: split into focused classes with single responsibilities. Use composition over inheritance.

**Anti-Pattern: String Formatting for SQL**
`f"SELECT * FROM users WHERE id = '{user_id}'"` is a SQL injection vulnerability. Instead: use parameterized queries: `cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))`

**Anti-Pattern: Nested Try/Except**
Three levels of `try/except` blocks handling different errors. Instead: use early returns, separate the operations into functions, or use a result type pattern.
