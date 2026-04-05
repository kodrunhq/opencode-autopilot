import { describe, expect, it } from "bun:test";

import { getLogger, initLoggers, MultiplexSink } from "../../src/logging/domains";

describe("Domain loggers", () => {
	it("should tag loggers with domain metadata", () => {
		const entries: unknown[] = [];
		initLoggers("/test/project", [
			{
				write(entry) {
					entries.push(entry);
				},
			},
		]);
		getLogger("orchestrator", "plan").info("hello");

		expect(entries).toHaveLength(1);
		expect((entries[0] as { metadata: Record<string, unknown> }).metadata).toEqual({
			domain: "orchestrator",
			subsystem: "plan",
		});
	});

	it("should fan out writes across multiple sinks", () => {
		const entries: string[] = [];
		const sink = new MultiplexSink([
			{ write: (entry) => entries.push(`a:${entry.message}`) },
			{ write: (entry) => entries.push(`b:${entry.message}`) },
		]);

		sink.write({
			timestamp: "2026-04-05T12:00:00Z",
			level: "INFO",
			message: "x",
			metadata: { domain: "test" },
		});

		expect(entries).toEqual(["a:x", "b:x"]);
	});
});
