import type { Config, Plugin } from "@opencode-ai/plugin";
import { configHook } from "./agents";
import { getLoopController } from "./autonomy";
import { createLoopInjector } from "./autonomy/injector";
import { isFirstLoad, loadConfig } from "./config";
import { createCompactionHandler, createContextInjector } from "./context";
import { runHealthChecks } from "./health/runner";
import { createAntiSlopHandler } from "./hooks/anti-slop";
import { createKeywordDetectorHandler } from "./hooks/keyword-detector";
import { createPreemptiveCompactionHandler } from "./hooks/preemptive-compaction";
import { createSessionRecoveryHandler } from "./hooks/session-recovery";
import { createToolOutputTruncatorHandler } from "./hooks/tool-output-truncator";
import { installAssets } from "./installer";
import { openKernelDb } from "./kernel/database";
import { getLogger, initLoggers } from "./logging/domains";
import {
	ocLspDiagnostics,
	ocLspFindReferences,
	ocLspGotoDefinition,
	ocLspPrepareRename,
	ocLspRename,
	ocLspSymbols,
} from "./lsp/tools";
import { McpLifecycleManager, setGlobalMcpManager } from "./mcp";
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
import {
	createRecoveryEventHandler,
	createRecoveryOrchestratorWithDb,
	getDefaultRecoveryOrchestrator,
} from "./recovery/index";
import { ocBackground, setBackgroundSdkOperations } from "./tools/background";
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
import { ocDelegate, setDelegateSdkOperations } from "./tools/delegate";
import { ocDoctor, setOpenCodeConfig as setDoctorOpenCodeConfig } from "./tools/doctor";
import { ocForensics } from "./tools/forensics";
import { ocHashlineEdit } from "./tools/hashline-edit";
import { ocLogs } from "./tools/logs";
import { ocLoop } from "./tools/loop";
import { ocMemoryPreferences } from "./tools/memory-preferences";
import { ocMemoryStatus } from "./tools/memory-status";
import { ocMockFallback } from "./tools/mock-fallback";
import { ocOrchestrate } from "./tools/orchestrate";
import { ocPhase } from "./tools/phase";
import { ocPipelineReport } from "./tools/pipeline-report";
import { ocPlan } from "./tools/plan";
import { ocQuick } from "./tools/quick";
import { ocRecover } from "./tools/recover";
import { ocReview } from "./tools/review";
import { ocSessionStats } from "./tools/session-stats";
import { ocState } from "./tools/state";
import { ocStocktake } from "./tools/stocktake";
import { ocSummary } from "./tools/summary";
import { ocUpdateDocs } from "./tools/update-docs";
import { ContextWarningMonitor } from "./ux/context-warnings";
import { getRemediationHint } from "./ux/error-hints";
import { NotificationManager } from "./ux/notifications";
import { ProgressTracker } from "./ux/progress";
import {
	registerNotificationManager,
	registerProgressTracker,
	registerTaskToastManager,
} from "./ux/registry";
import { TaskToastManager } from "./ux/task-toast-manager";

let openCodeConfig: Config | null = null;

let processHandlersRegistered = false;
function registerProcessHandlers() {
	if (processHandlersRegistered) return;
	processHandlersRegistered = true;
	process.on("uncaughtException", (error) => {
		getLogger("system").error("Uncaught exception", {
			error: error instanceof Error ? error.stack : String(error),
		});
	});
	process.on("unhandledRejection", (reason) => {
		getLogger("system").error("Unhandled rejection", {
			reason: reason instanceof Error ? reason.stack : String(reason),
		});
	});
}

const plugin: Plugin = async (input) => {
	const client = input.client;
	initLoggers(process.cwd());
	registerProcessHandlers();

	// Self-healing asset installation on every load
	const installResult = await installAssets();
	if (installResult.errors.length > 0) {
		getLogger("system").warn("Asset installation errors", { errors: installResult.errors });
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
		getLogger("system").error("Log retention pruning failed", {
			error: err instanceof Error ? err.stack : String(err),
		});
	});

	// --- UX notification manager (rate-limited, best-effort) ---
	const notificationManager = new NotificationManager({
		sink: {
			showToast: async (title, message, variant, duration) => {
				await sdkOps.showToast(title, message, variant as "info" | "warning" | "error");
				void duration;
			},
		},
	});

	// --- UX surfaces: context warnings, progress tracking, error hints ---
	const contextWarningMonitor = new ContextWarningMonitor({ notificationManager });
	const progressTracker = new ProgressTracker({ notificationManager });

	registerNotificationManager(notificationManager);
	registerProgressTracker(progressTracker);

	const taskToastManager = new TaskToastManager(notificationManager);
	registerTaskToastManager(taskToastManager);

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

	// --- Background task SDK wiring (enables real dispatch via promptAsync) ---
	const backgroundSdkOps = {
		promptAsync: async (
			sessionId: string,
			model: string | undefined,
			parts: ReadonlyArray<{ type: "text"; text: string }>,
		) => {
			const modelSpec = model ? { providerID: "", modelID: model } : undefined;
			await sdkOps.promptAsync(
				sessionId,
				modelSpec as { readonly providerID: string; readonly modelID: string },
				parts as readonly import("./orchestrator/fallback").MessagePart[],
			);
		},
	};
	setBackgroundSdkOperations(backgroundSdkOps);
	setDelegateSdkOperations(backgroundSdkOps);

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
	const recoveryEventHandler = (() => {
		try {
			const kernelDb = openKernelDb();
			const orchestrator = createRecoveryOrchestratorWithDb(kernelDb);
			return createRecoveryEventHandler({
				orchestrator,
				db: kernelDb,
				sdk: {
					abortSession: sdkOps.abortSession,
					showToast: (title, message, variant) =>
						sdkOps.showToast(title, message, variant as "info" | "warning" | "error"),
				},
			});
		} catch {
			return createRecoveryEventHandler(getDefaultRecoveryOrchestrator());
		}
	})();

	// --- Anti-slop hook initialization ---
	const antiSlopHandler = createAntiSlopHandler({ showToast: sdkOps.showToast });
	const keywordDetectorHandler = createKeywordDetectorHandler({ showToast: sdkOps.showToast });
	const preemptiveCompactionHandler = createPreemptiveCompactionHandler({
		showToast: sdkOps.showToast,
	});
	const sessionRecoveryHandler = createSessionRecoveryHandler({ showToast: sdkOps.showToast });
	const toolOutputTruncatorHandler = createToolOutputTruncatorHandler({});

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
	const contextInjector = createContextInjector({
		projectRoot: process.cwd(),
		totalBudget: 4000,
	});
	const compactionHandler = createCompactionHandler(contextInjector);
	const loopInjector = createLoopInjector(getLoopController());

	// --- MCP lifecycle manager (lazy — servers start when skills with mcp: config activate) ---
	const mcpManager = new McpLifecycleManager();
	setGlobalMcpManager(mcpManager);

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
	const tools = {
		oc_background: ocBackground,
		oc_configure: ocConfigure,
		oc_lsp_goto_definition: ocLspGotoDefinition,
		oc_lsp_find_references: ocLspFindReferences,
		oc_lsp_symbols: ocLspSymbols,
		oc_lsp_diagnostics: ocLspDiagnostics,
		oc_lsp_prepare_rename: ocLspPrepareRename,
		oc_lsp_rename: ocLspRename,
		oc_delegate: ocDelegate,
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
		oc_recover: ocRecover,
		oc_forensics: ocForensics,
		oc_hashline_edit: ocHashlineEdit,
		oc_review: ocReview,
		oc_logs: ocLogs,
		oc_loop: ocLoop,
		oc_session_stats: ocSessionStats,
		oc_pipeline_report: ocPipelineReport,
		oc_summary: ocSummary,
		oc_mock_fallback: ocMockFallback,
		oc_stocktake: ocStocktake,
		oc_update_docs: ocUpdateDocs,
		oc_memory_status: ocMemoryStatus,
		oc_memory_preferences: ocMemoryPreferences,
	};

	return {
		tool: {
			...tools,
		},
		event: async ({ event }) => {
			await observabilityEventHandler({ event });

			if (memoryCaptureHandler) {
				try {
					await memoryCaptureHandler({ event });
				} catch {
					/* best-effort */
				}
			}

			if (event.type === "session.created" && isFirstLoad(config)) {
				await notificationManager.info(
					"Welcome to OpenCode Autopilot!",
					"Plugin loaded. Run oc_doctor to verify your setup.",
				);
			}

			if (event.type === "session.error") {
				const props = event.properties;
				const errorMsg =
					props && typeof props === "object" && "error" in props
						? String((props as Record<string, unknown>).error)
						: "Unknown error";
				const hint = getRemediationHint(errorMsg);
				const displayMsg = hint ? `${errorMsg}\n${hint}` : errorMsg;
				await notificationManager.error("Session Error", displayMsg);
			}

			if (event.type === "message.updated") {
				const props = (event.properties ?? {}) as Record<string, unknown>;
				const info = props.info as Record<string, unknown> | undefined;
				if (info) {
					const tokens = info.tokens as { input?: number } | undefined;
					if (tokens && typeof tokens.input === "number") {
						contextWarningMonitor.checkUtilization(tokens.input, 200_000);
					}
				}
			}

			if (fallbackConfig.enabled) {
				await fallbackEventHandler({ event });
			}

			await recoveryEventHandler({ event });
			await compactionHandler({ event });

			if (event.type === "session.deleted") {
				mcpManager.stopAll().catch(() => {});
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

			try {
				await toolOutputTruncatorHandler(hookInput, output);
			} catch {
				// best-effort
			}

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

			try {
				await keywordDetectorHandler(hookInput, output);
			} catch {
				// best-effort
			}
		},
		"chat.completion.after": async (
			hookInput: {
				readonly sessionID: string;
				readonly tokens?: { readonly used?: number; readonly limit?: number };
			},
			output: { output?: string },
		) => {
			try {
				await preemptiveCompactionHandler(hookInput, output);
			} catch {
				// best-effort
			}

			try {
				await sessionRecoveryHandler(hookInput, output);
			} catch {
				// best-effort
			}
		},
		"experimental.chat.system.transform": async (input, output) => {
			if (memoryInjector) {
				await memoryInjector(input, output);
			}
			await contextInjector(input, output);
			await loopInjector(input, output);
		},
	};
};

export default plugin;
