const WORKER_COMPLETION_PROMISE = "<promise>DONE</promise>";
const ORACLE_VERIFICATION_PROMISE = "<promise>VERIFIED</promise>";

export interface CompletionDetectionResult {
	readonly isComplete: boolean;
	readonly confidence: number;
	readonly signals: readonly string[];
}

function extractPromiseSignals(transcript: readonly string[]): readonly string[] {
	const signals: string[] = [];
	for (const entry of transcript) {
		for (const line of entry.split(/\r?\n/)) {
			const trimmedLine = line.trim();
			if (
				trimmedLine === WORKER_COMPLETION_PROMISE ||
				trimmedLine === ORACLE_VERIFICATION_PROMISE
			) {
				signals.push(trimmedLine);
			}
		}
	}

	return Object.freeze(signals);
}

export function detectCompletion(transcript: readonly string[]): CompletionDetectionResult {
	const signals = extractPromiseSignals(transcript);
	const isComplete = signals.includes(WORKER_COMPLETION_PROMISE);

	return Object.freeze({
		isComplete,
		confidence: isComplete ? 1 : 0,
		signals,
	});
}
