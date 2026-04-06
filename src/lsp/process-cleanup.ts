type CleanupClient = { readonly client: { stop(): Promise<void> } };

export interface LspProcessCleanupHandle {
	unregister(): void;
}

interface CleanupOptions {
	getClients(): IterableIterator<[string, CleanupClient]>;
	clearClients(): void;
	clearCleanupInterval(): void;
}

export function registerLspManagerProcessCleanup(options: CleanupOptions): LspProcessCleanupHandle {
	const listeners: Array<readonly ["exit" | NodeJS.Signals, () => void]> = [];
	const stopAll = async (): Promise<void> => {
		await Promise.allSettled(
			[...options.getClients()].map(([, managed]) =>
				managed.client.stop().catch((error) => {
					console.error("[lsp-process-cleanup] stop failed", error);
				}),
			),
		);
		options.clearClients();
		options.clearCleanupInterval();
	};
	const register = (event: "exit" | NodeJS.Signals, listener: () => void) => {
		listeners.push([event, listener]);
		process.on(event, listener);
	};
	register("exit", () => {
		void stopAll();
	});
	const signalListener = () => {
		void stopAll().catch((error) =>
			console.error("[lsp-process-cleanup] signal cleanup failed", error),
		);
	};
	register("SIGINT", signalListener);
	register("SIGTERM", signalListener);
	if (process.platform === "win32") register("SIGBREAK", signalListener);
	return {
		unregister: () => {
			listeners.splice(0).forEach(([event, listener]) => {
				process.off(event, listener);
			});
		},
	};
}
