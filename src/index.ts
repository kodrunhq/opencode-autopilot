import type { Config, Plugin } from "@opencode-ai/plugin";
import { configHook } from "./agents";
import { isFirstLoad, loadConfig } from "./config";
import { runHealthChecks } from "./health/runner";
import { createAntiSlopHandler } from "./hooks/anti-slop";
import { installAssets } from "./installer";
import {
	createMemoryCaptureHandler,
	createMemoryChatMessageHandler,
	createMemoryInjector,
	getMemoryDb,
} from "./memory";
import { ContextMonitor } from "./observability/context-monitor";
import {
	createObservabilityEventHandler,
	createToolExecuteAfterHandler as createObsToolAfterHandler,
	createToolExecuteBeforeHandler,
} from "./observability/event-handlers";
import { SessionEventStore } from "./observability/event-store";
import { createForensicEvent } from "./observability/forensic-log";
import { writeSessionLog } from "./observability/log-writer";
import { pruneOldLogs } from "./observability/retention";
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
import {
	ocConfigure,
	setAvailableProviders,
	setOpenCodeConfig,
	setProviderDiscoveryPromise,
} from "./tools/configure";
import { ocCreateAgent } from "./tools/create-agent";
import { ocCreateCommand } from "./tools/create-command";
import { ocCreateSkill } from "./tools/create-skill";
import { ocDoctor, setOpenCodeConfig as setDoctorOpenCodeConfig } from "./tools/doctor";
import { ocForensics } from "./tools/forensics";
import { ocHashlineEdit } from "./tools/hashline-edit";
import { ocLogs } from "./tools/logs";
import { ocMemoryPreferences } from "./tools/memory-preferences";
import { ocMemoryStatus } from "./tools/memory-status";
import { ocMockFallback } from "./tools/mock-fallback";
import { ocOrchestrate } from "./tools/orchestrate";
import { ocPhase } from "./tools/phase";
import { ocPipelineReport } from "./tools/pipeline-report";
import { ocPlan } from "./tools/plan";
import { ocQuick } from "./tools/quick";
import { ocReview } from "./tools/review";
import { ocSessionStats } from "./tools/session-stats";
import { ocState } from "./tools/state";
import { ocStocktake } from "./tools/stocktake";
import { ocUpdateDocs } from "./tools/update-docs";

let openCodeConfig: Config | null = null;

const plugin: Plugin = async (input) => {
	const client = input.client;

	// Self-healing asset installation on every load
	const installResult = await installAssets();
	if (installResult.errors.length > 0) {
		console.error("[opencode-autopilot] Asset installation errors:", installResult.errors);
	}

	// Discover available providers/models in the background (non-blocking).
	// The promise is stored so oc_configure "start" can await it (with timeout).
	try {
		const discoveryPromise = client.provider
			.list({ query: { directory: process.cwd() } })
			.then((providerResponse) => {
				const providerData = providerResponse.data;
				if (providerData?.all) {
					setAvailableProviders(providerData.all);
				}
			})
			.catch(() => {
				// Provider discovery is best-effort; configure will show empty models
			});
		setProviderDiscoveryPromise(discoveryPromise);
	} catch {
		// Guard against synchronous failures (e.g. client.provider undefined)
	}

	// Load config for first-load detection and fallback settings
	const config = await loadConfig();
	const fallbackConfig = config?.fallback ?? fallbackDefaults;

	// Self-healing health checks on every load (non-blocking, <100ms target)
	runHealthChecks().catch(() => {
		// Health check failures are non-fatal — oc_doctor provides manual diagnostics
	});

	// --- Observability subsystem initialization ---
	const eventStore = new SessionEventStore();
	const contextMonitor = new ContextMonitor();

	// Retention pruning on load (non-blocking per D-14)
	pruneOldLogs().catch((err) => {
		console.error("[opencode-autopilot]", err);
	});

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
			// Per-agent fallback_models are populated by configHook from group/override config.
			// resolveChain reads config.agent[agentName].fallback_models (tier 1).
			return resolveChain(agentName ?? "", agentConfigs, undefined);
		},
	});

	const fallbackEventHandler = createEventHandler({
		manager,
		sdk: sdkOps,
		config: fallbackConfig,
		onFallbackEvent: (event) => {
			if (event.type === "fallback") {
				eventStore.appendEvent(event.sessionId, {
					type: "fallback",
					timestamp: new Date().toISOString(),
					sessionId: event.sessionId,
					failedModel: event.failedModel ?? "unknown",
					nextModel: event.nextModel ?? "unknown",
					reason: event.reason ?? "fallback",
					success: event.success === true,
				});
				return;
			}

			eventStore.appendEvent(event.sessionId, {
				type: "model_switch",
				timestamp: new Date().toISOString(),
				sessionId: event.sessionId,
				fromModel: event.fromModel ?? "unknown",
				toModel: event.toModel ?? "unknown",
				trigger: event.trigger ?? "fallback",
			});
		},
	});
	const chatMessageHandler = createChatMessageHandler(manager);
	const toolExecuteAfterHandler = createToolExecuteAfterHandler(manager);

	// --- Anti-slop hook initialization ---
	const antiSlopHandler = createAntiSlopHandler({ showToast: sdkOps.showToast });

	// --- Memory subsystem initialization ---
	const memoryConfig = config?.memory ?? {
		enabled: true,
		injectionBudget: 2000,
		decayHalfLifeDays: 90,
	};

	const memoryCaptureHandler = memoryConfig.enabled
		? createMemoryCaptureHandler({ getDb: () => getMemoryDb(), projectRoot: process.cwd() })
		: null;
	const memoryChatMessageHandler = memoryConfig.enabled
		? createMemoryChatMessageHandler({ getDb: () => getMemoryDb(), projectRoot: process.cwd() })
		: null;

	const memoryInjector = memoryConfig.enabled
		? createMemoryInjector({
				projectRoot: process.cwd(),
				tokenBudget: memoryConfig.injectionBudget,
				halfLifeDays: memoryConfig.decayHalfLifeDays,
				getDb: () => getMemoryDb(),
			})
		: null;

	// --- Observability handlers ---
	const toolStartTimes = new Map<string, number>();
	const observabilityEventHandler = createObservabilityEventHandler({
		eventStore,
		contextMonitor,
		showToast: sdkOps.showToast,
		writeSessionLog: async (sessionData) => {
			if (!sessionData) return;
			await writeSessionLog({
				projectRoot: process.cwd(),
				sessionId: sessionData.sessionId,
				startedAt: sessionData.startedAt,
				events: sessionData.events.map((event) =>
					createForensicEvent({
						projectRoot: process.cwd(),
						domain: "session",
						timestamp: event.timestamp,
						sessionId: event.sessionId,
						type: event.type,
						message: event.type === "error" ? event.message : null,
						code:
							event.type === "error"
								? event.errorType
								: event.type === "fallback"
									? "FALLBACK"
									: null,
						payload:
							event.type === "error"
								? {
										model: event.model,
										errorType: event.errorType,
										...(event.statusCode !== undefined ? { statusCode: event.statusCode } : {}),
									}
								: event.type === "fallback"
									? {
											failedModel: event.failedModel,
											nextModel: event.nextModel,
											reason: event.reason,
											success: event.success,
										}
									: event.type === "decision"
										? {
												decision: event.decision,
												rationale: event.rationale,
											}
										: event.type === "model_switch"
											? {
													fromModel: event.fromModel,
													toModel: event.toModel,
													trigger: event.trigger,
												}
											: event.type === "context_warning"
												? {
														utilization: event.utilization,
														contextLimit: event.contextLimit,
														inputTokens: event.inputTokens,
													}
												: event.type === "tool_complete"
													? {
															tool: event.tool,
															durationMs: event.durationMs,
															success: event.success,
														}
													: event.type === "phase_transition"
														? {
																fromPhase: event.fromPhase,
																toPhase: event.toPhase,
															}
														: event.type === "compacted"
															? {
																	trigger: event.trigger,
																}
															: {},
					}),
				),
			});
		},
	});
	const obsToolBeforeHandler = createToolExecuteBeforeHandler(toolStartTimes);
	const obsToolAfterHandler = createObsToolAfterHandler(eventStore, toolStartTimes);

	return {
		tool: {
			oc_configure: ocConfigure,
			oc_create_agent: ocCreateAgent,
			oc_create_skill: ocCreateSkill,
			oc_create_command: ocCreateCommand,
			oc_state: ocState,
			oc_confidence: ocConfidence,
			oc_phase: ocPhase,
			oc_plan: ocPlan,
			oc_orchestrate: ocOrchestrate,
			oc_doctor: ocDoctor,
			oc_quick: ocQuick,
			oc_forensics: ocForensics,
			oc_hashline_edit: ocHashlineEdit,
			oc_review: ocReview,
			oc_logs: ocLogs,
			oc_session_stats: ocSessionStats,
			oc_pipeline_report: ocPipelineReport,
			oc_mock_fallback: ocMockFallback,
			oc_stocktake: ocStocktake,
			oc_update_docs: ocUpdateDocs,
			oc_memory_status: ocMemoryStatus,
			oc_memory_preferences: ocMemoryPreferences,
		},
		event: async ({ event }) => {
			// 1. Observability: collect (pure observer, no side effects on session)
			await observabilityEventHandler({ event });

			// 2. Memory capture (pure observer, best-effort)
			if (memoryCaptureHandler) {
				try {
					await memoryCaptureHandler({ event });
				} catch {
					/* best-effort */
				}
			}

			// 3. First-load toast
			if (event.type === "session.created" && isFirstLoad(config)) {
				await sdkOps.showToast(
					"Welcome to OpenCode Autopilot!",
					"Plugin loaded. Run oc_doctor to verify your setup.",
					"info",
				);
			}

			// 4. Fallback event handling
			if (fallbackConfig.enabled) {
				await fallbackEventHandler({ event });
			}
		},
		config: async (cfg: Config) => {
			openCodeConfig = cfg;
			setOpenCodeConfig(cfg);
			setDoctorOpenCodeConfig(cfg);
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
			if (memoryChatMessageHandler) {
				await memoryChatMessageHandler(hookInput, output);
			}

			if (fallbackConfig.enabled) {
				await chatMessageHandler(hookInput, output);
			}
		},
		"tool.execute.before": async (
			input: { tool: string; sessionID: string; callID: string },
			output: { args: unknown },
		) => {
			obsToolBeforeHandler({ ...input, args: output.args });
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
			// Observability: record tool execution (pure observer)
			obsToolAfterHandler(hookInput, output);

			// Fallback handling
			if (fallbackConfig.enabled) {
				await toolExecuteAfterHandler(hookInput, output);
			}

			// Anti-slop comment detection (best-effort, non-blocking)
			try {
				await antiSlopHandler(hookInput, output);
			} catch {
				// best-effort
			}
		},
		"experimental.chat.system.transform": async (input, output) => {
			if (memoryInjector) {
				await memoryInjector(input, output);
			}
		},
	};
};

export default plugin;
