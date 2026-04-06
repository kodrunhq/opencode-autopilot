export type TaskToastStatus = "running" | "queued" | "completed" | "error";

export interface ModelFallbackInfo {
	readonly model: string;
	readonly type:
		| "user-defined"
		| "inherited"
		| "category-default"
		| "system-default"
		| "runtime-fallback";
}

export interface TrackedTask {
	readonly id: string;
	readonly sessionId?: string;
	readonly description: string;
	readonly agent: string;
	readonly isBackground: boolean;
	readonly category?: string;
	readonly skills?: readonly string[];
	readonly modelInfo?: ModelFallbackInfo;
	status: TaskToastStatus;
	startedAt: Date;
}
