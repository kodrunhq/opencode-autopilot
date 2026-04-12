import { Database as SqliteDatabase } from "bun:sqlite";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import {
	formatEvents,
	formatLessons,
	formatMemories,
	formatMemoryOverview,
	formatPaths,
	formatPreferences,
	formatProjectDetails,
	formatProjects,
	formatRuns,
	formatStuckDispatches,
} from "../src/inspect/formatters";
import {
	getMemoryOverview,
	getProjectDetails,
	listEvents,
	listLessons,
	listMemories,
	listPreferences,
	listProjects,
	listRuns,
	listStuckDispatches,
} from "../src/inspect/repository";
import { resolveKernelDbPathFromProject } from "../src/kernel/database";
import { reconcileProjectIds } from "../src/kernel/migrations";
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
	const projectKernelPathInfo = gitRoot ? resolveKernelDbPathFromProject(gitRoot) : null;
	const projectKernelExists =
		projectArtifactDir !== null &&
		projectKernelPathInfo !== null &&
		existsSync(projectKernelPathInfo.path);

	if (parsed.view === "reconcile-project-ids") {
		const targetDb =
			options.dbPath ??
			(parsed.global ? globalDbPath : (projectKernelPathInfo?.path ?? globalDbPath));
		if (!targetDb) return makeError("No database found for reconciliation", parsed.json);
		if (!existsSync(targetDb)) return makeError(`Database not found: ${targetDb}`, parsed.json);
		const db = new SqliteDatabase(targetDb);
		try {
			reconcileProjectIds(db);
		} finally {
			db.close();
		}
		return makeOutput(
			{ action: "reconcile_project_ids", dbPath: targetDb },
			parsed.json,
			`Reconciled project IDs in ${targetDb}`,
		);
	}

	function resolveDbInput(view: string): {
		dbInput: string;
		dbScope: string;
	} {
		if (options.dbPath) {
			return { dbInput: options.dbPath, dbScope: "explicit" };
		}
		if (parsed.global) {
			return { dbInput: globalDbPath, dbScope: "global" };
		}

		const globalScopedViews = ["memory", "memories", "preferences"];
		if (globalScopedViews.includes(view)) {
			return { dbInput: globalDbPath, dbScope: "global" };
		}

		if (projectKernelExists && projectArtifactDir && projectKernelPathInfo) {
			const scopeLabel =
				projectKernelPathInfo.kind === "legacy"
					? "project (legacy kernel.db at repo root)"
					: projectKernelPathInfo.kind === "migrated"
						? "project (migrated legacy kernel.db)"
						: projectKernelPathInfo.kind === "artifact_with_legacy"
							? "project (artifact kernel.db in use; legacy kernel.db also present at repo root)"
							: "project";
			return {
				dbInput: projectKernelPathInfo.path,
				dbScope: scopeLabel,
			};
		}

		if (gitRoot) {
			return {
				dbInput: globalDbPath,
				dbScope: "project (using global DB — no local kernel.db)",
			};
		}

		return { dbInput: globalDbPath, dbScope: "global" };
	}

	if (!parsed.help && parsed.error === null && parsed.view === null && parsed.pruneEphemeral) {
		const pruneDbPath = options.dbPath ?? globalDbPath;
		const pruned = pruneEphemeralProjects(pruneDbPath);
		return makeOutput(
			{ action: "prune_ephemeral", pruned, dbPath: pruneDbPath },
			parsed.json,
			parsed.json
				? JSON.stringify({ action: "prune_ephemeral", pruned, dbPath: pruneDbPath }, null, 2)
				: `Pruned ${pruned} ephemeral project records from ${pruneDbPath}`,
		);
	}

	const verbose = parsed.verbose;
	const scopeHeader = (dbScope: string, dbInput: string): string =>
		`DB scope: ${dbScope} (${dbInput})\n\n`;
	switch (parsed.view) {
		case "projects": {
			const { dbInput, dbScope } = resolveDbInput("projects");
			const allProjects = listProjects(dbInput);
			const shouldFilterEphemeral = !parsed.global && !options.dbPath;
			let projects = shouldFilterEphemeral
				? allProjects.filter((p) => !isEphemeralPath(p.path))
				: allProjects;
			let scopeNote: string | null = null;
			if (gitRoot && !parsed.global && !options.dbPath) {
				const currentRepoProject =
					projects.find((project) => project.path === gitRoot) ??
					projects.find((project) => project.path.startsWith(`${gitRoot}/`));
				if (currentRepoProject !== undefined) {
					projects = [currentRepoProject];
					scopeNote = "Showing current repo project. Use --global to list all projects.";
				} else {
					projects = [];
					scopeNote =
						"No project record found for current repo in the selected database. Use --global to list all projects.";
				}
			}
			const header = verbose ? `DB scope: ${dbScope} (${dbInput})\n\n` : "";
			const note = scopeNote === null ? "" : `${scopeNote}\n\n`;
			return makeOutput(
				{
					action: "inspect_projects",
					projects,
					dbScope,
					dbPath: dbInput,
					note: scopeNote ?? undefined,
				},
				parsed.json,
				`${header}${note}${formatProjects(projects, verbose)}`,
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
				{
					action: "inspect_paths",
					project: details.project,
					paths: details.paths,
				},
				parsed.json,
				`${header}${formatPaths(details, verbose)}`,
			);
		}
		case "stuck": {
			const { dbInput, dbScope } = resolveDbInput("stuck");
			const stuckDispatches = listStuckDispatches(
				{
					projectRef: parsed.projectRef ?? undefined,
					thresholdMinutes: parsed.threshold,
					limit: parsed.limit,
				},
				dbInput,
			);
			return makeOutput(
				{
					action: "inspect_stuck_dispatches",
					dispatches: stuckDispatches,
					thresholdMinutes: parsed.threshold,
					dbScope,
					dbPath: dbInput,
				},
				parsed.json,
				`${scopeHeader(dbScope, dbInput)}${formatStuckDispatches(stuckDispatches, verbose, parsed.threshold)}`,
			);
		}
		case "runs": {
			const { dbInput, dbScope } = resolveDbInput("runs");
			const runs = listRuns(
				{ projectRef: parsed.projectRef ?? undefined, limit: parsed.limit },
				dbInput,
			);
			return makeOutput(
				{ action: "inspect_runs", runs, dbScope, dbPath: dbInput },
				parsed.json,
				`${scopeHeader(dbScope, dbInput)}${formatRuns(runs, verbose)}`,
			);
		}
		case "events": {
			const { dbInput, dbScope } = resolveDbInput("events");
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
				{ action: "inspect_events", events, dbScope, dbPath: dbInput },
				parsed.json,
				`${scopeHeader(dbScope, dbInput)}${formatEvents(events, verbose)}`,
			);
		}
		case "lessons": {
			const { dbInput, dbScope } = resolveDbInput("lessons");
			const lessons = listLessons(
				{ projectRef: parsed.projectRef ?? undefined, limit: parsed.limit },
				dbInput,
			);
			return makeOutput(
				{ action: "inspect_lessons", lessons, dbScope, dbPath: dbInput },
				parsed.json,
				`${scopeHeader(dbScope, dbInput)}${formatLessons(lessons, verbose)}`,
			);
		}
		case "preferences": {
			const { dbInput, dbScope } = resolveDbInput("preferences");
			const preferences = listPreferences(dbInput);
			const header = scopeHeader(dbScope, dbInput);
			return makeOutput(
				{ action: "inspect_preferences", preferences },
				parsed.json,
				`${header}${formatPreferences(preferences, verbose)}`,
			);
		}
		case "memory": {
			const { dbInput, dbScope } = resolveDbInput("memory");
			const overview = getMemoryOverview(dbInput);
			const header = scopeHeader(dbScope, dbInput);
			return makeOutput(
				{ action: "inspect_memory", overview },
				parsed.json,
				`${header}${formatMemoryOverview(overview, verbose)}`,
			);
		}
		case "memories": {
			const { dbInput, dbScope } = resolveDbInput("memories");
			const memories = listMemories(
				{
					projectRef: parsed.projectRef ?? undefined,
					kind: parsed.kind ?? undefined,
					scope: parsed.scope ?? undefined,
					query: parsed.query ?? undefined,
					limit: parsed.limit,
				},
				dbInput,
			);
			const header = scopeHeader(dbScope, dbInput);
			return makeOutput(
				{ action: "inspect_memories", memories },
				parsed.json,
				`${header}${formatMemories(memories, verbose)}`,
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

const EPHEMERAL_TEST_PREFIXES = Object.freeze([
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
	"inspect-scope-",
	"lifecycle-test-",
]);

const TEMP_DIR_NAMES = Object.freeze(["tmp", "T"]);

function isEphemeralPath(path: string): boolean {
	const segments = path.split("/");
	const tmpIdx = segments.findIndex((s) => (TEMP_DIR_NAMES as readonly string[]).includes(s));
	if (tmpIdx === -1) return false;
	const afterTmp = segments.slice(tmpIdx + 1).join("/");
	if (afterTmp.length === 0) return false;
	for (const prefix of EPHEMERAL_TEST_PREFIXES) {
		if (afterTmp.startsWith(prefix)) return true;
	}
	return false;
}

function pruneEphemeralProjects(dbPath: string): number {
	if (!existsSync(dbPath)) return 0;
	const db = new SqliteDatabase(dbPath);
	try {
		db.run("PRAGMA foreign_keys = ON");
		const projects = db.query("SELECT id, path FROM projects").all() as Array<{
			id: string;
			path: string;
		}>;
		const tablesWithProjectIdFk = [
			"preference_records",
			"observations",
			"memories",
			"pipeline_runs",
			"route_tickets",
			"forensic_events",
			"active_review_state",
			"project_review_memory",
			"project_lesson_memory",
			"graph_edges",
			"graph_nodes",
			"graph_files",
			"project_paths",
			"project_git_fingerprints",
		];
		let count = 0;
		for (const project of projects) {
			if (isEphemeralPath(project.path)) {
				for (const table of tablesWithProjectIdFk) {
					try {
						db.run(`DELETE FROM ${table} WHERE project_id = ?`, [project.id]);
					} catch (e) {
						if (e instanceof Error && e.message.includes("no such table")) continue;
						throw e;
					}
				}
				db.run("DELETE FROM projects WHERE id = ?", [project.id]);
				count++;
			}
		}
		return count;
	} finally {
		db.close();
	}
}
