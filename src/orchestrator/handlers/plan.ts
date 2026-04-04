import { readFile } from "node:fs/promises";
import { getArtifactRef } from "../artifacts";
import { taskSchema } from "../schemas";
import type { Task } from "../types";
import type { DispatchResult, PhaseHandler } from "./types";
import { AGENT_NAMES } from "./types";

/**
 * Parse tasks from markdown table in tasks.md.
 * Expected format: | ID | Title | Description | Files | Wave | Criteria |
 * Returns array of Task objects.
 */
async function loadTasksFromMarkdown(tasksPath: string): Promise<Task[]> {
	const content = await readFile(tasksPath, "utf-8");
	const lines = content.split("\n");

	// Find the table header row and data rows
	const tableStartIndex = lines.findIndex((line) => line.startsWith("| Task ID"));
	if (tableStartIndex === -1) {
		return [];
	}

	// Skip header and separator lines, collect data rows
	const tasks: Task[] = [];
	let taskIndex = 0;
	for (let i = tableStartIndex + 2; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line.startsWith("|") || line.startsWith("|---")) {
			continue;
		}

		// Parse CSV-like: | W1-T01 | Title | Description | Files | Wave | Criteria |
		const columns = line
			.slice(1, -1)
			.split("|")
			.map((col) => col.trim());

		if (columns.length < 5) {
			continue;
		}

		// Use sequential index as task ID (1-based)
		taskIndex++;
		const title = columns[1];
		const wave = Number.parseInt(columns[4], 10);

		if (Number.isNaN(wave) || !title) {
			continue;
		}

		tasks.push(
			taskSchema.parse({
				id: taskIndex,
				title,
				status: "PENDING",
				wave,
				depends_on: [],
				attempt: 0,
				strike: 0,
			}),
		);
	}

	return tasks;
}

export const handlePlan: PhaseHandler = async (state, artifactDir, result?) => {
	// When result is provided, the planner has completed writing tasks
	// Load them from tasks.md and populate state.tasks
	if (result) {
		const tasksPath = getArtifactRef(artifactDir, "PLAN", "tasks.md");
		let loadedTasks: Task[] = [];

		try {
			loadedTasks = await loadTasksFromMarkdown(tasksPath);
		} catch {
			// If loading fails, continue with empty tasks (will be handled in BUILD)
		}

		return Object.freeze({
			action: "complete",
			phase: "PLAN",
			progress: "Planning complete — tasks written",
			_stateUpdates: {
				tasks: loadedTasks,
			},
		} satisfies DispatchResult);
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
