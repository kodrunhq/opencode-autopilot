import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadLatestPipelineStateFromKernel } from "../../src/kernel/repository";
import {
	appendDecision,
	createInitialState,
	isStateConflictError,
	loadState,
	patchState,
	saveState,
	updatePersistedState,
} from "../../src/orchestrator/state";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "state-test-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("createInitialState", () => {
	test("returns valid PipelineState with idea set", () => {
		const state = createInitialState("build a chat app");
		expect(state.idea).toBe("build a chat app");
		expect(state.schemaVersion).toBe(2);
		expect(state.status).toBe("IN_PROGRESS");
		expect(state.currentPhase).toBe("RECON");
	});

	test("creates 8 phases with RECON as IN_PROGRESS and rest PENDING", () => {
		const state = createInitialState("test");
		expect(state.phases).toHaveLength(8);
		expect(state.phases[0].name).toBe("RECON");
		expect(state.phases[0].status).toBe("IN_PROGRESS");
		for (let i = 1; i < 8; i++) {
			expect(state.phases[i].status).toBe("PENDING");
		}
	});

	test("initializes empty decisions, confidence, and tasks arrays", () => {
		const state = createInitialState("test");
		expect(state.decisions).toEqual([]);
		expect(state.confidence).toEqual([]);
		expect(state.tasks).toEqual([]);
	});
});

describe("saveState + loadState round-trip", () => {
	test("produces identical object", async () => {
		const original = createInitialState("round-trip test");
		await saveState(original, tempDir);
		const loaded = await loadState(tempDir);
		expect(loaded).toEqual(original);
		expect(loadLatestPipelineStateFromKernel(tempDir)).toEqual(original);
	});
});

describe("loadState", () => {
	test("returns null when file does not exist", async () => {
		const result = await loadState(join(tempDir, "nonexistent"));
		expect(result).toBeNull();
	});

	test("throws on invalid JSON", async () => {
		const statePath = join(tempDir, "state.json");
		const { writeFile: wf } = await import("node:fs/promises");
		await wf(statePath, "not json{{{", "utf-8");
		expect(loadState(tempDir)).rejects.toThrow();
	});

	test("throws on invalid schema (wrong schemaVersion)", async () => {
		const statePath = join(tempDir, "state.json");
		const { writeFile: wf } = await import("node:fs/promises");
		await wf(statePath, JSON.stringify({ schemaVersion: 1, idea: "bad" }), "utf-8");
		expect(loadState(tempDir)).rejects.toThrow();
	});
});

describe("patchState", () => {
	test("returns new object with updated fields and fresh lastUpdatedAt", () => {
		const original = {
			...createInitialState("patch test"),
			lastUpdatedAt: "2020-01-01T00:00:00.000Z",
		};
		const patched = patchState(original, { status: "COMPLETED" });
		expect(patched.status).toBe("COMPLETED");
		expect(patched.idea).toBe("patch test");
		expect(patched.lastUpdatedAt).not.toBe("2020-01-01T00:00:00.000Z");
	});

	test("does not mutate original", () => {
		const original = createInitialState("immutable test");
		const originalStatus = original.status;
		patchState(original, { status: "FAILED" });
		expect(original.status).toBe(originalStatus);
	});
});

describe("appendDecision", () => {
	test("returns new state with decision added to end of decisions array", () => {
		const original = createInitialState("decision test");
		const updated = appendDecision(original, {
			phase: "RECON",
			agent: "researcher",
			decision: "Use TypeScript",
			rationale: "Type safety",
		});
		expect(updated.decisions).toHaveLength(1);
		expect(updated.decisions[0].decision).toBe("Use TypeScript");
		expect(updated.decisions[0].phase).toBe("RECON");
	});

	test("auto-sets timestamp", () => {
		const original = createInitialState("timestamp test");
		const updated = appendDecision(original, {
			phase: "RECON",
			agent: "researcher",
			decision: "Test",
			rationale: "Test",
		});
		expect(updated.decisions[0].timestamp).toBeTruthy();
		expect(typeof updated.decisions[0].timestamp).toBe("string");
	});

	test("does not mutate original", () => {
		const original = createInitialState("no-mutate test");
		appendDecision(original, {
			phase: "RECON",
			agent: "researcher",
			decision: "Test",
			rationale: "Test",
		});
		expect(original.decisions).toHaveLength(0);
	});
});

describe("saveState atomicity", () => {
	test("uses atomic write (temp file then rename)", async () => {
		const state = createInitialState("atomic test");
		await saveState(state, tempDir);
		// Verify the compatibility mirror exists and is valid
		const raw = await readFile(join(tempDir, "state.json"), "utf-8");
		const parsed = JSON.parse(raw);
		expect(parsed.idea).toBe("atomic test");
		expect(loadLatestPipelineStateFromKernel(tempDir)?.idea).toBe("atomic test");
	});

	test("calls ensureDir before writing", async () => {
		const nested = join(tempDir, "nested", "deep");
		const state = createInitialState("nested test");
		await saveState(state, nested);
		const loaded = await loadState(nested);
		expect(loaded).not.toBeNull();
		expect(loaded?.idea).toBe("nested test");
	});

	test("throws state conflict when expected revision does not match", async () => {
		const initial = createInitialState("conflict test");
		await saveState(initial, tempDir);
		const advanced = patchState(initial, { exploreTriggered: true });

		await expect(saveState(advanced, tempDir, 99)).rejects.toThrow("E_STATE_CONFLICT");
	});

	test("updatePersistedState retries on revision conflict with latest state", async () => {
		const initial = createInitialState("retry test");
		await saveState(initial, tempDir);

		const stale = initial;
		const newer = patchState(initial, { exploreTriggered: true });
		await saveState(newer, tempDir, initial.stateRevision);

		const updated = await updatePersistedState(tempDir, stale, (current) =>
			appendDecision(current, {
				phase: current.currentPhase ?? "RECON",
				agent: "tester",
				decision: "retry",
				rationale: "conflict recovery",
			}),
		);

		expect(updated.exploreTriggered).toBe(true);
		expect(updated.decisions).toHaveLength(1);
		expect(updated.stateRevision).toBe(newer.stateRevision + 1);

		const loaded = await loadState(tempDir);
		expect(loaded).toEqual(updated);
	});

	test("isStateConflictError matches revision conflict errors", async () => {
		const state = createInitialState("guard test");
		await saveState(state, tempDir);

		let error: unknown = null;
		try {
			await saveState(patchState(state, { exploreTriggered: true }), tempDir, 99);
		} catch (caught: unknown) {
			error = caught;
		}

		expect(isStateConflictError(error)).toBe(true);
		expect(isStateConflictError(new Error("different"))).toBe(false);
	});
});
