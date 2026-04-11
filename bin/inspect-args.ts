type InspectView =
	| "projects"
	| "project"
	| "paths"
	| "runs"
	| "events"
	| "lessons"
	| "preferences"
	| "memory";

export interface ParsedInspectArgs {
	readonly view: InspectView | null;
	readonly json: boolean;
	readonly verbose: boolean;
	readonly projectRef: string | null;
	readonly limit: number;
	readonly runId: string | null;
	readonly sessionId: string | null;
	readonly type: string | null;
	readonly help: boolean;
	readonly error: string | null;
	readonly global: boolean;
	readonly pruneEphemeral: boolean;
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

function isInspectView(value: string): value is InspectView {
	return INSPECT_VIEWS.includes(value as InspectView);
}

export function inspectUsage(): string {
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
		"  --global                     Use global database (default: current project)",
		"  --prune-ephemeral            Remove ephemeral test/temp project records from DB",
		"  --run-id <id>                Filter events by run id",
		"  --session-id <id>            Filter events by session id",
		"  --type <type>                Filter events by type",
		"  --limit <n>                  Limit rows (default: 20 for runs, 50 elsewhere)",
		"  --verbose                    Show full content and expanded detail blocks",
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

export function parseInspectArgs(args: readonly string[]): ParsedInspectArgs {
	let view: InspectView | null = null;
	let json = false;
	let verbose = false;
	let projectRef: string | null = null;
	let limit = 50;
	let runId: string | null = null;
	let sessionId: string | null = null;
	let type: string | null = null;
	let help = false;
	let error: string | null = null;
	let global = false;
	let pruneEphemeral = false;

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
		if (arg === "--verbose") {
			verbose = true;
			continue;
		}
		if (arg === "--global") {
			global = true;
			continue;
		}
		if (arg === "--prune-ephemeral") {
			pruneEphemeral = true;
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
			if (isInspectView(arg)) {
				view = arg;
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

	if (!help && error === null && view === null && !pruneEphemeral) {
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
		verbose,
		projectRef,
		limit,
		runId,
		sessionId,
		type,
		help,
		error,
		global,
		pruneEphemeral,
	};
}
