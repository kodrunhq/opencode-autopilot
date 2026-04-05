import { tool } from "@opencode-ai/plugin";
import { z } from "zod";
import { readLatestSessionLog, readSessionLog } from "../observability/log-reader";
import { generateSessionSummary } from "../observability/summary-generator";

export async function summaryCore(sessionID?: string, logsDir?: string): Promise<string> {
	const logsRoot = logsDir ?? process.cwd();
	const log = sessionID
		? await readSessionLog(sessionID, logsRoot)
		: await readLatestSessionLog(logsRoot);

	if (!log) {
		const target = sessionID ? `Session "${sessionID}" not found.` : "No session logs found.";
		return JSON.stringify({
			action: "error",
			message: target,
		});
	}

	const summary = generateSessionSummary(log);

	return JSON.stringify({
		action: "session_summary",
		sessionId: log.sessionId,
		summary,
		displayText: summary,
	});
}

export const ocSummary = tool({
	description:
		"Generate a markdown summary for the latest session or a specific session ID. Use this to review session outcomes, decisions, and errors.",
	args: {
		sessionID: z
			.string()
			.regex(/^[a-zA-Z0-9_-]{1,256}$/)
			.optional()
			.describe("Session ID to summarize (uses latest if omitted)"),
	},
	async execute({ sessionID }) {
		return summaryCore(sessionID);
	},
});
