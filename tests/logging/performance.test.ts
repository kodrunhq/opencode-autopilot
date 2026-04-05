import { beforeEach, describe, expect, it } from "bun:test";

import { initLoggers } from "../../src/logging/domains";
import type { LogEntry } from "../../src/logging/types";
import {
	recordAgentResponseTime,
	recordMemoryUsage,
	startTimer,
} from "../../src/logging/performance";

function makeSink(): { entries: LogEntry[]; sink: { write(entry: LogEntry): void } } {
	const entries: LogEntry[] = [];
	return {
		entries,
		sink: {
			write(entry: LogEntry): void {
				entries.push(entry);
			},
		},
	};
}

describe("recordMemoryUsage", () => {
	it("emits one INFO entry tagged to the performance subsystem", () => {
		const { entries, sink } = makeSink();
		initLoggers("/test", [sink]);

		recordMemoryUsage();

		expect(entries).toHaveLength(1);
		const entry = entries[0];
		expect(entry.level).toBe("INFO");
		expect(entry.message).toBe("memory usage");
		expect(entry.metadata.domain).toBe("system");
		expect(entry.metadata.subsystem).toBe("performance");
		expect(entry.metadata.operation).toBe("memory_snapshot");
	});

	it("attaches all four memory counters as numbers", () => {
		const { entries, sink } = makeSink();
		initLoggers("/test", [sink]);

		recordMemoryUsage();

		const meta = entries[0].metadata;
		expect(typeof meta.rss).toBe("number");
		expect(typeof meta.heapTotal).toBe("number");
		expect(typeof meta.heapUsed).toBe("number");
		expect(typeof meta.external).toBe("number");
		expect(typeof meta.arrayBuffers).toBe("number");
	});

	it("records non-negative memory values", () => {
		const { entries, sink } = makeSink();
		initLoggers("/test", [sink]);

		recordMemoryUsage();

		const meta = entries[0].metadata;
		expect(meta.rss as number).toBeGreaterThanOrEqual(0);
		expect(meta.heapTotal as number).toBeGreaterThanOrEqual(0);
		expect(meta.heapUsed as number).toBeGreaterThanOrEqual(0);
		expect(meta.external as number).toBeGreaterThanOrEqual(0);
		expect(meta.arrayBuffers as number).toBeGreaterThanOrEqual(0);
	});
});

describe("startTimer", () => {
	it("logs the operation name and a numeric durationMs on stop", () => {
		const { entries, sink } = makeSink();
		initLoggers("/test", [sink]);

		const timer = startTimer("plan-generation");
		timer.stop();

		expect(entries).toHaveLength(1);
		const entry = entries[0];
		expect(entry.level).toBe("INFO");
		expect(entry.message).toBe("operation completed");
		expect(entry.metadata.operation).toBe("plan-generation");
		expect(typeof entry.metadata.durationMs).toBe("number");
	});

	it("records a non-negative duration", () => {
		const { entries, sink } = makeSink();
		initLoggers("/test", [sink]);

		const timer = startTimer("build");
		timer.stop();

		expect(entries[0].metadata.durationMs as number).toBeGreaterThanOrEqual(0);
	});

	it("passes additional metadata to the log entry", () => {
		const { entries, sink } = makeSink();
		initLoggers("/test", [sink]);

		const timer = startTimer("fetch-user");
		timer.stop({ userId: "u-42", cached: true });

		const meta = entries[0].metadata;
		expect(meta.userId).toBe("u-42");
		expect(meta.cached).toBe(true);
	});

	it("tags the entry with domain=system and subsystem=performance", () => {
		const { entries, sink } = makeSink();
		initLoggers("/test", [sink]);

		startTimer("noop").stop();

		const meta = entries[0].metadata;
		expect(meta.domain).toBe("system");
		expect(meta.subsystem).toBe("performance");
	});

	it("measures elapsed time longer than a small async gap", async () => {
		const { entries, sink } = makeSink();
		initLoggers("/test", [sink]);

		const timer = startTimer("async-op");
		await new Promise((resolve) => setTimeout(resolve, 10));
		timer.stop();

		expect(entries[0].metadata.durationMs as number).toBeGreaterThanOrEqual(5);
	});

	it("each timer is independent", () => {
		const { entries, sink } = makeSink();
		initLoggers("/test", [sink]);

		const t1 = startTimer("op-a");
		const t2 = startTimer("op-b");
		t1.stop();
		t2.stop();

		expect(entries).toHaveLength(2);
		expect(entries[0].metadata.operation).toBe("op-a");
		expect(entries[1].metadata.operation).toBe("op-b");
	});
});

describe("recordAgentResponseTime", () => {
	it("emits one INFO entry with agent and durationMs", () => {
		const { entries, sink } = makeSink();
		initLoggers("/test", [sink]);

		recordAgentResponseTime("oc-planner", 123.45);

		expect(entries).toHaveLength(1);
		const entry = entries[0];
		expect(entry.level).toBe("INFO");
		expect(entry.message).toBe("agent response time");
		expect(entry.metadata.operation).toBe("agent_response_time");
		expect(entry.metadata.agent).toBe("oc-planner");
		expect(entry.metadata.durationMs).toBe(123.45);
	});

	it("tags the entry with domain=system and subsystem=performance", () => {
		const { entries, sink } = makeSink();
		initLoggers("/test", [sink]);

		recordAgentResponseTime("oc-reviewer", 50);

		const meta = entries[0].metadata;
		expect(meta.domain).toBe("system");
		expect(meta.subsystem).toBe("performance");
	});

	it("preserves fractional milliseconds", () => {
		const { entries, sink } = makeSink();
		initLoggers("/test", [sink]);

		recordAgentResponseTime("oc-builder", 42.789);

		expect(entries[0].metadata.durationMs).toBe(42.789);
	});

	it("accepts zero as a valid duration", () => {
		const { entries, sink } = makeSink();
		initLoggers("/test", [sink]);

		recordAgentResponseTime("oc-fast-agent", 0);

		expect(entries[0].metadata.durationMs).toBe(0);
	});
});
