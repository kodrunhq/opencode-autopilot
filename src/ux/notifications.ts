import { getLogger } from "../logging/domains";
import type { NotificationSink, ToastOptions, ToastVariant } from "./types";

const DEFAULT_RATE_LIMIT_MS = 5_000;

const logger = getLogger("ux", "notifications");

export interface NotificationManagerOptions {
	readonly sink?: NotificationSink;
	readonly rateLimitMs?: number;
}

export class NotificationManager {
	private readonly sink?: NotificationSink;
	private readonly rateLimitMs: number;
	private readonly lastToastAtByVariant = new Map<ToastVariant, number>();

	constructor(options: NotificationManagerOptions = {}) {
		this.sink = options.sink;
		this.rateLimitMs = options.rateLimitMs ?? DEFAULT_RATE_LIMIT_MS;
	}

	async notify(options: ToastOptions): Promise<void> {
		try {
			if (!this.sink) {
				return;
			}

			const now = Date.now();
			const lastToastAt = this.lastToastAtByVariant.get(options.variant) ?? 0;

			if (now - lastToastAt < this.rateLimitMs) {
				logger.debug("Skipped rate-limited toast", {
					variant: options.variant,
					title: options.title,
					rateLimitMs: this.rateLimitMs,
				});
				return;
			}

			await this.sink.showToast(options.title, options.message, options.variant, options.duration);
			this.lastToastAtByVariant.set(options.variant, now);
		} catch (error: unknown) {
			logger.debug("Toast delivery failed", {
				variant: options.variant,
				title: options.title,
				error: String(error),
			});
		}
	}

	info(title: string, message: string, duration?: number): Promise<void> {
		return this.notify({ title, message, variant: "info", duration });
	}

	success(title: string, message: string, duration?: number): Promise<void> {
		return this.notify({ title, message, variant: "success", duration });
	}

	warn(title: string, message: string, duration?: number): Promise<void> {
		return this.notify({ title, message, variant: "warning", duration });
	}

	error(title: string, message: string, duration?: number): Promise<void> {
		return this.notify({ title, message, variant: "error", duration });
	}
}
