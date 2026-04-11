import { createForensicSink } from "./forensic-writer";
import { BaseLogger } from "./logger";
import type { LogEntry, Logger, LogMetadata, LogSink } from "./types";

export class MultiplexSink implements LogSink {
	constructor(private readonly sinks: readonly LogSink[]) {}

	write(entry: LogEntry): void {
		for (const sink of this.sinks) {
			sink.write(entry);
		}
	}
}

/**
 * Ring buffer for pre-initialization logs.
 */
class PreInitBuffer {
	private readonly maxSize = 100;
	private buffer: LogEntry[] = [];
	private flushed = false;

	write(entry: LogEntry): void {
		if (this.flushed) return;
		this.buffer.push(entry);
		if (this.buffer.length > this.maxSize) {
			this.buffer.shift();
		}
	}

	flush(sink: LogSink): void {
		if (this.flushed) return;
		this.flushed = true;
		for (const entry of this.buffer) {
			sink.write(entry);
		}
		this.buffer = [];
	}
}

const preInitBuffer = new PreInitBuffer();

let rootLogger: Logger | null = null;
let isInitialized = false;

const preInitSink: LogSink = {
	write(entry: LogEntry): void {
		preInitBuffer.write(entry);
	},
};

let activeSink: LogSink = preInitSink;

class DirectProxySink implements LogSink {
	write(entry: LogEntry): void {
		activeSink.write(entry);
	}
}

const directProxySink = new DirectProxySink();

export function initLoggers(projectRoot: string, sinks?: readonly LogSink[]): void {
	const resolvedSinks = sinks ?? [createForensicSink(projectRoot)];
	const multiplexSink = new MultiplexSink(resolvedSinks);
	rootLogger = new BaseLogger(multiplexSink, { domain: "system" });
	isInitialized = true;
	activeSink = multiplexSink;

	// Flush any pre-initialization logs
	preInitBuffer.flush(multiplexSink);
}

/**
 * Returns a proxy logger that routes to the active sink at call time.
 * This ensures module-scope loggers work correctly even when created
 * before initLoggers() is called.
 */
export function getLogger(domain: string, subsystem?: string): Logger {
	const metadata = compactMetadata(domain, subsystem);
	// Always return a logger using the proxy sink
	// This ensures the sink is resolved at log time, not creation time
	return new BaseLogger(directProxySink, metadata);
}

function compactMetadata(domain: string, subsystem?: string): LogMetadata {
	return subsystem ? { domain, subsystem } : { domain };
}

/**
 * Check if the logging system has been initialized.
 * Useful for tests and diagnostics.
 */
export function isLoggerInitialized(): boolean {
	return isInitialized;
}

/**
 * Reset logger state (for testing only).
 */
export function resetLoggerState(): void {
	rootLogger = null;
	isInitialized = false;
	activeSink = preInitSink;
}
