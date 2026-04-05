export interface RetryOptions {
	readonly maxRetries?: number;
	readonly backoffMs?: number;
	readonly onRetry?: (attempt: number, error: Error) => void;
}

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BACKOFF_MS = 100;

function isBusyError(error: Error): boolean {
	return (
		error.message.includes("database is locked") ||
		error.message.includes("SQLITE_BUSY") ||
		error.message.includes("database table is locked")
	);
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

export async function withRetry<T>(
	fn: () => T | Promise<T>,
	options: RetryOptions = {},
): Promise<T> {
	const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
	const backoffMs = options.backoffMs ?? DEFAULT_BACKOFF_MS;

	let attempt = 0;
	while (true) {
		try {
			return await fn();
		} catch (error: unknown) {
			if (!(error instanceof Error) || !isBusyError(error)) {
				throw error;
			}

			if (attempt >= maxRetries) {
				throw error;
			}

			attempt += 1;
			options.onRetry?.(attempt, error);
			await sleep(backoffMs * 2 ** (attempt - 1));
		}
	}
}
