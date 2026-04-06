import { platform as getOsPlatform } from "node:os";

import { getLogger } from "../logging/domains";
import {
	buildWindowsToastScript,
	escapeAppleScriptText,
	escapePowerShellSingleQuotedText,
} from "./session-notification-formatting";
import type { NotificationPlatform } from "./session-notification-types";
import {
	getAfplayPath,
	getAplayPath,
	getNotifySendPath,
	getOsascriptPath,
	getPaplayPath,
	getPowershellPath,
	getTerminalNotifierPath,
} from "./session-notification-utils";

declare const Bun: {
	spawn(
		cmd: string[],
		options?: { stdout?: "pipe" | "ignore"; stderr?: "pipe" | "ignore" },
	): {
		exited: Promise<number>;
	};
};

const logger = getLogger("notifications");
const DEFAULT_SOUND_PATHS: Record<NotificationPlatform, string> = {
	darwin: "/System/Library/Sounds/Glass.aiff",
	linux: "/usr/share/sounds/freedesktop/stereo/complete.oga",
	win32: "C:\\Windows\\Media\\Windows Notify System Generic.wav",
	unsupported: "",
};

async function runCommand(command: string, args: readonly string[]): Promise<boolean> {
	try {
		const process = Bun.spawn([command, ...args], { stdout: "ignore", stderr: "ignore" });
		return (await process.exited) === 0;
	} catch (error) {
		logger.debug("Notification command failed", {
			command,
			error: error instanceof Error ? error.message : String(error),
		});
		return false;
	}
}

export function detectPlatform(): NotificationPlatform {
	const currentPlatform = getOsPlatform();
	return currentPlatform === "darwin" || currentPlatform === "linux" || currentPlatform === "win32"
		? currentPlatform
		: "unsupported";
}

export function getDefaultSoundPath(platform: NotificationPlatform): string {
	return DEFAULT_SOUND_PATHS[platform];
}

export async function sendSessionNotification(
	platform: NotificationPlatform,
	title: string,
	message: string,
): Promise<void> {
	if (platform === "darwin") {
		const terminalNotifierPath = await getTerminalNotifierPath();
		if (terminalNotifierPath) {
			const senderBundleIdentifier = process.env.__CFBundleIdentifier;
			const terminalNotifierArgs = senderBundleIdentifier
				? ["-title", title, "-message", message, "-sender", senderBundleIdentifier]
				: ["-title", title, "-message", message];
			if (await runCommand(terminalNotifierPath, terminalNotifierArgs)) return;
		}

		const osascriptPath = await getOsascriptPath();
		if (!osascriptPath) return;
		const script = `display notification "${escapeAppleScriptText(message)}" with title "${escapeAppleScriptText(title)}"`;
		await runCommand(osascriptPath, ["-e", script]);
		return;
	}

	if (platform === "linux") {
		const notifySendPath = await getNotifySendPath();
		if (!notifySendPath) return;
		await runCommand(notifySendPath, [title, message]);
		return;
	}

	if (platform === "win32") {
		const powershellPath = await getPowershellPath();
		if (!powershellPath) return;
		await runCommand(powershellPath, [
			"-NoProfile",
			"-Command",
			buildWindowsToastScript(title, message),
		]);
	}
}

export async function playSessionNotificationSound(
	platform: NotificationPlatform,
	soundPath: string,
): Promise<void> {
	if (!soundPath) return;

	if (platform === "darwin") {
		const afplayPath = await getAfplayPath();
		if (!afplayPath) return;
		await runCommand(afplayPath, [soundPath]);
		return;
	}

	if (platform === "linux") {
		const paplayPath = await getPaplayPath();
		if (paplayPath && (await runCommand(paplayPath, [soundPath]))) return;

		const aplayPath = await getAplayPath();
		if (!aplayPath) return;
		await runCommand(aplayPath, [soundPath]);
		return;
	}

	if (platform === "win32") {
		const powershellPath = await getPowershellPath();
		if (!powershellPath) return;
		const script = [
			"Add-Type -AssemblyName System.Windows.Extensions",
			`$player = [System.Media.SoundPlayer]::new('${escapePowerShellSingleQuotedText(soundPath)}')`,
			"$player.PlaySync()",
		].join("; ");
		await runCommand(powershellPath, ["-NoProfile", "-Command", script]);
	}
}
