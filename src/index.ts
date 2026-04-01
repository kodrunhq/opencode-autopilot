import type { Config, Plugin } from "@opencode-ai/plugin";
import { configHook } from "./agents";
import { isFirstLoad, loadConfig } from "./config";
import { installAssets } from "./installer";
import type { SdkOperations } from "./orchestrator/fallback";
import {
	createChatMessageHandler,
	createEventHandler,
	createToolExecuteAfterHandler,
	FallbackManager,
} from "./orchestrator/fallback";
import { fallbackDefaults } from "./orchestrator/fallback/fallback-config";
import { resolveChain } from "./orchestrator/fallback/resolve-chain";
import { ocConfidence } from "./tools/confidence";
import { ocCreateAgent } from "./tools/create-agent";
import { ocCreateCommand } from "./tools/create-command";
import { ocCreateSkill } from "./tools/create-skill";
import { ocForensics } from "./tools/forensics";
import { ocOrchestrate } from "./tools/orchestrate";
import { ocPhase } from "./tools/phase";
import { ocPlaceholder } from "./tools/placeholder";
import { ocPlan } from "./tools/plan";
import { ocReview } from "./tools/review";
import { ocState } from "./tools/state";

let openCodeConfig: Config | null = null;

const plugin: Plugin = async (input) => {
	const client = input.client;

	// Self-healing asset installation on every load
	const installResult = await installAssets();
	if (installResult.errors.length > 0) {
		console.error("[opencode-autopilot] Asset installation errors:", installResult.errors);
	}

	// Load config for first-load detection and fallback settings
	const config = await loadConfig();
	const fallbackConfig = config?.fallback ?? fallbackDefaults;

	// --- Fallback subsystem initialization ---
	const sdkOps: SdkOperations = {
		abortSession: async (sessionID) => {
			await client.session.abort({ path: { id: sessionID } });
		},
		getSessionMessages: async (sessionID) => {
			const response = await client.session.messages({
				path: { id: sessionID },
				query: { directory: process.cwd() },
			});
			// Extract parts from the last non-assistant message for replay
			const messages = (response.data ?? []) as ReadonlyArray<{
				role?: string;
				parts?: readonly import("./orchestrator/fallback").MessagePart[];
			}>;
			const lastUserMsg = [...messages].reverse().find((m) => m.role !== "assistant");
			return lastUserMsg?.parts ?? [];
		},
		promptAsync: async (sessionID, model, parts) => {
			await client.session.promptAsync({
				path: { id: sessionID },
				// biome-ignore lint/suspicious/noExplicitAny: MessagePart is a superset of SDK part types
				body: { model, parts: parts as any },
				query: { directory: process.cwd() },
			});
		},
		showToast: async (title, message, variant) => {
			await client.tui.showToast({
				body: { title, message, variant, duration: 5000 },
			});
		},
	};

	const manager = new FallbackManager({
		config: fallbackConfig,
		resolveFallbackChain: (_sessionID, agentName) => {
			const agentConfigs = openCodeConfig?.agent as
				| Record<string, Record<string, unknown>>
				| undefined;
			return resolveChain(agentName ?? "", agentConfigs, config?.fallback_models);
		},
	});

	const fallbackEventHandler = createEventHandler({
		manager,
		sdk: sdkOps,
		config: fallbackConfig,
	});
	const chatMessageHandler = createChatMessageHandler(manager);
	const toolExecuteAfterHandler = createToolExecuteAfterHandler(manager);

	return {
		tool: {
			oc_placeholder: ocPlaceholder,
			oc_create_agent: ocCreateAgent,
			oc_create_skill: ocCreateSkill,
			oc_create_command: ocCreateCommand,
			oc_state: ocState,
			oc_confidence: ocConfidence,
			oc_phase: ocPhase,
			oc_plan: ocPlan,
			oc_orchestrate: ocOrchestrate,
			oc_forensics: ocForensics,
			oc_review: ocReview,
		},
		event: async ({ event }) => {
			if (event.type === "session.created" && isFirstLoad(config)) {
				// First load: config wizard will be triggered via /configure command
				// Phase 2 will add the oc_configure tool
			}

			// Fallback event handling (runs for all events)
			if (fallbackConfig.enabled) {
				await fallbackEventHandler({ event });
			}
		},
		config: async (cfg: Config) => {
			openCodeConfig = cfg;
			await configHook(cfg);
		},
		"chat.message": async (
			hookInput: {
				readonly sessionID: string;
				readonly agent?: string;
				readonly model?: { readonly providerID: string; readonly modelID: string };
			},
			output: {
				message: { model?: { providerID: string; modelID: string } };
				parts: unknown[];
			},
		) => {
			if (fallbackConfig.enabled) {
				await chatMessageHandler(hookInput, output);
			}
		},
		"tool.execute.after": async (
			hookInput: {
				readonly tool: string;
				readonly sessionID: string;
				readonly callID: string;
				readonly args: unknown;
			},
			output: { title: string; output: string; metadata: unknown },
		) => {
			if (fallbackConfig.enabled) {
				await toolExecuteAfterHandler(hookInput, output);
			}
		},
	};
};

export default plugin;
