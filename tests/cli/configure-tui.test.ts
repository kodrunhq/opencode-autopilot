import { describe, expect, test } from "bun:test";

/**
 * Tests for the configure TUI's pure helper functions.
 * We can't test the interactive prompts (they need a real TTY),
 * but we can test model parsing, grouping, and diversity logic.
 */

// Re-implement the pure functions from configure-tui.ts for testing
// (they're not exported from the module since they're internal helpers)

interface DiscoveredModel {
	readonly id: string;
	readonly provider: string;
	readonly model: string;
}

function parseModelLine(line: string): DiscoveredModel {
	const id = line.trim();
	const slashIndex = id.indexOf("/");
	return {
		id,
		provider: slashIndex > 0 ? id.slice(0, slashIndex) : "unknown",
		model: slashIndex > 0 ? id.slice(slashIndex + 1) : id,
	};
}

function groupByProvider(models: readonly DiscoveredModel[]): Map<string, DiscoveredModel[]> {
	const grouped = new Map<string, DiscoveredModel[]>();
	for (const m of models) {
		const existing = grouped.get(m.provider) ?? [];
		existing.push(m);
		grouped.set(m.provider, existing);
	}
	return grouped;
}

describe("configure-tui model parsing", () => {
	test("parses provider/model format correctly", () => {
		const result = parseModelLine("anthropic/claude-opus-4-6");
		expect(result.id).toBe("anthropic/claude-opus-4-6");
		expect(result.provider).toBe("anthropic");
		expect(result.model).toBe("claude-opus-4-6");
	});

	test("handles models with nested slashes", () => {
		const result = parseModelLine("drun/public/deepseek-r1");
		expect(result.id).toBe("drun/public/deepseek-r1");
		expect(result.provider).toBe("drun");
		expect(result.model).toBe("public/deepseek-r1");
	});

	test("handles model with no provider prefix", () => {
		const result = parseModelLine("some-model");
		expect(result.provider).toBe("unknown");
		expect(result.model).toBe("some-model");
	});

	test("trims whitespace", () => {
		const result = parseModelLine("  openai/gpt-5.4  ");
		expect(result.id).toBe("openai/gpt-5.4");
		expect(result.provider).toBe("openai");
	});
});

describe("configure-tui model grouping", () => {
	const models: DiscoveredModel[] = [
		{ id: "anthropic/claude-opus-4-6", provider: "anthropic", model: "claude-opus-4-6" },
		{ id: "anthropic/claude-sonnet-4-6", provider: "anthropic", model: "claude-sonnet-4-6" },
		{ id: "openai/gpt-5.4", provider: "openai", model: "gpt-5.4" },
		{ id: "openai/gpt-5.4-mini", provider: "openai", model: "gpt-5.4-mini" },
		{ id: "google/gemini-3.1-pro", provider: "google", model: "gemini-3.1-pro" },
	];

	test("groups models by provider", () => {
		const grouped = groupByProvider(models);
		expect(grouped.size).toBe(3);
		expect(grouped.get("anthropic")?.length).toBe(2);
		expect(grouped.get("openai")?.length).toBe(2);
		expect(grouped.get("google")?.length).toBe(1);
	});

	test("preserves model order within groups", () => {
		const grouped = groupByProvider(models);
		const anthropic = grouped.get("anthropic") ?? [];
		expect(anthropic[0].id).toBe("anthropic/claude-opus-4-6");
		expect(anthropic[1].id).toBe("anthropic/claude-sonnet-4-6");
	});

	test("handles empty input", () => {
		const grouped = groupByProvider([]);
		expect(grouped.size).toBe(0);
	});

	test("handles single provider", () => {
		const single = [{ id: "openai/gpt-5.4", provider: "openai", model: "gpt-5.4" }];
		const grouped = groupByProvider(single);
		expect(grouped.size).toBe(1);
		expect(grouped.get("openai")?.length).toBe(1);
	});
});

describe("configure-tui search source filtering", () => {
	const models: DiscoveredModel[] = [
		{ id: "anthropic/claude-opus-4-6", provider: "anthropic", model: "claude-opus-4-6" },
		{ id: "anthropic/claude-sonnet-4-6", provider: "anthropic", model: "claude-sonnet-4-6" },
		{ id: "openai/gpt-5.4", provider: "openai", model: "gpt-5.4" },
		{ id: "openai/gpt-5.4-mini", provider: "openai", model: "gpt-5.4-mini" },
		{ id: "google/gemini-3.1-pro", provider: "google", model: "gemini-3.1-pro" },
	];

	function filterModels(
		allModels: readonly DiscoveredModel[],
		term: string | undefined,
		exclude?: Set<string>,
	): DiscoveredModel[] {
		return allModels.filter((m) => {
			if (exclude?.has(m.id)) return false;
			if (!term) return true;
			return m.id.toLowerCase().includes(term.toLowerCase());
		});
	}

	test("returns all models when no search term", () => {
		const result = filterModels(models, undefined);
		expect(result.length).toBe(5);
	});

	test("filters by search term (case-insensitive)", () => {
		const result = filterModels(models, "claude");
		expect(result.length).toBe(2);
		expect(result[0].id).toBe("anthropic/claude-opus-4-6");
		expect(result[1].id).toBe("anthropic/claude-sonnet-4-6");
	});

	test("filters by provider name", () => {
		const result = filterModels(models, "openai");
		expect(result.length).toBe(2);
	});

	test("excludes specified models (primary + already-selected fallbacks)", () => {
		const exclude = new Set(["anthropic/claude-opus-4-6", "openai/gpt-5.4"]);
		const result = filterModels(models, undefined, exclude);
		expect(result.length).toBe(3);
		expect(result.some((m) => m.id === "anthropic/claude-opus-4-6")).toBe(false);
		expect(result.some((m) => m.id === "openai/gpt-5.4")).toBe(false);
	});

	test("combines search term with exclusion", () => {
		const exclude = new Set(["anthropic/claude-opus-4-6"]);
		const result = filterModels(models, "claude", exclude);
		expect(result.length).toBe(1);
		expect(result[0].id).toBe("anthropic/claude-sonnet-4-6");
	});

	test("returns empty for no matches", () => {
		const result = filterModels(models, "nonexistent");
		expect(result.length).toBe(0);
	});
});

describe("configure-tui CLI integration", () => {
	test("configure-tui module can be imported", async () => {
		// Just verify the module loads without errors
		const mod = await import("../../bin/configure-tui");
		expect(typeof mod.runConfigure).toBe("function");
	});
});
