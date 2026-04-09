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
import { getLogger } from "../logging/domains";
import { getGlobalMcpManager } from "../mcp";
import { sanitizeTemplateContent } from "../review/sanitize";
import { isEnoentError } from "../utils/fs-helpers";
import { resolveDependencyOrder } from "./dependency-resolver";
import type { LoadedSkill } from "./loader";

const DEFAULT_TOKEN_BUDGET = 8000;
/** Rough estimate: 1 token ~ 4 chars */
const CHARS_PER_TOKEN = 4;

const mcpLogger = getLogger("mcp", "skill-activation");

function activateMcpForSkills(skills: ReadonlyMap<string, LoadedSkill>, mcpEnabled: boolean): void {
	if (!mcpEnabled) return;

	const manager = getGlobalMcpManager();
	if (!manager) return;

	for (const [name, skill] of skills) {
		if (skill.frontmatter.mcp) {
			manager.startServer(name, skill.frontmatter.mcp).catch((error: unknown) => {
				mcpLogger.warn("Failed to start MCP server for skill", {
					skill: name,
					error: error instanceof Error ? error.message : String(error),
				});
			});
		}
	}
}

/**
 * Maps pipeline phases to the skill names relevant for that phase.
 * Skills not in the list for the current phase are excluded from injection,
 * preventing the full 13-19KB per-skill content from bloating every dispatch.
 */
export const PHASE_SKILL_MAP: Readonly<Record<string, readonly string[]>> = Object.freeze({
	RECON: ["domain-research", "evidence-gathering"],
	CHALLENGE: ["scope-pruning", "risk-assessment"],
	ARCHITECT: ["architecture-decision-records", "system-design"],
	PLAN: ["plan-writing", "plan-executing"],
	BUILD: ["coding-standards", "tdd-workflow"],
	SHIP: ["plan-executing"],
	RETROSPECTIVE: ["lessons-learned", "continuous-improvement"],
	EXPLORE: ["codebase-mapping", "exploration-methodology"],
});

const MCP_SUPPORT_NOTE =
	"Embedded MCP support is available for skills that declare an MCP server when plugin config.mcp.enabled is true.";

export type SkillMode = "summary" | "full";

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

	// Debug: log project root to diagnose CI issue
	console.log("DEBUG detectProjectStackTags projectRoot:", projectRoot);

	const results = await Promise.all(
		Object.entries(MANIFEST_TAGS).map(async ([manifest, manifestTags]) => {
			try {
				await access(join(projectRoot, manifest));
				console.log("DEBUG found manifest:", manifest, "tags:", manifestTags);
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
		console.log("DEBUG readdir entries:", entries);
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

	console.log("DEBUG detected tags:", [...tags]);
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
 * Build a compact summary for a single skill: frontmatter name + description
 * (max 200 chars). Used in summary mode to avoid injecting full skill content.
 */
export function buildSkillSummary(skill: LoadedSkill): string {
	const { name, description } = skill.frontmatter;
	const safeName = sanitizeTemplateContent(name);
	const safeDesc = sanitizeTemplateContent((description ?? "").slice(0, 200));
	const mcpNote = skill.frontmatter.mcp ? `\n${MCP_SUPPORT_NOTE}` : "";
	return `[Skill: ${safeName}]\n${safeDesc}${mcpNote}`;
}

/**
 * In full mode, truncate skill content at the first `## ` heading boundary
 * that exceeds the per-skill character budget. Preserves structure instead
 * of collapsing all newlines.
 */
function truncateAtSectionBoundary(content: string, maxChars: number): string {
	if (content.length <= maxChars) return content;
	const cutPoint = content.lastIndexOf("\n## ", maxChars);
	if (cutPoint > 0) return content.slice(0, cutPoint);
	return content.slice(0, maxChars);
}

/**
 * Build multi-skill context string with dependency ordering and token budget.
 * Skills are ordered by dependency (prerequisites first), then concatenated
 * until the token budget is exhausted.
 *
 * @param mode - "summary" emits only name + description (compact); "full" preserves structure
 */
export function buildMultiSkillContext(
	skills: ReadonlyMap<string, LoadedSkill>,
	tokenBudget: number = DEFAULT_TOKEN_BUDGET,
	mode: SkillMode = "summary",
	mcpEnabled = true,
): string {
	if (skills.size === 0) return "";

	activateMcpForSkills(skills, mcpEnabled);

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

		let section: string;
		if (mode === "summary") {
			section = sanitizeTemplateContent(buildSkillSummary(skill));
		} else {
			// Full mode: preserve structure, truncate at section boundaries
			const header = `[Skill: ${name}]\n`;
			const perSkillBudget = Math.max(charBudget - totalChars - header.length, 0);
			const truncated = truncateAtSectionBoundary(skill.content, perSkillBudget);
			const sanitized = sanitizeTemplateContent(truncated);
			section = `${header}${sanitized}`;
		}

		const separator = sections.length > 0 ? 2 : 0; // "\n\n"
		const sectionCost = section.length + separator;
		if (totalChars + sectionCost > charBudget) break;

		sections.push(section);
		totalChars += sectionCost;
	}

	if (sections.length === 0) return "";
	return `\n\nSkills context (follow these conventions and methodologies):\n${sections.join("\n\n")}`;
}

/**
 * Build adaptive skill context with optional phase filtering.
 *
 * When `phase` is provided, only skills listed in PHASE_SKILL_MAP for that
 * phase are included (pipeline dispatch path). When omitted, all stack-filtered
 * skills are included (direct chat injection path).
 */
export function buildAdaptiveSkillContext(
	skills: ReadonlyMap<string, LoadedSkill>,
	options?: {
		readonly phase?: string;
		readonly budget?: number;
		readonly mode?: SkillMode;
		readonly mcpEnabled?: boolean;
	},
): string {
	const phase = options?.phase;
	const budget = options?.budget ?? DEFAULT_TOKEN_BUDGET;
	const mode = options?.mode ?? "summary";
	const mcpEnabled = options?.mcpEnabled ?? true;

	if (phase !== undefined) {
		const allowedNames = PHASE_SKILL_MAP[phase] ?? [];
		if (allowedNames.length === 0) return "";

		const allowedSet = new Set(allowedNames);
		const filtered = new Map<string, LoadedSkill>();
		for (const [name, skill] of skills) {
			if (allowedSet.has(name)) {
				filtered.set(name, skill);
			}
		}

		return buildMultiSkillContext(filtered, budget, mode, mcpEnabled);
	}

	// No phase -- include all provided skills (caller already stack-filtered)
	return buildMultiSkillContext(skills, budget, mode, mcpEnabled);
}
