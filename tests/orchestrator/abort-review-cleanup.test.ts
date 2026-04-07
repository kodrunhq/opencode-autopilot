import { describe, expect, mock, test } from "bun:test";

const mockClearReviewState = mock(() => Promise.resolve());
const mockReviewCore = mock(() => Promise.resolve(JSON.stringify({ action: "error" })));
const mockLoadState = mock(() => Promise.resolve(null));
const mockCreateInitialState = mock(() => ({ currentPhase: null }) as never);
const mockIsStateConflictError = mock(() => false);
const mockPatchState = mock((state: unknown) => state);
const mockSaveState = mock(() => {
	const error = new Error("operation aborted");
	error.name = "AbortError";
	throw error;
});
const mockUpdatePersistedState = mock(() => Promise.resolve({} as never));

mock.module("../../src/tools/review", () => ({
	clearReviewState: mockClearReviewState,
	reviewCore: mockReviewCore,
}));

mock.module("../../src/orchestrator/state", () => ({
	createInitialState: mockCreateInitialState,
	isStateConflictError: mockIsStateConflictError,
	loadState: mockLoadState,
	patchState: mockPatchState,
	saveState: mockSaveState,
	updatePersistedState: mockUpdatePersistedState,
}));

mock.module("../../src/utils/gitignore", () => ({
	ensureGitignore: mock(() => Promise.resolve()),
}));

import { orchestrateCore } from "../../src/tools/orchestrate";

describe("orchestrateCore abort cleanup", () => {
	test("clears stale review state when interrupted", async () => {
		const artifactDir = "/tmp/opencode-artifacts";

		const result = JSON.parse(
			await orchestrateCore({ idea: "build something", intent: "implementation" }, artifactDir),
		);

		expect(result).toEqual({
			action: "error",
			code: "E_INTERRUPTED",
			message: "operation aborted",
		});
		expect(mockClearReviewState).toHaveBeenCalledWith(artifactDir);
	});
});
