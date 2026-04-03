/**
 * Adaptive skill injection: project stack detection, skill filtering, and
 * multi-skill context building with dependency ordering and token budget.
 *
 * Complements detectStackTags (which works on file paths from git diff)
 * by checking the project root for manifest files. This enables skill
 * filtering even before any git diff is available.
 */

import { access, readdir } from "node:fs/promises";
import { join } from "node:path";
import { sanitizeTemplateContent } from "../review/sanitize";
import { isEnoentError } from "../utils/fs-helpers";
import { resolveDependencyOrder } from "./dependency-resolver";
import type { LoadedSkill } from "./loader";

const DEFAULT_TOKEN_BUDGET = 8000;
/** Rough estimate: 1 token ~ 4 chars */
const CHARS_PER_TOKEN = 4;

/**
 * Manifest files that indicate project stack.
 * Checks project root for these files to detect the stack.
 */
const MANIFEST_TAGS: Readonly<Record<string, readonly string[]>> = Object.freeze({
	"package.json": Object.freeze(["javascript"]),
	"tsconfig.json": Object.freeze(["typescript"]),
	"bunfig.toml": Object.freeze(["bun", "typescript"]),
	"bun.lockb": Object.freeze(["bun"]),
	"go.mod": Object.freeze(["go"]),
	"Cargo.toml": Object.freeze(["rust"]),
	"pyproject.toml": Object.freeze(["python"]),
	"requirements.txt": Object.freeze(["python"]),
	Pipfile: Object.freeze(["python"]),
	Gemfile: Object.freeze(["ruby"]),
	"pom.xml": Object.freeze(["java"]),
	"build.gradle": Object.freeze(["java"]),
	"build.gradle.kts": Object.freeze(["java"]),
});

/**
 * Extension-based manifest patterns for languages that use variable filenames
 * (e.g., MyProject.csproj, MySolution.sln). Detected via readdir + endsWith
 * matching on the project root directory. Only checks immediate children —
 * nested .csproj files (e.g., src/MyProject/MyProject.csproj) require the
 * .sln file at root or diff-path detection via stack-gate.ts.
 */
const EXT_MANIFEST_TAGS: Readonly<Record<string, readonly string[]>> = Object.freeze({
	".csproj": Object.freeze(["csharp"]),
	".sln": Object.freeze(["csharp"]),
});

/**
 * Detect project stack tags from manifest files in the project root.
 * Complements detectStackTags (which works on file paths from git diff).
 */
export async function detectProjectStackTags(projectRoot: string): Promise<readonly string[]> {
	const tags = new Set<string>();

	const results = await Promise.all(
		Object.entries(MANIFEST_TAGS).map(async ([manifest, manifestTags]) => {
			try {
				await access(join(projectRoot, manifest));
				return [...manifestTags];
			} catch {
				return [];
			}
		}),
	);

	for (const result of results) {
		for (const tag of result) {
			tags.add(tag);
		}
	}

	// Check extension-based manifests (e.g., *.csproj, *.sln)
	try {
		const entries = await readdir(projectRoot);
		for (const [ext, extTags] of Object.entries(EXT_MANIFEST_TAGS)) {
			if (entries.some((entry) => entry.endsWith(ext))) {
				for (const tag of extTags) {
					tags.add(tag);
				}
			}
		}
	} catch (error: unknown) {
		// ENOENT is expected (directory may not exist) — skip silently.
		// Other errors (EACCES, etc.) are logged but non-fatal.
		if (!isEnoentError(error)) {
			console.error(
				"[adaptive-injector] readdir failed for project root, skipping extension detection:",
				error instanceof Error ? error.message : String(error),
			);
		}
	}

	return [...tags];
}

/**
 * Filter skills by detected stack tags.
 * Skills with empty stacks are ALWAYS included (methodology skills).
 * Skills with non-empty stacks are included only if at least one tag matches.
 */
export function filterSkillsByStack(
	skills: ReadonlyMap<string, LoadedSkill>,
	tags: readonly string[],
): ReadonlyMap<string, LoadedSkill> {
	const tagSet = new Set(tags);
	const filtered = new Map<string, LoadedSkill>();

	for (const [name, skill] of skills) {
		if (skill.frontmatter.stacks.length === 0) {
			filtered.set(name, skill);
		} else if (skill.frontmatter.stacks.some((s) => tagSet.has(s))) {
			filtered.set(name, skill);
		}
	}

	return filtered;
}

/**
 * Build multi-skill context string with dependency ordering and token budget.
 * Skills are ordered by dependency (prerequisites first), then concatenated
 * until the token budget is exhausted.
 */
export function buildMultiSkillContext(
	skills: ReadonlyMap<string, LoadedSkill>,
	tokenBudget: number = DEFAULT_TOKEN_BUDGET,
): string {
	if (skills.size === 0) return "";

	// Resolve dependency order
	const depMap = new Map(
		[...skills.entries()].map(([name, skill]) => [name, { requires: skill.frontmatter.requires }]),
	);
	const { ordered, cycles } = resolveDependencyOrder(depMap);

	// Skip cycle participants (graceful degradation)
	const cycleSet = new Set(cycles);
	const validOrder = ordered.filter((name) => !cycleSet.has(name));

	// Build context with token budget enforcement
	const charBudget = tokenBudget * CHARS_PER_TOKEN;
	let totalChars = 0;
	const sections: string[] = [];

	for (const name of validOrder) {
		const skill = skills.get(name);
		if (!skill) continue;

		const collapsed = skill.content.replace(/[\r\n]+/g, " ");
		const header = `[Skill: ${name}]\n`;
		const separator = sections.length > 0 ? 2 : 0; // "\n\n"
		const sectionCost = collapsed.length + header.length + separator;
		if (totalChars + sectionCost > charBudget) break;

		const sanitized = sanitizeTemplateContent(collapsed);
		sections.push(`${header}${sanitized}`);
		totalChars += sectionCost;
	}

	if (sections.length === 0) return "";
	return `\n\nSkills context (follow these conventions and methodologies):\n${sections.join("\n\n")}`;
}
