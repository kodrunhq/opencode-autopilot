/**
 * Logging type definitions for the OpenCode Autopilot plugin.
 *
 * @module
 */

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

export interface LogMetadata {
	readonly domain: string;
	readonly subsystem?: string;
	readonly operation?: string;
	readonly [key: string]: unknown;
}

export interface LogEntry {
	readonly timestamp: string;
	readonly level: LogLevel;
	readonly message: string;
	readonly metadata: LogMetadata;
}

export interface LogSink {
	write(entry: LogEntry): void;
}

export interface Logger {
	debug(message: string, metadata?: Partial<LogMetadata>): void;
	info(message: string, metadata?: Partial<LogMetadata>): void;
	warn(message: string, metadata?: Partial<LogMetadata>): void;
	error(message: string, metadata?: Partial<LogMetadata>): void;
	child(metadata: Partial<LogMetadata>): Logger;
}
