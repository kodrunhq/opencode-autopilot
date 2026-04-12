import {
	buildTrancheOracleSignoffRequest,
	isPassingTrancheOracleSignoff,
	parseTrancheOracleSignoff,
	type TrancheOracleSignoff,
} from "./signoff";
import type { Task } from "./types";

export interface TrancheOracleGateRequest {
	readonly originalIntent: string;
	readonly tasks: readonly Task[];
	readonly reviewReport: string;
	readonly verificationResults: string;
	readonly remainingBacklog: readonly string[];
	readonly taskPushes?: readonly string[];
}

export interface TrancheOracleGateDispatch {
	readonly prompt: string;
	readonly signoffId: string;
	readonly inputsDigest: string;
	readonly trancheIntent: string;
	readonly diffSummary: string;
}

function summarizeTasks(tasks: readonly Task[]): string {
	if (tasks.length === 0) {
		return "No tranche tasks were recorded.";
	}

	return tasks.map((task) => `Task ${task.id}: ${task.title} [${task.status}]`).join("\n");
}

function summarizeDiff(tasks: readonly Task[], taskPushes: readonly string[]): string {
	const completedTasks = tasks.filter((task) => task.status === "DONE");
	const taskPushSummary =
		taskPushes.length > 0
			? `Pushed task ids: ${taskPushes.join(", ")}`
			: "No pushed task ids recorded.";

	return [
		`Completed tasks: ${completedTasks.length}/${tasks.length}`,
		taskPushSummary,
		completedTasks.length > 0
			? `Completed scope:\n${completedTasks.map((task) => `- ${task.title}`).join("\n")}`
			: "Completed scope:\n- None recorded.",
	].join("\n");
}

export class OracleGate {
	createTrancheSignoffRequest(request: TrancheOracleGateRequest): TrancheOracleGateDispatch {
		const trancheIntent = summarizeTasks(request.tasks);
		const diffSummary = summarizeDiff(request.tasks, request.taskPushes ?? []);
		const signoffRequest = buildTrancheOracleSignoffRequest({
			originalIntent: request.originalIntent,
			trancheIntent,
			diffSummary,
			reviewReport: request.reviewReport,
			verificationResults: request.verificationResults,
			remainingBacklog: request.remainingBacklog,
		});

		return Object.freeze({
			...signoffRequest,
			trancheIntent,
			diffSummary,
		});
	}

	parseTrancheSignoff(
		response: string,
		expected: { readonly signoffId: string; readonly inputsDigest: string },
	): TrancheOracleSignoff {
		const signoff = parseTrancheOracleSignoff(response, {
			expectedSignoffId: expected.signoffId,
			expectedInputsDigest: expected.inputsDigest,
		});

		if (!signoff) {
			throw new Error(`Oracle signoff ${expected.signoffId} is missing from the response.`);
		}

		return signoff;
	}

	isPassingTrancheSignoff(signoff: TrancheOracleSignoff | null | undefined): boolean {
		return isPassingTrancheOracleSignoff(signoff);
	}
}

export const defaultOracleGate = new OracleGate();

export function createOracleGateIntegration(oracleGate: OracleGate = defaultOracleGate) {
	return {
		createTrancheSignoffRequest(request: TrancheOracleGateRequest): TrancheOracleGateDispatch {
			return oracleGate.createTrancheSignoffRequest(request);
		},

		parseTrancheSignoff(
			response: string,
			expected: { readonly signoffId: string; readonly inputsDigest: string },
		): TrancheOracleSignoff {
			return oracleGate.parseTrancheSignoff(response, expected);
		},

		isPassingTrancheSignoff(signoff: TrancheOracleSignoff | null | undefined): boolean {
			return oracleGate.isPassingTrancheSignoff(signoff);
		},
	};
}
