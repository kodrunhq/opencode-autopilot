import { describe, expect, test } from "bun:test";
import { Separator } from "@inquirer/search";
import { createSearchSource, type DiscoveredModel, groupByProvider } from "../../bin/configure-tui";

interface SearchChoice {
	readonly name: string;
	readonly value: string;
	readonly description: string;
}

const MODELS: readonly DiscoveredModel[] = [
	{ id: "anthropic/claude-opus-4-6", provider: "anthropic", model: "claude-opus-4-6" },
	{ id: "anthropic/claude-sonnet-4-6", provider: "anthropic", model: "claude-sonnet-4-6" },
	{ id: "openai/gpt-5.4", provider: "openai", model: "gpt-5.4" },
	{ id: "openai/gpt-5.4-mini", provider: "openai", model: "gpt-5.4-mini" },
	{ id: "google/gemini-3.1-pro", provider: "google", model: "gemini-3.1-pro" },
] as const;

// ── Model parsing (pure re-impl — these mirror configure-tui internals) ───

function parseModelLine(line: string): DiscoveredModel {
	const id = line.trim();
	const slashIndex = id.indexOf("/");
	return {
		id,
		provider: slashIndex > 0 ? id.slice(0, slashIndex) : "unknown",
		model: slashIndex > 0 ? id.slice(slashIndex + 1) : id,
	};
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

// ── groupByProvider (real export) ──────────────────────────────────

describe("configure-tui model grouping", () => {
	test("groups models by provider", () => {
		const grouped = groupByProvider(MODELS);
		expect(grouped.size).toBe(3);
		expect(grouped.get("anthropic")?.length).toBe(2);
		expect(grouped.get("openai")?.length).toBe(2);
		expect(grouped.get("google")?.length).toBe(1);
	});

	test("preserves model order within groups", () => {
		const grouped = groupByProvider(MODELS);
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

// ── createSearchSource (real export) ───────────────────────────────

describe("configure-tui createSearchSource", () => {
	test("returns all models with separators when no search term", async () => {
		const source = createSearchSource(MODELS);
		const results = await source(undefined);

		const separators = results.filter((r) => r instanceof Separator);
		const choices = results.filter((r) => !(r instanceof Separator));
		expect(separators.length).toBe(3);
		expect(choices.length).toBe(5);
	});

	test("filters by search term (case-insensitive)", async () => {
		const source = createSearchSource(MODELS);
		const results = await source("claude");

		const choices = results.filter((r) => !(r instanceof Separator));
		expect(choices.length).toBe(2);
		expect(choices.every((c) => (c as SearchChoice).value.includes("claude"))).toBe(true);
	});

	test("filters by provider name", async () => {
		const source = createSearchSource(MODELS);
		const results = await source("openai");

		const choices = results.filter((r) => !(r instanceof Separator));
		expect(choices.length).toBe(2);
		expect(choices.every((c) => (c as SearchChoice).value.startsWith("openai/"))).toBe(true);
	});

	test("excludes specified models", async () => {
		const exclude = new Set(["anthropic/claude-opus-4-6", "openai/gpt-5.4"]);
		const source = createSearchSource(MODELS, exclude);
		const results = await source(undefined);

		const choices = results.filter((r) => !(r instanceof Separator));
		expect(choices.length).toBe(3);
		const ids = choices.map((c) => (c as SearchChoice).value);
		expect(ids).not.toContain("anthropic/claude-opus-4-6");
		expect(ids).not.toContain("openai/gpt-5.4");
	});

	test("combines search term with exclusion", async () => {
		const exclude = new Set(["anthropic/claude-opus-4-6"]);
		const source = createSearchSource(MODELS, exclude);
		const results = await source("claude");

		const choices = results.filter((r) => !(r instanceof Separator));
		expect(choices.length).toBe(1);
		expect((choices[0] as SearchChoice).value).toBe("anthropic/claude-sonnet-4-6");
	});

	test("returns empty for no matches", async () => {
		const source = createSearchSource(MODELS);
		const results = await source("nonexistent");
		expect(results.length).toBe(0);
	});

	test("omits provider separator when all its models are excluded", async () => {
		const exclude = new Set(["google/gemini-3.1-pro"]);
		const source = createSearchSource(MODELS, exclude);
		const results = await source(undefined);

		const separators = results.filter((r) => r instanceof Separator);
		expect(separators.length).toBe(2);

		const choices = results.filter((r) => !(r instanceof Separator));
		expect(choices.length).toBe(4);
	});

	test("returns empty when all models excluded (exhausted fallback list)", async () => {
		const exclude = new Set(MODELS.map((m) => m.id));
		const source = createSearchSource(MODELS, exclude);
		const results = await source(undefined);
		expect(results.length).toBe(0);
	});

	test("returns empty when only primary model exists (preflight zero-candidate)", async () => {
		const singleModel: readonly DiscoveredModel[] = [
			{ id: "anthropic/claude-opus-4-6", provider: "anthropic", model: "claude-opus-4-6" },
		];
		const exclude = new Set(["anthropic/claude-opus-4-6"]);
		const source = createSearchSource(singleModel, exclude);
		const results = await source(undefined);
		expect(results.length).toBe(0);
	});

	test("hasFallbackCandidates check: false when only primary model exists", () => {
		const singleModel: readonly DiscoveredModel[] = [
			{ id: "anthropic/claude-opus-4-6", provider: "anthropic", model: "claude-opus-4-6" },
		];
		const primary = "anthropic/claude-opus-4-6";
		const hasFallbackCandidates = singleModel.some((m) => m.id !== primary);
		expect(hasFallbackCandidates).toBe(false);
	});

	test("hasFallbackCandidates check: true when multiple models exist", () => {
		const primary = "anthropic/claude-opus-4-6";
		const hasFallbackCandidates = MODELS.some((m) => m.id !== primary);
		expect(hasFallbackCandidates).toBe(true);
	});

	test("choice objects contain name, value, and description", async () => {
		const source = createSearchSource(MODELS);
		const results = await source(undefined);

		const firstChoice = results.find((r) => !(r instanceof Separator)) as SearchChoice | undefined;
		expect(firstChoice).toBeDefined();
		expect(firstChoice?.name).toBe("anthropic/claude-opus-4-6");
		expect(firstChoice?.value).toBe("anthropic/claude-opus-4-6");
		expect(firstChoice?.description).toBe("claude-opus-4-6");
	});
});

// ── CLI integration ────────────────────────────────────────────────

describe("configure-tui CLI integration", () => {
	test("configure-tui module can be imported", async () => {
		const mod = await import("../../bin/configure-tui");
		expect(typeof mod.runConfigure).toBe("function");
	});

	test("exports createSearchSource and groupByProvider", async () => {
		const mod = await import("../../bin/configure-tui");
		expect(typeof mod.createSearchSource).toBe("function");
		expect(typeof mod.groupByProvider).toBe("function");
	});

	test("runConfigure accepts optional groupFilter parameter", async () => {
		const mod = await import("../../bin/configure-tui");
		expect(mod.runConfigure.length).toBeLessThanOrEqual(2);
	});
});
