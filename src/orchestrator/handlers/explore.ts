import type { Dirent } from "node:fs";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { getLogger } from "../../logging/domains";
import { getProjectRootFromArtifactDir } from "../../utils/paths";
import { ensurePhaseDir, getArtifactRef, getPhaseDir } from "../artifacts";
import type { DispatchResult, PhaseHandler } from "./types";

const logger = getLogger("orchestrator", "explore");

const MAX_SCAN_DEPTH = 3;
const MAX_KEY_DIRECTORIES = 20;
const MAX_SUMMARY_ITEMS = 5;
const MAX_ANALYZED_TEXT_FILE_BYTES = 64 * 1024;

const SKIPPED_DIRECTORY_NAMES = new Set([
	".git",
	".idea",
	".next",
	".opencode-autopilot",
	".turbo",
	"coverage",
	"dist",
	"node_modules",
	"out",
]);

const LANGUAGE_LABELS: Readonly<Record<string, string>> = Object.freeze({
	".cjs": "JavaScript",
	".cs": "C#",
	".css": "CSS",
	".go": "Go",
	".html": "HTML",
	".java": "Java",
	".js": "JavaScript",
	".json": "JSON",
	".jsx": "React",
	".kt": "Kotlin",
	".md": "Markdown",
	".mjs": "JavaScript",
	".py": "Python",
	".rb": "Ruby",
	".rs": "Rust",
	".sh": "Shell",
	".sql": "SQL",
	".swift": "Swift",
	".toml": "TOML",
	".ts": "TypeScript",
	".tsx": "React",
	".yaml": "YAML",
	".yml": "YAML",
});

type ReadonlyRecord<K extends string, V> = Readonly<Record<K, V>>;

interface ArchitectureContext {
	readonly focusAreas: readonly string[];
	readonly sources: readonly string[];
}

interface ExplorationResult {
	readonly summary: string;
	readonly totalFiles: number;
	readonly languages: ReadonlyRecord<string, number>;
	readonly riskAreas: readonly string[];
	readonly techDebtIndicators: readonly string[];
	readonly relevantPatterns: readonly string[];
	readonly keyDirectories: readonly string[];
	readonly architectureInputs: readonly string[];
}

interface ScanState {
	readonly architecture: ArchitectureContext;
	readonly keyDirectories: Set<string>;
	readonly largeFiles: string[];
	readonly manifestFiles: Set<string>;
	readonly todoMatches: string[];
	totalFiles: number;
	testFiles: number;
	sourceFiles: number;
	readonly languages: Record<string, number>;
}

function hasErrnoCode(error: unknown): boolean {
	return (
		error !== null &&
		typeof error === "object" &&
		"code" in error &&
		typeof (error as { code?: unknown }).code === "string"
	);
}

function asRelativeDirectory(projectRoot: string, fullPath: string): string {
	const rel = relative(projectRoot, fullPath);
	return rel.length > 0 ? rel : ".";
}

function asLanguageLabel(extension: string): string {
	return LANGUAGE_LABELS[extension] ?? extension;
}

function isTextLikeFile(extension: string): boolean {
	return (
		extension.length > 0 &&
		![".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".pdf"].includes(extension)
	);
}

function isLikelySourceFile(extension: string): boolean {
	return [
		".cjs",
		".cs",
		".css",
		".go",
		".html",
		".java",
		".js",
		".jsx",
		".kt",
		".py",
		".rb",
		".rs",
		".sh",
		".sql",
		".swift",
		".ts",
		".tsx",
	].includes(extension);
}

function isTestPath(path: string): boolean {
	return /(\/|^)(tests?|__tests__)(\/|$)|\.(test|spec)\./i.test(path);
}

function hasDirectoryName(directories: ReadonlySet<string>, target: string): boolean {
	for (const directory of directories) {
		if (directory === target || directory.split("/").includes(target)) {
			return true;
		}
	}

	return false;
}

function buildRiskAreas(scan: ScanState): readonly string[] {
	const riskAreas: string[] = [];
	const directories = scan.keyDirectories;
	const manifests = scan.manifestFiles;

	if (
		hasDirectoryName(directories, "migrations") ||
		hasDirectoryName(directories, "prisma") ||
		manifests.has("schema.prisma")
	) {
		riskAreas.push(
			"Database change surface detected — verify schema migrations, data compatibility, and rollback safety.",
		);
	}

	if (hasDirectoryName(directories, "scripts") || hasDirectoryName(directories, ".github")) {
		riskAreas.push(
			"Automation scripts/CI config present — build and release workflows are high-impact change areas.",
		);
	}

	if (
		hasDirectoryName(directories, "infra") ||
		hasDirectoryName(directories, "terraform") ||
		manifests.has("docker-compose.yml")
	) {
		riskAreas.push(
			"Infrastructure definitions detected — environment drift and deployment assumptions need extra care.",
		);
	}

	if (scan.architecture.sources.length === 0) {
		riskAreas.push(
			"ARCHITECT artifacts were not found — exploration relied on repository structure only.",
		);
	}

	return Object.freeze(riskAreas);
}

function buildTechDebtIndicators(scan: ScanState): readonly string[] {
	const indicators: string[] = [];

	if (scan.largeFiles.length > 0) {
		indicators.push(
			`${scan.largeFiles.length} large text file(s) over ${Math.floor(MAX_ANALYZED_TEXT_FILE_BYTES / 1024)}KB: ${scan.largeFiles
				.slice(0, MAX_SUMMARY_ITEMS)
				.join(", ")}`,
		);
	}

	if (scan.todoMatches.length > 0) {
		indicators.push(
			`${scan.todoMatches.length} TODO/FIXME marker(s) found in scanned files: ${scan.todoMatches
				.slice(0, MAX_SUMMARY_ITEMS)
				.join(", ")}`,
		);
	}

	if (scan.sourceFiles > 0 && scan.testFiles === 0) {
		indicators.push(
			"Source files were detected without matching tests in the scanned project surface.",
		);
	}

	if (scan.keyDirectories.size > 12) {
		indicators.push(
			`Wide repository surface area detected (${scan.keyDirectories.size} directories within depth ${MAX_SCAN_DEPTH}).`,
		);
	}

	return Object.freeze(indicators);
}

function buildRelevantPatterns(scan: ScanState): readonly string[] {
	const patterns: string[] = [];
	const directories = scan.keyDirectories;
	const manifests = scan.manifestFiles;

	if (hasDirectoryName(directories, "src")) {
		patterns.push("Primary source code is organized under src/.");
	}

	if (hasDirectoryName(directories, "tests") || scan.testFiles > 0) {
		patterns.push("Tests are present and separated from production code.");
	}

	if (hasDirectoryName(directories, "docs")) {
		patterns.push("Documentation lives alongside code changes in docs/.");
	}

	if (manifests.has("package.json") || manifests.has("bun.lock") || manifests.has("bun.lockb")) {
		patterns.push("Node/Bun package management files are present.");
	}

	if (manifests.has("tsconfig.json")) {
		patterns.push("TypeScript compilation is configured with tsconfig.json.");
	}

	if (manifests.has("biome.json") || manifests.has("biome.jsonc")) {
		patterns.push("Biome is configured for formatting/linting.");
	}

	for (const source of scan.architecture.sources) {
		patterns.push(`Architecture context available from ${source}.`);
	}

	for (const focusArea of scan.architecture.focusAreas.slice(0, 2)) {
		patterns.push(`Architecture focus area: ${focusArea}`);
	}

	return Object.freeze(patterns.slice(0, MAX_KEY_DIRECTORIES));
}

function formatTopLanguages(languages: Readonly<Record<string, number>>): string {
	const entries = Object.entries(languages)
		.sort(([, leftCount], [, rightCount]) => rightCount - leftCount)
		.slice(0, MAX_SUMMARY_ITEMS)
		.map(([language, count]) => `${language}: ${count}`);

	return entries.length > 0 ? entries.join(", ") : "none detected";
}

function renderExplorationReport(exploration: ExplorationResult, projectRoot: string): string {
	const renderList = (items: readonly string[], empty: string): string =>
		items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : `- ${empty}`;

	return [
		"# EXPLORE Report",
		"",
		`Project root: ${projectRoot}`,
		"",
		"## Summary",
		exploration.summary,
		"",
		"## Languages",
		formatTopLanguages(exploration.languages),
		"",
		"## Key Directories",
		renderList(exploration.keyDirectories, "No key directories identified within scan depth."),
		"",
		"## Risk Areas",
		renderList(
			exploration.riskAreas,
			"No immediate high-risk areas were inferred from the scanned structure.",
		),
		"",
		"## Tech Debt Indicators",
		renderList(
			exploration.techDebtIndicators,
			"No obvious tech debt indicators were found in the scanned surface.",
		),
		"",
		"## Relevant Patterns",
		renderList(exploration.relevantPatterns, "No dominant structural patterns were inferred."),
		"",
		"## Architecture Inputs",
		renderList(
			exploration.architectureInputs,
			"No ARCHITECT artifacts were available to guide exploration.",
		),
		"",
	].join("\n");
}

function renderExplorationMessage(exploration: ExplorationResult, reportPath: string): string {
	return [
		`Report: ${reportPath}`,
		`Risk areas: ${exploration.riskAreas.length > 0 ? exploration.riskAreas.join(" | ") : "none identified"}`,
		`Tech debt: ${exploration.techDebtIndicators.length > 0 ? exploration.techDebtIndicators.join(" | ") : "none identified"}`,
		`Patterns: ${exploration.relevantPatterns.length > 0 ? exploration.relevantPatterns.join(" | ") : "none identified"}`,
	].join("\n");
}

async function loadArchitectureContext(
	artifactDir: string,
	runId: string | undefined,
): Promise<ArchitectureContext> {
	const phaseDir = getPhaseDir(artifactDir, "ARCHITECT", runId);
	const candidateFiles = [
		{ label: "design.md", path: getArtifactRef(artifactDir, "ARCHITECT", "design.md", runId) },
		{
			label: "critique.md",
			path: getArtifactRef(artifactDir, "ARCHITECT", "critique.md", runId),
		},
	];
	const sources: string[] = [];
	const focusAreas = new Set<string>();

	for (const candidate of candidateFiles) {
		try {
			const content = await readFile(candidate.path, "utf-8");
			sources.push(candidate.label);
			for (const match of content.matchAll(/^##\s+(.+)$/gm)) {
				const heading = match[1]?.trim();
				if (heading) {
					focusAreas.add(heading);
				}
			}
		} catch (error: unknown) {
			if (hasErrnoCode(error)) {
				continue;
			}
			throw error;
		}
	}

	try {
		const entries = await readdir(join(phaseDir, "proposals"), { withFileTypes: true });
		const proposalFiles = entries
			.filter(
				(entry) =>
					entry.isFile() && entry.name.startsWith("proposal-") && entry.name.endsWith(".md"),
			)
			.map((entry) => entry.name)
			.sort();
		if (proposalFiles.length > 0) {
			sources.push(...proposalFiles.map((file) => `proposals/${file}`));
		}
	} catch (error: unknown) {
		if (!hasErrnoCode(error)) {
			throw error;
		}
	}

	return Object.freeze({
		focusAreas: Object.freeze([...focusAreas].slice(0, MAX_KEY_DIRECTORIES)),
		sources: Object.freeze(sources),
	});
}

async function scanDirectory(
	projectRoot: string,
	directory: string,
	depth: number,
	scan: ScanState,
): Promise<void> {
	if (depth > MAX_SCAN_DEPTH) {
		return;
	}

	let entries: readonly Dirent<string>[];
	try {
		entries = await readdir(directory, { withFileTypes: true });
	} catch (error: unknown) {
		logger.warn("Skipping unreadable directory during EXPLORE scan", {
			operation: "scan_directory",
			directory,
			error: error instanceof Error ? error.message : String(error),
		});
		return;
	}

	for (const entry of entries) {
		if (entry.name.startsWith(".") && entry.name !== ".github") {
			continue;
		}
		if (SKIPPED_DIRECTORY_NAMES.has(entry.name)) {
			continue;
		}

		const fullPath = join(directory, entry.name);

		if (entry.isSymbolicLink()) {
			continue;
		}

		if (entry.isDirectory()) {
			scan.keyDirectories.add(asRelativeDirectory(projectRoot, fullPath));
			await scanDirectory(projectRoot, fullPath, depth + 1, scan);
			continue;
		}

		if (!entry.isFile()) {
			continue;
		}

		scan.totalFiles += 1;
		const extension = extname(entry.name).toLowerCase();
		const relativePath = relative(projectRoot, fullPath);

		if (isLikelySourceFile(extension)) {
			scan.sourceFiles += 1;
		}
		if (isTestPath(relativePath)) {
			scan.testFiles += 1;
		}

		const language = extension.length > 0 ? asLanguageLabel(extension) : "no-extension";
		scan.languages[language] = (scan.languages[language] ?? 0) + 1;
		scan.manifestFiles.add(entry.name);

		let fileStat: Awaited<ReturnType<typeof stat>>;
		try {
			fileStat = await stat(fullPath);
		} catch (error: unknown) {
			logger.warn("Skipping unreadable file during EXPLORE scan", {
				operation: "scan_file",
				file: fullPath,
				error: error instanceof Error ? error.message : String(error),
			});
			continue;
		}

		if (fileStat.size > MAX_ANALYZED_TEXT_FILE_BYTES && isTextLikeFile(extension)) {
			scan.largeFiles.push(relativePath);
			continue;
		}

		if (!isTextLikeFile(extension)) {
			continue;
		}

		try {
			const content = await readFile(fullPath, "utf-8");
			if (/TODO|FIXME/i.test(content)) {
				scan.todoMatches.push(relativePath);
			}
		} catch (error: unknown) {
			logger.warn("Skipping unreadable text file during EXPLORE scan", {
				operation: "scan_text_file",
				file: fullPath,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}
}

async function exploreCodebase(
	projectRoot: string,
	architecture: ArchitectureContext,
): Promise<ExplorationResult> {
	const scan: ScanState = {
		architecture,
		keyDirectories: new Set<string>(),
		largeFiles: [],
		manifestFiles: new Set<string>(),
		todoMatches: [],
		totalFiles: 0,
		testFiles: 0,
		sourceFiles: 0,
		languages: {},
	};

	await scanDirectory(projectRoot, projectRoot, 0, scan);

	const languages = Object.freeze(
		Object.fromEntries(Object.entries(scan.languages).sort((left, right) => right[1] - left[1])),
	) as ReadonlyRecord<string, number>;

	const keyDirectories = Object.freeze(
		[...scan.keyDirectories].sort().slice(0, MAX_KEY_DIRECTORIES),
	);
	const riskAreas = buildRiskAreas(scan);
	const techDebtIndicators = buildTechDebtIndicators(scan);
	const relevantPatterns = buildRelevantPatterns(scan);
	const architectureInputs = Object.freeze([...architecture.sources]);
	const summary = `scanned ${scan.totalFiles} file(s) across ${keyDirectories.length} key director${
		keyDirectories.length === 1 ? "y" : "ies"
	}; top languages: ${formatTopLanguages(languages)}`;

	return Object.freeze({
		summary,
		totalFiles: scan.totalFiles,
		languages,
		riskAreas,
		techDebtIndicators,
		relevantPatterns,
		keyDirectories,
		architectureInputs,
	});
}

export const handleExplore: PhaseHandler = async (state, artifactDir, _result?) => {
	const projectRoot = getProjectRootFromArtifactDir(artifactDir);
	const architecture = await loadArchitectureContext(artifactDir, state.runId);
	const exploration = await exploreCodebase(projectRoot, architecture);
	await ensurePhaseDir(artifactDir, "EXPLORE", state.runId);
	const reportPath = getArtifactRef(artifactDir, "EXPLORE", "report.md", state.runId);
	await writeFile(reportPath, renderExplorationReport(exploration, projectRoot), "utf-8");

	return Object.freeze({
		action: "complete",
		resultKind: "phase_output",
		phase: "EXPLORE",
		progress: `EXPLORE complete: ${exploration.summary}; skipped external dispatch because exploration runs locally.`,
		message: renderExplorationMessage(exploration, reportPath),
		_stateUpdates: {
			exploreTriggered: true,
		},
		_userProgress: `[4/8] EXPLORE complete — ${exploration.summary}`,
	} satisfies DispatchResult);
};
