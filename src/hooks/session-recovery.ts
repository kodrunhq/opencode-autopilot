const ERROR_INDICATORS = Object.freeze(["error", "failed", "exception"]);
const RECOVERY_WARNING_THRESHOLD = 3;

const consecutiveErrorCounts = new Map<string, number>();

export function clearRecoveryTracking(): void {
	consecutiveErrorCounts.clear();
}

function containsErrorIndicator(output: string): boolean {
	const normalizedOutput = output.toLowerCase();
	return ERROR_INDICATORS.some((indicator) => normalizedOutput.includes(indicator));
}

export function createSessionRecoveryHandler(options: {
	readonly showToast: (
		title: string,
		message: string,
		variant: "info" | "warning" | "error",
	) => Promise<void>;
}) {
	return async (
		hookInput: { readonly sessionID: string },
		output: { output?: string },
	): Promise<void> => {
		try {
			const completionOutput = typeof output.output === "string" ? output.output : "";
			if (!containsErrorIndicator(completionOutput)) {
				consecutiveErrorCounts.delete(hookInput.sessionID);
				return;
			}

			const nextCount = (consecutiveErrorCounts.get(hookInput.sessionID) ?? 0) + 1;
			consecutiveErrorCounts.set(hookInput.sessionID, nextCount);

			if (nextCount !== RECOVERY_WARNING_THRESHOLD) return;

			try {
				await options.showToast(
					"Recovery suggestion",
					"3 consecutive errors detected — consider using oc_recover or starting a new session.",
					"warning",
				);
			} catch {}
		} catch {}
	};
}
