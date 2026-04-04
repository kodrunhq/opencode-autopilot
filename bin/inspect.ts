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

type InspectView =
	| "projects"
	| "project"
	| "paths"
	| "runs"
	| "events"
	| "lessons"
	| "preferences"
	| "memory";

export interface InspectCliOptions {
	readonly dbPath?: string;
}

export interface InspectCliResult {
	readonly isError: boolean;
	readonly output: string;
	readonly format: "text" | "json";
}

interface ParsedInspectArgs {
	readonly view: InspectView | null;
	readonly json: boolean;
	readonly projectRef: string | null;
	readonly limit: number;
	readonly runId: string | null;
	readonly sessionId: string | null;
	readonly type: string | null;
	readonly help: boolean;
	readonly error: string | null;
}

const INSPECT_VIEWS: readonly InspectView[] = Object.freeze([
	"projects",
	"project",
	"paths",
	"runs",
	"events",
	"lessons",
	"preferences",
	"memory",
]);

function inspectUsage(): string {
	return [
		"Usage: opencode-autopilot inspect <view> [options]",
		"",
		"Views:",
		"  projects                     List known projects",
		"  project --project <ref>      Show one project's details",
		"  paths --project <ref>        List one project's path history",
		"  runs [--project <ref>]       List pipeline runs",
		"  events [--project <ref>]     List forensic events",
		"  lessons [--project <ref>]    List stored lessons",
		"  preferences                  List stored preferences",
		"  memory                       Show memory overview",
		"",
		"Options:",
		"  --project <ref>              Project id, path, or unique name",
		"  --run-id <id>                Filter events by run id",
		"  --session-id <id>            Filter events by session id",
		"  --type <type>                Filter events by type",
		"  --limit <n>                  Limit rows (default: 20 for runs, 50 elsewhere)",
		"  --json                       Emit JSON output",
		"  --help, -h                   Show inspect help",
	].join("\n");
}

function parsePositiveInt(raw: string): number | null {
	const parsed = Number.parseInt(raw, 10);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return null;
	}
	return parsed;
}

function parseInspectArgs(args: readonly string[]): ParsedInspectArgs {
	let view: InspectView | null = null;
	let json = false;
	let projectRef: string | null = null;
	let limit = 50;
	let runId: string | null = null;
	let sessionId: string | null = null;
	let type: string | null = null;
	let help = false;
	let error: string | null = null;

	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (arg === "--help" || arg === "-h") {
			help = true;
			continue;
		}
		if (arg === "--json") {
			json = true;
			continue;
		}
		if (arg === "--project") {
			projectRef = args[index + 1] ?? null;
			if (projectRef === null) {
				error = "Missing value for --project.";
				break;
			}
			index += 1;
			continue;
		}
		if (arg === "--limit") {
			const parsed = parsePositiveInt(args[index + 1] ?? "");
			if (parsed === null) {
				error = "--limit must be a positive integer.";
				break;
			}
			limit = parsed;
			index += 1;
			continue;
		}
		if (arg === "--run-id") {
			runId = args[index + 1] ?? null;
			if (runId === null) {
				error = "Missing value for --run-id.";
				break;
			}
			index += 1;
			continue;
		}
		if (arg === "--session-id") {
			sessionId = args[index + 1] ?? null;
			if (sessionId === null) {
				error = "Missing value for --session-id.";
				break;
			}
			index += 1;
			continue;
		}
		if (arg === "--type") {
			type = args[index + 1] ?? null;
			if (type === null) {
				error = "Missing value for --type.";
				break;
			}
			index += 1;
			continue;
		}

		if (view === null) {
			if ((INSPECT_VIEWS as readonly string[]).includes(arg)) {
				view = arg as InspectView;
				if (view === "runs") {
					limit = 20;
				}
				continue;
			}
			error = `Unknown inspect view: ${arg}`;
			break;
		}

		if (projectRef === null && (view === "project" || view === "paths")) {
			projectRef = arg;
			continue;
		}

		error = `Unexpected argument: ${arg}`;
		break;
	}

	if (!help && error === null && view === null) {
		help = true;
	}

	if (
		error === null &&
		(view === "project" || view === "paths") &&
		(projectRef === null || projectRef.trim().length === 0)
	) {
		error = `${view} view requires --project <ref> or a positional project reference.`;
	}

	return {
		view,
		json,
		projectRef,
		limit,
		runId,
		sessionId,
		type,
		help,
		error,
	};
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

	const dbInput = options.dbPath;
	switch (parsed.view) {
		case "projects": {
			const projects = listProjects(dbInput);
			return makeOutput(
				{ action: "inspect_projects", projects },
				parsed.json,
				formatProjects(projects),
			);
		}
		case "project": {
			const details = getProjectDetails(parsed.projectRef!, dbInput);
			if (details === null) {
				return makeError(`Project not found: ${parsed.projectRef}`, parsed.json);
			}
			return makeOutput(
				{ action: "inspect_project", project: details },
				parsed.json,
				formatProjectDetails(details),
			);
		}
		case "paths": {
			const details = getProjectDetails(parsed.projectRef!, dbInput);
			if (details === null) {
				return makeError(`Project not found: ${parsed.projectRef}`, parsed.json);
			}
			return makeOutput(
				{ action: "inspect_paths", project: details.project, paths: details.paths },
				parsed.json,
				formatPaths(details),
			);
		}
		case "runs": {
			const runs = listRuns(
				{ projectRef: parsed.projectRef ?? undefined, limit: parsed.limit },
				dbInput,
			);
			return makeOutput({ action: "inspect_runs", runs }, parsed.json, formatRuns(runs));
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
			return makeOutput({ action: "inspect_events", events }, parsed.json, formatEvents(events));
		}
		case "lessons": {
			const lessons = listLessons(
				{ projectRef: parsed.projectRef ?? undefined, limit: parsed.limit },
				dbInput,
			);
			return makeOutput(
				{ action: "inspect_lessons", lessons },
				parsed.json,
				formatLessons(lessons),
			);
		}
		case "preferences": {
			const preferences = listPreferences(dbInput);
			return makeOutput(
				{ action: "inspect_preferences", preferences },
				parsed.json,
				formatPreferences(preferences),
			);
		}
		case "memory": {
			const overview = getMemoryOverview(dbInput);
			return makeOutput(
				{ action: "inspect_memory", overview },
				parsed.json,
				formatMemoryOverview(overview),
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
