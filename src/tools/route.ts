import { tool } from "@opencode-ai/plugin";
import {
	getIntentRouting,
	IntentClassificationSchema,
	type IntentType,
	IntentTypeSchema,
} from "../routing/intent-types";

export function routeCore(args: {
	readonly intent: string;
	readonly reasoning: string;
	readonly verbalization: string;
}): string {
	const parsed = IntentTypeSchema.safeParse(args.intent);
	if (!parsed.success) {
		return JSON.stringify({
			action: "error",
			message: `Invalid intent '${args.intent}'. Valid intents: ${IntentTypeSchema.options.join(", ")}.`,
		});
	}

	const classification = IntentClassificationSchema.safeParse({
		intent: parsed.data,
		reasoning: args.reasoning,
		verbalization: args.verbalization,
	});
	if (!classification.success) {
		const issues = classification.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
		return JSON.stringify({
			action: "error",
			message: `Invalid classification: ${issues.join("; ")}.`,
		});
	}

	const intent: IntentType = classification.data.intent;
	const routing = getIntentRouting(intent);

	return JSON.stringify({
		action: "route",
		intent,
		reasoning: classification.data.reasoning,
		verbalization: classification.data.verbalization,
		targetAgent: routing.targetAgent,
		usePipeline: routing.usePipeline,
		instruction: routing.usePipeline
			? `Proceed with oc_orchestrate — full pipeline via ${routing.targetAgent}.`
			: `Route to ${routing.targetAgent} agent directly — no pipeline needed.`,
	});
}

export const ocRoute = tool({
	description:
		"Classify user intent and return routing instructions. Call this BEFORE oc_orchestrate to determine whether the full pipeline is needed or a specialist agent should handle the request directly.",
	args: {
		intent: IntentTypeSchema.describe(
			"Classified intent type: research, implementation, fix, review, planning, quick, or open_ended",
		),
		reasoning: tool.schema
			.string()
			.min(1)
			.max(2048)
			.describe(
				"Why this intent was chosen — what signals in the user message led to this classification",
			),
		verbalization: tool.schema
			.string()
			.min(1)
			.max(1024)
			.describe(
				"Human-readable intent statement, e.g. 'I detect research intent — user asked how X works'",
			),
	},
	execute(args) {
		return Promise.resolve(
			routeCore({
				intent: args.intent,
				reasoning: args.reasoning,
				verbalization: args.verbalization,
			}),
		);
	},
});
