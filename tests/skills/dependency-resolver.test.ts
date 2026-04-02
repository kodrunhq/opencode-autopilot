import { describe, expect, it } from "bun:test";
import { resolveDependencyOrder } from "../../src/skills/dependency-resolver";

describe("resolveDependencyOrder", () => {
	it("returns empty result for empty map", () => {
		const result = resolveDependencyOrder(new Map());
		expect(result.ordered).toEqual([]);
		expect(result.cycles).toEqual([]);
	});

	it("orders independent skills", () => {
		const skills = new Map([
			["a", { requires: [] }],
			["b", { requires: [] }],
		]);
		const result = resolveDependencyOrder(skills);
		expect(result.ordered).toHaveLength(2);
		expect(result.ordered).toContain("a");
		expect(result.ordered).toContain("b");
		expect(result.cycles).toEqual([]);
	});

	it("orders dependent skills correctly (dependency first)", () => {
		const skills = new Map([
			["a", { requires: ["b"] }],
			["b", { requires: [] }],
		]);
		const result = resolveDependencyOrder(skills);
		expect(result.ordered).toEqual(["b", "a"]);
		expect(result.cycles).toEqual([]);
	});

	it("detects simple cycles", () => {
		const skills = new Map([
			["a", { requires: ["b"] }],
			["b", { requires: ["a"] }],
		]);
		const result = resolveDependencyOrder(skills);
		expect(result.cycles.length).toBeGreaterThan(0);
	});

	it("handles chain dependencies", () => {
		const skills = new Map([
			["c", { requires: ["b"] }],
			["b", { requires: ["a"] }],
			["a", { requires: [] }],
		]);
		const result = resolveDependencyOrder(skills);
		const aIdx = result.ordered.indexOf("a");
		const bIdx = result.ordered.indexOf("b");
		const cIdx = result.ordered.indexOf("c");
		expect(aIdx).toBeLessThan(bIdx);
		expect(bIdx).toBeLessThan(cIdx);
		expect(result.cycles).toEqual([]);
	});

	it("skips references to skills not in the map", () => {
		const skills = new Map([
			["a", { requires: ["nonexistent"] }],
		]);
		const result = resolveDependencyOrder(skills);
		expect(result.ordered).toEqual(["a"]);
		expect(result.cycles).toEqual([]);
	});
});
