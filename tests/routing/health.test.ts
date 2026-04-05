import { describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { routingHealthCheck } from "../../src/health/checks";

describe("routingHealthCheck", () => {
	test("passes for valid routing configuration", async () => {
		const tempDir = join(tmpdir(), `routing-health-pass-${Date.now()}`);
		await mkdir(tempDir, { recursive: true });
		const configPath = join(tempDir, "opencode-autopilot.json");
		await writeFile(
			configPath,
			JSON.stringify({
				version: 7,
				configured: true,
				groups: {},
				overrides: {},
				orchestrator: {},
				confidence: {},
				fallback: {},
				memory: {},
				background: {},
				autonomy: {},
				routing: {
					enabled: true,
					categories: {
						writing: {
							enabled: true,
							modelGroup: "communicators",
							skills: ["coding-standards"],
							metadata: {},
						},
					},
				},
				recovery: {},
				mcp: {},
			}),
		);

		const result = await routingHealthCheck(configPath);
		expect(result.status).toBe("pass");
		expect(result.name).toBe("routing-health");

		await rm(tempDir, { recursive: true, force: true });
	});

	test("fails for invalid routing override category names", async () => {
		const tempDir = join(tmpdir(), `routing-health-fail-${Date.now()}`);
		await mkdir(tempDir, { recursive: true });
		const configPath = join(tempDir, "opencode-autopilot.json");
		await writeFile(
			configPath,
			JSON.stringify({
				version: 7,
				configured: true,
				groups: {},
				overrides: {},
				orchestrator: {},
				confidence: {},
				fallback: {},
				memory: {},
				background: {},
				autonomy: {},
				routing: {
					enabled: true,
					categories: {
						invalid: {
							enabled: true,
							skills: [],
							metadata: {},
						},
					},
				},
				recovery: {},
				mcp: {},
			}),
		);

		const result = await routingHealthCheck(configPath);
		expect(result.status).toBe("fail");
		expect(result.details).toContain("Invalid routing override category 'invalid'");

		await rm(tempDir, { recursive: true, force: true });
	});
});
