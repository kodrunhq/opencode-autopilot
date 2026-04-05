import { reviewFindingSchema, reviewFindingsEnvelopeSchema } from "./schemas";
import type { ReviewFinding, ReviewFindingsEnvelope } from "./types";

export function parseTypedFindingsEnvelope(raw: string): ReviewFindingsEnvelope | null {
	try {
		const parsed = JSON.parse(raw);
		return reviewFindingsEnvelopeSchema.parse(parsed);
	} catch {
		return null;
	}
}

export function parseAgentFindings(raw: string, agentName: string): readonly ReviewFinding[] {
	const findings: ReviewFinding[] = [];

	const jsonStr = extractJson(raw);
	if (jsonStr === null) return Object.freeze(findings);

	try {
		const cleanJson = sanitizeMalformedJson(jsonStr);
		const parsed = JSON.parse(cleanJson);
		const items = Array.isArray(parsed) ? parsed : parsed?.findings;

		if (!Array.isArray(items)) return Object.freeze(findings);

		for (const item of items) {
			if (typeof item !== "object" || item === null) continue;

			const problem = item.problem || item.description || item.issue || "No description provided";
			const normalized = {
				...item,
				agent: item.agent || agentName,
				severity: normalizeSeverity(item.severity),
				domain: item.domain || "general",
				title:
					item.title || item.name || (problem ? String(problem).slice(0, 50) : "Untitled finding"),
				file: item.file || item.path || item.filename || "unknown",
				source: item.source || "phase1",
				evidence: item.evidence || item.snippet || item.context || "No evidence provided",
				problem: problem,
				fix: item.fix || item.recommendation || item.solution || "No fix provided",
			};

			const result = reviewFindingSchema.safeParse(normalized);
			if (result.success) {
				findings.push(result.data);
			}
		}
	} catch {
		// JSON parse failed completely
	}

	return Object.freeze(findings);
}

function normalizeSeverity(sev: unknown): string {
	if (typeof sev !== "string") return "LOW";
	const upper = sev.toUpperCase();
	if (["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(upper)) return upper;
	return "LOW";
}

function sanitizeMalformedJson(json: string): string {
	let clean = json;
	// Remove trailing commas in objects and arrays
	clean = clean.replace(/,\s*([}\]])/g, "$1");
	// Replace unescaped newlines in strings (basic attempt)
	// This is risky with regex but catches common LLM markdown mistakes
	return clean;
}

export function extractJson(raw: string): string | null {
	const codeBlockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
	if (codeBlockMatch) {
		return codeBlockMatch[1].trim();
	}

	const objectStart = raw.indexOf("{");
	const arrayStart = raw.indexOf("[");

	if (objectStart === -1 && arrayStart === -1) return null;

	const start =
		objectStart === -1
			? arrayStart
			: arrayStart === -1
				? objectStart
				: Math.min(objectStart, arrayStart);

	let depth = 0;
	let inString = false;
	let escaped = false;
	for (let i = start; i < raw.length; i++) {
		const ch = raw[i];
		if (escaped) {
			escaped = false;
			continue;
		}
		if (ch === "\\" && inString) {
			escaped = true;
			continue;
		}
		if (ch === '"') {
			inString = !inString;
			continue;
		}
		if (inString) continue;
		if (ch === "{" || ch === "[") depth++;
		if (ch === "}" || ch === "]") depth--;
		if (depth === 0) {
			return raw.slice(start, i + 1);
		}
	}

	return null;
}
