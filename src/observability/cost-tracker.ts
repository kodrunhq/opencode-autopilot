/**
 * Enhanced Cost Tracking with Subagent Aggregation
 *
 * Tracks usage costs across all subagents and aggregates them.
 * Provides detailed cost breakdown by agent, model, and operation type.
 */

export interface CostEntry {
	readonly timestamp: string;
	readonly sessionId: string;
	readonly agent: string;
	readonly model?: string;
	readonly operation: "tool" | "message" | "agent" | "background";
	readonly inputTokens: number;
	readonly outputTokens: number;
	readonly totalTokens: number;
	readonly cost: number;
	readonly metadata?: Record<string, any>;
}

export interface CostSummary {
	readonly totalCost: number;
	readonly totalTokens: number;
	readonly byAgent: Record<string, { cost: number; tokens: number }>;
	readonly byModel: Record<string, { cost: number; tokens: number }>;
	readonly byOperation: Record<string, { cost: number; tokens: number }>;
	readonly hourlyCost: number;
	readonly estimatedMonthlyCost: number;
}

export class CostTracker {
	private costs: Map<string, CostEntry[]> = new Map(); // sessionId -> CostEntry[]
	private costRates: Map<string, number> = new Map(); // model -> cost per 1M tokens

	constructor() {
		// Initialize with default cost rates (USD per 1M tokens)
		// These are example rates - should be configurable
		this.costRates.set("anthropic/claude-opus-4-6", 75.0);
		this.costRates.set("anthropic/claude-sonnet-4-6", 12.0);
		this.costRates.set("anthropic/claude-haiku-4-5", 0.8);
		this.costRates.set("openai/gpt-5.4", 60.0);
		this.costRates.set("openai/gpt-4-turbo", 30.0);
		this.costRates.set("google/gemini-3.1-pro", 7.5);
		this.costRates.set("google/gemini-3-flash", 0.35);
	}

	/**
	 * Record a cost entry
	 */
	recordCost(entry: Omit<CostEntry, "cost"> & { cost?: number }): void {
		const fullEntry: CostEntry = {
			...entry,
			cost: entry.cost ?? this.calculateCost(entry.model, entry.inputTokens, entry.outputTokens),
		};

		const sessionCosts = this.costs.get(fullEntry.sessionId) || [];
		sessionCosts.push(fullEntry);
		this.costs.set(fullEntry.sessionId, sessionCosts);
	}

	/**
	 * Calculate cost based on token counts and model rates
	 */
	calculateCost(model: string | undefined, inputTokens: number, outputTokens: number): number {
		if (!model) return 0;

		const rate = this.costRates.get(model);
		if (!rate) return 0;

		// Convert per 1M tokens rate to per token
		const perTokenRate = rate / 1_000_000;
		return (inputTokens + outputTokens) * perTokenRate;
	}

	/**
	 * Get cost summary for a session
	 */
	getSessionSummary(sessionId: string): CostSummary | null {
		const sessionCosts = this.costs.get(sessionId);
		if (!sessionCosts || sessionCosts.length === 0) {
			return null;
		}

		const totalCost = sessionCosts.reduce((sum, entry) => sum + entry.cost, 0);
		const totalTokens = sessionCosts.reduce((sum, entry) => sum + entry.totalTokens, 0);

		const byAgent: Record<string, { cost: number; tokens: number }> = {};
		const byModel: Record<string, { cost: number; tokens: number }> = {};
		const byOperation: Record<string, { cost: number; tokens: number }> = {};

		for (const entry of sessionCosts) {
			// Aggregate by agent
			if (!byAgent[entry.agent]) {
				byAgent[entry.agent] = { cost: 0, tokens: 0 };
			}
			byAgent[entry.agent].cost += entry.cost;
			byAgent[entry.agent].tokens += entry.totalTokens;

			// Aggregate by model
			const modelKey = entry.model || "unknown";
			if (!byModel[modelKey]) {
				byModel[modelKey] = { cost: 0, tokens: 0 };
			}
			byModel[modelKey].cost += entry.cost;
			byModel[modelKey].tokens += entry.totalTokens;

			// Aggregate by operation
			if (!byOperation[entry.operation]) {
				byOperation[entry.operation] = { cost: 0, tokens: 0 };
			}
			byOperation[entry.operation].cost += entry.cost;
			byOperation[entry.operation].tokens += entry.totalTokens;
		}

		// Calculate hourly and monthly estimates
		const firstEntry = sessionCosts[0];
		const lastEntry = sessionCosts[sessionCosts.length - 1];
		const durationMs =
			new Date(lastEntry.timestamp).getTime() - new Date(firstEntry.timestamp).getTime();
		const durationHours = durationMs / (1000 * 60 * 60);
		const hourlyCost = durationHours > 0 ? totalCost / durationHours : 0;
		const estimatedMonthlyCost = hourlyCost * 24 * 30; // 30 days

		return {
			totalCost,
			totalTokens,
			byAgent,
			byModel,
			byOperation,
			hourlyCost,
			estimatedMonthlyCost,
		};
	}

	/**
	 * Get cost breakdown for a specific agent
	 */
	getAgentCostBreakdown(sessionId: string, agent: string): CostEntry[] {
		const sessionCosts = this.costs.get(sessionId);
		if (!sessionCosts) return [];

		return sessionCosts.filter((entry) => entry.agent === agent);
	}

	/**
	 * Get all sessions with costs
	 */
	getAllSessions(): string[] {
		return Array.from(this.costs.keys());
	}

	/**
	 * Clear cost data for a session
	 */
	clearSession(sessionId: string): void {
		this.costs.delete(sessionId);
	}

	/**
	 * Clear all cost data
	 */
	clearAll(): void {
		this.costs.clear();
	}

	/**
	 * Format cost summary for display
	 */
	formatSummary(summary: CostSummary): string {
		const lines: string[] = [];

		lines.push("## Cost Summary");
		lines.push("");
		lines.push(`**Total Cost**: $${summary.totalCost.toFixed(4)}`);
		lines.push(`**Total Tokens**: ${summary.totalTokens.toLocaleString()}`);
		lines.push(`**Hourly Rate**: $${summary.hourlyCost.toFixed(4)}/hr`);
		lines.push(`**Estimated Monthly**: $${summary.estimatedMonthlyCost.toFixed(2)}`);
		lines.push("");

		lines.push("### By Agent");
		lines.push("");
		for (const [agent, data] of Object.entries(summary.byAgent)) {
			const percentage = summary.totalCost > 0 ? (data.cost / summary.totalCost) * 100 : 0;
			lines.push(
				`- ${agent}: $${data.cost.toFixed(4)} (${data.tokens.toLocaleString()} tokens, ${percentage.toFixed(1)}%)`,
			);
		}
		lines.push("");

		lines.push("### By Model");
		lines.push("");
		for (const [model, data] of Object.entries(summary.byModel)) {
			const percentage = summary.totalCost > 0 ? (data.cost / summary.totalCost) * 100 : 0;
			lines.push(
				`- ${model}: $${data.cost.toFixed(4)} (${data.tokens.toLocaleString()} tokens, ${percentage.toFixed(1)}%)`,
			);
		}
		lines.push("");

		lines.push("### By Operation");
		lines.push("");
		for (const [operation, data] of Object.entries(summary.byOperation)) {
			const percentage = summary.totalCost > 0 ? (data.cost / summary.totalCost) * 100 : 0;
			lines.push(
				`- ${operation}: $${data.cost.toFixed(4)} (${data.tokens.toLocaleString()} tokens, ${percentage.toFixed(1)}%)`,
			);
		}

		return lines.join("\n");
	}

	/**
	 * Set custom cost rate for a model
	 */
	setModelRate(model: string, ratePerMillion: number): void {
		this.costRates.set(model, ratePerMillion);
	}

	/**
	 * Get current cost rates
	 */
	getCostRates(): Record<string, number> {
		return Object.fromEntries(this.costRates);
	}
}

/**
 * Global cost tracker instance
 */
export const globalCostTracker = new CostTracker();
