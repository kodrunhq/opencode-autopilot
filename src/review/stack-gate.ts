import { basename } from "node:path";
import type { AgentDefinition } from "./types";

/**
 * Maps gated agent names to their required stack tags.
 * If the agent is not in this map, it is ungated (always allowed).
 * If listed, at least ONE of the required tags must be present in the project.
 */
export const STACK_GATE_RULES: Readonly<Record<string, readonly string[]>> = Object.freeze({
	"react-patterns-auditor": Object.freeze(["react", "nextjs"]),
	"go-idioms-auditor": Object.freeze(["go"]),
	"python-django-auditor": Object.freeze(["django", "fastapi"]),
	"rust-safety-auditor": Object.freeze(["rust"]),
	"state-mgmt-auditor": Object.freeze(["react", "vue", "svelte", "angular"]),
	"type-soundness": Object.freeze(["typescript", "kotlin", "rust", "go"]),
});

/**
 * Filters agents based on detected project stack tags.
 * Agents not in STACK_GATE_RULES are always kept (ungated).
 * Gated agents are kept only if at least one required tag matches.
 */
export function applyStackGate(
	agents: readonly AgentDefinition[],
	tags: readonly string[],
): readonly AgentDefinition[] {
	const tagSet = new Set(tags);

	return agents.filter((agent) => {
		const requiredTags = STACK_GATE_RULES[agent.name];

		// Ungated agent: always allow
		if (requiredTags === undefined) {
			return true;
		}

		// Gated agent: allow if any required tag matches
		return requiredTags.some((tag) => tagSet.has(tag));
	});
}

/**
 * Extension-to-tag mappings for stack detection from file paths.
 */
const EXTENSION_TAGS: Readonly<Record<string, readonly string[]>> = Object.freeze({
	".ts": Object.freeze(["typescript"]),
	".tsx": Object.freeze(["typescript", "react"]),
	".js": Object.freeze(["javascript"]),
	".jsx": Object.freeze(["javascript", "react"]),
	".go": Object.freeze(["go"]),
	".py": Object.freeze(["python"]),
	".rs": Object.freeze(["rust"]),
	".vue": Object.freeze(["vue", "javascript"]),
	".svelte": Object.freeze(["svelte", "javascript"]),
	".kt": Object.freeze(["kotlin"]),
	".kts": Object.freeze(["kotlin"]),
});

/**
 * Django-specific file patterns that indicate the Django framework.
 */
const DJANGO_INDICATORS = Object.freeze([
	"manage.py",
	"wsgi.py",
	"asgi.py",
	"settings.py",
	"urls.py",
	"admin.py",
]);

/**
 * Framework-specific filename patterns for detection beyond extensions.
 * Maps filename (or pattern) to the tags it indicates.
 */
const FRAMEWORK_INDICATORS: Readonly<Record<string, readonly string[]>> = Object.freeze({
	"next.config.js": Object.freeze(["nextjs", "react", "javascript"]),
	"next.config.ts": Object.freeze(["nextjs", "react", "typescript"]),
	"next.config.mjs": Object.freeze(["nextjs", "react", "javascript"]),
	"angular.json": Object.freeze(["angular", "typescript"]),
	"nuxt.config.ts": Object.freeze(["vue", "typescript"]),
	"nuxt.config.js": Object.freeze(["vue", "javascript"]),
	"svelte.config.js": Object.freeze(["svelte", "javascript"]),
});

/**
 * Detect stack tags from a list of file paths by examining extensions
 * and framework-specific filenames.
 */
export function detectStackTags(filePaths: readonly string[]): readonly string[] {
	const tags = new Set<string>();

	for (const filePath of filePaths) {
		const fileName = basename(filePath);

		// Check extension-based tags
		for (const [ext, extTags] of Object.entries(EXTENSION_TAGS)) {
			if (filePath.endsWith(ext)) {
				for (const tag of extTags) {
					tags.add(tag);
				}
				break;
			}
		}

		// Check Django indicators
		if (DJANGO_INDICATORS.includes(fileName)) {
			tags.add("python");
			tags.add("django");
		}

		// Check framework indicators (Next.js, Angular, Nuxt, Svelte)
		const frameworkTags = FRAMEWORK_INDICATORS[fileName];
		if (frameworkTags) {
			for (const tag of frameworkTags) {
				tags.add(tag);
			}
		}

		// FastAPI indicator — any .py file with "fastapi" in path
		if (filePath.endsWith(".py") && filePath.includes("fastapi")) {
			tags.add("python");
			tags.add("fastapi");
		}
	}

	return [...tags];
}
