import { readFile } from "node:fs/promises";
import { isEnoentError } from "../../utils/fs-helpers";
import { getArtifactRef } from "../artifacts";
import { taskSchema } from "../schemas";
import type { Task } from "../types";
import type { DispatchResult, PhaseHandler } from "./types";
import { AGENT_NAMES } from "./types";

const EXPECTED_COLUMN_COUNT = 6;
const taskIdPattern = /^W(\d+)-T(\d+)$/i;
const separatorCellPattern = /^:?-{3,}:?$/;

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
 * Expected format: | Task ID | Title | Description | Files | Wave | Criteria |
 * Returns array of Task objects.
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

export const handlePlan: PhaseHandler = async (_state, artifactDir, result?) => {
	// When result is provided, the planner has completed writing tasks
	// Load them from tasks.md and populate state.tasks
	if (result) {
		const tasksPath = getArtifactRef(artifactDir, "PLAN", "tasks.md");
		try {
			const loadedTasks = await loadTasksFromMarkdown(tasksPath);
			return Object.freeze({
				action: "complete",
				phase: "PLAN",
				progress: `Planning complete — loaded ${loadedTasks.length} task(s)`,
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
				phase: "PLAN",
				message: `Failed to load PLAN tasks: ${reason}`,
				progress: "Planning failed — task extraction error",
			} satisfies DispatchResult);
		}
	}

	const architectRef = getArtifactRef(artifactDir, "ARCHITECT", "design.md");
	const challengeRef = getArtifactRef(artifactDir, "CHALLENGE", "brief.md");
	const tasksPath = getArtifactRef(artifactDir, "PLAN", "tasks.md");

	const prompt = [
		"Read the architecture design at",
		architectRef,
		"and the challenge brief at",
		challengeRef,
		"then produce a task plan.",
		`Write tasks to ${tasksPath}.`,
		"Each task should have a 300-line diff max.",
		"Assign wave numbers for parallel execution.",
	].join(" ");

	return Object.freeze({
		action: "dispatch",
		agent: AGENT_NAMES.PLAN,
		prompt,
		phase: "PLAN",
		progress: "Dispatching planner",
	} satisfies DispatchResult);
};
