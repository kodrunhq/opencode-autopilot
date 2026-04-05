import { describe, expect, it } from "bun:test";
import { BaseLogger } from "../../src/logging/logger";
import type { LogEntry, LogSink } from "../../src/logging/types";

describe("BaseLogger", () => {
	it("should write logs to the sink with correct level and message", () => {
		const entries: LogEntry[] = [];
		const sink: LogSink = {
			write: (entry) => entries.push(entry),
		};
		const logger = new BaseLogger(sink, { domain: "test" });

		logger.info("hello world");

		expect(entries).toHaveLength(1);
		expect(entries[0].level).toBe("INFO");
		expect(entries[0].message).toBe("hello world");
		expect(entries[0].metadata.domain).toBe("test");
		expect(entries[0].timestamp).toBeDefined();
	});

	it("should merge metadata correctly", () => {
		const entries: LogEntry[] = [];
		const sink: LogSink = {
			write: (entry) => entries.push(entry),
		};
		const logger = new BaseLogger(sink, { domain: "test", subsystem: "core" });

		logger.warn("something happened", { operation: "op1", extra: 123 });

		expect(entries[0].metadata).toEqual({
			domain: "test",
			subsystem: "core",
			operation: "op1",
			extra: 123,
		});
	});

	it("should create child loggers with merged metadata", () => {
		const entries: LogEntry[] = [];
		const sink: LogSink = {
			write: (entry) => entries.push(entry),
		};
		const logger = new BaseLogger(sink, { domain: "test" });
		const child = logger.child({ subsystem: "child" });

		child.debug("child log");

		expect(entries[0].metadata).toEqual({
			domain: "test",
			subsystem: "child",
		});
	});

	it("should support all log levels", () => {
		const entries: LogEntry[] = [];
		const sink: LogSink = {
			write: (entry) => entries.push(entry),
		};
		const logger = new BaseLogger(sink, { domain: "test" });

		logger.debug("d");
		logger.info("i");
		logger.warn("w");
		logger.error("e");

		expect(entries.map((e) => e.level)).toEqual(["DEBUG", "INFO", "WARN", "ERROR"]);
	});

	it("should produce immutable log entries", () => {
		const entries: LogEntry[] = [];
		const sink: LogSink = {
			write: (entry) => entries.push(entry),
		};
		const logger = new BaseLogger(sink, { domain: "test" });

		logger.info("test");

		expect(Object.isFrozen(entries[0])).toBe(true);
	});
});
