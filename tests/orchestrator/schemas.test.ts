import { describe, expect, test } from "bun:test";
import {
	confidenceEntrySchema,
	decisionEntrySchema,
	PHASES,
	pendingDispatchSchema,
	phaseSchema,
	phaseStatusSchema,
	pipelineStateSchema,
	taskSchema,
} from "../../src/orchestrator/schemas";
import type { PipelineState } from "../../src/orchestrator/types";
import { getProjectArtifactDir } from "../../src/utils/paths";

describe("phaseSchema", () => {
	test("parses valid phase RECON", () => {
		expect(phaseSchema.parse("RECON")).toBe("RECON");
	});

	test("parses all valid phases", () => {
		for (const phase of PHASES) {
			expect(phaseSchema.parse(phase)).toBe(phase);
		}
	});

	test("throws on invalid phase", () => {
		expect(() => phaseSchema.parse("INVALID")).toThrow();
	});
});

describe("PHASES", () => {
	test("contains exactly 8 phases", () => {
		expect(PHASES).toHaveLength(8);
	});

	test("is frozen (immutable)", () => {
		expect(Object.isFrozen(PHASES)).toBe(true);
	});
});

describe("phaseStatusSchema", () => {
	test("parses valid phase status", () => {
		const result = phaseStatusSchema.parse({
			name: "RECON",
			phaseNumber: 1,
			status: "PENDING",
		});
		expect(result.name).toBe("RECON");
		expect(result.phaseNumber).toBe(1);
		expect(result.status).toBe("PENDING");
		expect(result.completedAt).toBeNull();
		expect(result.confidence).toBeNull();
	});
});

describe("decisionEntrySchema", () => {
	test("parses valid decision entry", () => {
		const entry = {
			timestamp: "2026-03-31T00:00:00Z",
			phase: "RECON",
			agent: "researcher",
			decision: "Use Bun runtime",
			rationale: "Faster startup",
		};
		const result = decisionEntrySchema.parse(entry);
		expect(result.decision).toBe("Use Bun runtime");
	});

	test("throws on missing fields", () => {
		expect(() => decisionEntrySchema.parse({ timestamp: "x" })).toThrow();
	});
});

describe("confidenceEntrySchema", () => {
	test("parses valid confidence entry with HIGH level", () => {
		const entry = {
			timestamp: "2026-03-31T00:00:00Z",
			phase: "RECON",
			agent: "researcher",
			area: "tech-stack",
			level: "HIGH",
			rationale: "Well understood",
		};
		expect(confidenceEntrySchema.parse(entry).level).toBe("HIGH");
	});

	test("parses MEDIUM and LOW levels", () => {
		for (const level of ["MEDIUM", "LOW"] as const) {
			const entry = {
				timestamp: "2026-03-31T00:00:00Z",
				phase: "RECON",
				agent: "researcher",
				area: "tech-stack",
				level,
				rationale: "test",
			};
			expect(confidenceEntrySchema.parse(entry).level).toBe(level);
		}
	});

	test("throws on invalid level INVALID", () => {
		const entry = {
			timestamp: "2026-03-31T00:00:00Z",
			phase: "RECON",
			agent: "researcher",
			area: "tech-stack",
			level: "INVALID",
			rationale: "test",
		};
		expect(() => confidenceEntrySchema.parse(entry)).toThrow();
	});
});

describe("taskSchema", () => {
	test("parses task with default attempt and strike values", () => {
		const task = {
			id: 1,
			title: "Do thing",
			status: "PENDING",
			wave: 1,
		};
		const result = taskSchema.parse(task);
		expect(result.attempt).toBe(0);
		expect(result.strike).toBe(0);
	});

	test("parses task with explicit attempt and strike", () => {
		const task = {
			id: 2,
			title: "Other thing",
			status: "DONE",
			wave: 1,
			attempt: 3,
			strike: 1,
		};
		const result = taskSchema.parse(task);
		expect(result.attempt).toBe(3);
		expect(result.strike).toBe(1);
	});
});

describe("pendingDispatchSchema", () => {
	test("applies transactional result-handling defaults", () => {
		const pending = pendingDispatchSchema.parse({
			dispatchId: "dispatch_recon_1",
			phase: "RECON",
			agent: "oc-researcher",
			issuedAt: "2026-03-31T00:00:00Z",
		});

		expect(pending.status).toBe("PENDING");
		expect(pending.receivedResultId).toBeNull();
		expect(pending.receivedAt).toBeNull();
		expect(pending.callerSessionId).toBeNull();
		expect(pending.spawnedSessionId).toBeNull();
		expect(pending.sessionId).toBeNull();
	});

	test("aliases legacy sessionId into callerSessionId", () => {
		const pending = pendingDispatchSchema.parse({
			dispatchId: "dispatch_recon_legacy",
			phase: "RECON",
			agent: "oc-researcher",
			issuedAt: "2026-03-31T00:00:00Z",
			sessionId: "session-parent",
		});

		expect(pending.callerSessionId).toBe("session-parent");
		expect(pending.spawnedSessionId).toBeNull();
		expect(pending.sessionId).toBe("session-parent");
	});
});

describe("pipelineStateSchema", () => {
	test("parses valid complete state", () => {
		const state = {
			schemaVersion: 2,
			status: "IN_PROGRESS",
			runId: "run_1234567890abcdef",
			idea: "build a chat app",
			currentPhase: "RECON",
			startedAt: "2026-03-31T00:00:00Z",
			lastUpdatedAt: "2026-03-31T00:00:00Z",
			phases: [
				{ name: "RECON", phaseNumber: 1, status: "IN_PROGRESS" },
				{ name: "CHALLENGE", phaseNumber: 2, status: "PENDING" },
				{ name: "ARCHITECT", phaseNumber: 3, status: "PENDING" },
				{ name: "EXPLORE", phaseNumber: 4, status: "PENDING" },
				{ name: "PLAN", phaseNumber: 5, status: "PENDING" },
				{ name: "BUILD", phaseNumber: 6, status: "PENDING" },
				{ name: "SHIP", phaseNumber: 7, status: "PENDING" },
				{ name: "RETROSPECTIVE", phaseNumber: 8, status: "PENDING" },
			],
		};
		const result = pipelineStateSchema.parse(state);
		expect(result.runId).toBe("run_1234567890abcdef");
		expect(result.decisions).toEqual([]);
		expect(result.confidence).toEqual([]);
		expect(result.tasks).toEqual([]);
		expect(result.arenaConfidence).toBeNull();
		expect(result.exploreTriggered).toBe(false);
		expect(result.reviewStatus.status).toBe("IDLE");
	});

	test("throws on invalid state (wrong schemaVersion)", () => {
		const state = {
			schemaVersion: 1,
			status: "IN_PROGRESS",
			runId: "run_4567890abcdef123",
			idea: "test",
			currentPhase: "RECON",
			startedAt: "2026-03-31T00:00:00Z",
			lastUpdatedAt: "2026-03-31T00:00:00Z",
			phases: [],
		};
		expect(() => pipelineStateSchema.parse(state)).toThrow();
	});

	test("throws on invalid runId format with spaces", () => {
		const state = {
			schemaVersion: 2,
			status: "IN_PROGRESS",
			runId: "invalid run id with spaces",
			idea: "test",
			currentPhase: "RECON",
			startedAt: "2026-03-31T00:00:00Z",
			lastUpdatedAt: "2026-03-31T00:00:00Z",
			phases: [],
		};
		expect(() => pipelineStateSchema.parse(state)).toThrow(
			/runId must be alphanumeric with hyphens or underscores/,
		);
	});

	test("accepts legacy runId format", () => {
		const state = {
			schemaVersion: 2,
			status: "IN_PROGRESS",
			runId: "legacy-run",
			idea: "test",
			currentPhase: "RECON",
			startedAt: "2026-03-31T00:00:00Z",
			lastUpdatedAt: "2026-03-31T00:00:00Z",
			phases: [],
		};
		const result = pipelineStateSchema.parse(state);
		expect(result.runId).toBe("legacy-run");
	});

	test("generates runId when not provided", () => {
		const state = {
			schemaVersion: 2,
			status: "IN_PROGRESS",
			idea: "test",
			currentPhase: "RECON",
			startedAt: "2026-03-31T00:00:00Z",
			lastUpdatedAt: "2026-03-31T00:00:00Z",
			phases: [],
		};
		const result = pipelineStateSchema.parse(state);
		expect(result.runId).toMatch(/^run_[a-f0-9]{16}$/);
	});

	test("accepts partial state with empty decisions/confidence via defaults", () => {
		const state = {
			schemaVersion: 2,
			status: "NOT_STARTED",
			runId: "run_7890abcdef123456",
			idea: "minimal",
			currentPhase: null,
			startedAt: "2026-03-31T00:00:00Z",
			lastUpdatedAt: "2026-03-31T00:00:00Z",
			phases: [],
		};
		const result = pipelineStateSchema.parse(state);
		expect(result.runId).toBe("run_7890abcdef123456");
		expect(result.decisions).toEqual([]);
		expect(result.confidence).toEqual([]);
		expect(result.tasks).toEqual([]);
		expect(result.programContext).toBeNull();
	});

	test("returns typed PipelineState", () => {
		const state = {
			schemaVersion: 2,
			status: "IN_PROGRESS",
			runId: "run_typedtestabcdef",
			idea: "typed test",
			currentPhase: "RECON",
			startedAt: "2026-03-31T00:00:00Z",
			lastUpdatedAt: "2026-03-31T00:00:00Z",
			phases: [],
		};
		const result: PipelineState = pipelineStateSchema.parse(state);
		expect(result.runId).toBe("run_typedtestabcdef");
		expect(result.idea).toBe("typed test");
	});

	test("parses optional program context for autonomous tranche runs", () => {
		const state = {
			schemaVersion: 2,
			status: "IN_PROGRESS",
			runId: "run_programtestabcdef",
			idea: "focused tranche",
			currentPhase: "RECON",
			startedAt: "2026-03-31T00:00:00Z",
			lastUpdatedAt: "2026-03-31T00:00:00Z",
			phases: [],
			programContext: {
				programId: "program_123",
				trancheId: "tranche_01",
				trancheTitle: "Persist program state",
				trancheIndex: 1,
				trancheCount: 3,
				selectionRationale: "Selected automatically because it has no unmet dependencies.",
				originatingRequest: "Implement the remediation plan.",
				mode: "autonomous",
			},
		};
		const result = pipelineStateSchema.parse(state);
		expect(result.programContext?.programId).toBe("program_123");
		expect(result.programContext?.trancheCount).toBe(3);
	});
});

describe("getProjectArtifactDir", () => {
	test("returns .opencode-autopilot path relative to project root", () => {
		expect(getProjectArtifactDir("/home/user/project")).toBe(
			"/home/user/project/.opencode-autopilot",
		);
	});
});
