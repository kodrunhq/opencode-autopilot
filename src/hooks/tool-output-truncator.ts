const DEFAULT_MAX_OUTPUT_LENGTH = 50_000;

function normalizeMaxOutputLength(maxOutputLength: number | undefined): number {
	if (typeof maxOutputLength !== "number" || Number.isNaN(maxOutputLength)) {
		return DEFAULT_MAX_OUTPUT_LENGTH;
	}

	return Math.max(0, Math.floor(maxOutputLength));
}

export function createToolOutputTruncatorHandler(options: { readonly maxOutputLength?: number }) {
	const maxOutputLength = normalizeMaxOutputLength(options.maxOutputLength);

	return async (
		_hookInput: {
			readonly tool: string;
			readonly sessionID: string;
			readonly callID: string;
			readonly args: unknown;
		},
		_output: { title: string; output: string; metadata: unknown },
	): Promise<void> => {
		try {
			if (_output.output.length <= maxOutputLength) return;

			const originalLength = _output.output.length;
			const suffix = `\n\n[Output truncated from ${originalLength} to ${maxOutputLength} characters]`;
			const contentBudget = Math.max(0, maxOutputLength - suffix.length);
			_output.output = `${_output.output.slice(0, contentBudget)}${suffix}`;
		} catch {}
	};
}
