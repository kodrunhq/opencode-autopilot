import { type ChildProcess, spawn as nodeSpawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { spawn as bunSpawn, type Subprocess } from "bun";

interface StreamReader {
	read(): Promise<{ readonly done: boolean; readonly value: Uint8Array | undefined }>;
}

export interface UnifiedProcess {
	readonly stdin: { write(chunk: Uint8Array | string): void };
	readonly stdout: { getReader(): StreamReader };
	readonly stderr: { getReader(): StreamReader };
	readonly exitCode: number | null;
	readonly exited: Promise<number>;
	kill(signal?: NodeJS.Signals): void;
}

function createNodeReader(stream: NodeJS.ReadableStream | null): StreamReader {
	const queued: Uint8Array[] = [];
	let ended = stream === null;
	let waiting: ((result: { done: boolean; value: Uint8Array | undefined }) => void) | null = null;
	stream?.on("data", (chunk: Buffer) => {
		const value = new Uint8Array(chunk);
		if (waiting) {
			const resolve = waiting;
			waiting = null;
			resolve({ done: false, value });
			return;
		}
		queued.push(value);
	});
	const finish = () => {
		ended = true;
		if (waiting) {
			const resolve = waiting;
			waiting = null;
			resolve({ done: true, value: undefined });
		}
	};
	stream?.on("end", finish);
	stream?.on("error", finish);
	return {
		read: () =>
			new Promise((resolve) => {
				if (queued.length > 0) return resolve({ done: false, value: queued.shift() });
				if (ended) return resolve({ done: true, value: undefined });
				waiting = resolve;
			}),
	};
}

function wrapNodeProcess(processRef: ChildProcess): UnifiedProcess {
	let exitCode: number | null = null;
	let resolveExited: ((code: number) => void) | undefined;
	const exited = new Promise<number>((resolve) => {
		resolveExited = resolve;
	});
	const onExit = (code: number | null) => {
		exitCode = code ?? 1;
		resolveExited?.(exitCode);
	};
	processRef.once("exit", onExit);
	processRef.once("error", () => onExit(1));
	return {
		exited,
		kill: (signal) => {
			try {
				processRef.kill(signal);
			} catch {}
		},
		stderr: { getReader: () => createNodeReader(processRef.stderr) },
		stdin: { write: (chunk) => void processRef.stdin?.write(chunk) },
		stdout: { getReader: () => createNodeReader(processRef.stdout) },
		get exitCode() {
			return exitCode;
		},
	};
}

function wrapBunProcess(processRef: Subprocess<"pipe", "pipe", "pipe">): UnifiedProcess {
	return {
		get exitCode() {
			return processRef.exitCode;
		},
		exited: processRef.exited,
		kill: (signal) => {
			try {
				if (signal) processRef.kill(signal);
				else processRef.kill();
			} catch {}
		},
		stderr: { getReader: () => processRef.stderr.getReader() },
		stdin: { write: (chunk) => void processRef.stdin.write(chunk) },
		stdout: { getReader: () => processRef.stdout.getReader() },
	};
}

export function validateCwd(cwd: string): { readonly valid: boolean; readonly error?: string } {
	try {
		if (!existsSync(cwd))
			return { valid: false, error: `Working directory does not exist: ${cwd}` };
		if (!statSync(cwd).isDirectory())
			return { valid: false, error: `Path is not a directory: ${cwd}` };
		return { valid: true };
	} catch (error) {
		return {
			valid: false,
			error: `Cannot access working directory: ${cwd} (${error instanceof Error ? error.message : String(error)})`,
		};
	}
}

export function spawnProcess(
	command: readonly string[],
	options: { readonly cwd: string; readonly env: Record<string, string | undefined> },
): UnifiedProcess {
	const cwdResult = validateCwd(options.cwd);
	if (!cwdResult.valid) throw new Error(`[LSP] ${cwdResult.error}`);
	if (process.platform === "win32") {
		const [cmd, ...args] = command;
		return wrapNodeProcess(
			nodeSpawn(cmd, args, {
				cwd: options.cwd,
				env: options.env,
				shell: true,
				stdio: ["pipe", "pipe", "pipe"],
				windowsHide: true,
			}),
		);
	}
	return wrapBunProcess(
		bunSpawn([...command], {
			cwd: options.cwd,
			env: options.env,
			stderr: "pipe",
			stdin: "pipe",
			stdout: "pipe",
		}),
	);
}
