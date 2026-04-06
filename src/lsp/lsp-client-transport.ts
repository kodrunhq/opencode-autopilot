import { delimiter } from "node:path";
import { Readable, Writable } from "node:stream";
import {
	createMessageConnection,
	type MessageConnection,
	StreamMessageReader,
	StreamMessageWriter,
} from "vscode-jsonrpc/node";
import { spawnProcess, type UnifiedProcess } from "./lsp-process";
import { getLspServerAdditionalPathBases } from "./server-path-bases";
import type { Diagnostic, ResolvedServer } from "./types";

interface DiagnosticsNotification {
	readonly uri?: string;
	readonly diagnostics?: readonly Diagnostic[];
}

export class LspClientTransport {
	protected proc: UnifiedProcess | null = null;
	protected connection: MessageConnection | null = null;
	protected readonly stderrBuffer: string[] = [];
	protected readonly diagnosticsStore = new Map<string, readonly Diagnostic[]>();
	protected readonly requestTimeoutMs = 15000;
	protected processExited = false;

	constructor(
		protected readonly root: string,
		protected readonly server: ResolvedServer,
	) {}

	async start(): Promise<void> {
		const env = { ...process.env, ...this.server.env };
		const pathValue =
			process.platform === "win32" ? (env.PATH ?? env.Path ?? "") : (env.PATH ?? "");
		const spawnPath = [pathValue, ...getLspServerAdditionalPathBases(this.root)]
			.filter(Boolean)
			.join(delimiter);
		env.PATH = spawnPath;
		if (process.platform === "win32" && env.Path !== undefined) env.Path = spawnPath;
		this.proc = spawnProcess(this.server.command, { cwd: this.root, env });
		this.startStderrReading();
		await new Promise((resolve) => setTimeout(resolve, 100));
		if (this.proc.exitCode !== null)
			throw new Error(
				`LSP server exited immediately with code ${this.proc.exitCode}${this.formatStderr()}`,
			);

		const stdoutReader = this.proc.stdout.getReader();
		const nodeReadable = new Readable({
			async read() {
				try {
					const { done, value } = await stdoutReader.read();
					this.push(done || !value ? null : Buffer.from(value));
				} catch {
					this.push(null);
				}
			},
		});
		const nodeWritable = new Writable({
			write: (chunk, _encoding, callback) => {
				try {
					this.proc?.stdin.write(chunk);
					callback();
				} catch (error) {
					callback(error instanceof Error ? error : new Error(String(error)));
				}
			},
		});
		this.connection = createMessageConnection(
			new StreamMessageReader(nodeReadable),
			new StreamMessageWriter(nodeWritable),
		);
		this.connection.onNotification(
			"textDocument/publishDiagnostics",
			(params: DiagnosticsNotification) => {
				if (params.uri) this.diagnosticsStore.set(params.uri, params.diagnostics ?? []);
			},
		);
		this.connection.onRequest(
			"workspace/configuration",
			(params: { readonly items?: readonly { readonly section?: string }[] }) =>
				(params.items ?? []).map((item) =>
					item.section === "json" ? { validate: { enable: true } } : {},
				),
		);
		this.connection.onRequest("client/registerCapability", () => null);
		this.connection.onRequest("window/workDoneProgress/create", () => null);
		this.connection.onClose(() => {
			this.processExited = true;
		});
		this.connection.onError((error) => {
			console.error("LSP connection error", error);
		});
		this.connection.listen();
	}

	protected async sendRequest<T>(method: string, params?: unknown): Promise<T> {
		if (!this.connection) throw new Error("LSP client not started");
		if (this.processExited || this.proc?.exitCode !== null)
			throw new Error(
				`LSP server already exited (code: ${this.proc?.exitCode})${this.formatStderr(10)}`,
			);
		let timeoutId: ReturnType<typeof setTimeout> | undefined;
		const timeoutPromise = new Promise<never>((_resolve, reject) => {
			timeoutId = setTimeout(
				() =>
					reject(
						new Error(
							`LSP request timeout (method: ${method})${this.formatStderr(5, "recent stderr")}`,
						),
					),
				this.requestTimeoutMs,
			);
		});
		try {
			const request =
				params === undefined
					? this.connection.sendRequest(method)
					: this.connection.sendRequest(method, params);
			return await Promise.race([request as Promise<T>, timeoutPromise]);
		} finally {
			if (timeoutId) clearTimeout(timeoutId);
		}
	}

	protected sendNotification(method: string, params?: unknown): void {
		if (!this.connection || this.processExited || this.proc?.exitCode !== null) return;
		if (params === undefined) this.connection.sendNotification(method);
		else this.connection.sendNotification(method, params);
	}

	protected startStderrReading(): void {
		const reader = this.proc?.stderr.getReader();
		if (!reader) return;
		void (async () => {
			const decoder = new TextDecoder();
			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) return;
					this.stderrBuffer.push(decoder.decode(value));
					if (this.stderrBuffer.length > 100) this.stderrBuffer.shift();
				}
			} catch {}
		})();
	}

	private formatStderr(limit = this.stderrBuffer.length, label = "stderr"): string {
		const joined = this.stderrBuffer.slice(-limit).join("\n");
		return joined ? `\n${label}: ${joined}` : "";
	}

	isAlive(): boolean {
		return this.proc !== null && !this.processExited && this.proc.exitCode === null;
	}

	async stop(): Promise<void> {
		if (this.connection) {
			this.connection.dispose();
			this.connection = null;
		}
		const proc = this.proc;
		this.proc = null;
		if (proc) {
			try {
				proc.kill();
				const exited = await Promise.race([
					proc.exited.then(() => true),
					new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5000)),
				]);
				if (!exited) {
					console.error("[LSPClient] Process did not exit within timeout, escalating to SIGKILL");
					proc.kill("SIGKILL");
					await Promise.race([
						proc.exited,
						new Promise<void>((resolve) => setTimeout(resolve, 1000)),
					]);
				}
			} catch {}
		}
		this.processExited = true;
		this.diagnosticsStore.clear();
	}
}
