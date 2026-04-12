import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";

const execFileAsync = promisify(execFile);

const GH_PENDING_STATES = new Set([
	"expected",
	"pending",
	"queued",
	"requested",
	"waiting",
	"in_progress",
]);

const GH_FAILURE_STATES = new Set([
	"action_required",
	"cancelled",
	"error",
	"failure",
	"startup_failure",
	"timed_out",
]);

const GH_SUCCESS_STATES = new Set(["neutral", "skipped", "success"]);

export const githubCheckSchema = z.object({
	name: z.string().min(1).max(256),
	status: z.enum(["PASSED", "FAILED", "PENDING", "BLOCKED", "SKIPPED_WITH_REASON"]),
	summary: z.string().max(2048),
	workflow: z.string().max(256).nullable().default(null),
	link: z.string().max(2048).nullable().default(null),
});

export const githubChecksPollResultSchema = z.object({
	status: z.enum(["PASSED", "FAILED", "PENDING", "BLOCKED", "SKIPPED_WITH_REASON"]),
	summary: z.string().max(4096),
	checks: z.array(githubCheckSchema).max(200),
	attempts: z.number().int().min(1),
});

export type GitHubCheck = z.infer<typeof githubCheckSchema>;
export type GitHubChecksPollResult = z.infer<typeof githubChecksPollResultSchema>;

export interface GitHubChecksRunner {
	readonly runChecksCommand?: (
		prNumber: number,
		projectRoot: string,
	) => Promise<{ readonly stdout: string; readonly stderr?: string }>;
	readonly sleep?: (ms: number) => Promise<void>;
	readonly now?: () => number;
}

interface RawGhCheck {
	readonly name?: unknown;
	readonly state?: unknown;
	readonly link?: unknown;
	readonly workflow?: unknown;
	readonly description?: unknown;
	readonly event?: unknown;
	readonly bucket?: unknown;
}

async function defaultSleep(ms: number): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, ms));
}

async function defaultRunChecksCommand(
	prNumber: number,
	projectRoot: string,
): Promise<{ readonly stdout: string; readonly stderr?: string }> {
	const result = await execFileAsync(
		"gh",
		[
			"pr",
			"checks",
			String(prNumber),
			"--required",
			"--json",
			"name,state,link,workflow,description,event,bucket",
		],
		{ cwd: projectRoot },
	);

	return Object.freeze({ stdout: result.stdout, stderr: result.stderr });
}

function normalizeCheckStatus(rawState: string): GitHubCheck["status"] {
	const normalized = rawState.toLowerCase().trim().replace(/\s+/g, "_");

	if (GH_PENDING_STATES.has(normalized)) {
		return "PENDING";
	}

	if (GH_FAILURE_STATES.has(normalized)) {
		return "FAILED";
	}

	if (GH_SUCCESS_STATES.has(normalized)) {
		return normalized === "skipped" ? "SKIPPED_WITH_REASON" : "PASSED";
	}

	if (normalized.length === 0) {
		return "BLOCKED";
	}

	return "BLOCKED";
}

function buildCheckSummary(check: RawGhCheck): string {
	const description = typeof check.description === "string" ? check.description.trim() : "";
	const event = typeof check.event === "string" ? check.event.trim() : "";
	const bucket = typeof check.bucket === "string" ? check.bucket.trim() : "";
	return (
		[description, event, bucket].filter((part) => part.length > 0).join(" · ") ||
		"No details reported."
	);
}

function parseChecks(stdout: string): readonly GitHubCheck[] {
	const parsed = JSON.parse(stdout) as unknown;
	if (!Array.isArray(parsed)) {
		throw new Error("GitHub checks response was not an array.");
	}

	return githubCheckSchema.array().parse(
		parsed.map((entry) => {
			const rawCheck = entry as RawGhCheck;
			const name = typeof rawCheck.name === "string" ? rawCheck.name : "unknown-check";
			const state = typeof rawCheck.state === "string" ? rawCheck.state : "";
			return {
				name,
				status: normalizeCheckStatus(state),
				summary: buildCheckSummary(rawCheck),
				workflow: typeof rawCheck.workflow === "string" ? rawCheck.workflow : null,
				link: typeof rawCheck.link === "string" ? rawCheck.link : null,
			};
		}),
	);
}

function summarizeChecks(checks: readonly GitHubCheck[]): string {
	if (checks.length === 0) {
		return "No required GitHub checks were reported for this pull request.";
	}

	const failedChecks = checks.filter(
		(check) => check.status === "FAILED" || check.status === "BLOCKED",
	);
	if (failedChecks.length > 0) {
		return `Required GitHub checks failed: ${failedChecks.map((check) => check.name).join(", ")}.`;
	}

	const pendingChecks = checks.filter((check) => check.status === "PENDING");
	if (pendingChecks.length > 0) {
		return `Required GitHub checks are still pending: ${pendingChecks
			.map((check) => check.name)
			.join(", ")}.`;
	}

	return `All required GitHub checks passed (${checks.length} total).`;
}

function summarizeOverallStatus(checks: readonly GitHubCheck[]): GitHubChecksPollResult["status"] {
	if (checks.length === 0) {
		return "SKIPPED_WITH_REASON";
	}

	if (checks.some((check) => check.status === "FAILED")) {
		return "FAILED";
	}

	if (checks.some((check) => check.status === "BLOCKED")) {
		return "BLOCKED";
	}

	if (checks.some((check) => check.status === "PENDING")) {
		return "PENDING";
	}

	return "PASSED";
}

export async function pollRequiredGitHubChecks(
	options: {
		readonly prNumber: number;
		readonly projectRoot: string;
		readonly pollIntervalMs?: number;
		readonly timeoutMs?: number;
	} & GitHubChecksRunner,
): Promise<GitHubChecksPollResult> {
	const runChecksCommand = options.runChecksCommand ?? defaultRunChecksCommand;
	const sleep = options.sleep ?? defaultSleep;
	const now = options.now ?? Date.now;
	const pollIntervalMs = options.pollIntervalMs ?? 5_000;
	const timeoutMs = options.timeoutMs ?? 60_000;
	const startedAt = now();

	let attempts = 0;

	for (;;) {
		attempts += 1;

		let checks: readonly GitHubCheck[];
		try {
			const result = await runChecksCommand(options.prNumber, options.projectRoot);
			checks = parseChecks(result.stdout);
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error);
			return githubChecksPollResultSchema.parse({
				status: "BLOCKED",
				summary: `Unable to query required GitHub checks: ${message}`,
				checks: [],
				attempts,
			});
		}

		const status = summarizeOverallStatus(checks);
		if (status !== "PENDING") {
			return githubChecksPollResultSchema.parse({
				status,
				summary: summarizeChecks(checks),
				checks,
				attempts,
			});
		}

		if (now() - startedAt >= timeoutMs) {
			return githubChecksPollResultSchema.parse({
				status,
				summary: summarizeChecks(checks),
				checks,
				attempts,
			});
		}

		await sleep(pollIntervalMs);
	}
}
