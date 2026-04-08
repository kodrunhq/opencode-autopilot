/**
 * Oracle Gate - Performance Improvement Component
 *
 * Consults Oracle agent for complex decisions to prevent wasted cycles
 * and improve implementation quality.
 */

import type { Task } from "./types";

interface OracleConsultationRequest {
	readonly taskId: number;
	readonly taskTitle: string;
	readonly context: string;
	readonly issue?: string;
	readonly options?: readonly string[];
}

interface OracleConsultationResult {
	readonly recommendedAction: string;
	readonly reasoning: string;
	readonly confidence: "high" | "medium" | "low";
	readonly estimatedEffort?: "trivial" | "moderate" | "significant";
}

/**
 * Oracle Gate - Determines when to consult Oracle agent
 */
export class OracleGate {
	private readonly consultationHistory: Map<number, OracleConsultationResult[]> = new Map();

	/**
	 * Determine if a task requires Oracle consultation
	 */
	shouldConsultOracle(
		task: Task,
		context: {
			readonly attemptCount: number;
			readonly strikeCount: number;
			readonly reviewFindings?: readonly string[];
			readonly complexityHint?: "high" | "medium" | "low";
		},
	): boolean {
		// Consult Oracle for:
		// 1. Tasks that have failed multiple times
		if (context.attemptCount >= 2) {
			return true;
		}

		// 2. Tasks with critical review findings
		if (context.strikeCount > 0) {
			return true;
		}

		// 3. Complex tasks (based on title or description)
		if (this.isComplexTask(task)) {
			return true;
		}

		// 4. Ambiguous review findings
		if (context.reviewFindings && this.hasAmbiguousFindings(context.reviewFindings)) {
			return true;
		}

		// 5. User-specified complexity hint
		if (context.complexityHint === "high") {
			return true;
		}

		return false;
	}

	/**
	 * Generate consultation prompt for Oracle
	 */
	createConsultationPrompt(request: OracleConsultationRequest): string {
		const lines: string[] = [];

		lines.push(`# Oracle Consultation Request`);
		lines.push(``);
		lines.push(`**Task ${request.taskId}: ${request.taskTitle}**`);
		lines.push(``);
		lines.push(`## Context`);
		lines.push(request.context);
		lines.push(``);

		if (request.issue) {
			lines.push(`## Issue`);
			lines.push(request.issue);
			lines.push(``);
		}

		if (request.options && request.options.length > 0) {
			lines.push(`## Options`);
			request.options.forEach((option, index) => {
				lines.push(`${index + 1}. ${option}`);
			});
			lines.push(``);
		}

		lines.push(`## Request`);
		lines.push(`Please provide:`);
		lines.push(`1. **Recommended Action** - What should be done next?`);
		lines.push(`2. **Reasoning** - Why this approach?`);
		lines.push(`3. **Confidence** - High/Medium/Low in this recommendation`);
		lines.push(`4. **Estimated Effort** - Trivial/Moderate/Significant`);
		lines.push(``);
		lines.push(`Respond in this format:`);
		lines.push(`Recommended Action: [your recommendation]`);
		lines.push(`Reasoning: [your reasoning]`);
		lines.push(`Confidence: [high|medium|low]`);
		lines.push(`Estimated Effort: [trivial|moderate|significant]`);

		return lines.join("\n");
	}

	/**
	 * Parse Oracle response into structured result
	 */
	parseOracleResponse(response: string): OracleConsultationResult | null {
		const lines = response.split("\n");
		let recommendedAction = "";
		let reasoning = "";
		let confidence: "high" | "medium" | "low" = "medium";
		let estimatedEffort: "trivial" | "moderate" | "significant" | undefined;

		for (const line of lines) {
			const lowerLine = line.toLowerCase();

			if (lowerLine.startsWith("recommended action:")) {
				recommendedAction = line.substring("Recommended Action:".length).trim();
			} else if (lowerLine.startsWith("reasoning:")) {
				reasoning = line.substring("Reasoning:".length).trim();
			} else if (lowerLine.startsWith("confidence:")) {
				const conf = line.substring("Confidence:".length).trim().toLowerCase();
				if (conf === "high" || conf === "medium" || conf === "low") {
					confidence = conf;
				}
			} else if (lowerLine.startsWith("estimated effort:")) {
				const effort = line.substring("Estimated Effort:".length).trim().toLowerCase();
				if (effort === "trivial" || effort === "moderate" || effort === "significant") {
					estimatedEffort = effort;
				}
			}
		}

		if (!recommendedAction || !reasoning) {
			return null;
		}

		return {
			recommendedAction,
			reasoning,
			confidence,
			estimatedEffort,
		};
	}

	/**
	 * Record consultation for future reference
	 */
	recordConsultation(taskId: number, result: OracleConsultationResult): void {
		const history = this.consultationHistory.get(taskId) || [];
		history.push(result);
		this.consultationHistory.set(taskId, history);
	}

	/**
	 * Get consultation history for a task
	 */
	getConsultationHistory(taskId: number): readonly OracleConsultationResult[] {
		return this.consultationHistory.get(taskId) || [];
	}

	/**
	 * Clear consultation history
	 */
	clearHistory(): void {
		this.consultationHistory.clear();
	}

	// Private helper methods

	private isComplexTask(task: Task): boolean {
		const title = task.title.toLowerCase();
		const complexKeywords = [
			"refactor",
			"migrate",
			"rewrite",
			"redesign",
			"restructure",
			"architecture",
			"performance",
			"optimize",
			"security",
			"auth",
			"database",
			"schema",
			"api",
			"integration",
			"legacy",
		];

		return complexKeywords.some((keyword) => title.includes(keyword));
	}

	private hasAmbiguousFindings(findings: readonly string[]): boolean {
		const ambiguousIndicators = [
			"maybe",
			"perhaps",
			"could be",
			"might be",
			"possibly",
			"consider",
			"suggest",
			"recommend",
			"alternative",
			"trade-off",
			"pros and cons",
			"depends",
		];

		const findingsText = findings.join(" ").toLowerCase();
		return ambiguousIndicators.some((indicator) => findingsText.includes(indicator));
	}
}

/**
 * Default Oracle Gate instance
 */
export const defaultOracleGate = new OracleGate();

/**
 * Helper to integrate Oracle Gate with BUILD phase
 */
export function createOracleGateIntegration(oracleGate: OracleGate = defaultOracleGate) {
	return {
		/**
		 * Check if task needs Oracle consultation and create prompt if needed
		 */
		checkTaskForOracle(
			task: Task,
			context: {
				attemptCount: number;
				strikeCount: number;
				reviewFindings?: readonly string[];
				artifactDir: string;
				runId?: string;
			},
		): { needsConsultation: boolean; prompt?: string } {
			const needsConsultation = oracleGate.shouldConsultOracle(task, {
				attemptCount: context.attemptCount,
				strikeCount: context.strikeCount,
				reviewFindings: context.reviewFindings,
			});

			if (!needsConsultation) {
				return { needsConsultation: false };
			}

			const consultationRequest: OracleConsultationRequest = {
				taskId: task.id,
				taskTitle: task.title,
				context: `Task ${task.id}: ${task.title}\nArtifact directory: ${context.artifactDir}\nRun ID: ${context.runId || "N/A"}`,
				issue:
					context.attemptCount > 0
						? `Task has failed ${context.attemptCount} time(s) and has ${context.strikeCount} strike(s).`
						: undefined,
				options: [
					"Continue implementation with current approach",
					"Refactor implementation approach",
					"Break task into smaller subtasks",
					"Seek additional clarification",
					"Skip task and revisit later",
				],
			};

			const prompt = oracleGate.createConsultationPrompt(consultationRequest);
			return { needsConsultation: true, prompt };
		},

		/**
		 * Parse and apply Oracle recommendation
		 */
		applyOracleRecommendation(
			taskId: number,
			oracleResponse: string,
		): { success: boolean; result?: OracleConsultationResult; error?: string } {
			const result = oracleGate.parseOracleResponse(oracleResponse);

			if (!result) {
				return { success: false, error: "Failed to parse Oracle response" };
			}

			oracleGate.recordConsultation(taskId, result);

			return { success: true, result };
		},
	};
}
