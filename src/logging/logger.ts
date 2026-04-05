import type { LogEntry, Logger, LogLevel, LogMetadata, LogSink } from "./types";

export class BaseLogger implements Logger {
	constructor(
		private readonly sink: LogSink,
		private readonly baseMetadata: LogMetadata,
	) {}

	debug(message: string, metadata?: Partial<LogMetadata>): void {
		this.log("DEBUG", message, metadata);
	}

	info(message: string, metadata?: Partial<LogMetadata>): void {
		this.log("INFO", message, metadata);
	}

	warn(message: string, metadata?: Partial<LogMetadata>): void {
		this.log("WARN", message, metadata);
	}

	error(message: string, metadata?: Partial<LogMetadata>): void {
		this.log("ERROR", message, metadata);
	}

	child(metadata: Partial<LogMetadata>): Logger {
		return new BaseLogger(this.sink, {
			...this.baseMetadata,
			...metadata,
		});
	}

	private log(level: LogLevel, message: string, metadata?: Partial<LogMetadata>): void {
		const entry: LogEntry = {
			timestamp: new Date().toISOString(),
			level,
			message,
			metadata: {
				...this.baseMetadata,
				...metadata,
			},
		};
		this.sink.write(Object.freeze(entry));
	}
}
