import type { Database } from "bun:sqlite";

export interface TransactionOptions {
	maxRetries?: number;
	backoffMs?: number;
	useImmediate?: boolean;
}

const transactionDepthByDatabase = new WeakMap<Database, number>();

function getTransactionDepth(db: Database): number {
	return transactionDepthByDatabase.get(db) ?? 0;
}

function enterTransaction(db: Database): void {
	const currentDepth = getTransactionDepth(db);
	if (currentDepth > 0) {
		throw new Error("Nested transactions are not supported for this database instance");
	}
	transactionDepthByDatabase.set(db, currentDepth + 1);
}

function exitTransaction(db: Database): void {
	const currentDepth = getTransactionDepth(db);
	if (currentDepth <= 1) {
		transactionDepthByDatabase.delete(db);
		return;
	}
	transactionDepthByDatabase.set(db, currentDepth - 1);
}

export function withTransaction<T>(db: Database, fn: () => T, options: TransactionOptions = {}): T {
	const maxRetries = options.maxRetries ?? 5;
	const backoffMs = options.backoffMs ?? 100;
	const useImmediate = options.useImmediate ?? true;

	let attempts = 0;
	while (true) {
		try {
			enterTransaction(db);
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
			} finally {
				exitTransaction(db);
			}
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
