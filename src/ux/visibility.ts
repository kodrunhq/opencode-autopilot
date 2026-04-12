import { z } from "zod";
import type { VisibilityMode } from "../config";
import { appendForensicEventForArtifactDir } from "../observability/forensic-log";

export const visibilityEventTypeSchema = z.enum([
	"phase_started",
	"phase_completed",
	"tranche_started",
	"tranche_completed",
	"task_started",
	"task_completed",
	"review_started",
	"review_blocked",
	"oracle_passed",
	"oracle_failed",
	"verification_passed",
	"ship_created",
	"program_completed",
]);

export type VisibilityEventType = z.infer<typeof visibilityEventTypeSchema>;

const visibilityMetadataValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

type VisibilityMetadataValue = z.infer<typeof visibilityMetadataValueSchema>;

export const visibilityEventSchema = z.object({
	schemaVersion: z.literal(1),
	type: visibilityEventTypeSchema,
	timestamp: z.string().max(128),
	runId: z.string().max(256).nullable(),
	phase: z.string().max(128).nullable(),
	trancheId: z.string().max(128).nullable(),
	trancheIndex: z.number().int().positive().nullable(),
	trancheCount: z.number().int().positive().nullable(),
	taskId: z.union([z.number().int(), z.string().max(128)]).nullable(),
	agent: z.string().max(128).nullable(),
	summary: z.string().max(4096),
	metadata: z.record(z.string(), visibilityMetadataValueSchema),
});

export type VisibilityEvent = z.infer<typeof visibilityEventSchema>;

export interface VisibilityEventInput {
	readonly type: VisibilityEventType;
	readonly timestamp?: string;
	readonly runId?: string | null;
	readonly phase?: string | null;
	readonly trancheId?: string | null;
	readonly trancheIndex?: number | null;
	readonly trancheCount?: number | null;
	readonly taskId?: number | string | null;
	readonly agent?: string | null;
	readonly summary?: string;
	readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface VisibilityBus {
	publish(input: VisibilityEventInput): VisibilityEvent;
	getEvents(): readonly VisibilityEvent[];
	renderOperatorText(fallbackText?: string): string;
}

function collapseBlankLines(text: string): string {
	return text.replace(/\n{3,}/gu, "\n\n");
}

function collapseWhitespace(text: string): string {
	return text.replace(/\s+/gu, " ").trim();
}

export function stripInternalReasoning(text: string): string {
	if (text.trim().length === 0) {
		return "";
	}

	const filteredLines = text
		.split(/\r?\n/u)
		.filter((line) => {
			const trimmed = line.trim();
			if (trimmed.length === 0) {
				return true;
			}

			if (/^_?(thinking|reasoning)\s*:/iu.test(trimmed)) {
				return false;
			}

			if (/^<\/?(thinking|reasoning)>/iu.test(trimmed)) {
				return false;
			}

			return true;
		})
		.join("\n");

	return collapseBlankLines(filteredLines).trim();
}

export function sanitizeChatMessageParts(parts: unknown[]): void {
	if (!Array.isArray(parts)) {
		return;
	}

	const sanitizedParts: unknown[] = [];
	for (const part of parts) {
		if (part === null || typeof part !== "object") {
			sanitizedParts.push(part);
			continue;
		}

		const record = part as Record<string, unknown>;
		if (record.type !== "text" || typeof record.text !== "string") {
			sanitizedParts.push(part);
			continue;
		}

		const sanitizedText = stripInternalReasoning(record.text);
		if (sanitizedText.length === 0) {
			continue;
		}

		record.text = sanitizedText;
		sanitizedParts.push(part);
	}

	parts.splice(0, parts.length, ...sanitizedParts);
}

function normalizeMetadata(
	metadata: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, VisibilityMetadataValue>> {
	if (!metadata) {
		return Object.freeze({});
	}

	const normalizedEntries = Object.entries(metadata)
		.filter(
			([, value]) =>
				value === null ||
				typeof value === "string" ||
				typeof value === "number" ||
				typeof value === "boolean",
		)
		.map(([key, value]) => [key, value as VisibilityMetadataValue]);

	return Object.freeze(Object.fromEntries(normalizedEntries));
}

function formatVisibilitySummary(input: VisibilityEventInput): string {
	switch (input.type) {
		case "phase_started":
			return `Phase started — ${input.phase ?? "unknown phase"}`;
		case "phase_completed":
			return `Phase completed — ${input.phase ?? "unknown phase"}`;
		case "tranche_started": {
			const trancheLabel =
				input.trancheIndex !== null &&
				input.trancheIndex !== undefined &&
				input.trancheCount !== null &&
				input.trancheCount !== undefined
					? `Tranche ${input.trancheIndex}/${input.trancheCount}`
					: "Tranche";
			const title = typeof input.metadata?.title === "string" ? input.metadata.title : null;
			return title ? `${trancheLabel} started — ${title}` : `${trancheLabel} started`;
		}
		case "tranche_completed": {
			const trancheLabel =
				input.trancheIndex !== null &&
				input.trancheIndex !== undefined &&
				input.trancheCount !== null &&
				input.trancheCount !== undefined
					? `Tranche ${input.trancheIndex}/${input.trancheCount}`
					: "Tranche";
			return `${trancheLabel} completed`;
		}
		case "task_started":
			return `Task ${String(input.taskId ?? "?")} started`;
		case "task_completed":
			return `Task ${String(input.taskId ?? "?")} completed`;
		case "review_started":
			return "Review started";
		case "review_blocked":
			return "Review blocked shipment";
		case "oracle_passed":
			return "Oracle signoff passed";
		case "oracle_failed":
			return "Oracle signoff failed";
		case "verification_passed":
			return "Verification passed";
		case "ship_created":
			return "Ship created";
		case "program_completed":
			return "Program completed";
	}
}

function createVisibilityEvent(input: VisibilityEventInput): VisibilityEvent {
	return Object.freeze(
		visibilityEventSchema.parse({
			schemaVersion: 1,
			type: input.type,
			timestamp: input.timestamp ?? new Date().toISOString(),
			runId: input.runId ?? null,
			phase: input.phase ?? null,
			trancheId: input.trancheId ?? null,
			trancheIndex: input.trancheIndex ?? null,
			trancheCount: input.trancheCount ?? null,
			taskId: input.taskId ?? null,
			agent: input.agent ?? null,
			summary: stripInternalReasoning(input.summary ?? formatVisibilitySummary(input)),
			metadata: normalizeMetadata(input.metadata),
		}),
	);
}

function getForensicType(
	event: VisibilityEvent,
): "dispatch" | "result_applied" | "phase_transition" | "complete" | "warning" {
	switch (event.type) {
		case "phase_started":
		case "phase_completed":
			return "phase_transition";
		case "task_started":
		case "review_started":
			return "dispatch";
		case "task_completed":
			return "result_applied";
		case "review_blocked":
		case "oracle_failed":
			return "warning";
		case "tranche_started":
		case "tranche_completed":
		case "oracle_passed":
		case "verification_passed":
		case "ship_created":
		case "program_completed":
			return "complete";
	}
}

function getForensicAgent(event: VisibilityEvent): string | null {
	if (event.taskId !== null) {
		return `task:${String(event.taskId)}`;
	}

	if (event.trancheId !== null) {
		return `${event.type}:${event.trancheId}`;
	}

	return event.agent;
}

export function buildOperatorTextFromEvents(
	events: readonly VisibilityEvent[],
	fallbackText?: string,
): string {
	const summaries = events
		.map((event) => stripInternalReasoning(event.summary))
		.filter((summary) => summary.length > 0);

	if (summaries.length > 0) {
		return summaries.join("\n");
	}

	return stripInternalReasoning(fallbackText ?? "");
}

export function createVisibilityBus(options: { readonly artifactDir: string }): VisibilityBus {
	const events: VisibilityEvent[] = [];

	return {
		publish(input) {
			const event = createVisibilityEvent(input);
			events.push(event);

			appendForensicEventForArtifactDir(options.artifactDir, {
				timestamp: event.timestamp,
				domain: "orchestrator",
				runId: event.runId,
				phase: event.phase,
				taskId: event.taskId,
				agent: getForensicAgent(event),
				type: getForensicType(event),
				message: event.summary,
				payload: {
					visibilityType: event.type,
					visibilityEvent: {
						...event,
						metadata: event.metadata,
					},
				},
			});

			return event;
		},
		getEvents() {
			return Object.freeze([...events]);
		},
		renderOperatorText(fallbackText) {
			return buildOperatorTextFromEvents(events, fallbackText);
		},
	};
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function readString(value: unknown): string | null {
	return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readVisibilityEvents(
	payload: Readonly<Record<string, unknown>>,
): readonly VisibilityEvent[] {
	const visibility = asRecord(payload.visibility);
	const rawEvents = visibility?.events;
	if (!Array.isArray(rawEvents)) {
		return [];
	}

	return Object.freeze(
		rawEvents
			.map((rawEvent) => {
				const event = asRecord(rawEvent);
				if (!event) {
					return null;
				}

				const type = readString(event.type) as VisibilityEventType | null;
				const summary = readString(event.summary);
				if (!type || !summary) {
					return null;
				}

				return createVisibilityEvent({
					type,
					timestamp: readString(event.timestamp) ?? undefined,
					runId: readString(event.runId),
					phase: readString(event.phase),
					trancheId: readString(event.trancheId),
					trancheIndex: typeof event.trancheIndex === "number" ? event.trancheIndex : null,
					trancheCount: typeof event.trancheCount === "number" ? event.trancheCount : null,
					taskId:
						typeof event.taskId === "number" || typeof event.taskId === "string"
							? event.taskId
							: null,
					agent: readString(event.agent),
					summary,
					metadata: asRecord(event.metadata) ?? undefined,
				});
			})
			.filter((event): event is VisibilityEvent => event !== null),
	);
}

export function buildOrchestrateDisplayText(
	payload: Readonly<Record<string, unknown>>,
	visibilityEvents?: readonly VisibilityEvent[],
): string {
	const eventText = buildOperatorTextFromEvents(visibilityEvents ?? readVisibilityEvents(payload));
	if (eventText.length > 0) {
		return eventText;
	}

	const explicitDisplayText = readString(payload.displayText);
	if (explicitDisplayText) {
		return stripInternalReasoning(explicitDisplayText);
	}

	const progress = readString(payload._userProgress) ?? readString(payload.progress);
	if (progress) {
		return stripInternalReasoning(progress);
	}

	const action = readString(payload.action);
	if (action === "complete") {
		return stripInternalReasoning(readString(payload.summary) ?? "Pipeline completed.");
	}

	if (action === "error") {
		return stripInternalReasoning(readString(payload.message) ?? "Pipeline error.");
	}

	if (action === "abandoned") {
		return stripInternalReasoning(readString(payload.displayText) ?? "Pipeline abandoned.");
	}

	if (action === "dispatch" || action === "dispatch_multi") {
		const phase = readString(payload.phase) ?? "pipeline";
		return `Dispatching ${phase}.`;
	}

	return "";
}

export function decorateOrchestrateResponse(
	payload: Readonly<Record<string, unknown>>,
	visibilityBus?: VisibilityBus,
): string {
	const visibilityEvents = visibilityBus?.getEvents() ?? [];
	const displayText = buildOrchestrateDisplayText(payload, visibilityEvents);

	return JSON.stringify({
		...payload,
		...(displayText.length > 0 ? { displayText } : {}),
		...(visibilityEvents.length > 0 ? { visibility: { events: visibilityEvents } } : {}),
	});
}

function safeParseObject(output: string): Record<string, unknown> | null {
	try {
		const parsed = JSON.parse(output);
		return asRecord(parsed);
	} catch {
		return null;
	}
}

export function projectToolOutputForSummary(toolName: string, output: string): string | null {
	const parsed = safeParseObject(output);
	if (!parsed) {
		const sanitized = stripInternalReasoning(output);
		return sanitized === output ? null : sanitized;
	}

	const explicitDisplayText = readString(parsed.displayText);
	if (explicitDisplayText) {
		return stripInternalReasoning(explicitDisplayText);
	}

	if (toolName === "oc_orchestrate") {
		const projected = buildOrchestrateDisplayText(parsed);
		return projected.length > 0 ? projected : null;
	}

	return null;
}

export function createToolVisibilityProjectionHandler(options: {
	readonly visibilityMode: VisibilityMode;
}) {
	return (
		hookInput: {
			readonly tool: string;
			readonly sessionID: string;
			readonly callID: string;
			readonly args: unknown;
		},
		output: { title: string; output: string; metadata: unknown },
	): void => {
		if (options.visibilityMode === "debug") {
			return;
		}

		const projectedOutput = projectToolOutputForSummary(hookInput.tool, output.output);
		if (projectedOutput !== null) {
			output.output = projectedOutput;
			return;
		}

		output.output = stripInternalReasoning(output.output);
	};
}

export function summarizeBackgroundDescription(description: string, maxLength = 120): string {
	const sanitized = collapseWhitespace(stripInternalReasoning(description));
	if (sanitized.length <= maxLength) {
		return sanitized;
	}

	return `${sanitized.slice(0, maxLength - 1).trimEnd()}…`;
}
