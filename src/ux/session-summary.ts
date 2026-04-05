import type { SessionEvents } from "../observability/event-store";
import type { PipelineState } from "../orchestrator/types";

export interface SessionSummaryData {
	readonly sessionId: string;
	readonly startedAt: string;
	readonly endedAt: string;
	readonly tokensUsed: number;
	readonly phasesCompleted: readonly string[];
	readonly errorsEncountered: number;
	readonly tasksCompleted: number;
	readonly lessonsLearned: readonly string[];
}

export function generateSessionSummary(
	sessionData: SessionEvents | SessionSummaryData | undefined,
	pipelineState?: PipelineState | null,
): string {
	if (isStructuredSessionSummaryData(sessionData) && pipelineState === undefined) {
		return generateStructuredSessionSummary(sessionData);
	}

	return generatePipelineSessionSummary(
		sessionData as SessionEvents | undefined,
		pipelineState ?? null,
	);
}

function generatePipelineSessionSummary(
	sessionData: SessionEvents | undefined,
	pipelineState: PipelineState | null,
): string {
	const sections: string[] = ["## Session Summary"];

	if (pipelineState) {
		const phaseInfo = pipelineState.currentPhase
			? ` (Current Phase: ${pipelineState.currentPhase})`
			: "";
		sections.push(`**Pipeline Status**: ${pipelineState.status}${phaseInfo}`);

		const done = pipelineState.phases.filter((p) => p.status === "DONE").map((p) => p.name);

		sections.push(`**Phases Completed**: ${done.length > 0 ? done.join(", ") : "None"}`);
	} else {
		sections.push("**Pipeline Status**: Unknown");
	}

	if (sessionData?.tokens) {
		const { inputTokens, outputTokens, reasoningTokens } = sessionData.tokens;
		sections.push(
			"\n**Context Used**:",
			`- Input: ${inputTokens.toLocaleString()} tokens`,
			`- Output: ${outputTokens.toLocaleString()} tokens`,
			...(reasoningTokens > 0 ? [`- Reasoning: ${reasoningTokens.toLocaleString()} tokens`] : []),
		);
	}

	const errors = (sessionData?.events ?? []).filter((e) => e.type === "error");
	if (errors.length > 0) {
		sections.push("\n**Errors Encountered**:");
		for (const e of errors) {
			if (e.type === "error") {
				sections.push(`- ${e.errorType.toUpperCase()}: ${e.message}`);
			}
		}
	}

	if (sessionData) {
		const endEvent = sessionData.events.find((e) => e.type === "session_end");
		if (endEvent && endEvent.type === "session_end") {
			const seconds = (endEvent.durationMs / 1000).toFixed(1);
			sections.push(`\n**Duration**: ${seconds}s`);
		} else {
			const start = new Date(sessionData.startedAt).getTime();
			const seconds = ((Date.now() - start) / 1000).toFixed(1);
			sections.push(`\n**Duration (active)**: ${seconds}s`);
		}
	}

	return sections.join("\n").trim();
}

function generateStructuredSessionSummary(data: SessionSummaryData): string {
	const sections = [
		`# Session Summary: ${data.sessionId}`,
		"",
		"## Overview",
		`- Started: ${data.startedAt}`,
		`- Ended: ${data.endedAt}`,
		`- Tokens Used: ${data.tokensUsed.toLocaleString()}`,
		`- Tasks Completed: ${data.tasksCompleted}`,
		`- Errors Encountered: ${data.errorsEncountered}`,
		"",
		"## Phases Completed",
		...(data.phasesCompleted.length > 0
			? data.phasesCompleted.map((phase) => `- ${phase}`)
			: ["- None"]),
		"",
		"## Lessons Learned",
		...(data.lessonsLearned.length > 0
			? data.lessonsLearned.map((lesson) => `- ${lesson}`)
			: ["- None recorded"]),
	];

	return sections.join("\n").trim();
}

function isStructuredSessionSummaryData(
	value: SessionEvents | SessionSummaryData | undefined,
): value is SessionSummaryData {
	if (!value) {
		return false;
	}

	return (
		"endedAt" in value &&
		"tokensUsed" in value &&
		"phasesCompleted" in value &&
		"errorsEncountered" in value &&
		"tasksCompleted" in value &&
		"lessonsLearned" in value
	);
}
