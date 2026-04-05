import type { Category } from "../types/routing";
import { getAllCategories } from "./categories";

export interface ClassificationResult {
	readonly category: Category;
	readonly confidence: number;
	readonly reasoning: string;
}

interface ScoredCategory {
	readonly category: Category;
	readonly score: number;
	readonly matches: readonly string[];
}

const COMPLEXITY_SIGNALS: readonly string[] = Object.freeze([
	"implement",
	"authentication",
	"jwt",
	"refresh token",
	"oauth",
	"integration",
	"workflow",
	"subsystem",
	"pipeline",
	"multi-step",
	"end-to-end",
]);

function clampConfidence(value: number): number {
	return Math.max(0, Math.min(1, value));
}

function scoreFilePatternMatches(changedFiles: readonly string[]): ScoredCategory | null {
	const lowerFiles = changedFiles.map((file) => file.toLowerCase());
	let bestMatch: ScoredCategory | null = null;

	for (const definition of getAllCategories()) {
		if (definition.filePatterns.length === 0) {
			continue;
		}

		const matches = definition.filePatterns.filter((pattern) =>
			lowerFiles.some((file) => file.endsWith(pattern.toLowerCase())),
		);

		if (matches.length === 0) {
			continue;
		}

		if (bestMatch === null || matches.length > bestMatch.score) {
			bestMatch = {
				category: definition.category,
				score: matches.length,
				matches: Object.freeze([...matches]),
			};
		}
	}

	return bestMatch;
}

function scoreKeywordMatches(description: string): ScoredCategory | null {
	let bestMatch: ScoredCategory | null = null;

	for (const definition of getAllCategories()) {
		if (definition.keywords.length === 0) {
			continue;
		}

		const matches = definition.keywords.filter((keyword) =>
			description.includes(keyword.toLowerCase()),
		);
		if (matches.length === 0) {
			continue;
		}

		if (bestMatch === null || matches.length > bestMatch.score) {
			bestMatch = {
				category: definition.category,
				score: matches.length,
				matches: Object.freeze([...matches]),
			};
		}
	}

	return bestMatch;
}

function classifyByHeuristic(description: string): ClassificationResult | null {
	if (description.length < 20) {
		return Object.freeze({
			category: "quick",
			confidence: 0.45,
			reasoning: "Short task description suggests a quick utility task.",
		});
	}

	const matchedSignals = COMPLEXITY_SIGNALS.filter((signal) => description.includes(signal));
	if (description.length > 200 || matchedSignals.length > 0) {
		const confidence = clampConfidence(
			0.58 + matchedSignals.length * 0.07 + (description.length > 200 ? 0.12 : 0),
		);
		const details =
			matchedSignals.length > 0
				? `complexity signals: ${matchedSignals.join(", ")}`
				: "long task description suggests high complexity";
		return Object.freeze({
			category: "unspecified-high",
			confidence,
			reasoning: `Heuristic classified task as unspecified-high based on ${details}.`,
		});
	}

	return null;
}

export function classifyTask(
	description: string,
	changedFiles: readonly string[] = [],
): ClassificationResult {
	const normalizedDescription = description.trim().toLowerCase();

	const filePatternMatch = scoreFilePatternMatches(changedFiles);
	if (filePatternMatch !== null) {
		return Object.freeze({
			category: filePatternMatch.category,
			confidence: clampConfidence(0.72 + filePatternMatch.score * 0.1),
			reasoning: `Matched file patterns for ${filePatternMatch.category}: ${filePatternMatch.matches.join(", ")}.`,
		});
	}

	const keywordMatch = scoreKeywordMatches(normalizedDescription);
	if (keywordMatch !== null) {
		return Object.freeze({
			category: keywordMatch.category,
			confidence: clampConfidence(0.55 + keywordMatch.score * 0.15),
			reasoning: `Matched keywords for ${keywordMatch.category}: ${keywordMatch.matches.join(", ")}.`,
		});
	}

	const heuristicMatch = classifyByHeuristic(normalizedDescription);
	if (heuristicMatch !== null) {
		return heuristicMatch;
	}

	return Object.freeze({
		category: "unspecified-low",
		confidence: 0.3,
		reasoning: "No strong routing signals found; defaulted to unspecified-low.",
	});
}
