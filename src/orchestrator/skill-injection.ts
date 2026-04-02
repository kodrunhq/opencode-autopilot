/**
 * Skill injection into pipeline dispatch prompts.
 *
 * Loads coding-standards skill content from the global config dir
 * and builds formatted context strings for injection into agent
 * prompts. Mirrors the lesson-injection.ts pattern: all content
 * is sanitized before injection to prevent template injection.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sanitizeTemplateContent } from "../review/sanitize";
import {
	buildMultiSkillContext,
	detectProjectStackTags,
	filterSkillsByStack,
} from "../skills/adaptive-injector";
import { loadAllSkills } from "../skills/loader";
import { isEnoentError } from "../utils/fs-helpers";

const MAX_SKILL_LENGTH = 2048;

/**
 * Load the coding-standards skill content from the global config dir.
 * Returns empty string on any I/O error (best-effort, same as lesson injection).
 */
export async function loadSkillContent(baseDir: string): Promise<string> {
	try {
		const skillPath = join(baseDir, "skills", "coding-standards", "SKILL.md");
		const content = await readFile(skillPath, "utf-8");
		return content;
	} catch (error: unknown) {
		if (isEnoentError(error)) return "";
		// Treat all I/O errors as non-critical
		if (error !== null && typeof error === "object") {
			const errWithCode = error as { code?: unknown };
			if (typeof errWithCode.code === "string") return "";
		}
		throw error; // re-throw programmer errors
	}
}

/**
 * Build a formatted skill context string for injection into dispatch prompts.
 * Returns empty string if content is empty.
 * Sanitizes content and truncates to MAX_SKILL_LENGTH.
 */
export function buildSkillContext(skillContent: string): string {
	if (!skillContent || skillContent.trim().length === 0) return "";

	const collapsed = skillContent.replace(/[\r\n]+/g, " ");
	const truncated =
		collapsed.length > MAX_SKILL_LENGTH ? `${collapsed.slice(0, MAX_SKILL_LENGTH)}...` : collapsed;
	const sanitized = sanitizeTemplateContent(truncated);

	const header = "Coding standards for this project (follow these conventions):";
	return `\n\n${header}\n${sanitized}`;
}

// --- Adaptive multi-skill loading ---

/**
 * Load and inject all matching skills for the current project.
 * Detects project stack from manifest files, filters skills by stack,
 * resolves dependencies, and builds a token-budgeted context string.
 *
 * Returns empty string on any error (best-effort, same as lesson injection).
 */
export async function loadAdaptiveSkillContext(
	baseDir: string,
	projectRoot: string,
	tokenBudget?: number,
): Promise<string> {
	try {
		const skillsDir = join(baseDir, "skills");
		const [allSkills, projectTags] = await Promise.all([
			loadAllSkills(skillsDir),
			detectProjectStackTags(projectRoot),
		]);

		if (allSkills.size === 0) return "";

		const matchingSkills = filterSkillsByStack(allSkills, projectTags);
		return buildMultiSkillContext(matchingSkills, tokenBudget);
	} catch {
		// Best-effort: never break dispatch due to skill loading failure
		return "";
	}
}
