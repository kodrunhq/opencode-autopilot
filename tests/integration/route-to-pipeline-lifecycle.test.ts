import type { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openProjectKernelDb } from "../../src/kernel/database";
import { resolveProjectIdentitySync } from "../../src/projects/resolve";
import { createRouteTicketRepository } from "../../src/routing/route-ticket-repository";
import { ocOrchestrate } from "../../src/tools/orchestrate";
import { ocRoute } from "../../src/tools/route";

interface RouteResponse {
	readonly action: string;
	readonly requiredPipelineArgs?: {
		readonly intent: string;
		readonly routeToken: string;
	};
}

interface OrchestrateResponse {
	readonly action: string;
	readonly code?: string;
}

interface RouteTicketRow {
	readonly routeToken: string;
	readonly consumedAt: string | null;
}

describe("Integration: oc_route → oc_orchestrate lifecycle", () => {
	let tempDir: string;
	let consoleLogCallCount: number;
	let consoleErrorCallCount: number;
	let originalConsoleLog: typeof console.log;
	let originalConsoleError: typeof console.error;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "route-pipeline-lifecycle-"));
		consoleLogCallCount = 0;
		consoleErrorCallCount = 0;
		originalConsoleLog = console.log;
		originalConsoleError = console.error;
		console.log = (..._args: Parameters<typeof console.log>): void => {
			consoleLogCallCount += 1;
		};
		console.error = (..._args: Parameters<typeof console.error>): void => {
			consoleErrorCallCount += 1;
		};
	});

	afterEach(async () => {
		console.log = originalConsoleLog;
		console.error = originalConsoleError;
		await rm(tempDir, { recursive: true, force: true });
	});

	test("end-to-end: oc_route → oc_orchestrate lifecycle", async () => {
		const routeContext: Parameters<typeof ocRoute.execute>[1] = {
			sessionID: "session-route-lifecycle",
			directory: tempDir,
			worktree: tempDir,
			messageID: "route-message-lifecycle",
		};

		const route = JSON.parse(
			await ocRoute.execute(
				{
					primaryIntent: "implementation",
					reasoning: "User asked to implement a feature end-to-end.",
					verbalization: "I detect implementation intent.",
				},
				routeContext,
			),
		) as RouteResponse;

		expect(route.action).toBe("route");
		const routeToken = route.requiredPipelineArgs?.routeToken;
		expect(typeof routeToken).toBe("string");
		if (!routeToken) {
			throw new Error("Expected oc_route to return requiredPipelineArgs.routeToken");
		}

		const orchestrateContext: Parameters<typeof ocOrchestrate.execute>[1] = {
			sessionID: routeContext.sessionID,
			directory: tempDir,
			worktree: tempDir,
			messageID: routeContext.messageID,
		};

		const orchestrateResult = JSON.parse(
			await ocOrchestrate.execute(
				{
					idea: "Implement the routed lifecycle integration flow",
					intent: "implementation",
					routeToken,
				},
				orchestrateContext,
			),
		) as OrchestrateResponse;

		expect(orchestrateResult.action).not.toBe("error");

		const projectKernelPath = join(tempDir, ".opencode-autopilot", "kernel.db");
		const rootKernelPath = join(tempDir, "kernel.db");
		expect(existsSync(projectKernelPath)).toBe(true);
		expect(existsSync(rootKernelPath)).toBe(false);

		let kernelDb: Database | null = null;
		try {
			kernelDb = openProjectKernelDb(tempDir, { readonly: true });
			const routeTicketRepo = createRouteTicketRepository(kernelDb);
			expect(routeTicketRepo.getValidTicket(routeToken)).toBeNull();

			const project = resolveProjectIdentitySync(tempDir, {
				db: kernelDb,
				allowCreate: false,
			});
			const routeTickets = kernelDb
				.query(
					`SELECT route_token as routeToken, consumed_at as consumedAt
					 FROM route_tickets
					 WHERE project_id = ?`,
				)
				.all(project.id) as RouteTicketRow[];

			expect(routeTickets.length).toBeGreaterThan(0);
			expect(
				routeTickets.some(
					(ticket) => ticket.routeToken === routeToken && ticket.consumedAt !== null,
				),
			).toBe(true);
		} finally {
			kernelDb?.close();
		}

		expect(consoleLogCallCount).toBe(0);
		expect(consoleErrorCallCount).toBe(0);
	});
});
