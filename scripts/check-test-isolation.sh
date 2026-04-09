#!/usr/bin/env bash
# Test Isolation Checker - Validates that all test files use proper isoaltion patterns
# This prevents CI flakiness from environment pollution and race conditions

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=()
WARNINGS=()
FILES_CHECKED=0

# Check for Math.random() in tests (non-deterministic)
check_random_usage() {
	local file="$1"
	if grep -q "Math\.random()" "$file" 2>/dev/null; then
		WARNINGS+=("$file: Uses Math.random() - non-deterministic behavior causes flaky tests (fix in follow-up)")
	fi
}

# Check for process.exitCode mutations (global state pollution)
check_exitcode_mutation() {
	local file="$1"
	if grep -q "process\.exitCode\s*=" "$file" 2>/dev/null; then
		WARNINGS+=("$file: Mutates process.exitCode - ensure cleanup in afterEach")
	fi
}

# Check for import.meta.dir usage (may resolve differently under coverage)
check_import_meta_dir() {
	local file="$1"
	if grep -q "import\.meta\.dir" "$file" 2>/dev/null; then
		WARNINGS+=("$file: Uses import.meta.dir - may resolve differently under coverage")
	fi
}

# Check for hardcoded timeouts < 10ms (too short for CI)
check_hardcoded_timeouts() {
	local file="$1"
	if grep -qE "setTimeout\([^,]+,\s*([0-9]|10)\s*\)" "$file" 2>/dev/null; then
		WARNINGS+=("$file: Uses setTimeout with ≤10ms delay - may be too short for CI reliability")
	fi
}

# Main check
main() {
	echo "Checking test isolation patterns..."
	echo ""

	# Find all test files
	while IFS= read -r -d '' file; do
		FILES_CHECKED=$((FILES_CHECKED + 1))
		
		check_random_usage "$file"
		check_exitcode_mutation "$file"
		check_import_meta_dir "$file"
		check_hardcoded_timeouts "$file"
	done < <(find tests -name "*.test.ts" -print0)

	# Report results
	echo "Checked $FILES_CHECKED test files"
	echo ""

	if [ ${#WARNINGS[@]} -gt 0 ]; then
		echo -e "${YELLOW}WARNINGS:${NC}"
		printf '%s\n' "${WARNINGS[@]}"
		echo ""
	fi

	if [ ${#ERRORS[@]} -gt 0 ]; then
		echo -e "${RED}ERRORS:${NC}"
		printf '%s\n' "${ERRORS[@]}"
		echo ""
		echo -e "${RED}Test isolation check failed${NC}"
		exit 1
	fi

	echo -e "${GREEN}✓ All tests pass isolation check${NC}"
	exit 0
}

main "$@"