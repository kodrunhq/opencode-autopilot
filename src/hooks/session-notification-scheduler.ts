export interface SchedulerOptions {
	readonly config: {
		readonly idleConfirmationDelay: number;
		readonly skipIfIncompleteTodos: boolean;
		readonly maxTrackedSessions: number;
		readonly activityGracePeriodMs: number;
		readonly playSound: boolean;
		readonly soundPath: string;
	};
	readonly send: (sessionID: string) => Promise<void>;
	readonly playSound: (soundPath: string) => Promise<void>;
}

function getTrackedSessionID<T>(
	collection: ReadonlySet<string> | ReadonlyMap<string, T>,
): string | undefined {
	const next = collection.keys().next();
	return next.done ? undefined : next.value;
}

export function createIdleNotificationScheduler(options: SchedulerOptions) {
	const notifiedSessions = new Set<string>();
	const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();
	const sessionActivitySinceIdle = new Set<string>();
	const notificationVersions = new Map<string, number>();
	const executingNotifications = new Set<string>();
	const scheduledAt = new Map<string, number>();

	const maxTrackedSessions = Math.max(1, options.config.maxTrackedSessions);
	const activityGracePeriodMs = Math.max(0, options.config.activityGracePeriodMs);

	function touchVersion(sessionID: string): number {
		const nextVersion = (notificationVersions.get(sessionID) ?? 0) + 1;
		notificationVersions.delete(sessionID);
		notificationVersions.set(sessionID, nextVersion);
		return nextVersion;
	}

	function touchSetEntry(collection: Set<string>, sessionID: string): void {
		collection.delete(sessionID);
		collection.add(sessionID);
	}

	function clearPendingTimer(sessionID: string): void {
		const timer = pendingTimers.get(sessionID);
		if (!timer) return;

		clearTimeout(timer);
		pendingTimers.delete(sessionID);
	}

	function deleteSession(sessionID: string): void {
		clearPendingTimer(sessionID);
		notifiedSessions.delete(sessionID);
		sessionActivitySinceIdle.delete(sessionID);
		notificationVersions.delete(sessionID);
		executingNotifications.delete(sessionID);
		scheduledAt.delete(sessionID);
	}

	function cleanupCollection<T>(collection: ReadonlySet<string> | ReadonlyMap<string, T>): void {
		while (collection.size > maxTrackedSessions) {
			const oldestSessionID = getTrackedSessionID(collection);
			if (!oldestSessionID) return;
			deleteSession(oldestSessionID);
		}
	}

	function cleanupOldSessions(): void {
		cleanupCollection(notifiedSessions);
		cleanupCollection(pendingTimers);
		cleanupCollection(sessionActivitySinceIdle);
		cleanupCollection(notificationVersions);
		cleanupCollection(executingNotifications);
		cleanupCollection(scheduledAt);
	}

	async function executeNotification(sessionID: string, version: number): Promise<void> {
		if (executingNotifications.has(sessionID)) return;
		if (notificationVersions.get(sessionID) !== version) return;
		if (sessionActivitySinceIdle.has(sessionID)) return;
		if (notifiedSessions.has(sessionID)) return;

		touchSetEntry(executingNotifications, sessionID);

		let didNotify = false;

		try {
			await options.send(sessionID);
			didNotify = true;
			touchSetEntry(notifiedSessions, sessionID);

			if (options.config.playSound && options.config.soundPath) {
				await options.playSound(options.config.soundPath);
			}
		} catch {
			if (didNotify) {
				notifiedSessions.delete(sessionID);
			}
		} finally {
			executingNotifications.delete(sessionID);
			clearPendingTimer(sessionID);
			scheduledAt.delete(sessionID);

			if (sessionActivitySinceIdle.has(sessionID)) {
				notifiedSessions.delete(sessionID);
			}
		}
	}

	function markSessionActivity(sessionID: string): void {
		const lastScheduledAt = scheduledAt.get(sessionID);
		if (
			typeof lastScheduledAt === "number" &&
			Date.now() - lastScheduledAt <= activityGracePeriodMs
		) {
			return;
		}

		clearPendingTimer(sessionID);
		touchSetEntry(sessionActivitySinceIdle, sessionID);
		touchVersion(sessionID);

		if (!executingNotifications.has(sessionID)) {
			notifiedSessions.delete(sessionID);
		}
	}

	function scheduleIdleNotification(sessionID: string): void {
		if (notifiedSessions.has(sessionID)) return;
		if (pendingTimers.has(sessionID)) return;
		if (executingNotifications.has(sessionID)) return;

		sessionActivitySinceIdle.delete(sessionID);
		scheduledAt.delete(sessionID);
		scheduledAt.set(sessionID, Date.now());

		const capturedVersion = touchVersion(sessionID);
		const timer = setTimeout(() => {
			pendingTimers.delete(sessionID);
			void executeNotification(sessionID, capturedVersion);
		}, options.config.idleConfirmationDelay);

		pendingTimers.set(sessionID, timer);
		cleanupOldSessions();
	}

	return {
		markSessionActivity,
		scheduleIdleNotification,
		deleteSession,
	};
}
