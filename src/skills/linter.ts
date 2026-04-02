import { parse } from "yaml";

interface LintResult {
	readonly valid: boolean;
	readonly errors: readonly string[];
	readonly warnings: readonly string[];
}

/** Parse YAML frontmatter from markdown content. Supports LF and CRLF. */
function extractFrontmatter(content: string): Record<string, unknown> | null {
	const match = content.match(/^---\r?\n([\s\S]*?\r?\n)?---/);
	if (!match) return null;
	try {
		const parsed = parse(match[1] ?? "");
		if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return {};
		return parsed as Record<string, unknown>;
	} catch {
		return null;
	}
}

/** Freeze a LintResult including nested arrays. */
function freezeResult(valid: boolean, errors: string[], warnings: string[]): LintResult {
	return Object.freeze({
		valid,
		errors: Object.freeze(errors),
		warnings: Object.freeze(warnings),
	});
}

/** Lint a skill SKILL.md file for valid YAML frontmatter and required fields. */
export function lintSkill(content: string): LintResult {
	const errors: string[] = [];
	const warnings: string[] = [];

	const fm = extractFrontmatter(content);
	if (!fm) {
		return freezeResult(false, ["Missing YAML frontmatter"], []);
	}

	// Required fields
	if (typeof fm.name !== "string" || fm.name.length === 0) {
		errors.push("Missing required field: name");
	}
	if (typeof fm.description !== "string" || fm.description.length === 0) {
		errors.push("Missing required field: description");
	}

	// Optional but recommended fields
	if (!Array.isArray(fm.stacks)) {
		warnings.push(
			"Missing recommended field: stacks (add stacks: [] for methodology skills or stacks: [lang] for language skills)",
		);
	}
	if (!Array.isArray(fm.requires)) {
		warnings.push("Missing recommended field: requires (add requires: [] if no dependencies)");
	}

	// Validate stacks entries are strings
	if (Array.isArray(fm.stacks) && fm.stacks.some((s: unknown) => typeof s !== "string")) {
		errors.push("stacks must contain only strings");
	}
	if (Array.isArray(fm.requires) && fm.requires.some((s: unknown) => typeof s !== "string")) {
		errors.push("requires must contain only strings");
	}

	// Content validation (CRLF-safe)
	const body = content.replace(/^---\r?\n(?:[\s\S]*?\r?\n)?---/, "").trim();
	if (body.length === 0) {
		warnings.push("Skill has no content after frontmatter");
	}

	return freezeResult(errors.length === 0, errors, warnings);
}

/** Lint a command markdown file for valid YAML frontmatter and required fields. */
export function lintCommand(content: string): LintResult {
	const errors: string[] = [];
	const warnings: string[] = [];

	const fm = extractFrontmatter(content);
	if (!fm) {
		return freezeResult(false, ["Missing YAML frontmatter"], []);
	}

	if (typeof fm.description !== "string" || fm.description.length === 0) {
		errors.push("Missing required field: description");
	}

	const body = content.replace(/^---\r?\n(?:[\s\S]*?\r?\n)?---/, "").trim();
	if (body.length === 0) {
		warnings.push("Command has no content after frontmatter");
	}

	return freezeResult(errors.length === 0, errors, warnings);
}

/** Lint an agent markdown file for valid YAML frontmatter and required fields. */
export function lintAgent(content: string): LintResult {
	const errors: string[] = [];
	const warnings: string[] = [];

	const fm = extractFrontmatter(content);
	if (!fm) {
		return freezeResult(false, ["Missing YAML frontmatter"], []);
	}

	if (typeof fm.name !== "string" || fm.name.length === 0) {
		errors.push("Missing required field: name");
	}

	return freezeResult(errors.length === 0, errors, warnings);
}
