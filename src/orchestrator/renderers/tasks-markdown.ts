import type { z } from "zod";
import type { planTasksArtifactSchema } from "../contracts/phase-artifacts";

type PlanTasksArtifact = z.infer<typeof planTasksArtifactSchema>;

export function renderTasksMarkdown(artifact: PlanTasksArtifact): string {
	const header = [
		"# Implementation Task Plan",
		"",
		"## Task Table",
		"",
		"| Task ID | Title | Description | Files to Modify | Wave Number | Acceptance Criteria |",
		"|---|---|---|---|---:|---|",
	];

	const rows = artifact.tasks.map((task) => {
		const deps = task.depends_on.length > 0 ? `Depends on: ${task.depends_on.join(", ")}` : "None";
		return `| ${task.taskId} | ${task.title.replace(/\|/g, "\\|")} | ${deps} | TBD | ${task.wave} | TBD |`;
	});

	return [...header, ...rows, ""].join("\n");
}
