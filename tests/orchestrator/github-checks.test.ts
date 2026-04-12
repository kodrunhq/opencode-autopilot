import { describe, expect, test } from "bun:test";
import { pollRequiredGitHubChecks } from "../../src/orchestrator/github-checks";

describe("pollRequiredGitHubChecks", () => {
	test("passes when all required checks succeed", async () => {
		const result = await pollRequiredGitHubChecks({
			prNumber: 42,
			projectRoot: "/tmp/project",
			runChecksCommand: async () => ({
				stdout: JSON.stringify([
					{ name: "test", state: "SUCCESS", workflow: "CI" },
					{ name: "lint", state: "SUCCESS", workflow: "CI" },
				]),
			}),
		});

		expect(result.status).toBe("PASSED");
		expect(result.summary).toContain("passed");
	});

	test("fails when any required check fails", async () => {
		const result = await pollRequiredGitHubChecks({
			prNumber: 42,
			projectRoot: "/tmp/project",
			runChecksCommand: async () => ({
				stdout: JSON.stringify([
					{ name: "test", state: "SUCCESS", workflow: "CI" },
					{ name: "deploy", state: "FAILURE", workflow: "CI" },
				]),
			}),
		});

		expect(result.status).toBe("FAILED");
		expect(result.summary).toContain("deploy");
	});

	test("returns pending after polling timeout when checks do not finish", async () => {
		let nowMs = 0;
		const result = await pollRequiredGitHubChecks({
			prNumber: 42,
			projectRoot: "/tmp/project",
			timeoutMs: 1,
			pollIntervalMs: 1,
			now: () => {
				nowMs += 10;
				return nowMs;
			},
			sleep: async () => undefined,
			runChecksCommand: async () => ({
				stdout: JSON.stringify([{ name: "test", state: "PENDING", workflow: "CI" }]),
			}),
		});

		expect(result.status).toBe("PENDING");
		expect(result.summary).toContain("pending");
	});

	test("blocks when GitHub checks cannot be queried", async () => {
		const result = await pollRequiredGitHubChecks({
			prNumber: 42,
			projectRoot: "/tmp/project",
			runChecksCommand: async () => {
				throw new Error("gh auth token missing");
			},
		});

		expect(result.status).toBe("BLOCKED");
		expect(result.summary).toContain("gh auth token missing");
	});
});
