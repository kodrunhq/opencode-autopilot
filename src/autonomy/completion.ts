const EXPLICIT_SIGNALS = Object.freeze(["all tasks completed", "complete", "finished", "done"]);
const TODO_SIGNALS = Object.freeze(["all todos completed", "no remaining tasks"]);
const NEGATIVE_SIGNALS = Object.freeze(["still working", "in progress", "next step"]);

export interface CompletionDetectionResult {
	readonly isComplete: boolean;
	readonly confidence: number;
	readonly signals: readonly string[];
}

function countMatches(content: string, phrases: readonly string[]): readonly string[] {
	return phrases.filter((phrase) => new RegExp(`\\b${phrase}\\b`, "i").test(content));
}

function clampConfidence(value: number): number {
	return Math.max(0, Math.min(1, value));
}

export function detectCompletion(transcript: readonly string[]): CompletionDetectionResult {
	const normalizedTranscript = transcript.join("\n").toLowerCase();
	const explicitMatches = countMatches(normalizedTranscript, EXPLICIT_SIGNALS);
	const todoMatches = countMatches(normalizedTranscript, TODO_SIGNALS);
	const negativeMatches = countMatches(normalizedTranscript, NEGATIVE_SIGNALS);
	const signals = Object.freeze([...explicitMatches, ...todoMatches, ...negativeMatches]);

	if (negativeMatches.length > 0) {
		return Object.freeze({
			isComplete: false,
			confidence: clampConfidence(0.2 + negativeMatches.length * 0.05),
			signals,
		});
	}

	if (explicitMatches.length === 0 && todoMatches.length === 0) {
		return Object.freeze({
			isComplete: false,
			confidence: 0,
			signals,
		});
	}

	const explicitConfidence =
		explicitMatches.length > 0 ? 0.75 + (explicitMatches.length - 1) * 0.1 : 0;
	const todoConfidence = todoMatches.length > 0 ? 0.65 + (todoMatches.length - 1) * 0.1 : 0;
	const combinedBonus = explicitMatches.length > 0 && todoMatches.length > 0 ? 0.1 : 0;

	return Object.freeze({
		isComplete: true,
		confidence: clampConfidence(Math.max(explicitConfidence, todoConfidence) + combinedBonus),
		signals,
	});
}
