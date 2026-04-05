import type { Database } from "bun:sqlite";

export interface TransactionOptions {
	maxRetries?: number;
	backoffMs?: number;
	useImmediate?: boolean;
}

export function withTransaction<T>(db: Database, fn: () => T, options: TransactionOptions = {}): T {
	const maxRetries = options.maxRetries ?? 5;
	const backoffMs = options.backoffMs ?? 100;
	const useImmediate = options.useImmediate ?? true;

	let attempts = 0;
	while (true) {
		try {
			if (useImmediate) {
				db.run("BEGIN IMMEDIATE");
				try {
					const result = fn();
					db.run("COMMIT");
					return result;
				} catch (innerError) {
					db.run("ROLLBACK");
					throw innerError;
				}
			}

			const transaction = db.transaction(fn);
			return transaction();
		} catch (error: unknown) {
			const e = error as Error;
			const isBusyError =
				e.message &&
				(e.message.includes("database is locked") ||
					e.message.includes("SQLITE_BUSY") ||
					e.message.includes("database table is locked"));

			if (isBusyError && attempts < maxRetries) {
				attempts++;
				const waitTime = backoffMs * attempts;
				Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, waitTime);
				continue;
			}
			throw error;
		}
	}
}
