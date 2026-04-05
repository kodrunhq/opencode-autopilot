import type { TaskStatus } from "../types/background";

const VALID_TRANSITIONS: Readonly<Record<TaskStatus, readonly TaskStatus[]>> = Object.freeze({
	pending: Object.freeze<TaskStatus[]>(["running", "cancelled"]),
	running: Object.freeze<TaskStatus[]>(["completed", "failed", "cancelled"]),
	completed: Object.freeze<TaskStatus[]>([]),
	failed: Object.freeze<TaskStatus[]>([]),
	cancelled: Object.freeze<TaskStatus[]>([]),
});

export function validateTransition(from: TaskStatus, to: TaskStatus): boolean {
	return VALID_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: TaskStatus, to: TaskStatus): void {
	if (!validateTransition(from, to)) {
		throw new Error(`Invalid background task transition from '${from}' to '${to}'`);
	}
}
