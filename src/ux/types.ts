export type ToastVariant = "info" | "success" | "warning" | "error";

export interface ToastOptions {
	readonly title: string;
	readonly message: string;
	readonly variant: ToastVariant;
	readonly duration?: number;
}

export interface NotificationSink {
	showToast(title: string, message: string, variant: string, duration?: number): Promise<void>;
}

export interface ProgressUpdate {
	readonly current: number;
	readonly total: number;
	readonly label: string;
	readonly detail?: string;
}
