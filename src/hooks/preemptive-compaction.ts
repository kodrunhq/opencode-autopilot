const DEFAULT_THRESHOLD_PERCENT = 80;

const warnedSessions = new Set<string>();

export function clearCompactionTracking(): void {
	warnedSessions.clear();
}

function normalizeThresholdPercent(thresholdPercent: number | undefined): number {
	if (typeof thresholdPercent !== "number" || Number.isNaN(thresholdPercent)) {
		return DEFAULT_THRESHOLD_PERCENT;
	}

	return Math.min(100, Math.max(0, thresholdPercent));
}

export function createPreemptiveCompactionHandler(options: {
	readonly showToast: (
		title: string,
		message: string,
		variant: "info" | "warning" | "error",
	) => Promise<void>;
	readonly thresholdPercent?: number;
}) {
	const thresholdPercent = normalizeThresholdPercent(options.thresholdPercent);

	return async (
		hookInput: {
			readonly sessionID: string;
			readonly tokens?: { readonly used?: number; readonly limit?: number };
		},
		_output: unknown,
	): Promise<void> => {
		void _output;

		try {
			const used = hookInput.tokens?.used;
			const limit = hookInput.tokens?.limit;

			if (typeof used !== "number" || typeof limit !== "number" || limit <= 0) {
				warnedSessions.delete(hookInput.sessionID);
				return;
			}

			const usagePercent = Math.round((used / limit) * 100);
			if (usagePercent < thresholdPercent) {
				warnedSessions.delete(hookInput.sessionID);
				return;
			}

			if (warnedSessions.has(hookInput.sessionID)) return;

			warnedSessions.add(hookInput.sessionID);

			try {
				await options.showToast(
					"Context warning",
					`Context window at ${usagePercent}% — consider compacting.`,
					"info",
				);
			} catch {}
		} catch {}
	};
}
