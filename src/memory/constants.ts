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
