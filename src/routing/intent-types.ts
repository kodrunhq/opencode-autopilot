import { z } from "zod";

/**
 * Intent-based routing types and mapping.
 *
 * Classifies user intent (research, implementation, fix, etc.) and maps
 * each intent to a target agent and pipeline decision. Orthogonal to
 * category-based routing in classifier.ts — categories route by task
 * domain, intents route by user goal.
 */

export const IntentTypeSchema = z.enum([
	"research",
	"implementation",
	"fix",
	"review",
	"planning",
	"quick",
	"open_ended",
]);
export type IntentType = z.infer<typeof IntentTypeSchema>;

export const IntentClassificationSchema = z.object({
	intent: IntentTypeSchema,
	reasoning: z.string().min(1),
	verbalization: z.string().min(1),
});
export type IntentClassification = z.infer<typeof IntentClassificationSchema>;

export const IntentRoutingSchema = z.object({
	targetAgent: z.string().min(1),
	usePipeline: z.boolean(),
});
export type IntentRouting = z.infer<typeof IntentRoutingSchema>;

const ROUTING_ENTRIES: ReadonlyArray<readonly [IntentType, IntentRouting]> = Object.freeze([
	["research", Object.freeze({ targetAgent: "researcher", usePipeline: false })],
	["implementation", Object.freeze({ targetAgent: "autopilot", usePipeline: true })],
	["fix", Object.freeze({ targetAgent: "debugger", usePipeline: false })],
	["review", Object.freeze({ targetAgent: "reviewer", usePipeline: false })],
	["planning", Object.freeze({ targetAgent: "planner", usePipeline: false })],
	["quick", Object.freeze({ targetAgent: "coder", usePipeline: false })],
	["open_ended", Object.freeze({ targetAgent: "autopilot", usePipeline: true })],
] as const);

export const INTENT_ROUTING_MAP: ReadonlyMap<IntentType, Readonly<IntentRouting>> = new Map(
	ROUTING_ENTRIES,
);

export function getIntentRouting(intent: IntentType): Readonly<IntentRouting> {
	const routing = INTENT_ROUTING_MAP.get(intent);
	if (!routing) {
		return Object.freeze({ targetAgent: "autopilot", usePipeline: true });
	}
	return routing;
}
