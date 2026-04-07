import { describe, expect, test } from "bun:test";
import {
	ensurePhaseDir,
	getArtifactRef,
	getPhaseDir,
	listRuns,
	PHASE_ARTIFACTS,
} from "../src/orchestrator/artifacts";
import type { DispatchResult } from "../src/orchestrator/handlers/types";
import { AGENT_NAMES } from "../src/orchestrator/handlers/types";
import { buildProgressSchema, pipelineStateSchema } from "../src/orchestrator/schemas";

describe("getPhaseDir", () => {
	test("returns correct path for a phase", () => {
		expect(getPhaseDir("./artifacts", "RECON")).toBe("artifacts/phases/RECON");
	});

	test("returns correct path for BUILD phase", () => {
		expect(getPhaseDir("/tmp/project/.opencode-autopilot", "BUILD")).toBe(
			"/tmp/project/.opencode-autopilot/phases/BUILD",
		);
	});

	test("returns flat path when runId is undefined", () => {
		expect(getPhaseDir("./artifacts", "RECON")).toBe("artifacts/phases/RECON");
	});

	test("returns flat path when runId is legacy-run", () => {
		expect(getPhaseDir("./artifacts", "RECON", "legacy-run")).toBe("artifacts/phases/RECON");
	});

	test("returns run-scoped path with real runId", () => {
		expect(getPhaseDir("./artifacts", "RECON", "run_abc123")).toBe(
			"artifacts/phases/run_abc123/RECON",
		);
	});
});

describe("getArtifactRef", () => {
	test("returns absolute path under artifactDir for RECON report", () => {
		expect(getArtifactRef("/project/.opencode-autopilot", "RECON", "report.md")).toBe(
			"/project/.opencode-autopilot/phases/RECON/report.md",
		);
	});

	test("returns absolute path under artifactDir for SHIP changelog", () => {
		expect(getArtifactRef("/project/.opencode-autopilot", "SHIP", "changelog.md")).toBe(
			"/project/.opencode-autopilot/phases/SHIP/changelog.md",
		);
	});

	test("prompt path matches handler check path (no path mismatch)", () => {
		const artifactDir = "/project/.opencode-autopilot";
		const ref = getArtifactRef(artifactDir, "ARCHITECT", "design.md");
		const checkPath = `${getPhaseDir(artifactDir, "ARCHITECT")}/design.md`;
		expect(ref).toBe(checkPath);
	});

	test("returns run-scoped artifact path", () => {
		expect(getArtifactRef("/project/.oca", "RECON", "report.md", "run_abc123")).toBe(
			"/project/.oca/phases/run_abc123/RECON/report.md",
		);
	});

	test("returns flat artifact path for legacy-run", () => {
		expect(getArtifactRef("/project/.oca", "RECON", "report.md", "legacy-run")).toBe(
			"/project/.oca/phases/RECON/report.md",
		);
	});
});

describe("ensurePhaseDir", () => {
	test("creates directory and returns path", async () => {
		const tmpDir = `/tmp/test-artifacts-${Date.now()}`;
		const result = await ensurePhaseDir(tmpDir, "RECON");
		expect(result).toBe(`${tmpDir}/phases/RECON`);
		// Verify directory was created
		const { existsSync } = await import("node:fs");
		expect(existsSync(result)).toBe(true);
	});

	test("creates run-scoped directory", async () => {
		const tmpDir = `/tmp/test-artifacts-runscoped-${Date.now()}`;
		const result = await ensurePhaseDir(tmpDir, "RECON", "run_abc123");
		expect(result).toBe(`${tmpDir}/phases/run_abc123/RECON`);
		const { existsSync } = await import("node:fs");
		expect(existsSync(result)).toBe(true);
	});
});

describe("listRuns", () => {
	test("returns empty array when phases dir does not exist", async () => {
		const runs = await listRuns("/nonexistent/path");
		expect(runs).toEqual([]);
	});

	test("returns run IDs from phases directory", async () => {
		const tmpDir = `/tmp/test-listruns-${Date.now()}`;
		const { mkdirSync } = await import("node:fs");
		mkdirSync(`${tmpDir}/phases/run_aaa`, { recursive: true });
		mkdirSync(`${tmpDir}/phases/run_bbb`, { recursive: true });
		mkdirSync(`${tmpDir}/phases/RECON`, { recursive: true });
		const runs = await listRuns(tmpDir);
		expect(runs).toEqual(["run_aaa", "run_bbb"]);
	});
});

describe("PHASE_ARTIFACTS", () => {
	test("has entries for all 8 phases", () => {
		const phases = [
			"RECON",
			"CHALLENGE",
			"ARCHITECT",
			"EXPLORE",
			"PLAN",
			"BUILD",
			"SHIP",
			"RETROSPECTIVE",
		];
		for (const phase of phases) {
			expect(PHASE_ARTIFACTS).toHaveProperty(phase);
			expect(Array.isArray(PHASE_ARTIFACTS[phase])).toBe(true);
		}
	});

	test("RECON has report.md", () => {
		expect(PHASE_ARTIFACTS.RECON).toContain("report.md");
	});

	test("SHIP has walkthrough, decisions, changelog", () => {
		expect(PHASE_ARTIFACTS.SHIP).toContain("walkthrough.md");
		expect(PHASE_ARTIFACTS.SHIP).toContain("decisions.md");
		expect(PHASE_ARTIFACTS.SHIP).toContain("changelog.md");
	});
});

describe("AGENT_NAMES", () => {
	test("is frozen", () => {
		expect(Object.isFrozen(AGENT_NAMES)).toBe(true);
	});

	test("maps all pipeline phases to agent names", () => {
		expect(AGENT_NAMES.RECON).toBe("oc-researcher");
		expect(AGENT_NAMES.CHALLENGE).toBe("oc-challenger");
		expect(AGENT_NAMES.ARCHITECT).toBe("oc-architect");
		expect(AGENT_NAMES.CRITIC).toBe("oc-critic");
		expect(AGENT_NAMES.EXPLORE).toBe("oc-researcher");
		expect(AGENT_NAMES.PLAN).toBe("oc-planner");
		expect(AGENT_NAMES.BUILD).toBe("oc-implementer");
		expect(AGENT_NAMES.SHIP).toBe("oc-shipper");
		expect(AGENT_NAMES.RETROSPECTIVE).toBe("oc-shipper");
	});
});

describe("DispatchResult type", () => {
	test("accepts dispatch action", () => {
		const result: DispatchResult = {
			action: "dispatch",
			agent: "oc-researcher",
			prompt: "Research this",
			phase: "RECON",
		};
		expect(result.action).toBe("dispatch");
	});

	test("accepts complete action", () => {
		const result: DispatchResult = {
			action: "complete",
			message: "Pipeline finished",
		};
		expect(result.action).toBe("complete");
	});

	test("accepts error action", () => {
		const result: DispatchResult = {
			action: "error",
			message: "Something failed",
		};
		expect(result.action).toBe("error");
	});

	test("accepts dispatch_multi action", () => {
		const result: DispatchResult = {
			action: "dispatch_multi",
			agents: [
				{ agent: "oc-architect", prompt: "Proposal 1" },
				{ agent: "oc-architect", prompt: "Proposal 2" },
			],
			phase: "ARCHITECT",
		};
		expect(result.action).toBe("dispatch_multi");
		expect(result.agents).toHaveLength(2);
	});
});

describe("buildProgressSchema", () => {
	test("parses default values correctly", () => {
		const result = buildProgressSchema.parse({});
		expect(result).toEqual({
			currentTask: null,
			currentTasks: [],
			currentWave: null,
			attemptCount: 0,
			strikeCount: 0,
			reviewPending: false,
		});
	});

	test("parses explicit values", () => {
		const result = buildProgressSchema.parse({
			currentTask: 3,
			currentWave: 2,
			attemptCount: 1,
			strikeCount: 0,
			reviewPending: true,
		});
		expect(result.currentTask).toBe(3);
		expect(result.currentWave).toBe(2);
		expect(result.reviewPending).toBe(true);
	});
});

describe("pipelineStateSchema with buildProgress", () => {
	test("parses valid state with buildProgress", () => {
		const state = {
			schemaVersion: 2,
			status: "IN_PROGRESS",
			idea: "Build a CLI tool",
			currentPhase: "BUILD",
			startedAt: "2026-01-01T00:00:00Z",
			lastUpdatedAt: "2026-01-01T00:00:00Z",
			phases: [],
			buildProgress: {
				currentTask: 1,
				currentWave: 1,
				attemptCount: 0,
				strikeCount: 0,
				reviewPending: false,
			},
		};
		const result = pipelineStateSchema.parse(state);
		expect(result.buildProgress.currentTask).toBe(1);
	});

	test("accepts INTERRUPTED status", () => {
		const state = {
			schemaVersion: 2,
			status: "INTERRUPTED",
			idea: "Test idea",
			currentPhase: "BUILD",
			startedAt: "2026-01-01T00:00:00Z",
			lastUpdatedAt: "2026-01-01T00:00:00Z",
			phases: [],
		};
		const result = pipelineStateSchema.parse(state);
		expect(result.status).toBe("INTERRUPTED");
	});

	test("defaults buildProgress when omitted", () => {
		const state = {
			schemaVersion: 2,
			status: "NOT_STARTED",
			idea: "Test idea",
			currentPhase: null,
			startedAt: "2026-01-01T00:00:00Z",
			lastUpdatedAt: "2026-01-01T00:00:00Z",
			phases: [],
		};
		const result = pipelineStateSchema.parse(state);
		expect(result.buildProgress).toEqual({
			currentTask: null,
			currentTasks: [],
			currentWave: null,
			attemptCount: 0,
			strikeCount: 0,
			reviewPending: false,
		});
	});
});
