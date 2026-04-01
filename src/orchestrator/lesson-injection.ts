/**
 * Lesson injection into phase dispatch prompts.
 *
 * Maps phases to relevant lesson domains and builds formatted
 * context strings for injection into agent prompts. All content
 * is sanitized before injection to prevent template injection.
 */

import { sanitizeTemplateContent } from "../review/sanitize";
import type { Lesson, LessonDomain } from "./lesson-types";
import type { Phase } from "./types";

const MAX_INJECTED_LESSONS = 10;
const MAX_CONTENT_LENGTH = 256;

/**
 * Maps each pipeline phase to the lesson domains relevant to that phase.
 * Phases with empty arrays receive no lesson injection.
 */
export const PHASE_LESSON_DOMAINS: Readonly<Record<Phase, readonly LessonDomain[]>> = Object.freeze(
	{
		RECON: Object.freeze(["planning"] as const),
		CHALLENGE: Object.freeze(["architecture", "planning"] as const),
		ARCHITECT: Object.freeze(["architecture"] as const),
		EXPLORE: Object.freeze([] as const),
		PLAN: Object.freeze(["planning", "architecture"] as const),
		BUILD: Object.freeze(["testing", "review"] as const),
		SHIP: Object.freeze(["planning"] as const),
		RETROSPECTIVE: Object.freeze([] as const),
	},
);

/**
 * Build a formatted lesson context string for injection into a dispatch prompt.
 *
 * - Filters lessons by the domains relevant to the given phase
 * - Sorts by extractedAt descending (newest first)
 * - Caps at 10 lessons
 * - Truncates individual content to 256 chars
 * - Sanitizes all content via sanitizeTemplateContent
 *
 * Returns empty string if no relevant lessons exist or phase has no mapped domains.
 */
export function buildLessonContext(lessons: readonly Lesson[], phase: Phase): string {
	const domains = PHASE_LESSON_DOMAINS[phase];
	if (domains.length === 0) {
		return "";
	}

	const relevant = lessons.filter((lesson) =>
		(domains as readonly string[]).includes(lesson.domain),
	);

	if (relevant.length === 0) {
		return "";
	}

	// Sort by extractedAt descending (newest first)
	const sorted = [...relevant].sort(
		(a, b) => new Date(b.extractedAt).getTime() - new Date(a.extractedAt).getTime(),
	);

	// Cap at MAX_INJECTED_LESSONS
	const capped = sorted.slice(0, MAX_INJECTED_LESSONS);

	// Format each lesson with truncation and sanitization
	const lines = capped.map((lesson) => {
		const truncated =
			lesson.content.length > MAX_CONTENT_LENGTH
				? `${lesson.content.slice(0, MAX_CONTENT_LENGTH)}...`
				: lesson.content;
		const sanitized = sanitizeTemplateContent(truncated);
		return `- [${lesson.domain}] ${sanitized}`;
	});

	return `\n\nPrior lessons from previous runs:\n${lines.join("\n")}`;
}
