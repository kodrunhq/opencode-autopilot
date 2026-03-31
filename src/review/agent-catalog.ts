import type { AgentCategory, AgentDefinition } from "./types";

/**
 * Complete registry of review agents ported from the ace review engine.
 * Core squad always runs. Parallel specialists run based on stack gate.
 * Sequenced specialists run after all prior findings are collected.
 */
export const AGENT_CATALOG: readonly AgentDefinition[] = Object.freeze([
	// --- Core Squad (always runs) ---
	Object.freeze({
		name: "logic-auditor",
		category: "core" as const,
		domain: "Control flow, null safety, async correctness, boundary conditions",
		catches: Object.freeze([
			"Off-by-one errors",
			"Null dereference",
			"Missing await",
			"Race conditions",
			"Incorrect boundary comparisons",
		]),
		triggerSignals: Object.freeze(["Any code change"]),
		stackAffinity: Object.freeze(["universal"]),
		hardGatesSummary:
			"Traces happy + error path per function, checks loops for termination, verifies null safety",
	}),
	Object.freeze({
		name: "test-interrogator",
		category: "core" as const,
		domain: "Test quality, assertion coverage, edge case gaps",
		catches: Object.freeze([
			"Tests without assertions",
			"Over-broad mocks",
			"Missing edge case coverage",
			"Tests that pass by accident",
		]),
		triggerSignals: Object.freeze(["Any code change"]),
		stackAffinity: Object.freeze(["universal"]),
		hardGatesSummary:
			"Reads each test + tested code, identifies hiding bugs, verifies assertions exist",
	}),
	Object.freeze({
		name: "contract-verifier",
		category: "core" as const,
		domain: "API boundary correctness, request/response shape alignment",
		catches: Object.freeze([
			"Mismatched request/response shapes",
			"Wrong HTTP methods",
			"Missing error handling on boundaries",
			"URL path mismatches",
		]),
		triggerSignals: Object.freeze(["Any code change"]),
		stackAffinity: Object.freeze(["universal"]),
		hardGatesSummary:
			"Reads both sides of every API boundary, compares shapes/methods/URLs/error codes",
	}),

	// --- Parallel Specialists ---
	Object.freeze({
		name: "wiring-inspector",
		category: "parallel" as const,
		domain: "End-to-end connectivity (UI -> API -> DB -> response -> UI)",
		catches: Object.freeze([
			"Disconnected flows",
			"Wrong endpoint URLs",
			"Mismatched request/response shapes",
			"Missing error propagation across layers",
			"Orphaned handlers",
		]),
		triggerSignals: Object.freeze([
			"Changes span 2+ architectural layers",
			"New API endpoints",
			"New UI components that fetch data",
		]),
		stackAffinity: Object.freeze(["universal"]),
		hardGatesSummary:
			"Traces every feature path from UI event to DB write and back, documents each verified link",
	}),
	Object.freeze({
		name: "dead-code-scanner",
		category: "parallel" as const,
		domain: "Unused code, imports, unreachable branches",
		catches: Object.freeze([
			"Unused imports",
			"Orphaned functions",
			"TODO/FIXME",
			"Console.log/debugger",
			"Hardcoded secrets",
			"Commented-out code",
		]),
		triggerSignals: Object.freeze([
			"Refactors",
			"Feature removals",
			"Large diffs",
			"File deletions with remaining references",
		]),
		stackAffinity: Object.freeze(["universal"]),
		hardGatesSummary:
			"Checks all changed files for unused imports, orphaned functions, debug artifacts, hardcoded secrets",
	}),
	Object.freeze({
		name: "spec-checker",
		category: "parallel" as const,
		domain: "Requirements alignment with issue/spec context",
		catches: Object.freeze([
			"Missing requirements",
			"Partial implementations",
			"Ungoverned changes",
			"Extra features not in spec",
		]),
		triggerSignals: Object.freeze([
			"Linked GitHub issue exists",
			"PR description references requirements",
			"Changes touch feature code",
		]),
		stackAffinity: Object.freeze(["universal"]),
		hardGatesSummary: "Maps each requirement to implementation status (done/partial/missing/extra)",
	}),
	Object.freeze({
		name: "database-auditor",
		category: "parallel" as const,
		domain: "Migrations, query performance, schema design, connection management",
		catches: Object.freeze([
			"Destructive migrations without rollback",
			"Missing indexes on FKs",
			"N+1 queries",
			"Raw SQL injection",
			"Wrong column types",
		]),
		triggerSignals: Object.freeze([
			"Migration files in diff",
			"Schema changes",
			"ORM model changes without corresponding migrations",
		]),
		stackAffinity: Object.freeze(["universal"]),
		hardGatesSummary:
			"Verifies rollback path, checks index coverage, detects N+1 patterns, checks for SQL injection",
	}),
	Object.freeze({
		name: "auth-flow-verifier",
		category: "parallel" as const,
		domain: "Auth/authz correctness, middleware guards, token handling",
		catches: Object.freeze([
			"Unprotected routes",
			"Privilege escalation",
			"Token validation gaps",
			"Session fixation",
			"Plaintext password storage",
		]),
		triggerSignals: Object.freeze([
			"Changes to auth middleware",
			"Login/logout handlers",
			"Role/permission checks",
			"JWT/session code",
		]),
		stackAffinity: Object.freeze(["universal"]),
		hardGatesSummary:
			"Traces every protected route to verify guard, checks token validation flow end-to-end",
	}),
	Object.freeze({
		name: "type-soundness",
		category: "parallel" as const,
		domain: "Type correctness, invariant design, encapsulation, generics",
		catches: Object.freeze([
			"Unsafe any usage",
			"Incorrect type narrowing",
			"Meaningless generic constraints",
			"Unsafe type assertions",
			"Violated invariants",
		]),
		triggerSignals: Object.freeze([
			"New type definitions",
			"Complex generics",
			"Type assertion usage",
			"any in diff",
		]),
		stackAffinity: Object.freeze(["typescript", "kotlin", "rust", "go"]),
		hardGatesSummary:
			"Flags every any usage, verifies type narrowing correctness, evaluates invariant enforcement",
	}),
	Object.freeze({
		name: "state-mgmt-auditor",
		category: "parallel" as const,
		domain: "UI state consistency, reactivity bugs, stale state, race conditions in UI",
		catches: Object.freeze([
			"Stale closures",
			"Infinite re-render loops",
			"Derived state stored instead of computed",
			"Missing optimistic update rollback",
		]),
		triggerSignals: Object.freeze([
			"React useState/useReducer",
			"Redux/Zustand/Pinia store changes",
			"Vue reactive state",
			"Svelte stores",
		]),
		stackAffinity: Object.freeze(["react", "vue", "svelte", "angular"]),
		hardGatesSummary:
			"Traces state flow from update to render, verifies no stale closures in hooks",
	}),
	Object.freeze({
		name: "concurrency-checker",
		category: "parallel" as const,
		domain: "Thread/async/goroutine safety, deadlocks, resource leaks",
		catches: Object.freeze([
			"Goroutine leaks",
			"Mutex misuse",
			"Race conditions",
			"Missing context cancellation",
			"Missing await",
		]),
		triggerSignals: Object.freeze([
			"Goroutine creation",
			"Mutex/lock usage",
			"Async/await patterns",
			"Worker threads",
			"Promise.all usage",
		]),
		stackAffinity: Object.freeze(["universal"]),
		hardGatesSummary:
			"Verifies every goroutine/thread has a termination path, checks lock/unlock pairs",
	}),
	Object.freeze({
		name: "code-quality-auditor",
		category: "parallel" as const,
		domain: "Readability, modularity, naming, file organization",
		catches: Object.freeze([
			"Overly long functions (>100 lines)",
			"Overly large files (>800 lines)",
			"Deep nesting (>4 levels)",
			"Poor naming",
			"Code duplication",
		]),
		triggerSignals: Object.freeze([
			"Large diffs",
			"New files",
			"Refactors",
			"Substantial function additions",
		]),
		stackAffinity: Object.freeze(["universal"]),
		hardGatesSummary:
			"Measures function length, file length, nesting depth; checks naming conventions",
	}),
	Object.freeze({
		name: "security-auditor",
		category: "parallel" as const,
		domain: "Systematic OWASP auditing, secrets, injection, crypto",
		catches: Object.freeze([
			"Hardcoded secrets",
			"SQL/NoSQL/command injection",
			"XSS",
			"CSRF gaps",
			"Insecure crypto",
			"SSRF",
			"Sensitive data in logs",
		]),
		triggerSignals: Object.freeze([
			"User input handling",
			"API endpoint changes",
			"Database query construction",
			"Crypto usage",
		]),
		stackAffinity: Object.freeze(["universal"]),
		hardGatesSummary:
			"Checks OWASP Top 10 categories systematically, scans for hardcoded secrets",
	}),
	Object.freeze({
		name: "scope-intent-verifier",
		category: "parallel" as const,
		domain: "Scope creep, project alignment, feature coherence",
		catches: Object.freeze([
			"Features not in any spec/issue",
			"Changes conflicting with project philosophy",
			"Unnecessary dependencies",
		]),
		triggerSignals: Object.freeze([
			"New capabilities added",
			"New dependencies",
			"Changes to core architecture",
		]),
		stackAffinity: Object.freeze(["universal"]),
		hardGatesSummary:
			"Reads project docs to understand purpose, maps each change to a user need or spec requirement",
	}),
	Object.freeze({
		name: "silent-failure-hunter",
		category: "parallel" as const,
		domain: "Error handling quality, swallowed errors, empty catches, silent fallbacks",
		catches: Object.freeze([
			"Empty catch blocks",
			"Generic error swallowing",
			"Console.log-only error handling",
			"Optional chaining masking nulls",
			"Fallbacks hiding failures",
		]),
		triggerSignals: Object.freeze([
			"New/modified try-catch blocks",
			"Error callbacks",
			"Fallback logic",
			"Default values on failure paths",
		]),
		stackAffinity: Object.freeze(["universal"]),
		hardGatesSummary:
			"Every catch block must log with context and surface actionable feedback",
	}),
	Object.freeze({
		name: "react-patterns-auditor",
		category: "parallel" as const,
		domain: "React/Next.js specific bug classes",
		catches: Object.freeze([
			"Hooks rules violations",
			"Stale closures",
			"Missing useEffect deps",
			"Server/client boundary violations",
			"Hydration mismatches",
		]),
		triggerSignals: Object.freeze([
			"React component files in diff",
			"Hooks usage",
			"Next.js page/layout files",
		]),
		stackAffinity: Object.freeze(["react", "nextjs"]),
		hardGatesSummary:
			"Checks every hook call for rules compliance, verifies every useEffect deps array",
	}),
	Object.freeze({
		name: "go-idioms-auditor",
		category: "parallel" as const,
		domain: "Go-specific bug classes",
		catches: Object.freeze([
			"defer-in-loop",
			"Goroutine leaks",
			"Nil interface traps",
			"Error shadowing with :=",
			"Context misuse",
		]),
		triggerSignals: Object.freeze([
			"Go files in diff",
			"Goroutine creation",
			"Defer statements",
			"Context.Context usage",
		]),
		stackAffinity: Object.freeze(["go"]),
		hardGatesSummary:
			"Checks every defer for loop placement, every goroutine for cancellation path",
	}),
	Object.freeze({
		name: "python-django-auditor",
		category: "parallel" as const,
		domain: "Python/Django-specific bug classes",
		catches: Object.freeze([
			"N+1 in templates",
			"Unvalidated ModelForms",
			"Missing CSRF",
			"Lazy eval traps",
			"Mutable default args",
		]),
		triggerSignals: Object.freeze([
			"Django view/model/form/template files",
			"Python files with ORM queries",
			"settings.py changes",
		]),
		stackAffinity: Object.freeze(["django", "fastapi"]),
		hardGatesSummary:
			"Checks every queryset for select_related/prefetch_related, every ModelForm for explicit fields",
	}),
	Object.freeze({
		name: "rust-safety-auditor",
		category: "parallel" as const,
		domain: "Rust-specific bug classes",
		catches: Object.freeze([
			"Unjustified unsafe blocks",
			".unwrap() in non-test code",
			"Lifetime correctness issues",
			"Send/Sync violations",
			"mem::forget misuse",
		]),
		triggerSignals: Object.freeze([
			"Rust files in diff",
			"Unsafe blocks",
			".unwrap()/.expect() calls",
			"Lifetime annotations",
		]),
		stackAffinity: Object.freeze(["rust"]),
		hardGatesSummary:
			"Every unsafe block must have a SAFETY comment, every .unwrap() in non-test code is flagged",
	}),

	// --- Sequenced Specialists (run after all prior findings) ---
	Object.freeze({
		name: "product-thinker",
		category: "sequenced" as const,
		domain: "UX/product impact, feature completeness",
		catches: Object.freeze([
			"Dead-end user flows",
			"Missing CRUD operations",
			"Incomplete features",
			"Poor UX",
		]),
		triggerSignals: Object.freeze([
			"User-facing changes",
			"New UI components",
			"New API endpoints for user features",
		]),
		stackAffinity: Object.freeze(["universal"]),
		hardGatesSummary:
			"Traces complete user journey, checks CRUD completeness, verifies no dead ends. Requires ALL Phase 1-2 findings.",
	}),
	Object.freeze({
		name: "red-team",
		category: "sequenced" as const,
		domain: "Adversarial review, inter-domain gap analysis",
		catches: Object.freeze([
			"Bugs hiding between agent domains",
			"Assumption conflicts",
			"User abuse scenarios",
			"Concurrency issues",
		]),
		triggerSignals: Object.freeze(["Any changes that survived Phase 1-3 review"]),
		stackAffinity: Object.freeze(["universal"]),
		hardGatesSummary:
			"Reads ALL other agents' reports, constructs attack scenarios, checks inter-domain gaps. Requires ALL Phase 1-3 findings.",
	}),
]);

/**
 * The three core squad agents that always run regardless of stack or scoring.
 */
export const CORE_SQUAD: readonly AgentDefinition[] = Object.freeze(
	AGENT_CATALOG.filter((a) => a.category === "core"),
);

/**
 * Filter agents by category.
 */
export function getAgentsByCategory(category: AgentCategory): readonly AgentDefinition[] {
	return AGENT_CATALOG.filter((a) => a.category === category);
}
