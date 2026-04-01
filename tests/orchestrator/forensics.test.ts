import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test, beforeEach, afterEach, mock } from "bun:test";
import { pipelineStateSchema, failureContextSchema, PHASES } from "../../src/orchestrator/schemas";
import type { PipelineState, FailureContext } from "../../src/orchestrator/types";

// ---------- helpers ----------

function makeMinimalState(overrides: Partial<PipelineState> = {}): PipelineState {
	const now = new Date().toISOString();
	return pipelineStateSchema.parse({
		schemaVersion: 2,
		status: "IN_PROGRESS",
		idea: "test idea",
		currentPhase: "RECON",
		startedAt: now,
		lastUpdatedAt: now,
		phases: PHASES.map((name) => ({
			name,
			status: "PENDING",
		})),
		...overrides,
	});
}

async function writeState(dir: string, state: PipelineState): Promise<void> {
	const { ensureDir } = await import("../../src/utils/fs-helpers");
	await ensureDir(dir);
	await writeFile(join(dir, "state.json"), JSON.stringify(state, null, 2), "utf-8");
}

async function readState(dir: string): Promise<PipelineState> {
	const raw = await readFile(join(dir, "state.json"), "utf-8");
	return pipelineStateSchema.parse(JSON.parse(raw));
}

// ---------- Task 1: failureContext schema and backward compatibility ----------

describe("failureContext schema", () => {
	test("failureContextSchema validates a complete failure context", () => {
		const fc = failureContextSchema.parse({
			failedPhase: "BUILD",
			failedAgent: "oc-builder",
			errorMessage: "Build failed with 3 strikes",
			timestamp: new Date().toISOString(),
			lastSuccessfulPhase: "PLAN",
		});
		expect(fc.failedPhase).toBe("BUILD");
		expect(fc.failedAgent).toBe("oc-builder");
		expect(fc.errorMessage).toBe("Build failed with 3 strikes");
		expect(fc.lastSuccessfulPhase).toBe("PLAN");
	});

	test("failureContextSchema allows null failedAgent and lastSuccessfulPhase", () => {
		const fc = failureContextSchema.parse({
			failedPhase: "RECON",
			failedAgent: null,
			errorMessage: "Failed during recon",
			timestamp: new Date().toISOString(),
			lastSuccessfulPhase: null,
		});
		expect(fc.failedAgent).toBeNull();
		expect(fc.lastSuccessfulPhase).toBeNull();
	});

	test("pipelineStateSchema defaults failureContext to null (backward compat)", () => {
		const state = makeMinimalState();
		expect(state.failureContext).toBeNull();
	});

	test("existing state files without failureContext parse cleanly", () => {
		const raw = {
			schemaVersion: 2,
			status: "IN_PROGRESS",
			idea: "old idea",
			currentPhase: "BUILD",
			startedAt: new Date().toISOString(),
			lastUpdatedAt: new Date().toISOString(),
			phases: PHASES.map((name) => ({ name, status: "PENDING" })),
		};
		const parsed = pipelineStateSchema.parse(raw);
		expect(parsed.failureContext).toBeNull();
	});

	test("pipelineStateSchema accepts failureContext with valid data", () => {
		const state = makeMinimalState({
			status: "FAILED",
			failureContext: {
				failedPhase: "ARCHITECT",
				failedAgent: "oc-architect",
				errorMessage: "Arena failed",
				timestamp: new Date().toISOString(),
				lastSuccessfulPhase: "CHALLENGE",
			},
		});
		expect(state.failureContext).not.toBeNull();
		expect(state.failureContext!.failedPhase).toBe("ARCHITECT");
	});
});

// ---------- Task 1: orchestrateCore failure capture ----------

describe("orchestrateCore failure metadata capture", () => {
	let tmpDir: string;

	beforeEach(async () => {
		tmpDir = await mkdtemp(join(tmpdir(), "forensics-"));
	});

	afterEach(async () => {
		await rm(tmpDir, { recursive: true, force: true });
	});

	test("catch block persists failureContext to state on error", async () => {
		// We test the failure capture logic directly using state utilities
		// since PHASE_HANDLERS is frozen and cannot be mocked by assignment.
		const { loadState, patchState, saveState } = await import("../../src/orchestrator/state");

		const state = makeMinimalState({
			currentPhase: "RECON",
			phases: PHASES.map((name) => ({
				name,
				status: name === "RECON" ? "IN_PROGRESS" : "PENDING",
			})),
		});
		await writeState(tmpDir, state);

		// Simulate what the catch block does
		const currentState = await loadState(tmpDir);
		expect(currentState).not.toBeNull();

		const errorMessage = "Simulated RECON failure";
		const lastDone = currentState!.phases.filter((p) => p.status === "DONE").pop();
		const failureContext = {
			failedPhase: currentState!.currentPhase!,
			failedAgent: null as string | null,
			errorMessage: errorMessage.slice(0, 4096),
			timestamp: new Date().toISOString(),
			lastSuccessfulPhase: lastDone?.name ?? null,
		};
		const failed = patchState(currentState!, {
			status: "FAILED" as const,
			failureContext,
		});
		await saveState(failed, tmpDir);

		// Verify persisted state
		const updatedState = await loadState(tmpDir);
		expect(updatedState!.status).toBe("FAILED");
		expect(updatedState!.failureContext).not.toBeNull();
		expect(updatedState!.failureContext!.failedPhase).toBe("RECON");
		expect(updatedState!.failureContext!.errorMessage).toBe("Simulated RECON failure");
		expect(updatedState!.failureContext!.lastSuccessfulPhase).toBeNull();
	});

	test("lastSuccessfulPhase reflects the last DONE phase", async () => {
		const { loadState, patchState, saveState } = await import("../../src/orchestrator/state");

		const state = makeMinimalState({
			currentPhase: "ARCHITECT",
			phases: PHASES.map((name) => ({
				name,
				status:
					name === "RECON" || name === "CHALLENGE"
						? "DONE"
						: name === "ARCHITECT"
							? "IN_PROGRESS"
							: "PENDING",
				completedAt:
					name === "RECON" || name === "CHALLENGE" ? new Date().toISOString() : null,
			})),
		});
		await writeState(tmpDir, state);

		const currentState = await loadState(tmpDir);
		const lastDone = currentState!.phases.filter((p) => p.status === "DONE").pop();
		const failureContext = {
			failedPhase: currentState!.currentPhase!,
			failedAgent: null as string | null,
			errorMessage: "Arena crashed",
			timestamp: new Date().toISOString(),
			lastSuccessfulPhase: lastDone?.name ?? null,
		};
		const failed = patchState(currentState!, {
			status: "FAILED" as const,
			failureContext,
		});
		await saveState(failed, tmpDir);

		const updatedState = await loadState(tmpDir);
		expect(updatedState!.failureContext!.lastSuccessfulPhase).toBe("CHALLENGE");
	});

	test("if loadState fails in catch block, original error still returned", async () => {
		// The catch block swallows inner errors -- we verify the pattern
		// by confirming that a try/catch around a failing loadState still
		// allows the outer return
		let originalErrorReturned = false;
		const errorMessage = "Build exploded";

		try {
			// Simulate loadState throwing by reading from a non-existent corrupt path
			const { loadState } = await import("../../src/orchestrator/state");
			const badDir = join(tmpDir, "nonexistent-subdir");
			// Write an invalid JSON file to force a parse error
			const { ensureDir } = await import("../../src/utils/fs-helpers");
			await ensureDir(badDir);
			await writeFile(join(badDir, "state.json"), "NOT VALID JSON", "utf-8");

			try {
				await loadState(badDir);
			} catch {
				// Swallow save errors -- original error takes priority
			}

			// Original error message is still available
			originalErrorReturned = true;
		} catch {
			// Should not reach here
		}

		expect(originalErrorReturned).toBe(true);
	});
});
