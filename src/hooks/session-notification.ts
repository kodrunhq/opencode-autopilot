import { createNotificationContentBuilder } from "./session-notification-content";
import { createIdleNotificationScheduler } from "./session-notification-scheduler";
import {
	detectPlatform,
	getDefaultSoundPath,
	playSessionNotificationSound,
	sendSessionNotification,
} from "./session-notification-sender";
import {
	DEFAULT_NOTIFICATION_CONFIG,
	type SessionNotificationConfig,
} from "./session-notification-types";
import { startBackgroundCheck } from "./session-notification-utils";

interface SessionNotificationMessage {
	readonly role: string;
	readonly text: string;
}

export interface SessionNotificationHandlerOptions {
	readonly getSessionTitle: (sessionID: string) => Promise<string>;
	readonly getSessionMessages: (
		sessionID: string,
	) => Promise<ReadonlyArray<SessionNotificationMessage>>;
	readonly config?: Partial<SessionNotificationConfig>;
}

interface NotificationEvent {
	readonly type: string;
	readonly properties?: unknown;
}

const QUESTION_TOOLS = new Set(["question", "ask_user_question", "askuserquestion"]);
const PERMISSION_EVENTS = new Set([
	"permission.ask",
	"permission.asked",
	"permission.updated",
	"permission.requested",
]);

function asRecord(value: unknown): Record<string, unknown> | undefined {
	return value !== null && typeof value === "object"
		? (value as Record<string, unknown>)
		: undefined;
}

function extractSessionID(properties: unknown): string | undefined {
	const root = asRecord(properties);
	if (!root) return undefined;

	if (typeof root.sessionID === "string") return root.sessionID;
	if (typeof root.sessionId === "string") return root.sessionId;

	const info = asRecord(root.info);
	if (!info) return undefined;
	if (typeof info.sessionID === "string") return info.sessionID;
	if (typeof info.sessionId === "string") return info.sessionId;
	if (typeof info.id === "string") return info.id;
	return undefined;
}

function extractToolName(properties: unknown): string | undefined {
	const root = asRecord(properties);
	if (!root) return undefined;
	if (typeof root.tool === "string") return root.tool;

	const info = asRecord(root.info);
	if (!info) return undefined;
	if (typeof info.tool === "string") return info.tool;
	if (typeof info.name === "string") return info.name;
	return undefined;
}

export function createSessionNotificationHandler(options: SessionNotificationHandlerOptions) {
	const platform = detectPlatform();
	startBackgroundCheck(platform);

	const mergedConfig: SessionNotificationConfig = {
		...DEFAULT_NOTIFICATION_CONFIG,
		soundPath: getDefaultSoundPath(platform),
		...options.config,
	};

	const contentBuilder = createNotificationContentBuilder({
		getSessionTitle: options.getSessionTitle,
		getSessionMessages: options.getSessionMessages,
	});

	async function playSoundIfEnabled(): Promise<void> {
		if (!mergedConfig.playSound || !mergedConfig.soundPath) return;
		await playSessionNotificationSound(platform, mergedConfig.soundPath);
	}

	async function sendImmediateNotification(message: string): Promise<void> {
		await sendSessionNotification(platform, mergedConfig.title, message);
		await playSoundIfEnabled();
	}

	const scheduler = createIdleNotificationScheduler({
		config: mergedConfig,
		send: async (sessionID) => {
			const content = await contentBuilder({
				sessionID,
				baseTitle: mergedConfig.title,
				baseMessage: mergedConfig.message,
			});
			await sendSessionNotification(platform, content.title, content.message);
		},
		playSound: async (soundPath) => {
			await playSessionNotificationSound(platform, soundPath);
		},
	});

	return async ({ event }: { event: NotificationEvent }): Promise<void> => {
		if (platform === "unsupported") return;

		const sessionID = extractSessionID(event.properties);
		if (!sessionID) return;

		if (PERMISSION_EVENTS.has(event.type)) {
			scheduler.markSessionActivity(sessionID);
			await sendImmediateNotification(mergedConfig.permissionMessage);
			return;
		}

		switch (event.type) {
			case "session.created": {
				scheduler.markSessionActivity(sessionID);
				return;
			}

			case "session.idle": {
				scheduler.scheduleIdleNotification(sessionID);
				return;
			}

			case "message.updated": {
				scheduler.markSessionActivity(sessionID);
				return;
			}

			case "tool.execute.before": {
				scheduler.markSessionActivity(sessionID);
				const toolName = extractToolName(event.properties)?.toLowerCase();
				if (!toolName || !QUESTION_TOOLS.has(toolName)) return;
				await sendImmediateNotification(mergedConfig.questionMessage);
				return;
			}

			case "tool.execute.after": {
				scheduler.markSessionActivity(sessionID);
				return;
			}

			case "session.deleted": {
				scheduler.deleteSession(sessionID);
				return;
			}

			default:
				return;
		}
	};
}
