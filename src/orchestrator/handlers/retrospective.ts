import { getProjectRootFromArtifactDir } from "../../utils/paths";
import { getArtifactRef, PHASE_ARTIFACTS } from "../artifacts";
import {
	createEmptyLessonMemory,
	loadLessonMemory,
	pruneLessons,
	saveLessonMemory,
} from "../lesson-memory";
import { lessonSchema } from "../lesson-schemas";
import type { Lesson } from "../lesson-types";
import type { Phase } from "../types";
import type { DispatchResult, PhaseHandler } from "./types";
import { AGENT_NAMES } from "./types";

export const LESSONS_PARSE_ERROR_CODE = "E_RETRO_PARSE";

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
		// Strip markdown code fences before parsing
		const cleaned = raw.replace(/^```(?:json)?\s*\n?([\s\S]*?)```\s*$/m, "$1").trim();
		parsed = JSON.parse(cleaned);
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

export const handleRetrospective: PhaseHandler = async (state, artifactDir, result?) => {
	if (result) {
		const { valid, parseError } = parseAndValidateLessons(result);

		if (parseError) {
			return Object.freeze({
				action: "complete",
				code: LESSONS_PARSE_ERROR_CODE,
				resultKind: "phase_output",
				phase: "RETROSPECTIVE",
				progress: "Retrospective complete -- no lessons extracted (parse error)",
			} satisfies DispatchResult);
		}

		if (valid.length === 0) {
			return Object.freeze({
				action: "complete",
				resultKind: "phase_output",
				phase: "RETROSPECTIVE",
				progress: "Retrospective complete -- 0 lessons extracted",
			} satisfies DispatchResult);
		}

		// Persist lessons to memory (best-effort: failure should not mark pipeline as FAILED)
		try {
			const projectRoot = getProjectRootFromArtifactDir(artifactDir);
			const existing = await loadLessonMemory(projectRoot);
			const memory = existing ?? createEmptyLessonMemory();
			const merged = [...memory.lessons, ...valid];
			const pruned = pruneLessons({
				...memory,
				lessons: merged,
				lastUpdatedAt: new Date().toISOString(),
			});
			await saveLessonMemory(pruned, projectRoot);
		} catch (error: unknown) {
			const raw = error instanceof Error ? error.message : "unknown error";
			const msg = raw.replace(/[/\\][^\s"']+/g, "[PATH]").slice(0, 256);
			return Object.freeze({
				action: "complete",
				resultKind: "phase_output",
				phase: "RETROSPECTIVE",
				progress: `Retrospective complete — ${valid.length} lessons extracted (persistence failed: ${msg})`,
			} satisfies DispatchResult);
		}

		return Object.freeze({
			action: "complete",
			resultKind: "phase_output",
			phase: "RETROSPECTIVE",
			progress: `Retrospective complete -- ${valid.length} lessons extracted`,
		} satisfies DispatchResult);
	}

	const artifactRefs = Object.entries(PHASE_ARTIFACTS)
		.filter(([phase, files]) => files.length > 0 && phase !== "RETROSPECTIVE")
		.flatMap(([phase, files]) =>
			files.map((file) => getArtifactRef(artifactDir, phase as Phase, file, state.runId)),
		);

	const prompt = [
		"Analyze all phase artifacts:",
		`${artifactRefs.join(", ")}.`,
		"Output ONLY valid JSON with lessons categorized by domain.",
	].join(" ");

	return Object.freeze({
		action: "dispatch",
		agent: AGENT_NAMES.RETROSPECTIVE,
		resultKind: "phase_output",
		prompt,
		phase: "RETROSPECTIVE",
		progress: "Dispatching retrospector",
	} satisfies DispatchResult);
};
