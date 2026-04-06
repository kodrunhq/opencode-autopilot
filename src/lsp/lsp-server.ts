import { LspClient } from "./lsp-client";
import { type LspProcessCleanupHandle, registerLspManagerProcessCleanup } from "./process-cleanup";
import { cleanupTempDirectoryLspClients } from "./temp-cleanup";
import type { ResolvedServer } from "./types";

interface ManagedClient {
	readonly client: LspClient;
	lastUsedAt: number;
	refCount: number;
	initPromise?: Promise<void>;
	isInitializing: boolean;
	initializingSince?: number;
}

class LspServerManager {
	private static instance: LspServerManager | null = null;
	private readonly clients = new Map<string, ManagedClient>();
	private cleanupInterval: ReturnType<typeof setInterval> | null = null;
	private cleanupHandle: LspProcessCleanupHandle | null = null;
	private readonly idleTimeoutMs = 5 * 60 * 1000;
	private readonly initTimeoutMs = 60 * 1000;

	private constructor() {
		this.startCleanupTimer();
		this.cleanupHandle = registerLspManagerProcessCleanup({
			clearCleanupInterval: () => {
				if (this.cleanupInterval) clearInterval(this.cleanupInterval);
				this.cleanupInterval = null;
			},
			clearClients: () => this.clients.clear(),
			getClients: () => this.clients.entries(),
		});
	}

	static getInstance(): LspServerManager {
		if (!LspServerManager.instance) LspServerManager.instance = new LspServerManager();
		return LspServerManager.instance;
	}

	private getKey(root: string, serverId: string): string {
		return `${root}::${serverId}`;
	}

	private startCleanupTimer(): void {
		if (this.cleanupInterval) return;
		this.cleanupInterval = setInterval(() => {
			const now = Date.now();
			for (const [key, managed] of this.clients) {
				if (managed.refCount === 0 && now - managed.lastUsedAt > this.idleTimeoutMs) {
					void managed.client.stop();
					this.clients.delete(key);
				}
			}
		}, 60000);
		if (typeof this.cleanupInterval === "object" && "unref" in this.cleanupInterval)
			this.cleanupInterval.unref();
	}

	async getClient(root: string, server: ResolvedServer): Promise<LspClient> {
		const key = this.getKey(root, server.id);
		let managed = this.clients.get(key);
		if (
			managed?.isInitializing &&
			managed.initializingSince &&
			Date.now() - managed.initializingSince >= this.initTimeoutMs
		) {
			try {
				await managed.client.stop();
			} catch {}
			this.clients.delete(key);
			managed = undefined;
		}
		if (managed?.initPromise) {
			try {
				await managed.initPromise;
			} catch {
				try {
					await managed.client.stop();
				} catch {}
				this.clients.delete(key);
				managed = undefined;
			}
		}
		if (managed) {
			if (managed.client.isAlive()) {
				managed.refCount += 1;
				managed.lastUsedAt = Date.now();
				return managed.client;
			}
			try {
				await managed.client.stop();
			} catch {}
			this.clients.delete(key);
		}

		const client = new LspClient(root, server);
		const initPromise = (async () => {
			await client.start();
			await client.initialize();
		})();
		const startedAt = Date.now();
		this.clients.set(key, {
			client,
			initPromise,
			initializingSince: startedAt,
			isInitializing: true,
			lastUsedAt: startedAt,
			refCount: 1,
		});
		try {
			await initPromise;
		} catch (error) {
			this.clients.delete(key);
			try {
				await client.stop();
			} catch {}
			throw error;
		}
		const current = this.clients.get(key);
		if (current) {
			current.initPromise = undefined;
			current.initializingSince = undefined;
			current.isInitializing = false;
		}
		return client;
	}

	releaseClient(root: string, serverId: string): void {
		const managed = this.clients.get(this.getKey(root, serverId));
		if (!managed || managed.refCount <= 0) return;
		managed.refCount -= 1;
		managed.lastUsedAt = Date.now();
	}

	isServerInitializing(root: string, serverId: string): boolean {
		return this.clients.get(this.getKey(root, serverId))?.isInitializing ?? false;
	}

	async stopAll(): Promise<void> {
		this.cleanupHandle?.unregister();
		this.cleanupHandle = null;
		await Promise.allSettled([...this.clients.values()].map((managed) => managed.client.stop()));
		this.clients.clear();
		if (this.cleanupInterval) clearInterval(this.cleanupInterval);
		this.cleanupInterval = null;
	}

	async cleanupTempDirectoryClients(): Promise<void> {
		await cleanupTempDirectoryLspClients(this.clients);
	}
}

export const lspManager = LspServerManager.getInstance();
