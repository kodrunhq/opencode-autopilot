/**
 * Health check result for a single diagnostic check.
 * Immutable — frozen on creation by each check function.
 */
export interface HealthResult {
	readonly name: string;
	readonly status: "pass" | "fail";
	readonly message: string;
	readonly details?: readonly string[];
}

/**
 * Aggregated health report from running all checks.
 * Immutable — frozen on creation by runHealthChecks.
 */
export interface HealthReport {
	readonly results: readonly HealthResult[];
	readonly allPassed: boolean;
	readonly duration: number;
}
