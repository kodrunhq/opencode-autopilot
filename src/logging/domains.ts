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

let rootLogger: Logger | null = null;

export function initLoggers(projectRoot: string, sinks?: readonly LogSink[]): void {
	const resolvedSinks = sinks ?? [createForensicSink(projectRoot)];
	rootLogger = new BaseLogger(new MultiplexSink(resolvedSinks), { domain: "system" });
}

export function getLogger(domain: string, subsystem?: string): Logger {
	if (!rootLogger) {
		return new BaseLogger(
			{
				write(entry: LogEntry): void {
					console.log(entry.level, entry.message);
				},
			},
			compactMetadata(domain, subsystem),
		);
	}

	return rootLogger.child(compactMetadata(domain, subsystem));
}

function compactMetadata(domain: string, subsystem?: string): LogMetadata {
	return subsystem ? { domain, subsystem } : { domain };
}
