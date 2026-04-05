import type { AgentCategory, AgentDefinition } from "./types";

export const AGENT_CATALOG: readonly AgentDefinition[] = Object.freeze([
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
	Object.freeze({
		name: "security-auditor",
		category: "parallel" as const,
		domain: "Systematic OWASP auditing, auth/authz correctness, secrets, injection, crypto",
		catches: Object.freeze([
			"Hardcoded secrets",
			"SQL/NoSQL/command injection",
			"XSS",
			"CSRF gaps",
			"Broken route protection",
			"Privilege escalation",
			"Token validation gaps",
			"Insecure crypto",
			"SSRF",
			"Sensitive data in logs",
		]),
		triggerSignals: Object.freeze([
			"User input handling",
			"API endpoint changes",
			"Auth middleware or session code",
			"Database query construction",
			"Crypto usage",
		]),
		stackAffinity: Object.freeze(["universal"]),
		hardGatesSummary:
			"Checks OWASP Top 10 categories systematically and verifies auth guard, token, and password-handling flows end-to-end",
	}),
	Object.freeze({
		name: "code-hygiene-auditor",
		category: "parallel" as const,
		domain: "Unused code, unreachable branches, debug artifacts, and silent failure patterns",
		catches: Object.freeze([
			"Unused imports",
			"Orphaned functions",
			"Unreachable branches",
			"Empty catch blocks",
			"Silent fallbacks that hide failures",
			"Console.log/debugger",
			"Commented-out code",
		]),
		triggerSignals: Object.freeze([
			"Refactors",
			"Feature removals",
			"Large diffs",
			"New error handling or fallback logic",
		]),
		stackAffinity: Object.freeze(["universal"]),
		hardGatesSummary:
			"Checks all changed files for dead code, production leftovers, and error paths that fail silently instead of surfacing problems",
	}),
	Object.freeze({
		name: "architecture-verifier",
		category: "parallel" as const,
		domain: "End-to-end connectivity, scope and intent alignment, and requirement compliance",
		catches: Object.freeze([
			"Disconnected flows",
			"Broken cross-layer shape alignment",
			"Missing error propagation across layers",
			"Partial implementations",
			"Scope creep and unguided architectural surface area",
		]),
		triggerSignals: Object.freeze([
			"Changes span 2+ architectural layers",
			"New API endpoints",
			"Requirements-driven feature work",
			"New dependencies or architectural changes",
		]),
		stackAffinity: Object.freeze(["universal"]),
		hardGatesSummary:
			"Traces feature paths end-to-end, maps each change to the requested scope, and flags missing or extra architectural work",
	}),
	Object.freeze({
		name: "correctness-auditor",
		category: "parallel" as const,
		domain: "Type correctness, invariant design, async safety, concurrency safety",
		catches: Object.freeze([
			"Unsafe any usage",
			"Incorrect type narrowing",
			"Unsafe type assertions",
			"Race conditions",
			"Missing await or dropped promises",
			"Missing cancellation or cleanup",
		]),
		triggerSignals: Object.freeze([
			"New type definitions",
			"Complex async or concurrency code",
			"Type assertion usage",
			"Shared mutable state",
		]),
		stackAffinity: Object.freeze(["universal"]),
		hardGatesSummary:
			"Flags type escape hatches, traces async and concurrent execution paths, and verifies cleanup on every code path",
	}),
	Object.freeze({
		name: "frontend-auditor",
		category: "parallel" as const,
		domain: "Frontend framework rules, hooks/reactivity, state management, stale closures",
		catches: Object.freeze([
			"Hooks or lifecycle rule violations",
			"Stale closures",
			"Infinite re-render or reactive loops",
			"Derived state anti-patterns",
			"Hydration or server/client boundary mismatches",
			"Missing optimistic update rollback",
		]),
		triggerSignals: Object.freeze([
			"React/Next.js component changes",
			"Vue/Svelte/Angular reactive state changes",
			"Hooks, watchers, or store updates",
		]),
		stackAffinity: Object.freeze(["react", "nextjs", "vue", "svelte", "angular"]),
		hardGatesSummary:
			"Traces state from update to render, verifies framework rule compliance, and catches stale closures and hydration risks",
	}),
	Object.freeze({
		name: "language-idioms-auditor",
		category: "parallel" as const,
		domain: "Go idioms, Python or Django or FastAPI patterns, and Rust safety conventions",
		catches: Object.freeze([
			"defer-in-loop and goroutine leaks",
			"Nil interface or context misuse",
			"N+1 queries in templates or handlers",
			"Mutable default arguments",
			"Missing CSRF on cookie-based auth flows",
			"Unsafe Rust blocks without justification",
			"unwrap/expect in non-test Rust code",
			"Send/Sync or resource lifecycle misuse",
		]),
		triggerSignals: Object.freeze([
			"Go files in diff",
			"Django/FastAPI files in diff",
			"Rust files in diff",
			"Language-specific framework or runtime primitives",
		]),
		stackAffinity: Object.freeze(["go", "django", "fastapi", "rust"]),
		hardGatesSummary:
			"Applies stack-specific correctness checks for Go, Python web frameworks, and Rust that generic reviewers often miss",
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

export const CORE_SQUAD: readonly AgentDefinition[] = Object.freeze(
	AGENT_CATALOG.filter((a) => a.category === "core"),
);

export function getAgentsByCategory(category: AgentCategory): readonly AgentDefinition[] {
	return AGENT_CATALOG.filter((a) => a.category === category);
}
