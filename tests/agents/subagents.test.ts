import { describe, expect, test } from "bun:test";
import { dbSpecialistAgent } from "../../src/agents/db-specialist";
import { devopsAgent } from "../../src/agents/devops";
import { frontendEngineerAgent } from "../../src/agents/frontend-engineer";
import { securityAuditorAgent } from "../../src/agents/security-auditor";

const subagents = [
	{ name: "frontend-engineer", agent: frontendEngineerAgent, keyword: "frontend" },
	{ name: "db-specialist", agent: dbSpecialistAgent, keyword: "database" },
	{ name: "security-auditor", agent: securityAuditorAgent, keyword: "security" },
	{ name: "devops", agent: devopsAgent, keyword: "docker" },
] as const;

describe("Phase 25 subagent agents", () => {
	for (const { name, agent, keyword } of subagents) {
		describe(name, () => {
			test("mode is subagent (not in Tab cycle)", () => {
				expect(agent.mode).toBe("subagent");
			});

			test("is frozen (immutable)", () => {
				expect(Object.isFrozen(agent)).toBe(true);
			});

			test("has a non-empty description", () => {
				expect(typeof agent.description).toBe("string");
				expect((agent.description ?? "").length).toBeGreaterThan(0);
			});

			test(`prompt contains domain keyword "${keyword}"`, () => {
				const prompt = (agent.prompt ?? "").toLowerCase();
				expect(prompt).toContain(keyword);
			});

			test("prompt has production-ready length with embedded skills", () => {
				expect(typeof agent.prompt).toBe("string");
				expect((agent.prompt ?? "").length).toBeGreaterThanOrEqual(100);
			});

			test("webfetch is denied", () => {
				expect(agent.permission?.webfetch).toBe("deny");
			});

			test("bash is allowed", () => {
				expect(agent.permission?.bash).toBe("allow");
			});
		});
	}

	// Security-auditor has a unique permission: edit must be deny (audit-only)
	test("security-auditor denies edit (audit-only role)", () => {
		expect(securityAuditorAgent.permission?.edit).toBe("deny");
	});

	// Other 3 agents allow edit (they write code/configs)
	for (const { name, agent } of subagents.filter((s) => s.name !== "security-auditor")) {
		test(`${name} allows edit`, () => {
			expect(agent.permission?.edit).toBe("allow");
		});
	}
});
