import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Config } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";
import { runHealthChecks } from "../health/runner";
import type { HealthResult } from "../health/types";
import { getProjectArtifactDir } from "../utils/paths";

let openCodeConfig: Config | null = null;

export function setOpenCodeConfig(config: Config | null): void {
	openCodeConfig = config;
}

/**
 * A single check in the doctor report, with an optional fix suggestion.
 */
interface DoctorCheck {
	readonly name: string;
	readonly status: "pass" | "fail";
	readonly message: string;
	readonly fixSuggestion: string | null;
}

interface ContractHealth {
	readonly legacyTasksFallbackSeen: boolean;
	readonly legacyResultParserSeen: boolean;
}

async function detectContractHealth(projectRoot?: string): Promise<ContractHealth> {
	if (!projectRoot) {
		return {
			legacyTasksFallbackSeen: false,
			legacyResultParserSeen: false,
		};
	}

	try {
		const artifactDir = getProjectArtifactDir(projectRoot);
		const logPath = join(artifactDir, "orchestration.jsonl");
		const content = await readFile(logPath, "utf-8");
		const entries = content
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean)
			.map((line) => {
				try {
					return JSON.parse(line) as Record<string, unknown>;
				} catch {
					return null;
				}
			})
			.filter((entry): entry is Record<string, unknown> => entry !== null);
		return {
			legacyTasksFallbackSeen: entries.some(
				(entry) =>
					typeof entry.message === "string" &&
					entry.message.includes("PLAN fallback: parsed legacy tasks.md"),
			),
			legacyResultParserSeen: entries.some(
				(entry) =>
					typeof entry.message === "string" &&
					entry.message.includes("Legacy result parser path used"),
			),
		};
	} catch {
		return {
			legacyTasksFallbackSeen: false,
			legacyResultParserSeen: false,
		};
	}
}

/**
 * Options for doctorCore — all optional for testability.
 */
interface DoctorOptions {
	readonly configPath?: string;
	readonly openCodeConfig?: Config | null;
	readonly assetsDir?: string;
	readonly targetDir?: string;
	readonly projectRoot?: string;
}

/**
 * Map check names to actionable fix suggestions (per D-11).
 */
const FIX_SUGGESTIONS: Readonly<Record<string, string>> = Object.freeze({
	"config-validity":
		"Run `bunx @kodrunhq/opencode-autopilot configure` to reconfigure, or delete ~/.config/opencode/opencode-autopilot.json to reset",
	"agent-injection": "Restart OpenCode to trigger agent re-injection via config hook",
	"native-agent-suppression":
		"Restart OpenCode and verify plugin config hook runs. If issue persists, check for conflicting OpenCode config or another plugin overriding agent entries",
	"asset-directories": "Restart OpenCode to trigger asset reinstallation",
	"skill-loading": "Ensure skills directory exists in ~/.config/opencode/skills/",
	"memory-db":
		"Memory DB is created automatically on first memory capture -- use the plugin normally to initialize",
	"command-accessibility": "Restart OpenCode to trigger command reinstallation from bundled assets",
});

function getFixSuggestion(checkName: string): string {
	return FIX_SUGGESTIONS[checkName] ?? "Restart OpenCode to trigger auto-repair";
}

function formatCheck(result: HealthResult): DoctorCheck {
	return Object.freeze({
		name: result.name,
		status: result.status,
		message: result.message,
		fixSuggestion: result.status === "fail" ? getFixSuggestion(result.name) : null,
	});
}

/**
 * Build human-readable pass/fail display text (like `brew doctor` output).
 */
function buildDisplayText(checks: readonly DoctorCheck[], duration: number): string {
	const lines = checks.map((c) => {
		const icon = c.status === "pass" ? "OK" : "FAIL";
		const line = `[${icon}] ${c.name}: ${c.message}`;
		return c.fixSuggestion ? `${line}\n     Fix: ${c.fixSuggestion}` : line;
	});
	lines.push("", `Completed in ${duration}ms`);
	return lines.join("\n");
}

/**
 * Core diagnostic function — runs all health checks and returns a structured
 * JSON report. Follows the *Core + tool() wrapper pattern per CLAUDE.md.
 *
 * The hook-registration check is informational: if oc_doctor is callable,
 * the plugin is registered. Always passes.
 */
export async function doctorCore(options?: DoctorOptions): Promise<string> {
	const report = await runHealthChecks({
		configPath: options?.configPath,
		openCodeConfig: options?.openCodeConfig,
		assetsDir: options?.assetsDir,
		targetDir: options?.targetDir,
		projectRoot: options?.projectRoot,
	});

	// Map health results to doctor checks with fix suggestions
	const healthChecks = report.results.map(formatCheck);

	// Hook-registration check: if oc_doctor is callable, hooks are registered
	const hookCheck: DoctorCheck = Object.freeze({
		name: "hook-registration",
		status: "pass" as const,
		message: "Plugin tools registered (oc_doctor callable)",
		fixSuggestion: null,
	});

	const allChecks = [...healthChecks, hookCheck];
	const contractHealth = await detectContractHealth(options?.projectRoot);
	const allPassed = report.allPassed && hookCheck.status === "pass";
	const displayText = buildDisplayText(allChecks, report.duration);

	return JSON.stringify({
		action: "doctor",
		checks: allChecks,
		allPassed,
		contractHealth,
		displayText,
		duration: report.duration,
	});
}

// --- Tool wrapper ---

export const ocDoctor = tool({
	description:
		"Run plugin health diagnostics. Reports pass/fail status for config, agents, " +
		"native suppression, assets, and hooks. Like `brew doctor` for opencode-autopilot.",
	args: {},
	async execute(_args, context) {
		return doctorCore({
			openCodeConfig,
			projectRoot: context.directory,
		});
	},
});
