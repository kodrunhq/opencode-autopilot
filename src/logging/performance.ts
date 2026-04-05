import { getLogger } from "./domains";

function log() {
	return getLogger("system", "performance");
}

export interface MemorySnapshot {
	readonly rss: number;
	readonly heapTotal: number;
	readonly heapUsed: number;
	readonly external: number;
	readonly arrayBuffers: number;
}

export interface TimerHandle {
	stop(metadata?: Record<string, unknown>): void;
}

export function recordMemoryUsage(): void {
	const mem = process.memoryUsage();

	const snapshot: MemorySnapshot = {
		rss: mem.rss,
		heapTotal: mem.heapTotal,
		heapUsed: mem.heapUsed,
		external: mem.external,
		arrayBuffers: mem.arrayBuffers,
	};

	log().info("memory usage", {
		operation: "memory_snapshot",
		...snapshot,
	});
}

export function startTimer(operation: string): TimerHandle {
	// performance.now() is monotonic and unaffected by system-clock adjustments
	const startMs = performance.now();

	return {
		stop(metadata?: Record<string, unknown>): void {
			const durationMs = performance.now() - startMs;

			log().info("operation completed", {
				operation,
				durationMs,
				...metadata,
			});
		},
	};
}

export function recordAgentResponseTime(agent: string, durationMs: number): void {
	log().info("agent response time", {
		operation: "agent_response_time",
		agent,
		durationMs,
	});
}
