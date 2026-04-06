import { getLogger } from "../logging/domains";
import type { NotificationPlatform } from "./session-notification-types";

declare const Bun: {
	which(commandName: string): string | null;
};

const logger = getLogger("notifications");

export async function findCommand(commandName: string): Promise<string | null> {
	try {
		return Bun.which(commandName);
	} catch (error) {
		logger.debug("Command lookup failed", {
			commandName,
			error: error instanceof Error ? error.message : String(error),
		});
		return null;
	}
}

export function createCommandFinder(commandName: string): () => Promise<string | null> {
	let cachedPath: string | null | undefined;
	let pendingResolution: Promise<string | null> | null = null;

	return async (): Promise<string | null> => {
		if (cachedPath !== undefined) return cachedPath;
		if (pendingResolution) return pendingResolution;

		pendingResolution = findCommand(commandName)
			.then((resolvedPath) => {
				cachedPath = resolvedPath;
				return resolvedPath;
			})
			.finally(() => {
				pendingResolution = null;
			});

		return pendingResolution;
	};
}

export const getNotifySendPath = createCommandFinder("notify-send");
export const getOsascriptPath = createCommandFinder("osascript");
export const getPowershellPath = createCommandFinder("powershell");
export const getAfplayPath = createCommandFinder("afplay");
export const getPaplayPath = createCommandFinder("paplay");
export const getAplayPath = createCommandFinder("aplay");
export const getTerminalNotifierPath = createCommandFinder("terminal-notifier");

export function startBackgroundCheck(platform: NotificationPlatform): void {
	const lookupsByPlatform: Record<
		NotificationPlatform,
		ReadonlyArray<() => Promise<string | null>>
	> = {
		darwin: [getTerminalNotifierPath, getOsascriptPath, getAfplayPath],
		linux: [getNotifySendPath, getPaplayPath, getAplayPath],
		win32: [getPowershellPath],
		unsupported: [],
	};

	const lookups = lookupsByPlatform[platform];
	if (lookups.length === 0) return;

	void Promise.all(lookups.map((lookup) => lookup())).catch((error) => {
		logger.debug("Background command detection failed", {
			platform,
			error: error instanceof Error ? error.message : String(error),
		});
	});
}
