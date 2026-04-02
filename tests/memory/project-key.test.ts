import { describe, expect, test } from "bun:test";
// Types verified via schema tests (Observation, ObservationType, Project, Preference)
import {
	CHARS_PER_TOKEN,
	DEFAULT_HALF_LIFE_DAYS,
	DEFAULT_INJECTION_BUDGET,
	MAX_OBSERVATIONS_PER_PROJECT,
	OBSERVATION_TYPES,
	TYPE_WEIGHTS,
} from "../../src/memory/constants";
import { computeProjectKey } from "../../src/memory/project-key";
import {
	observationSchema,
	observationTypeSchema,
	preferenceSchema,
	projectSchema,
} from "../../src/memory/schemas";

describe("computeProjectKey", () => {
	test("returns a 64-char hex string (SHA-256)", () => {
		const key = computeProjectKey("/home/user/project");
		expect(key).toHaveLength(64);
		expect(key).toMatch(/^[0-9a-f]{64}$/);
	});

	test("is deterministic (same input -> same output)", () => {
		const a = computeProjectKey("/home/user/project");
		const b = computeProjectKey("/home/user/project");
		expect(a).toBe(b);
	});

	test("different inputs produce different outputs", () => {
		const a = computeProjectKey("/home/user/project-a");
		const b = computeProjectKey("/home/user/project-b");
		expect(a).not.toBe(b);
	});
});

describe("observationTypeSchema", () => {
	test("accepts all 6 valid types", () => {
		const validTypes = ["decision", "pattern", "error", "preference", "context", "tool_usage"];
		for (const t of validTypes) {
			expect(observationTypeSchema.parse(t)).toBe(t);
		}
	});

	test("rejects invalid types", () => {
		expect(() => observationTypeSchema.parse("invalid")).toThrow();
		expect(() => observationTypeSchema.parse("")).toThrow();
	});
});

describe("observationSchema", () => {
	const validObservation = {
		projectId: "abc123",
		sessionId: "sess-1",
		type: "decision" as const,
		content: "Use SQLite for storage",
		summary: "Chose SQLite",
		confidence: 0.9,
		accessCount: 0,
		createdAt: "2026-01-01T00:00:00Z",
		lastAccessed: "2026-01-01T00:00:00Z",
	};

	test("parses valid observation", () => {
		const result = observationSchema.parse(validObservation);
		expect(result.content).toBe("Use SQLite for storage");
		expect(result.type).toBe("decision");
	});

	test("allows null projectId for user-level observations", () => {
		const result = observationSchema.parse({ ...validObservation, projectId: null });
		expect(result.projectId).toBeNull();
	});

	test("allows optional id field", () => {
		const result = observationSchema.parse({ ...validObservation, id: 42 });
		expect(result.id).toBe(42);
	});

	test("applies defaults for confidence and accessCount", () => {
		const minimal = {
			projectId: null,
			sessionId: "s1",
			type: "error" as const,
			content: "Something broke",
			summary: "Error occurred",
			createdAt: "2026-01-01T00:00:00Z",
			lastAccessed: "2026-01-01T00:00:00Z",
		};
		const result = observationSchema.parse(minimal);
		expect(result.confidence).toBe(0.5);
		expect(result.accessCount).toBe(0);
	});

	test("rejects missing required fields", () => {
		expect(() => observationSchema.parse({})).toThrow();
		expect(() => observationSchema.parse({ content: "x" })).toThrow();
		expect(() => observationSchema.parse({ ...validObservation, content: undefined })).toThrow();
	});

	test("rejects empty content", () => {
		expect(() => observationSchema.parse({ ...validObservation, content: "" })).toThrow();
	});

	test("rejects empty summary", () => {
		expect(() => observationSchema.parse({ ...validObservation, summary: "" })).toThrow();
	});
});

describe("projectSchema", () => {
	test("parses valid project", () => {
		const result = projectSchema.parse({
			id: "abc123",
			path: "/home/user/project",
			name: "my-project",
			lastUpdated: "2026-01-01T00:00:00Z",
		});
		expect(result.id).toBe("abc123");
		expect(result.path).toBe("/home/user/project");
	});

	test("rejects missing fields", () => {
		expect(() => projectSchema.parse({ id: "abc" })).toThrow();
	});
});

describe("preferenceSchema", () => {
	test("parses valid preference", () => {
		const result = preferenceSchema.parse({
			id: "pref-1",
			key: "editor.theme",
			value: "dark",
			confidence: 0.8,
			sourceSession: "sess-1",
			createdAt: "2026-01-01T00:00:00Z",
			lastUpdated: "2026-01-01T00:00:00Z",
		});
		expect(result.key).toBe("editor.theme");
		expect(result.value).toBe("dark");
	});

	test("applies defaults for confidence and sourceSession", () => {
		const result = preferenceSchema.parse({
			id: "pref-2",
			key: "lang",
			value: "ts",
			createdAt: "2026-01-01T00:00:00Z",
			lastUpdated: "2026-01-01T00:00:00Z",
		});
		expect(result.confidence).toBe(0.5);
		expect(result.sourceSession).toBeNull();
	});

	test("rejects missing fields", () => {
		expect(() => preferenceSchema.parse({})).toThrow();
	});
});

describe("constants", () => {
	test("TYPE_WEIGHTS has entries for all 6 observation types", () => {
		expect(Object.keys(TYPE_WEIGHTS)).toHaveLength(6);
		for (const t of OBSERVATION_TYPES) {
			expect(TYPE_WEIGHTS[t]).toBeNumber();
		}
	});

	test("DEFAULT_INJECTION_BUDGET equals 2000", () => {
		expect(DEFAULT_INJECTION_BUDGET).toBe(2000);
	});

	test("DEFAULT_HALF_LIFE_DAYS equals 90", () => {
		expect(DEFAULT_HALF_LIFE_DAYS).toBe(90);
	});

	test("CHARS_PER_TOKEN equals 4", () => {
		expect(CHARS_PER_TOKEN).toBe(4);
	});

	test("MAX_OBSERVATIONS_PER_PROJECT equals 10000", () => {
		expect(MAX_OBSERVATIONS_PER_PROJECT).toBe(10000);
	});
});
