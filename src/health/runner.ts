import type { Config } from "@opencode-ai/plugin";
import {
	agentHealthCheck,
	assetHealthCheck,
	commandHealthCheck,
	configHealthCheck,
	configV7FieldsCheck,
	lspHealthCheck,
	mcpHealthCheck,
	memoryHealthCheck,
	nativeAgentSuppressionHealthCheck,
	routingHealthCheck,
	skillHealthCheck,
} from "./checks";
import type { HealthReport, HealthResult } from "./types";

/**
 * Map a settled promise result to a HealthResult.
 * Fulfilled results pass through; rejected results become fail entries.
 */
function settledToResult(
	outcome: PromiseSettledResult<HealthResult>,
	fallbackName: string,
): HealthResult {
	if (outcome.status === "fulfilled") {
		return outcome.value;
	}
	const msg = outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
	return Object.freeze({
		name: fallbackName,
		status: "fail" as const,
		message: `Check threw unexpectedly: ${msg}`,
	});
}

/**
 * Run all health checks and aggregate into a HealthReport.
 * Each check runs independently — a failure in one does not skip others.
 * Uses Promise.allSettled so a throwing check cannot kill the entire report.
 */
export async function runHealthChecks(options?: {
	configPath?: string;
	openCodeConfig?: Config | null;
	assetsDir?: string;
	targetDir?: string;
	projectRoot?: string;
}): Promise<HealthReport> {
	const start = Date.now();

	const configOutcome = await Promise.allSettled([configHealthCheck(options?.configPath)]);

	const settled = await Promise.allSettled([
		agentHealthCheck(options?.openCodeConfig ?? null),
		nativeAgentSuppressionHealthCheck(options?.openCodeConfig ?? null),
		assetHealthCheck(options?.assetsDir, options?.targetDir),
		skillHealthCheck(options?.projectRoot ?? process.cwd()),
		memoryHealthCheck(options?.targetDir),
		commandHealthCheck(options?.targetDir),
		configV7FieldsCheck(options?.configPath),
		routingHealthCheck(options?.configPath),
		mcpHealthCheck(options?.configPath),
		lspHealthCheck(),
	]);

	const allSettled = [...configOutcome, ...settled];

	const fallbackNames = [
		"config-validity",
		"agent-injection",
		"native-agent-suppression",
		"asset-directories",
		"skill-loading",
		"memory-db",
		"command-accessibility",
		"config-v7-fields",
		"routing-health",
		"mcp-health",
		"lsp-servers",
	];
	const results: readonly HealthResult[] = Object.freeze(
		allSettled.map((outcome, i) => settledToResult(outcome, fallbackNames[i])),
	);

	const allPassed = results.every((r) => r.status === "pass");
	const duration = Date.now() - start;

	return Object.freeze({
		results,
		allPassed,
		duration,
	});
}
