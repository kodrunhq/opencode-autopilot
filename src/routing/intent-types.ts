import { z } from "zod";

/**
 * Intent-based routing types and mapping.
 *
 * Classifies user intent (research, implementation, fix, etc.) and maps
 * each intent to a target agent and pipeline decision. Orthogonal to
 * category-based routing in classifier.ts — categories route by task
 * domain, intents route by user goal.
 *
 * Multi-intent is supported as routing metadata: a primary intent drives
 * the immediate routing decision, and an optional secondary intent provides
 * follow-up guidance to the LLM. Secondary intent execution is prompt-driven
 * (the LLM decides when to act on it), not runtime-chained.
 */

export const IntentTypeSchema = z.enum([
	"research",
	"implementation",
	"investigation",
	"evaluation",
	"fix",
	"review",
	"planning",
	"quick",
	"open_ended",
]);
export type IntentType = z.infer<typeof IntentTypeSchema>;

export const IntentClassificationSchema = z.object({
	primaryIntent: IntentTypeSchema,
	secondaryIntent: IntentTypeSchema.optional(),
	reasoning: z.string().min(1),
	verbalization: z.string().min(1),
});
export type IntentClassification = z.infer<typeof IntentClassificationSchema>;

export const IntentRoutingSchema = z.object({
	targetAgent: z.string().min(1),
	usePipeline: z.boolean(),
	behavior: z.string().min(1),
});
export type IntentRouting = z.infer<typeof IntentRoutingSchema>;

const ROUTING_ENTRIES: ReadonlyArray<readonly [IntentType, IntentRouting]> = Object.freeze([
	[
		"research",
		Object.freeze({
			targetAgent: "researcher",
			usePipeline: false,
			behavior: "Answer using research tools. DO NOT start any pipeline or edit code.",
		}),
	],
	[
		"implementation",
		Object.freeze({
			targetAgent: "autopilot",
			usePipeline: true,
			behavior: "Run the full pipeline via oc_orchestrate.",
		}),
	],
	[
		"investigation",
		Object.freeze({
			targetAgent: "researcher",
			usePipeline: false,
			behavior:
				"Explore the codebase or topic and report findings. DO NOT edit code or start a pipeline.",
		}),
	],
	[
		"evaluation",
		Object.freeze({
			targetAgent: "reviewer",
			usePipeline: false,
			behavior:
				"Evaluate the approach or code, propose improvements, then WAIT for user confirmation before acting.",
		}),
	],
	[
		"fix",
		Object.freeze({
			targetAgent: "debugger",
			usePipeline: false,
			behavior:
				"Reproduce, isolate, diagnose, and fix the issue. Write a regression test first. Minimal change — do not refactor.",
		}),
	],
	[
		"review",
		Object.freeze({
			targetAgent: "reviewer",
			usePipeline: false,
			behavior: "Perform the code review directly using oc_review or manual inspection.",
		}),
	],
	[
		"planning",
		Object.freeze({
			targetAgent: "planner",
			usePipeline: false,
			behavior: "Create a plan without implementing it. DO NOT start a build pipeline.",
		}),
	],
	[
		"quick",
		Object.freeze({
			targetAgent: "coder",
			usePipeline: false,
			behavior: "Make the small change directly. No pipeline needed.",
		}),
	],
	[
		"open_ended",
		Object.freeze({
			targetAgent: "autopilot",
			usePipeline: false,
			behavior:
				"Assess the codebase first, then propose an approach to the user. DO NOT start the pipeline until scope is clarified and an implementation verb is given.",
		}),
	],
] as const);

export const INTENT_ROUTING_MAP: ReadonlyMap<IntentType, Readonly<IntentRouting>> = new Map(
	ROUTING_ENTRIES,
);

export function getIntentRouting(intent: IntentType): Readonly<IntentRouting> {
	const routing = INTENT_ROUTING_MAP.get(intent);
	if (!routing) {
		return Object.freeze({
			targetAgent: "autopilot",
			usePipeline: false,
			behavior: "Assess the request and clarify before proceeding.",
		});
	}
	return routing;
}
