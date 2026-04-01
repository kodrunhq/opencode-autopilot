import { join } from "node:path";
import { getArtifactRef, PHASE_ARTIFACTS } from "../artifacts";
import { lessonSchema } from "../lesson-schemas";
import {
	createEmptyLessonMemory,
	loadLessonMemory,
	saveLessonMemory,
} from "../lesson-memory";
import type { Lesson } from "../lesson-types";
import type { Phase } from "../types";
import type { DispatchResult, PhaseHandler } from "./types";
import { AGENT_NAMES } from "./types";

/**
 * Parse and validate lessons from the agent's JSON output.
 * Returns only valid lessons; invalid entries are silently skipped (graceful degradation).
 */
function parseAndValidateLessons(raw: string): {
	readonly valid: readonly Lesson[];
	readonly parseError: boolean;
} {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return { valid: Object.freeze([]), parseError: true };
	}

	if (
		parsed === null ||
		typeof parsed !== "object" ||
		!("lessons" in parsed) ||
		!Array.isArray((parsed as Record<string, unknown>).lessons)
	) {
		return { valid: Object.freeze([]), parseError: true };
	}

	const now = new Date().toISOString();
	const validated: Lesson[] = [];

	for (const entry of (parsed as Record<string, unknown>).lessons as unknown[]) {
		const result = lessonSchema.safeParse({
			...(typeof entry === "object" && entry !== null ? entry : {}),
			extractedAt: now,
		});
		if (result.success) {
			validated.push(result.data);
		}
	}

	return { valid: Object.freeze(validated), parseError: false };
}

export const handleRetrospective: PhaseHandler = async (_state, artifactDir, result?) => {
	if (result) {
		const { valid, parseError } = parseAndValidateLessons(result);

		if (parseError) {
			return Object.freeze({
				action: "complete",
				phase: "RETROSPECTIVE",
				progress: "Retrospective complete -- no lessons extracted (parse error)",
			} satisfies DispatchResult);
		}

		if (valid.length === 0) {
			return Object.freeze({
				action: "complete",
				phase: "RETROSPECTIVE",
				progress: "Retrospective complete -- 0 lessons extracted",
			} satisfies DispatchResult);
		}

		// Persist lessons to memory
		const projectRoot = join(artifactDir, "..");
		const existing = await loadLessonMemory(projectRoot);
		const memory = existing ?? createEmptyLessonMemory();
		const merged = [...memory.lessons, ...valid];

		await saveLessonMemory(
			{
				...memory,
				lessons: merged,
				lastUpdatedAt: new Date().toISOString(),
			},
			projectRoot,
		);

		return Object.freeze({
			action: "complete",
			phase: "RETROSPECTIVE",
			progress: `Retrospective complete -- ${valid.length} lessons extracted`,
		} satisfies DispatchResult);
	}

	const artifactRefs = Object.entries(PHASE_ARTIFACTS)
		.filter(([_, files]) => files.length > 0)
		.flatMap(([phase, files]) => files.map((file) => getArtifactRef(phase as Phase, file)));

	const prompt = [
		"Analyze all phase artifacts:",
		`${artifactRefs.join(", ")}.`,
		"Output ONLY valid JSON with lessons categorized by domain.",
		"Write output to phases/RETROSPECTIVE/lessons.json.",
	].join(" ");

	return Object.freeze({
		action: "dispatch",
		agent: AGENT_NAMES.RETROSPECTIVE,
		prompt,
		phase: "RETROSPECTIVE",
		progress: "Dispatching retrospector",
	} satisfies DispatchResult);
};
