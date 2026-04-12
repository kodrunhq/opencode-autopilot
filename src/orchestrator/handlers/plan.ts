import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getLogger } from "../../logging/domains";
import { fileExists, isEnoentError } from "../../utils/fs-helpers";
import { getArtifactRef, getPhaseDir } from "../artifacts";
import { normalizePlanTasks, planTasksArtifactSchema } from "../contracts/phase-artifacts";
import { logOrchestrationEvent } from "../orchestration-logger";
import { renderTasksMarkdown } from "../renderers/tasks-markdown";
import { taskSchema } from "../schemas";
import type { Task } from "../types";
import type { DispatchResult, PhaseHandler } from "./types";
import { AGENT_NAMES } from "./types";

const EXPECTED_COLUMN_COUNT = 6;
const taskIdPattern = /^W(\d+)-T(\d+)$/i;
const separatorCellPattern = /^:?-{3,}:?$/;
const logger = getLogger("orchestrator", "plan");

function parseTableColumns(line: string): readonly string[] | null {
	const trimmed = line.trim();
	if (!trimmed.includes("|")) {
		return null;
	}

	const withoutLeadingBoundary = trimmed.startsWith("|") ? trimmed.slice(1) : trimmed;
	const normalized = withoutLeadingBoundary.endsWith("|")
		? withoutLeadingBoundary.slice(0, -1)
		: withoutLeadingBoundary;

	return normalized.split("|").map((col) => col.trim());
}

function isSeparatorRow(columns: readonly string[]): boolean {
	return columns.length > 0 && columns.every((col) => separatorCellPattern.test(col));
}

/**
 * Parse tasks from markdown table in tasks.md.
 * Legacy fallback only -- canonical source is tasks.json.
 */
async function loadTasksFromMarkdown(tasksPath: string): Promise<Task[]> {
	const content = await readFile(tasksPath, "utf-8");
	const lines = content.split("\n");

	const tasks: Task[] = [];
	for (const line of lines) {
		const columns = parseTableColumns(line);
		if (columns === null || columns.length < EXPECTED_COLUMN_COUNT || isSeparatorRow(columns)) {
			continue;
		}

		if (columns[0].toLowerCase() === "task id") {
			continue;
		}

		const idMatch = taskIdPattern.exec(columns[0]);
		if (idMatch === null) {
			continue;
		}

		const waveFromId = Number.parseInt(idMatch[1], 10);
		const title = columns[1];
		const waveFromColumn = Number.parseInt(columns[4], 10);

		if (!title || Number.isNaN(waveFromId) || Number.isNaN(waveFromColumn)) {
			continue;
		}

		if (waveFromId !== waveFromColumn) {
			continue;
		}

		tasks.push(
			taskSchema.parse({
				id: tasks.length + 1,
				title,
				status: "PENDING",
				wave: waveFromColumn,
				depends_on: [],
				attempt: 0,
				strike: 0,
			}),
		);
	}

	if (tasks.length === 0) {
		throw new Error("No valid task rows found in PLAN tasks.md");
	}

	return tasks;
}

async function loadTasksFromJson(tasksPath: string): Promise<Task[]> {
	const raw = await readFile(tasksPath, "utf-8");
	const parsed = JSON.parse(raw);
	const artifact = planTasksArtifactSchema.parse(parsed);
	const normalized = normalizePlanTasks(artifact);
	return normalized.map((task) =>
		taskSchema.parse({
			id: task.id,
			title: task.title,
			status: "PENDING",
			wave: task.wave,
			depends_on: task.dependsOnIndexes,
			attempt: 0,
			strike: 0,
		}),
	);
}

function buildTasksArtifactFromLegacyTasks(tasks: readonly Task[]) {
	const countersByWave = new Map<number, number>();
	return planTasksArtifactSchema.parse({
		schemaVersion: 1,
		tasks: tasks.map((task) => {
			const nextIndex = (countersByWave.get(task.wave) ?? 0) + 1;
			countersByWave.set(task.wave, nextIndex);
			return {
				taskId: `W${task.wave}-T${String(nextIndex).padStart(2, "0")}`,
				title: task.title,
				wave: task.wave,
				depends_on: [] as string[],
			};
		}),
	});
}

export const handlePlan: PhaseHandler = async (state, artifactDir, result?) => {
	// When result is provided, the planner has completed writing tasks
	// Load them from tasks.json (canonical) and populate state.tasks.
	// Fall back to tasks.md for compatibility with legacy planners.
	if (result) {
		const tasksJsonPath = getArtifactRef(artifactDir, "PLAN", "tasks.json", state.runId);
		const tasksPath = getArtifactRef(artifactDir, "PLAN", "tasks.md", state.runId);
		try {
			let loadedTasks: Task[];
			let usedLegacyMarkdown = false;

			try {
				loadedTasks = await loadTasksFromJson(tasksJsonPath);
			} catch (jsonError: unknown) {
				if (!isEnoentError(jsonError)) {
					throw jsonError;
				}
				loadedTasks = await loadTasksFromMarkdown(tasksPath);
				usedLegacyMarkdown = true;
			}

			if (usedLegacyMarkdown) {
				const msg =
					"PLAN fallback: parsed legacy tasks.md (tasks.json missing). Migrate planner output to tasks.json.";
				logger.warn(msg, {
					operation: "phase_transition",
					phase: "PLAN",
					tasksJsonPath,
					tasksPath,
				});
				logOrchestrationEvent(artifactDir, {
					timestamp: new Date().toISOString(),
					phase: "PLAN",
					action: "error",
					message: msg,
				});

				const artifact = buildTasksArtifactFromLegacyTasks(loadedTasks);
				await writeFile(tasksJsonPath, JSON.stringify(artifact, null, 2), "utf-8");
			} else {
				const artifact = planTasksArtifactSchema.parse(
					JSON.parse(await readFile(tasksJsonPath, "utf-8")),
				);
				const markdown = renderTasksMarkdown(artifact);
				await writeFile(tasksPath, markdown, "utf-8");
			}

			return Object.freeze({
				action: "complete",
				phase: "PLAN",
				resultKind: "phase_output",
				progress: usedLegacyMarkdown
					? `Planning complete — loaded ${loadedTasks.length} task(s) via legacy markdown fallback`
					: `Planning complete — loaded ${loadedTasks.length} task(s) from tasks.json`,
				_stateUpdates: {
					tasks: loadedTasks,
				},
			} satisfies DispatchResult);
		} catch (error: unknown) {
			const reason = isEnoentError(error)
				? "tasks.md not found after planner completion"
				: error instanceof Error
					? error.message
					: "Unknown parsing error";

			return Object.freeze({
				action: "error",
				code: "E_PLAN_TASK_LOAD",
				errorSeverity: isEnoentError(error) ? "recoverable" : "terminal",
				phase: "PLAN",
				message: `Failed to load PLAN tasks: ${reason}`,
				progress: "Planning failed — task extraction error",
			} satisfies DispatchResult);
		}
	}

	const phaseDir = getPhaseDir(artifactDir, "ARCHITECT", state.runId);
	const critiquePath = join(phaseDir, "critique.md");
	const designPath = join(phaseDir, "design.md");
	const proposalsDir = join(phaseDir, "proposals");

	const critiqueExists = await fileExists(critiquePath);
	const designExists = await fileExists(designPath);

	let architectRef: string;
	let architectDescription: string;

	if (critiqueExists) {
		architectRef = critiquePath;
		architectDescription = "the architecture critique and proposals";
	} else if (designExists) {
		architectRef = designPath;
		architectDescription = "the architecture design";
	} else {
		const proposalFiles = await readdir(proposalsDir).catch(() => []);
		if (proposalFiles.length === 0) {
			return Object.freeze({
				action: "error",
				code: "E_ARCHITECT_ARTIFACT_MISSING",
				message:
					"No architecture artifacts found. Expected design.md, critique.md, or proposals/ directory.",
			} satisfies DispatchResult);
		}
		architectRef = proposalsDir;
		architectDescription = "the architecture proposals";
	}

	const challengeRef = getArtifactRef(artifactDir, "CHALLENGE", "brief.md", state.runId);
	const tasksPath = getArtifactRef(artifactDir, "PLAN", "tasks.json", state.runId);
	const trancheScopeLines =
		state.programContext === null
			? []
			: [
					`This run is tranche ${state.programContext.trancheIndex}/${state.programContext.trancheCount}: ${state.programContext.trancheTitle}.`,
					`Selection rationale: ${state.programContext.selectionRationale}`,
					"Plan ONLY this tranche scope. Do not ask which tranche to do first and do not schedule later tranches here.",
				];

	const prompt = [
		`Read ${architectDescription} at`,
		architectRef,
		"and the challenge brief at",
		challengeRef,
		"then produce a task plan.",
		`Write tasks to ${tasksPath} as strict JSON with shape {"schemaVersion":1,"tasks":[{"taskId":"W1-T01","title":"...","wave":1,"depends_on":[]}]}.`,
		"Each task should have a 300-line diff max.",
		"Assign wave numbers for parallel execution.",
		...trancheScopeLines,
	].join(" ");

	return Object.freeze({
		action: "dispatch",
		agent: AGENT_NAMES.PLAN,
		resultKind: "phase_output",
		prompt,
		phase: "PLAN",
		progress: "Dispatching planner",
	} satisfies DispatchResult);
};
