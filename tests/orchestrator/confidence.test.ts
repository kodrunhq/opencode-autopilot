import { describe, expect, test } from "bun:test";
import {
	appendConfidence,
	filterByPhase,
	summarizeConfidence,
} from "../../src/orchestrator/confidence";
import { createInitialState } from "../../src/orchestrator/state";
import type { ConfidenceEntry } from "../../src/orchestrator/types";

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

describe("appendConfidence", () => {
	test("adds entry with auto-timestamp, returns new state", () => {
		const original = createInitialState("confidence test");
		const updated = appendConfidence(original, {
			phase: "RECON",
			agent: "researcher",
			area: "tech-stack",
			level: "HIGH",
			rationale: "Well understood",
		});
		expect(updated.confidence).toHaveLength(1);
		expect(updated.confidence[0].level).toBe("HIGH");
		expect(updated.confidence[0].timestamp).toBeTruthy();
	});

	test("does not mutate original state", () => {
		const original = createInitialState("no-mutate test");
		appendConfidence(original, {
			phase: "RECON",
			agent: "researcher",
			area: "tech-stack",
			level: "HIGH",
			rationale: "test",
		});
		expect(original.confidence).toHaveLength(0);
	});
});

describe("summarizeConfidence", () => {
	test("counts HIGH:2, MEDIUM:1, LOW:1 with dominant HIGH", () => {
		const entries: readonly ConfidenceEntry[] = [
			makeEntry({ level: "HIGH" }),
			makeEntry({ level: "HIGH" }),
			makeEntry({ level: "MEDIUM" }),
			makeEntry({ level: "LOW" }),
		];
		const summary = summarizeConfidence(entries);
		expect(summary.HIGH).toBe(2);
		expect(summary.MEDIUM).toBe(1);
		expect(summary.LOW).toBe(1);
		expect(summary.total).toBe(4);
		expect(summary.dominant).toBe("HIGH");
	});

	test("empty array returns zeros with dominant MEDIUM", () => {
		const summary = summarizeConfidence([]);
		expect(summary.HIGH).toBe(0);
		expect(summary.MEDIUM).toBe(0);
		expect(summary.LOW).toBe(0);
		expect(summary.total).toBe(0);
		expect(summary.dominant).toBe("MEDIUM");
	});

	test("tie-break prefers higher confidence (HIGH > MEDIUM > LOW)", () => {
		const entries: readonly ConfidenceEntry[] = [
			makeEntry({ level: "HIGH" }),
			makeEntry({ level: "MEDIUM" }),
		];
		const summary = summarizeConfidence(entries);
		expect(summary.dominant).toBe("HIGH");

		const entries2: readonly ConfidenceEntry[] = [
			makeEntry({ level: "MEDIUM" }),
			makeEntry({ level: "LOW" }),
		];
		const summary2 = summarizeConfidence(entries2);
		expect(summary2.dominant).toBe("MEDIUM");
	});
});

describe("filterByPhase", () => {
	test("returns only entries with matching phase", () => {
		const entries: readonly ConfidenceEntry[] = [
			makeEntry({ phase: "RECON" }),
			makeEntry({ phase: "CHALLENGE" }),
			makeEntry({ phase: "RECON" }),
		];
		const filtered = filterByPhase(entries, "RECON");
		expect(filtered).toHaveLength(2);
		expect(filtered.every((e) => e.phase === "RECON")).toBe(true);
	});

	test("returns empty array when no entries match", () => {
		const entries: readonly ConfidenceEntry[] = [makeEntry({ phase: "RECON" })];
		const filtered = filterByPhase(entries, "BUILD");
		expect(filtered).toHaveLength(0);
	});
});
