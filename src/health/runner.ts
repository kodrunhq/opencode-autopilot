import type { Config } from "@opencode-ai/plugin";
import { agentHealthCheck, assetHealthCheck, configHealthCheck } from "./checks";
import type { HealthReport, HealthResult } from "./types";

/**
 * Run all health checks and aggregate into a HealthReport.
 * Each check runs independently — a failure in one does not skip others.
 */
export async function runHealthChecks(options?: {
	configPath?: string;
	openCodeConfig?: Config | null;
	assetsDir?: string;
	targetDir?: string;
}): Promise<HealthReport> {
	const start = Date.now();

	const results: HealthResult[] = await Promise.all([
		configHealthCheck(options?.configPath),
		agentHealthCheck(options?.openCodeConfig ?? null),
		assetHealthCheck(options?.assetsDir, options?.targetDir),
	]);

	const repairs = results.filter((r) => r.repaired).map((r) => r.name);

	const allPassed = results.every((r) => r.status === "pass");
	const duration = Date.now() - start;

	return Object.freeze({
		results: Object.freeze(results),
		repairs: Object.freeze(repairs),
		allPassed,
		duration,
	});
}
