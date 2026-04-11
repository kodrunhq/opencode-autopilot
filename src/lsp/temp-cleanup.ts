import { getLogger } from "../logging/domains";

type TempCleanupClient = {
	readonly refCount: number;
	readonly client: { stop(): Promise<void> };
};

export async function cleanupTempDirectoryLspClients(
	clients: ReadonlyMap<string, TempCleanupClient>,
): Promise<void> {
	const removable = [...clients.entries()].filter(
		([key, managed]) =>
			managed.refCount === 0 && (key.startsWith("/tmp/") || key.startsWith("/var/folders/")),
	);
	for (const [key, managed] of removable) {
		try {
			await managed.client.stop();
		} catch (error) {
			getLogger("lsp", "temp-cleanup").warn("Failed to stop client", {
				key,
				error: error instanceof Error ? error.message : String(error),
			});
		}
		if (clients instanceof Map) clients.delete(key);
	}
}
