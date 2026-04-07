export const OBSERVATION_TYPES = [
	"decision",
	"pattern",
	"error",
	"preference",
	"context",
	"tool_usage",
] as const;

export const TYPE_WEIGHTS: Readonly<Record<(typeof OBSERVATION_TYPES)[number], number>> =
	Object.freeze({
		decision: 1.5,
		pattern: 1.2,
		error: 1.0,
		preference: 0.8,
		context: 0.6,
		tool_usage: 0.4,
	});

export const DEFAULT_INJECTION_BUDGET = 2000;
export const DEFAULT_HALF_LIFE_DAYS = 90;
export const CHARS_PER_TOKEN = 4;
export const MAX_OBSERVATIONS_PER_PROJECT = 10000;
export const MIN_RELEVANCE_THRESHOLD = 0.1;
export const MEMORY_DIR = "memory";
export const DB_FILE = "memory.db";

export const MEMORY_KINDS = [
	"preference",
	"decision",
	"project_fact",
	"mistake",
	"workflow_rule",
] as const;

export const MEMORY_SCOPES = ["project", "user"] as const;

export const MEMORY_STATUSES = ["active", "superseded", "rejected"] as const;

export const KIND_WEIGHTS: Readonly<Record<(typeof MEMORY_KINDS)[number], number>> = Object.freeze({
	preference: 1.0,
	decision: 1.3,
	project_fact: 1.1,
	mistake: 1.5,
	workflow_rule: 1.4,
});

/** Memories with bigram overlap >= this value are considered duplicates. */
export const DEDUP_JACCARD_THRESHOLD = 0.6;

export const MAX_MEMORIES_PER_QUERY = 50;
export const DEFAULT_MEMORY_CONFIDENCE = 0.8;
export const MAX_MEMORY_CONTENT_LENGTH = 4000;
export const MAX_MEMORY_SUMMARY_LENGTH = 500;
export const MAX_MEMORY_TAGS = 10;
