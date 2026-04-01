import { describe, expect, test } from "bun:test";
import { AGENT_CATALOG } from "../../src/review/agent-catalog";
import { applyStackGate, detectStackTags, STACK_GATE_RULES } from "../../src/review/stack-gate";

describe("STACK_GATE_RULES", () => {
	test("maps agent names to required tags", () => {
		expect(STACK_GATE_RULES["react-patterns-auditor"]).toBeDefined();
		expect(STACK_GATE_RULES["go-idioms-auditor"]).toBeDefined();
		expect(STACK_GATE_RULES["type-soundness"]).toBeDefined();
	});

	test("is frozen", () => {
		expect(Object.isFrozen(STACK_GATE_RULES)).toBe(true);
	});

	test("does not include core squad or ungated agents", () => {
		expect(STACK_GATE_RULES["logic-auditor"]).toBeUndefined();
		expect(STACK_GATE_RULES["security-auditor"]).toBeUndefined();
	});
});

describe("applyStackGate", () => {
	test("keeps type-soundness with typescript tags", () => {
		const result = applyStackGate(AGENT_CATALOG, ["typescript"]);
		expect(result.some((a) => a.name === "type-soundness")).toBe(true);
	});

	test("excludes go-idioms-auditor with typescript tags", () => {
		const result = applyStackGate(AGENT_CATALOG, ["typescript"]);
		expect(result.some((a) => a.name === "go-idioms-auditor")).toBe(false);
	});

	test("keeps react-patterns-auditor and state-mgmt-auditor with react tags", () => {
		const result = applyStackGate(AGENT_CATALOG, ["react"]);
		expect(result.some((a) => a.name === "react-patterns-auditor")).toBe(true);
		expect(result.some((a) => a.name === "state-mgmt-auditor")).toBe(true);
	});

	test("excludes react-patterns-auditor with python tags", () => {
		const result = applyStackGate(AGENT_CATALOG, ["python"]);
		expect(result.some((a) => a.name === "react-patterns-auditor")).toBe(false);
	});

	test("keeps ungated agents regardless of tags", () => {
		const result = applyStackGate(AGENT_CATALOG, ["python"]);
		expect(result.some((a) => a.name === "logic-auditor")).toBe(true);
		expect(result.some((a) => a.name === "security-auditor")).toBe(true);
		expect(result.some((a) => a.name === "wiring-inspector")).toBe(true);
	});

	test("keeps ungated agents even with empty tags", () => {
		const result = applyStackGate(AGENT_CATALOG, []);
		expect(result.some((a) => a.name === "logic-auditor")).toBe(true);
		expect(result.some((a) => a.name === "security-auditor")).toBe(true);
		// Gated agents should be excluded with empty tags
		expect(result.some((a) => a.name === "react-patterns-auditor")).toBe(false);
		expect(result.some((a) => a.name === "go-idioms-auditor")).toBe(false);
	});
});

describe("detectStackTags", () => {
	test("detects typescript from .ts files", () => {
		const tags = detectStackTags(["src/index.ts", "src/utils.ts"]);
		expect(tags).toContain("typescript");
	});

	test("detects react from .tsx files", () => {
		const tags = detectStackTags(["src/App.tsx", "src/components/Button.tsx"]);
		expect(tags).toContain("react");
		expect(tags).toContain("typescript");
	});

	test("detects go from .go files", () => {
		const tags = detectStackTags(["main.go", "handlers/api.go"]);
		expect(tags).toContain("go");
	});

	test("detects python from .py files", () => {
		const tags = detectStackTags(["app.py", "models.py"]);
		expect(tags).toContain("python");
	});

	test("detects rust from .rs files", () => {
		const tags = detectStackTags(["src/main.rs", "src/lib.rs"]);
		expect(tags).toContain("rust");
	});

	test("returns empty array for unknown extensions", () => {
		const tags = detectStackTags(["README.md", "data.csv"]);
		expect(tags).toHaveLength(0);
	});

	test("detects django from Django-specific files", () => {
		const tags = detectStackTags(["myapp/views.py", "myapp/models.py", "manage.py"]);
		expect(tags).toContain("python");
		expect(tags).toContain("django");
	});

	test("returns unique tags only", () => {
		const tags = detectStackTags(["a.ts", "b.ts", "c.ts"]);
		const unique = [...new Set(tags)];
		expect(tags.length).toBe(unique.length);
	});

	test("detects Next.js from next.config.js", () => {
		const tags = detectStackTags(["next.config.js"]);
		expect(tags).toContain("nextjs");
		expect(tags).toContain("react");
		expect(tags).toContain("javascript");
	});

	test("detects Next.js from next.config.ts", () => {
		const tags = detectStackTags(["next.config.ts"]);
		expect(tags).toContain("nextjs");
		expect(tags).toContain("react");
		expect(tags).toContain("typescript");
	});

	test("detects Angular from angular.json", () => {
		const tags = detectStackTags(["angular.json"]);
		expect(tags).toContain("angular");
		expect(tags).toContain("typescript");
	});

	test("detects Nuxt from nuxt.config.ts", () => {
		const tags = detectStackTags(["nuxt.config.ts"]);
		expect(tags).toContain("vue");
		expect(tags).toContain("typescript");
	});

	test("detects Svelte from svelte.config.js", () => {
		const tags = detectStackTags(["svelte.config.js"]);
		expect(tags).toContain("svelte");
		expect(tags).toContain("javascript");
	});

	test("detects FastAPI from path containing fastapi", () => {
		const tags = detectStackTags(["fastapi/router.py"]);
		expect(tags).toContain("python");
		expect(tags).toContain("fastapi");
	});

	test("does not detect FastAPI from plain .py file without fastapi in path", () => {
		const tags = detectStackTags(["app/main.py"]);
		expect(tags).toContain("python");
		expect(tags).not.toContain("fastapi");
	});
});
