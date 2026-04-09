# CI Test Flakiness - Permanent Fix Plan

**Created**: 2026-04-09  
**Status**: READY TO EXECUTE  
**Priority**: CRITICAL

---

## Executive Summary

This plan addresses CI test flakiness through **immediate fixes** (stop the bleeding) and **systemic changes** (prevent recurrence). Execute phases in order - each phase must pass verification before proceeding.

**Root Causes Identified:**
1. Unused imports causing lint failures
2. 145/204 test files lack proper temp directory isolation
3. No concurrency limits in CI (race conditions on shared state)
4. No automated enforcement of isolation patterns

---

## PHASE 0: Immediate Fixes (5 minutes)

**Goal**: Fix current CI failures blocking merges

### Step 0.1: Remove unused import

**File**: `tests/health/checks.test.ts`  
**Line**: 2  
**Change**: Remove `randomUUID` from import

```typescript
// BEFORE (line 2):
import { randomUUID } from "node:crypto";

// AFTER:
// (line deleted - randomUUID is unused)
```

**Command**:
```bash
# Edit the file to remove line 2
sed -i '2d' tests/health/checks.test.ts
```

**Verification**:
```bash
bun run lint
# Expected: No errors

bunx tsc --noEmit
# Expected: No errors
```

### Step 0.2: Verify skillHealthCheck test isolation

**File**: `tests/health/checks.test.ts`  
**Lines**: 24-75  

**Current State**: Already uses `createIsolatedTempDir()` with nested subdirectories. This is CORRECT - no changes needed.

**Pattern to preserve**:
```typescript
const baseDir = await createIsolatedTempDir("skill-check-ts");
const tempDir = join(baseDir, "project");
await mkdir(tempDir, { recursive: true });
// ... use tempDir for test ...
await rm(baseDir, { recursive: true, force: true });
```

### Step 0.3: Run full verification

```bash
# Lint
bun run lint

# Type check
bunx tsc --noEmit

# Tests (local verification)
bun test

# If all pass, commit:
git add -A && git commit -m "fix: remove unused randomUUID import from health checks test"
```

**Rollback**: `git checkout HEAD~1` if anything breaks

---

## PHASE 1: Reduce CI Parallelism (10 minutes)

**Goal**: Eliminate race conditions from concurrent test execution

### Step 1.1: Update CI workflow

**File**: `.github/workflows/ci.yml`  
**Change**: Add `--concurrency` flag to test command

```yaml
# BEFORE (line 31):
      - name: Test with coverage
        run: bun test --coverage --bail=1

# AFTER:
      - name: Test with coverage
        run: bun test --coverage --bail=1 --concurrency=4
```

**Rationale**: 
- Current: Unlimited concurrency (default = CPU cores, often 4-8 in CI)
- New: Max 4 concurrent test files
- Reduces filesystem race conditions on temp directories
- Still fast enough for CI (tests complete in ~2-3 minutes)

### Step 1.2: Add test timeout

**File**: `.github/workflows/ci.yml`  
**Change**: Add timeout to prevent hanging tests

```yaml
# AFTER the test step, add:
      - name: Test with coverage
        run: bun test --coverage --bail=1 --concurrency=4
        timeout-minutes: 10
```

### Step 1.3: Verify CI changes

```bash
# Local test with new concurrency
bun test --concurrency=4

# If passes, commit:
git add -A && git commit -m "ci: reduce test concurrency to 4, add timeout"
```

**Rollback**: Revert commit if tests fail

---

## PHASE 2: Test Isolation Harness (30 minutes)

**Goal**: Enforce proper temp directory isolation across ALL tests

### Step 2.1: Create test preload file

**File**: `tests/preload.ts` (NEW)

```typescript
/**
 * Test preload - enforces isolation patterns
 * Loaded before all tests via bunfig.toml
 */
import { beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Track temp directories for cleanup
const tempDirs = new Set<string>();

/**
 * Create an isolated temp directory for a test
 * Automatically cleaned up after test completes
 */
export async function createTestDir(prefix: string): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), `oca-test-${prefix}-`));
	tempDirs.add(dir);
	return dir;
}

// Global cleanup after each test
afterEach(async () => {
	for (const dir of tempDirs) {
		try {
			await rm(dir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors - OS will clean /tmp eventually
		}
		tempDirs.clear();
	}
});
```

### Step 2.2: Update bunfig.toml

**File**: `bunfig.toml`  
**Change**: Add preload configuration

```toml
[test]
coverageSkipTestFiles = true
root = "./tests"
preload = ["./tests/preload.ts"]
```

### Step 2.3: Create migration helper script

**File**: `scripts/migrate-test-isolation.sh` (NEW)

```bash
#!/bin/bash
# Migrate tests to use createTestDir from preload
# Usage: ./scripts/migrate-test-isolation.sh

set -e

echo "Scanning tests for isolation issues..."

# Find tests using tmpdir() directly (not via createTestDir/createIsolatedTempDir)
FILES_NEEDING_MIGRATION=$(grep -r "tmpdir()" tests/*.test.ts tests/**/*.test.ts 2>/dev/null | \
  grep -v "createTestDir\|createIsolatedTempDir" | \
  cut -d: -f1 | \
  sort -u)

if [ -z "$FILES_NEEDING_MIGRATION" ]; then
  echo "✅ All tests already use proper isolation"
  exit 0
fi

echo "Files needing migration:"
echo "$FILES_NEEDING_MIGRATION"
echo ""
echo "Total: $(echo "$FILES_NEEDING_MIGRATION" | wc -l) files"
echo ""
echo "Migration pattern:"
echo "  1. Add: import { createTestDir } from '../preload';"
echo "  2. Replace: mkdtemp(join(tmpdir(), 'prefix'))"
echo "  3. With:    createTestDir('prefix')"
echo "  4. Remove: Manual rm() calls (handled by preload)"
```

**Make executable**:
```bash
chmod +x scripts/migrate-test-isolation.sh
```

### Step 2.4: Verify preload works

```bash
# Run tests with preload
bun test

# Check for any issues
bun run lint
bunx tsc --noEmit
```

**Rollback**: Remove preload from bunfig.toml

---

## PHASE 3: Automated Enforcement (20 minutes)

**Goal**: Prevent future isolation regressions

### Step 3.1: Create isolation linter script

**File**: `scripts/check-test-isolation.sh` (NEW)

```bash
#!/bin/bash
# Check test files for proper isolation patterns
# Exit code 0 = all good, 1 = issues found

set -e

VIOLATIONS=0

echo "Checking test isolation patterns..."

# Check for direct tmpdir() usage without proper isolation
BAD_FILES=$(grep -r "tmpdir()" tests/*.test.ts tests/**/*.test.ts 2>/dev/null | \
  grep -v "createTestDir\|createIsolatedTempDir" | \
  cut -d: -f1 | \
  sort -u || true)

if [ -n "$BAD_FILES" ]; then
  echo "❌ Tests using tmpdir() without isolation helper:"
  echo "$BAD_FILES"
  VIOLATIONS=$((VIOLATIONS + 1))
fi

# Check for missing cleanup (rm with recursive)
INCOMPLETE_CLEANUP=$(grep -r "await rm(" tests/*.test.ts tests/**/*.test.ts 2>/dev/null | \
  grep -v "recursive: true, force: true" | \
  cut -d: -f1 | \
  sort -u || true)

if [ -n "$INCOMPLETE_CLEANUP" ]; then
  echo "❌ Tests with incomplete cleanup (missing recursive: true, force: true):"
  echo "$INCOMPLETE_CLEANUP"
  VIOLATIONS=$((VIOLATIONS + 1))
fi

# Check for hardcoded paths
HARDCODED_PATHS=$(grep -r '"/tmp/' tests/*.test.ts tests/**/*.test.ts 2>/dev/null | \
  cut -d: -f1 | \
  sort -u || true)

if [ -n "$HARDCODED_PATHS" ]; then
  echo "❌ Tests with hardcoded /tmp/ paths:"
  echo "$HARDCODED_PATHS"
  VIOLATIONS=$((VIOLATIONS + 1))
fi

if [ $VIOLATIONS -eq 0 ]; then
  echo "✅ All tests follow isolation patterns"
  exit 0
else
  echo ""
  echo "Found $VIOLATIONS isolation issues"
  echo "See tests/preload.ts for proper patterns"
  exit 1
fi
```

**Make executable**:
```bash
chmod +x scripts/check-test-isolation.sh
```

### Step 3.2: Add to CI workflow

**File**: `.github/workflows/ci.yml`  
**Change**: Add isolation check before tests

```yaml
# BEFORE the test step, add:
      - name: Check test isolation
        run: ./scripts/check-test-isolation.sh

      - name: Test with coverage
        run: bun test --coverage --bail=1 --concurrency=4
        timeout-minutes: 10
```

### Step 3.3: Create pre-commit hook

**File**: `.husky/pre-commit` (if using husky) OR `scripts/pre-commit-check.sh`

```bash
#!/bin/bash
# Pre-commit hook to check test isolation

# Only check if test files were modified
TEST_FILES_CHANGED=$(git diff --cached --name-only | grep "tests/.*\.test\.ts$" || true)

if [ -n "$TEST_FILES_CHANGED" ]; then
  echo "Test files changed, checking isolation..."
  ./scripts/check-test-isolation.sh
fi
```

**Alternative: Add to package.json scripts**:
```json
{
  "scripts": {
    "test": "bun test",
    "test:check": "./scripts/check-test-isolation.sh && bun test",
    "lint": "biome check .",
    "format": "biome format . --write",
    "prepublishOnly": "bun test && bunx tsc --noEmit"
  }
}
```

### Step 3.4: Verify enforcement

```bash
# Run isolation check
./scripts/check-test-isolation.sh

# Run full test suite
bun run test:check

# If passes, commit:
git add -A && git commit -m "ci: add test isolation enforcement and pre-commit checks"
```

**Rollback**: Remove isolation check from CI

---

## PHASE 4: Documentation (10 minutes)

**Goal**: Document patterns for future contributors

### Step 4.1: Update AGENTS.md

**File**: `AGENTS.md`  
**Add section**: Testing Conventions

```markdown
## Testing Conventions

### Test Isolation (CRITICAL)

ALL tests MUST use isolated temp directories. Never use shared paths.

**Pattern**:
```typescript
import { createTestDir } from "./preload";

test("my test", async () => {
  const tempDir = await createTestDir("my-test");
  // ... use tempDir ...
  // Cleanup is automatic via preload
});
```

**Legacy pattern** (still valid):
```typescript
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("my test", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "oca-my-test-"));
  try {
    // ... use tempDir ...
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
```

**NEVER**:
- Use hardcoded paths like `/tmp/my-test`
- Share temp directories between tests
- Forget cleanup (use `createTestDir` or try/finally)
```

### Step 4.2: Create test template

**File**: `tests/_template.test.ts` (NEW)

```typescript
/**
 * Test template - copy this for new tests
 * Shows proper isolation patterns
 */
import { describe, expect, test } from "bun:test";
import { createTestDir } from "./preload";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";

describe("myFeature", () => {
	test("does something with files", async () => {
		// Arrange - create isolated temp directory
		const tempDir = await createTestDir("my-feature");

		// Act - do something
		const testFile = join(tempDir, "test.txt");
		await writeFile(testFile, "test content");

		// Assert
		expect(testFile).toContain(tempDir);

		// No cleanup needed - preload handles it
	});
});
```

---

## Verification Checklist

After completing all phases:

```bash
# 1. Lint passes
bun run lint

# 2. Type check passes
bunx tsc --noEmit

# 3. All tests pass
bun test

# 4. Isolation check passes
./scripts/check-test-isolation.sh

# 5. CI simulation (with reduced concurrency)
bun test --concurrency=4 --bail=1
```

---

## Rollback Plan

If any phase breaks CI:

1. **Phase 0 issues**: `git checkout HEAD~1` (revert import fix)
2. **Phase 1 issues**: Remove `--concurrency=4` from CI
3. **Phase 2 issues**: Remove `preload` from bunfig.toml
4. **Phase 3 issues**: Remove isolation check from CI workflow
5. **Phase 4 issues**: Documentation only - no rollback needed

**Emergency full rollback**:
```bash
git revert HEAD~4..HEAD  # Revert all 4 commits
git push --force-with-lease
```

---

## Long-Term Prevention

### Automated (implemented above)
- ✅ CI concurrency limit (4 max)
- ✅ Test isolation preload with auto-cleanup
- ✅ Pre-commit isolation check
- ✅ CI gate for isolation violations

### Manual (ongoing)
- Review PRs for test isolation patterns
- Run `./scripts/check-test-isolation.sh` before merging
- Monitor CI flakiness metrics

### Future Enhancements (optional)
- Add `bun test --coverage` to PR requirements
- Create GitHub Action for isolation checking
- Add flakiness detection (retry failed tests 2x, flag if inconsistent)

---

## Execution Order

**Execute in this exact order**:

1. **Phase 0** (5 min) - Fix current failures
   - Remove unused import
   - Verify lint + type check + tests
   - Commit

2. **Phase 1** (10 min) - Reduce parallelism
   - Update CI concurrency
   - Add timeout
   - Commit

3. **Phase 2** (30 min) - Isolation harness
   - Create preload.ts
   - Update bunfig.toml
   - Create migration script
   - Commit

4. **Phase 3** (20 min) - Enforcement
   - Create isolation checker
   - Add to CI
   - Create pre-commit hook
   - Commit

5. **Phase 4** (10 min) - Documentation
   - Update AGENTS.md
   - Create test template
   - Commit

**Total time**: ~75 minutes

---

## Success Criteria

- [ ] All lint checks pass
- [ ] All type checks pass
- [ ] All tests pass locally
- [ ] All tests pass in CI
- [ ] No flakiness in 3 consecutive CI runs
- [ ] Isolation check catches violations
- [ ] Documentation updated

---

## Notes

- **Do NOT skip phases** - each builds on the previous
- **Commit after each phase** - enables granular rollback
- **Test locally before pushing** - catches issues early
- **Monitor first 3 CI runs** - verify flakiness is gone

**Questions?** Check `tests/preload.ts` for the canonical isolation pattern.
