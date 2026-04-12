import type { BroadRequestAssessment } from "./types";

const BULLET_PATTERN = /^\s*(?:[-*+•]|\d+[.)])\s+(.+?)\s*$/;
const MARKDOWN_HEADING_PATTERN = /^\s{0,3}#{1,6}\s+(.+?)\s*$/;
const LABEL_HEADING_PATTERN = /^\s*([A-Za-z][A-Za-z0-9 /_-]{1,80}):\s*$/;
const IMPLEMENTATION_VERB_PATTERN =
	/\b(add|implement|create|remove|replace|continue|introduce|migrate|refactor|improve|support|persist|plan|queue|advance|ship|verify|review|design|decompose|split)\b/i;

const PREFERRED_SECTION_PATTERNS = Object.freeze([
	/detailed tasks?/i,
	/tasks?/i,
	/workstreams?/i,
	/phases?/i,
	/remediation/i,
]);

const EXCLUDED_SECTION_PATTERNS = Object.freeze([
	/acceptance criteria/i,
	/success criteria/i,
	/non-goals?/i,
	/primary files/i,
	/must do/i,
	/must not do/i,
	/context/i,
]);

const SUCCESS_SECTION_PATTERNS = Object.freeze([/acceptance criteria/i, /success criteria/i]);

const PROGRAM_SCALE_KEYWORDS = Object.freeze([
	/comprehensive/i,
	/remediation/i,
	/roadmap/i,
	/program/i,
	/dossier/i,
	/workstreams?/i,
	/multi[- ]tranche/i,
	/across multiple pr/i,
	/sequenc/i,
	/backlog/i,
]);

export const TRANCHE_DIRECT_ITEM_LIMIT = 4;
export const TARGET_COMPLEXITY_PER_TRANCHE = 3;
export const MAX_ITEMS_PER_TRANCHE = 2;

function normalizeHeading(rawHeading: string): string {
	return rawHeading.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeText(text: string): string {
	return text.replace(/\s+/g, " ").trim();
}

function cleanupItem(rawItem: string): string {
	return normalizeText(rawItem.replace(/^[-–—:;,.\s]+/, "").replace(/[\s;,.]+$/, ""));
}

function dedupePreserveOrder(items: readonly string[]): readonly string[] {
	const seen = new Set<string>();
	const deduped: string[] = [];

	for (const item of items) {
		const normalized = item.toLowerCase();
		if (normalized.length === 0 || seen.has(normalized)) {
			continue;
		}
		seen.add(normalized);
		deduped.push(item);
	}

	return Object.freeze(deduped);
}

function splitIntoSections(request: string): ReadonlyMap<string, readonly string[]> {
	const sections = new Map<string, string[]>();
	let currentHeading = "body";
	sections.set(currentHeading, []);

	for (const line of request.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (trimmed.length === 0) {
			continue;
		}

		const markdownHeading = MARKDOWN_HEADING_PATTERN.exec(trimmed);
		if (markdownHeading) {
			currentHeading = normalizeHeading(markdownHeading[1]);
			if (!sections.has(currentHeading)) {
				sections.set(currentHeading, []);
			}
			continue;
		}

		const labelHeading = LABEL_HEADING_PATTERN.exec(trimmed);
		if (labelHeading) {
			currentHeading = normalizeHeading(labelHeading[1]);
			if (!sections.has(currentHeading)) {
				sections.set(currentHeading, []);
			}
			continue;
		}

		const bulletMatch = BULLET_PATTERN.exec(trimmed);
		if (!bulletMatch) {
			continue;
		}

		const cleaned = cleanupItem(bulletMatch[1]);
		if (cleaned.length === 0) {
			continue;
		}

		sections.get(currentHeading)?.push(cleaned);
	}

	return sections;
}

function matchesAnyPattern(value: string, patterns: readonly RegExp[]): boolean {
	return patterns.some((pattern) => pattern.test(value));
}

function extractSectionItems(sections: ReadonlyMap<string, readonly string[]>): readonly string[] {
	const preferred = [...sections.entries()].find(
		([heading, items]) =>
			items.length >= 2 &&
			matchesAnyPattern(heading, PREFERRED_SECTION_PATTERNS) &&
			!matchesAnyPattern(heading, EXCLUDED_SECTION_PATTERNS),
	);
	if (preferred) {
		return dedupePreserveOrder(preferred[1]);
	}

	const fallbackItems = [...sections.entries()]
		.filter(
			([heading, items]) =>
				items.length > 0 && !matchesAnyPattern(heading, EXCLUDED_SECTION_PATTERNS),
		)
		.flatMap(([, items]) => items);

	return dedupePreserveOrder(fallbackItems);
}

function extractSentenceItems(request: string): readonly string[] {
	const sentences = request
		.replace(/\r/g, "")
		.split(/\n{2,}|[.;]\s+/)
		.map((segment) => cleanupItem(segment))
		.filter((segment) => segment.length >= 24 && IMPLEMENTATION_VERB_PATTERN.test(segment));

	return dedupePreserveOrder(sentences);
}

function extractSuccessCriteria(
	sections: ReadonlyMap<string, readonly string[]>,
	workItems: readonly string[],
): readonly string[] {
	const explicit = [...sections.entries()].find(
		([heading, items]) => items.length > 0 && matchesAnyPattern(heading, SUCCESS_SECTION_PATTERNS),
	);
	if (explicit) {
		return dedupePreserveOrder(explicit[1].slice(0, 10));
	}

	return Object.freeze(
		workItems
			.slice(0, 3)
			.map((item) => `Deliver ${item}`)
			.slice(0, Math.max(1, workItems.length)),
	);
}

function inferBroadReasons(request: string, workItems: readonly string[]): readonly string[] {
	const reasons: string[] = [];
	if (workItems.length >= 2) {
		reasons.push(`detected ${workItems.length} independent work items`);
	}
	if (BULLET_PATTERN.test(request)) {
		reasons.push("detected structured task list");
	}
	if (PROGRAM_SCALE_KEYWORDS.some((pattern) => pattern.test(request))) {
		reasons.push("request contains program-scale keywords");
	}
	if (request.length >= 700) {
		reasons.push("request is large enough to exceed a single safe tranche");
	}
	return Object.freeze(reasons);
}

export function assessBroadRequest(request: string): BroadRequestAssessment {
	const sections = splitIntoSections(request);
	const sectionItems = extractSectionItems(sections);
	const sentenceItems = sectionItems.length >= 2 ? [] : extractSentenceItems(request);
	const workItems = dedupePreserveOrder(
		(sectionItems.length >= 2 ? sectionItems : sentenceItems).filter((item) => item.length > 0),
	);
	const reasons = inferBroadReasons(request, workItems);
	const successCriteria = extractSuccessCriteria(sections, workItems);
	const isBroad = workItems.length >= 2 && reasons.length > 0;

	return Object.freeze({
		isBroad,
		workItems,
		successCriteria,
		reasons,
	});
}

export function scoreWorkItemComplexity(item: string): number {
	let score = 1;
	if (item.length > 120) {
		score += 1;
	}
	if (/[;,]/.test(item) || /\band\b/i.test(item)) {
		score += 1;
	}
	return Math.min(score, 2);
}

export function groupWorkItemsIntoTranches(
	workItems: readonly string[],
): readonly (readonly string[])[] {
	if (workItems.length <= 1) {
		return Object.freeze([Object.freeze([...workItems])]);
	}

	if (workItems.length <= TRANCHE_DIRECT_ITEM_LIMIT) {
		return Object.freeze(workItems.map((item) => Object.freeze([item])));
	}

	const tranches: string[][] = [];
	let currentTranche: string[] = [];
	let currentComplexity = 0;

	for (const workItem of workItems) {
		const itemComplexity = scoreWorkItemComplexity(workItem);
		const wouldOverflow =
			currentTranche.length >= MAX_ITEMS_PER_TRANCHE ||
			(currentTranche.length > 0 &&
				currentComplexity + itemComplexity > TARGET_COMPLEXITY_PER_TRANCHE);

		if (wouldOverflow) {
			tranches.push(currentTranche);
			currentTranche = [workItem];
			currentComplexity = itemComplexity;
			continue;
		}

		currentTranche.push(workItem);
		currentComplexity += itemComplexity;
	}

	if (currentTranche.length > 0) {
		tranches.push(currentTranche);
	}

	return Object.freeze(tranches.map((group) => Object.freeze([...group])));
}
