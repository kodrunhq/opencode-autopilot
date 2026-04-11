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

	let dbInput: string | undefined = options.dbPath;
	let dbScope = "unknown";

	if (!dbInput) {
		if (parsed.global) {
			dbInput = getAutopilotDbPath();
			dbScope = "global";
		} else {
			const cwd = process.cwd();
			const artifactDir = getProjectArtifactDir(cwd);
			if (kernelDbExists(artifactDir)) {
				dbInput = `${artifactDir}/kernel.db`;
				dbScope = "project";
			} else {
				dbInput = getAutopilotDbPath();
				dbScope = "global (no project kernel.db found)";
			}
		}
	} else {
		dbScope = "explicit";
	}

	const verbose = parsed.verbose;
	switch (parsed.view) {
		case "projects": {
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
			const details = getProjectDetails(parsed.projectRef ?? "", dbInput);
			if (details === null) {
				return makeError(`Project not found: ${parsed.projectRef}`, parsed.json);
			}
			return makeOutput(
				{ action: "inspect_project", project: details },
				parsed.json,
				formatProjectDetails(details, verbose),
			);
		}
		case "paths": {
			const details = getProjectDetails(parsed.projectRef ?? "", dbInput);
			if (details === null) {
				return makeError(`Project not found: ${parsed.projectRef}`, parsed.json);
			}
			return makeOutput(
				{ action: "inspect_paths", project: details.project, paths: details.paths },
				parsed.json,
				formatPaths(details, verbose),
			);
		}
		case "runs": {
			const runs = listRuns(
				{ projectRef: parsed.projectRef ?? undefined, limit: parsed.limit },
				dbInput,
			);
			return makeOutput({ action: "inspect_runs", runs }, parsed.json, formatRuns(runs, verbose));
		}
		case "events": {
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
			const preferences = listPreferences(dbInput);
			return makeOutput(
				{ action: "inspect_preferences", preferences },
				parsed.json,
				formatPreferences(preferences, verbose),
			);
		}
		case "memory": {
			const overview = getMemoryOverview(dbInput);
			return makeOutput(
				{ action: "inspect_memory", overview },
				parsed.json,
				formatMemoryOverview(overview, verbose),
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

function isEphemeralPath(path: string): boolean {
	return (
		path.startsWith("/tmp/") ||
		path.startsWith("/var/folders/") ||
		(path.includes("/T/") && path.startsWith("/var")) ||
		path.startsWith(process.env.TMPDIR ?? "/tmp/")
	);
}
