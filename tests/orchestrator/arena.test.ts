import { describe, expect, test } from "bun:test";
import { getDebateDepth, shouldTriggerExplorer } from "../../src/orchestrator/arena";
import type { ConfidenceEntry } from "../../src/orchestrator/types";

type ConfidenceLevel = ConfidenceEntry["level"];

function makeEntry(overrides: Partial<ConfidenceEntry> = {}): ConfidenceEntry {
	return {
		timestamp: "2026-03-31T00:00:00Z",
		phase: "RECON",
		agent: "researcher",
		area: "tech-stack",
		level: "HIGH",
		rationale: "test",
		...overrides,
	};
}

describe("getDebateDepth", () => {
	test("dominant LOW confidence returns depth 3", () => {
		const entries: readonly ConfidenceEntry[] = [
			makeEntry({ level: "LOW" as ConfidenceLevel }),
			makeEntry({ level: "LOW" as ConfidenceLevel }),
			makeEntry({ level: "HIGH" as ConfidenceLevel }),
		];
		expect(getDebateDepth(entries)).toBe(3);
	});

	test("dominant MEDIUM confidence returns depth 2", () => {
		const entries: readonly ConfidenceEntry[] = [
			makeEntry({ level: "MEDIUM" as ConfidenceLevel }),
			makeEntry({ level: "MEDIUM" as ConfidenceLevel }),
			makeEntry({ level: "HIGH" as ConfidenceLevel }),
		];
		expect(getDebateDepth(entries)).toBe(2);
	});

	test("dominant HIGH confidence returns depth 1", () => {
		const entries: readonly ConfidenceEntry[] = [
			makeEntry({ level: "HIGH" as ConfidenceLevel }),
			makeEntry({ level: "HIGH" as ConfidenceLevel }),
			makeEntry({ level: "LOW" as ConfidenceLevel }),
		];
		expect(getDebateDepth(entries)).toBe(1);
	});

	test("empty entries returns depth 1 (default HIGH dominant — fast path)", () => {
		expect(getDebateDepth([])).toBe(1);
	});
});

describe("shouldTriggerExplorer", () => {
	test("returns true when any entry is below threshold", () => {
		const entries: readonly ConfidenceEntry[] = [
			makeEntry({ level: "HIGH" as ConfidenceLevel }),
			makeEntry({ level: "LOW" as ConfidenceLevel }),
		];
		expect(shouldTriggerExplorer(entries, "MEDIUM")).toBe(true);
	});

	test("returns false when all entries are at or above threshold", () => {
		const entries: readonly ConfidenceEntry[] = [
			makeEntry({ level: "HIGH" as ConfidenceLevel }),
			makeEntry({ level: "MEDIUM" as ConfidenceLevel }),
		];
		expect(shouldTriggerExplorer(entries, "MEDIUM")).toBe(false);
	});

	test("returns false with empty entries", () => {
		expect(shouldTriggerExplorer([], "MEDIUM")).toBe(false);
	});

	test("HIGH threshold triggers on MEDIUM entries", () => {
		const entries: readonly ConfidenceEntry[] = [makeEntry({ level: "MEDIUM" as ConfidenceLevel })];
		expect(shouldTriggerExplorer(entries, "HIGH")).toBe(true);
	});

	test("LOW threshold never triggers on any level", () => {
		const entries: readonly ConfidenceEntry[] = [
			makeEntry({ level: "LOW" as ConfidenceLevel }),
			makeEntry({ level: "MEDIUM" as ConfidenceLevel }),
			makeEntry({ level: "HIGH" as ConfidenceLevel }),
		];
		expect(shouldTriggerExplorer(entries, "LOW")).toBe(false);
	});

	test("defaults to MEDIUM threshold when not specified", () => {
		const entries: readonly ConfidenceEntry[] = [makeEntry({ level: "LOW" as ConfidenceLevel })];
		expect(shouldTriggerExplorer(entries)).toBe(true);
	});
});
