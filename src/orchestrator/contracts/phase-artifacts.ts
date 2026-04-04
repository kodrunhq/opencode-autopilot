import { z } from "zod";

const taskIdPattern = /^W(\d+)-T(\d+)$/i;

export const planTaskArtifactItemSchema = z
	.object({
		taskId: z.string().regex(taskIdPattern),
		title: z.string().min(1).max(2048),
		wave: z.number().int().positive(),
		depends_on: z.array(z.string().regex(taskIdPattern)).default([]),
	})
	.superRefine((task, ctx) => {
		const parsed = taskIdPattern.exec(task.taskId);
		if (!parsed) {
			return;
		}
		const waveFromTaskId = Number.parseInt(parsed[1], 10);
		if (waveFromTaskId !== task.wave) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: `wave mismatch for ${task.taskId}: expected ${waveFromTaskId}, got ${task.wave}`,
				path: ["wave"],
			});
		}
	});

export const planTasksArtifactSchema = z
	.object({
		schemaVersion: z.literal(1).default(1),
		tasks: z.array(planTaskArtifactItemSchema).min(1),
	})
	.superRefine((artifact, ctx) => {
		const seen = new Set<string>();
		for (let i = 0; i < artifact.tasks.length; i++) {
			const id = artifact.tasks[i].taskId.toUpperCase();
			if (seen.has(id)) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: `duplicate taskId: ${artifact.tasks[i].taskId}`,
					path: ["tasks", i, "taskId"],
				});
				continue;
			}
			seen.add(id);
		}

		for (let i = 0; i < artifact.tasks.length; i++) {
			for (const dep of artifact.tasks[i].depends_on) {
				if (!seen.has(dep.toUpperCase())) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: `unknown dependency ${dep}`,
						path: ["tasks", i, "depends_on"],
					});
				}
			}
		}
	});

export interface NormalizedPlanTask {
	readonly id: number;
	readonly title: string;
	readonly wave: number;
	readonly dependsOnIndexes: readonly number[];
}

export function normalizePlanTasks(
	artifact: z.infer<typeof planTasksArtifactSchema>,
): readonly NormalizedPlanTask[] {
	const ordered = artifact.tasks.map((task) => ({ ...task }));
	const indexByTaskId = new Map<string, number>();
	for (let i = 0; i < ordered.length; i++) {
		indexByTaskId.set(ordered[i].taskId.toUpperCase(), i + 1);
	}

	return Object.freeze(
		ordered.map((task, idx) => {
			const deps = task.depends_on
				.map((id) => indexByTaskId.get(id.toUpperCase()))
				.filter((n): n is number => typeof n === "number")
				.sort((a, b) => a - b);
			return Object.freeze({
				id: idx + 1,
				title: task.title,
				wave: task.wave,
				dependsOnIndexes: Object.freeze(deps),
			});
		}),
	);
}
