import { describe, expect, it, mock } from "bun:test";
import { withRetry } from "../../src/kernel/retry";

describe("withRetry", () => {
	it("retries busy errors and eventually succeeds", async () => {
		let attempts = 0;

		const result = await withRetry(
			() => {
				attempts += 1;
				if (attempts < 3) {
					throw new Error("SQLITE_BUSY: database is locked");
				}
				return "success";
			},
			{ backoffMs: 1 },
		);

		expect(result).toBe("success");
		expect(attempts).toBe(3);
	});

	it("rethrows non-busy errors immediately", async () => {
		let attempts = 0;

		expect(
			withRetry(
				() => {
					attempts += 1;
					throw new Error("validation failed");
				},
				{ backoffMs: 1 },
			),
		).rejects.toThrow("validation failed");

		expect(attempts).toBe(1);
	});

	it("exhausts retries and throws busy error", async () => {
		let attempts = 0;

		expect(
			withRetry(
				() => {
					attempts += 1;
					throw new Error("database table is locked");
				},
				{ maxRetries: 2, backoffMs: 1 },
			),
		).rejects.toThrow("database table is locked");

		expect(attempts).toBe(3);
	});

	it("calls onRetry with incrementing attempt numbers", async () => {
		const onRetry = mock<(attempt: number, error: Error) => void>(() => undefined);
		let attempts = 0;

		const result = await withRetry(
			() => {
				attempts += 1;
				if (attempts < 3) {
					throw new Error("database is locked");
				}
				return "done";
			},
			{ backoffMs: 1, onRetry },
		);

		expect(result).toBe("done");
		expect(onRetry).toHaveBeenCalledTimes(2);
		expect(onRetry.mock.calls[0]?.[0]).toBe(1);
		expect(onRetry.mock.calls[1]?.[0]).toBe(2);
		expect(onRetry.mock.calls[0]?.[1]).toBeInstanceOf(Error);
	});

	it("uses default retry count when options are omitted", async () => {
		let attempts = 0;

		const result = await withRetry(() => {
			attempts += 1;
			if (attempts <= 3) {
				throw new Error("SQLITE_BUSY default retries");
			}
			return "default success";
		});

		expect(result).toBe("default success");
		expect(attempts).toBe(4);
	});

	it("supports async functions that resolve after retries", async () => {
		let attempts = 0;

		const result = await withRetry(
			async () => {
				attempts += 1;
				if (attempts === 1) {
					throw new Error("database is locked");
				}
				return Promise.resolve("async success");
			},
			{ backoffMs: 1 },
		);

		expect(result).toBe("async success");
		expect(attempts).toBe(2);
	});

	it("matches busy table lock errors for retry", async () => {
		let attempts = 0;

		const result = await withRetry(
			() => {
				attempts += 1;
				if (attempts < 2) {
					throw new Error("database table is locked: observations");
				}
				return "table lock recovered";
			},
			{ backoffMs: 1 },
		);

		expect(result).toBe("table lock recovered");
		expect(attempts).toBe(2);
	});

	it("does not call onRetry when first attempt succeeds", async () => {
		const onRetry = mock<(attempt: number, error: Error) => void>(() => undefined);

		const result = await withRetry(() => "immediate success", { onRetry, backoffMs: 1 });

		expect(result).toBe("immediate success");
		expect(onRetry).not.toHaveBeenCalled();
	});
});
