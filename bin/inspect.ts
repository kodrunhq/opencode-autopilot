import { execSync } from "node:child_process";
import {
	formatEvents,
	formatLessons,
	formatMemoryOverview,
	formatPaths,
	formatPreferences,
	formatProjectDetails,
	formatProjects,
	formatRuns,
} from "../src/inspect/formatters";
import {
	getMemoryOverview,
	getProjectDetails,
	listEvents,
	listLessons,
	listPreferences,
	listProjects,
	listRuns,
} from "../src/inspect/repository";
import { kernelDbExists } from "../src/kernel/database";
import { getAutopilotDbPath, getProjectArtifactDir } from "../src/utils/paths";
import { inspectUsage, parseInspectArgs } from "./inspect-args";

export interface InspectCliOptions {
	readonly dbPath?: string;
}

export interface InspectCliResult {
	readonly isError: boolean;
	readonly output: string;
	readonly format: "text" | "json";
}

function makeOutput(payload: unknown, json: boolean, text: string): InspectCliResult {
	return Object.freeze({
		isError: false,
		format: json ? "json" : "text",
		output: json ? JSON.stringify(payload, null, 2) : text,
	});
}

function makeError(message: string, json: boolean): InspectCliResult {
	return Object.freeze({
		isError: true,
		format: json ? "json" : "text",
		output: json
			? JSON.stringify({ action: "error", message }, null, 2)
			: `${message}\n\n${inspectUsage()}`,
	});
}

export async function inspectCliCore(
	args: readonly string[],
	options: InspectCliOptions = {},
): Promise<InspectCliResult> {
	const parsed = parseInspectArgs(args);
	if (parsed.help) {
		return makeOutput({ action: "help", usage: inspectUsage() }, parsed.json, inspectUsage());
	}
	if (parsed.error !== null) {
		return makeError(parsed.error, parsed.json);
	}

	const globalDbPath = getAutopilotDbPath();
	const gitRoot = resolveGitRoot();
	const projectArtifactDir = gitRoot ? getProjectArtifactDir(gitRoot) : null;
	const projectKernelExists = projectArtifactDir !== null && kernelDbExists(projectArtifactDir);

	function resolveDbInput(view: string): { dbInput: string | undefined; dbScope: string } {
		if (options.dbPath) {
			return { dbInput: options.dbPath, dbScope: "explicit" };
		}
		if (parsed.global) {
			return { dbInput: globalDbPath, dbScope: "global" };
		}

		const globalScopedViews = ["memory", "preferences"];
		if (globalScopedViews.includes(view)) {
			return { dbInput: globalDbPath, dbScope: "global" };
		}

		if (projectKernelExists && projectArtifactDir) {
			return {
				dbInput: `${projectArtifactDir}/kernel.db`,
				dbScope: "project",
			};
		}

		return { dbInput: globalDbPath, dbScope: "global (no project kernel.db found)" };
	}

	const verbose = parsed.verbose;
	switch (parsed.view) {
		case "projects": {
			const { dbInput, dbScope } = resolveDbInput("projects");
			const allProjects = listProjects(dbInput);
			const shouldFilterEphemeral = !parsed.global && !options.dbPath;
			const projects = shouldFilterEphemeral
				? allProjects.filter((p) => !isEphemeralPath(p.path))
				: allProjects;
			const header = verbose ? `DB scope: ${dbScope} (${dbInput})\n\n` : "";
			return makeOutput(
				{ action: "inspect_projects", projects, dbScope, dbPath: dbInput },
				parsed.json,
				`${header}${formatProjects(projects, verbose)}`,
			);
		}
		case "project": {
			const { dbInput, dbScope } = resolveDbInput("project");
			const details = getProjectDetails(parsed.projectRef ?? "", dbInput);
			if (details === null) {
				return makeError(`Project not found: ${parsed.projectRef}`, parsed.json);
			}
			const header = verbose ? `DB scope: ${dbScope} (${dbInput})\n\n` : "";
			return makeOutput(
				{ action: "inspect_project", project: details },
				parsed.json,
				`${header}${formatProjectDetails(details, verbose)}`,
			);
		}
		case "paths": {
			const { dbInput, dbScope } = resolveDbInput("paths");
			const details = getProjectDetails(parsed.projectRef ?? "", dbInput);
			if (details === null) {
				return makeError(`Project not found: ${parsed.projectRef}`, parsed.json);
			}
			const header = verbose ? `DB scope: ${dbScope} (${dbInput})\n\n` : "";
			return makeOutput(
				{ action: "inspect_paths", project: details.project, paths: details.paths },
				parsed.json,
				`${header}${formatPaths(details, verbose)}`,
			);
		}
		case "runs": {
			const { dbInput } = resolveDbInput("runs");
			const runs = listRuns(
				{ projectRef: parsed.projectRef ?? undefined, limit: parsed.limit },
				dbInput,
			);
			return makeOutput({ action: "inspect_runs", runs }, parsed.json, formatRuns(runs, verbose));
		}
		case "events": {
			const { dbInput } = resolveDbInput("events");
			const events = listEvents(
				{
					projectRef: parsed.projectRef ?? undefined,
					runId: parsed.runId ?? undefined,
					sessionId: parsed.sessionId ?? undefined,
					type: parsed.type ?? undefined,
					limit: parsed.limit,
				},
				dbInput,
			);
			return makeOutput(
				{ action: "inspect_events", events },
				parsed.json,
				formatEvents(events, verbose),
			);
		}
		case "lessons": {
			const { dbInput } = resolveDbInput("lessons");
			const lessons = listLessons(
				{ projectRef: parsed.projectRef ?? undefined, limit: parsed.limit },
				dbInput,
			);
			return makeOutput(
				{ action: "inspect_lessons", lessons },
				parsed.json,
				formatLessons(lessons, verbose),
			);
		}
		case "preferences": {
			const { dbInput, dbScope } = resolveDbInput("preferences");
			const preferences = listPreferences(dbInput);
			const header = verbose ? `DB scope: ${dbScope} (${dbInput})\n\n` : "";
			return makeOutput(
				{ action: "inspect_preferences", preferences },
				parsed.json,
				`${header}${formatPreferences(preferences, verbose)}`,
			);
		}
		case "memory": {
			const { dbInput, dbScope } = resolveDbInput("memory");
			const overview = getMemoryOverview(dbInput);
			const header = verbose ? `DB scope: ${dbScope} (${dbInput})\n\n` : "";
			return makeOutput(
				{ action: "inspect_memory", overview },
				parsed.json,
				`${header}${formatMemoryOverview(overview, verbose)}`,
			);
		}
		case null:
			return makeOutput({ action: "help", usage: inspectUsage() }, parsed.json, inspectUsage());
	}
}

export async function runInspect(
	args: readonly string[],
	options: InspectCliOptions = {},
): Promise<void> {
	const result = await inspectCliCore(args, options);
	if (result.isError) {
		console.error(result.output);
		process.exitCode = 1;
		return;
	}

	console.log(result.output);
}

function resolveGitRoot(): string | null {
	try {
		const result = execSync("git rev-parse --show-toplevel", {
			encoding: "utf-8",
			timeout: 3000,
			stdio: ["pipe", "pipe", "pipe"],
		}).trim();
		return result.length > 0 ? result : null;
	} catch {
		return null;
	}
}

function isEphemeralPath(path: string): boolean {
	if (path.startsWith("/var/folders/")) return true;
	if (process.env.TMPDIR && path.startsWith(process.env.TMPDIR)) return true;
	const segments = path.split("/");
	const tmpIdx = segments.indexOf("tmp");
	if (tmpIdx !== -1) {
		const afterTmp = segments.slice(tmpIdx + 1).join("/");
		if (afterTmp.length === 0) return false;
		const ephemeralPrefixes = [
			"forensics-project-",
			"review-tool-",
			"lesson-test-",
			"log-writer-",
			"session-logs-",
			"orchestrate-tool-test-",
			"report-test-",
			"stats-test-",
			"replay-a-",
			"cli-inspect-",
			"kernel-test-",
			"route-test-",
			"memory-test-",
		];
		for (const prefix of ephemeralPrefixes) {
			if (afterTmp.startsWith(prefix)) return true;
		}
	}
	return false;
}
