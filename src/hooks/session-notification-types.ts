export type NotificationPlatform = "darwin" | "linux" | "win32" | "unsupported";

export interface SessionNotificationConfig {
	readonly title: string;
	readonly message: string;
	readonly questionMessage: string;
	readonly permissionMessage: string;
	readonly playSound: boolean;
	readonly soundPath: string;
	readonly idleConfirmationDelay: number;
	readonly skipIfIncompleteTodos: boolean;
	readonly maxTrackedSessions: number;
	readonly activityGracePeriodMs: number;
	readonly enforceMainSessionFilter: boolean;
}

export const DEFAULT_NOTIFICATION_CONFIG: SessionNotificationConfig = {
	title: "OpenCode Autopilot",
	message: "Agent is ready for input",
	questionMessage: "Agent is asking a question",
	permissionMessage: "Agent needs permission to continue",
	playSound: false,
	soundPath: "",
	idleConfirmationDelay: 1500,
	skipIfIncompleteTodos: true,
	maxTrackedSessions: 100,
	activityGracePeriodMs: 100,
	enforceMainSessionFilter: true,
};
