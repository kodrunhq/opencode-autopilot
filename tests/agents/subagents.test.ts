import { describe, expect, test } from "bun:test";
import { securityAuditorAgent } from "../../src/agents/security-auditor";

describe("Phase 25 subagent agents", () => {
	describe("security-auditor", () => {
		test("mode is subagent (not in Tab cycle)", () => {
			expect(securityAuditorAgent.mode).toBe("subagent");
		});

		test("is frozen (immutable)", () => {
			expect(Object.isFrozen(securityAuditorAgent)).toBe(true);
		});

		test("has a non-empty description", () => {
			expect(typeof securityAuditorAgent.description).toBe("string");
			expect((securityAuditorAgent.description ?? "").length).toBeGreaterThan(0);
		});

		test('prompt contains domain keyword "security"', () => {
			const prompt = (securityAuditorAgent.prompt ?? "").toLowerCase();
			expect(prompt).toContain("security");
		});

		test("prompt has production-ready length", () => {
			expect(typeof securityAuditorAgent.prompt).toBe("string");
			expect((securityAuditorAgent.prompt ?? "").length).toBeGreaterThanOrEqual(100);
		});

		test("webfetch is denied", () => {
			expect(securityAuditorAgent.permission?.webfetch).toBe("deny");
		});

		test("bash is allowed", () => {
			expect(securityAuditorAgent.permission?.bash).toBe("allow");
		});

		test("edit is denied (audit-only role)", () => {
			expect(securityAuditorAgent.permission?.edit).toBe("deny");
		});
	});
});
