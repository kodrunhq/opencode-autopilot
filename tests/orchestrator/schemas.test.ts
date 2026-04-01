import { describe, expect, test } from "bun:test";
import {
	confidenceEntrySchema,
	decisionEntrySchema,
	PHASES,
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
			status: "PENDING",
		});
		expect(result.name).toBe("RECON");
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

describe("pipelineStateSchema", () => {
	test("parses valid complete state", () => {
		const state = {
			schemaVersion: 2,
			status: "IN_PROGRESS",
			idea: "build a chat app",
			currentPhase: "RECON",
			startedAt: "2026-03-31T00:00:00Z",
			lastUpdatedAt: "2026-03-31T00:00:00Z",
			phases: [
				{ name: "RECON", status: "IN_PROGRESS" },
				{ name: "CHALLENGE", status: "PENDING" },
				{ name: "ARCHITECT", status: "PENDING" },
				{ name: "EXPLORE", status: "PENDING" },
				{ name: "PLAN", status: "PENDING" },
				{ name: "BUILD", status: "PENDING" },
				{ name: "SHIP", status: "PENDING" },
				{ name: "RETROSPECTIVE", status: "PENDING" },
			],
		};
		const result = pipelineStateSchema.parse(state);
		expect(result.decisions).toEqual([]);
		expect(result.confidence).toEqual([]);
		expect(result.tasks).toEqual([]);
		expect(result.arenaConfidence).toBeNull();
		expect(result.exploreTriggered).toBe(false);
	});

	test("throws on invalid state (wrong schemaVersion)", () => {
		const state = {
			schemaVersion: 1,
			status: "IN_PROGRESS",
			idea: "test",
			currentPhase: "RECON",
			startedAt: "2026-03-31T00:00:00Z",
			lastUpdatedAt: "2026-03-31T00:00:00Z",
			phases: [],
		};
		expect(() => pipelineStateSchema.parse(state)).toThrow();
	});

	test("accepts partial state with empty decisions/confidence via defaults", () => {
		const state = {
			schemaVersion: 2,
			status: "NOT_STARTED",
			idea: "minimal",
			currentPhase: null,
			startedAt: "2026-03-31T00:00:00Z",
			lastUpdatedAt: "2026-03-31T00:00:00Z",
			phases: [],
		};
		const result = pipelineStateSchema.parse(state);
		expect(result.decisions).toEqual([]);
		expect(result.confidence).toEqual([]);
		expect(result.tasks).toEqual([]);
	});

	test("returns typed PipelineState", () => {
		const state = {
			schemaVersion: 2,
			status: "IN_PROGRESS",
			idea: "typed test",
			currentPhase: "RECON",
			startedAt: "2026-03-31T00:00:00Z",
			lastUpdatedAt: "2026-03-31T00:00:00Z",
			phases: [],
		};
		const result: PipelineState = pipelineStateSchema.parse(state);
		expect(result.idea).toBe("typed test");
	});
});

describe("getProjectArtifactDir", () => {
	test("returns .opencode-autopilot path relative to project root", () => {
		expect(getProjectArtifactDir("/home/user/project")).toBe(
			"/home/user/project/.opencode-autopilot",
		);
	});
});
