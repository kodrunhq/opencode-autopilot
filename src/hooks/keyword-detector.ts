const STUCK_KEYWORDS = Object.freeze([
	"i apologize",
	"let me try again",
	"i'm unable to",
	"i cannot",
	"as an ai",
	"i don't have access",
]);

const MAX_TRACKED_CALLS = 5;
const SESSION_TTL_MS = 30 * 60 * 1000;

interface TrackedToolCall {
	readonly tool: string;
	readonly argsKey: string;
}

interface SessionToolHistory {
	readonly calls: readonly TrackedToolCall[];
	readonly updatedAt: number;
}

const sessionToolHistory = new Map<string, SessionToolHistory>();

function cleanupExpiredSessions(now: number): void {
	const cutoff = now - SESSION_TTL_MS;
	for (const [sessionID, history] of sessionToolHistory) {
		if (history.updatedAt < cutoff) {
			sessionToolHistory.delete(sessionID);
		}
	}
}

function stringifyArgs(args: unknown): string {
	if (args === undefined) return "undefined";

	try {
		return JSON.stringify(args) ?? "undefined";
	} catch {
		return "[unserializable args]";
	}
}

function countTrailingRepeatedCalls(calls: readonly TrackedToolCall[]): number {
	const latestCall = calls.at(-1);
	if (!latestCall) return 0;

	let repetitionCount = 0;
	for (let index = calls.length - 1; index >= 0; index--) {
		const currentCall = calls[index];
		if (currentCall.tool !== latestCall.tool || currentCall.argsKey !== latestCall.argsKey) {
			break;
		}
		repetitionCount += 1;
	}

	return repetitionCount;
}

function countMatchedKeywords(output: string): number {
	const lowerOutput = output.toLowerCase();
	return STUCK_KEYWORDS.reduce((matchCount, keyword) => {
		return lowerOutput.includes(keyword) ? matchCount + 1 : matchCount;
	}, 0);
}

export function clearKeywordDetectorTracking(): void {
	sessionToolHistory.clear();
}

export function createKeywordDetectorHandler(options: {
	readonly showToast: (
		title: string,
		message: string,
		variant: "info" | "warning" | "error",
	) => Promise<void>;
}) {
	return async (
		hookInput: {
			readonly tool: string;
			readonly sessionID: string;
			readonly callID: string;
			readonly args: unknown;
		},
		_output: { title: string; output: string; metadata: unknown },
	): Promise<void> => {
		try {
			const now = Date.now();
			cleanupExpiredSessions(now);

			const argsKey = stringifyArgs(hookInput.args);
			const previousCalls = sessionToolHistory.get(hookInput.sessionID)?.calls ?? Object.freeze([]);
			const nextCalls = Object.freeze(
				[...previousCalls, Object.freeze({ tool: hookInput.tool, argsKey })].slice(
					-MAX_TRACKED_CALLS,
				),
			);

			sessionToolHistory.set(
				hookInput.sessionID,
				Object.freeze({
					calls: nextCalls,
					updatedAt: now,
				}),
			);

			if (countTrailingRepeatedCalls(nextCalls) >= 3) {
				try {
					await options.showToast(
						"Repetition detected",
						`Tool "${hookInput.tool}" was called 3+ times consecutively with identical arguments.`,
						"warning",
					);
				} catch {}
			}

			if (countMatchedKeywords(_output.output) >= 2) {
				try {
					await options.showToast(
						"Agent may be stuck",
						"Detected multiple stuck-pattern phrases in tool output.",
						"warning",
					);
				} catch {}
			}
		} catch {}
	};
}
