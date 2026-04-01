import type { AgentEntry, DiversityRule, GroupDefinition, GroupId } from "./types";

export const AGENT_REGISTRY: Readonly<Record<string, AgentEntry>> = Object.freeze({
	// ── Architects ─────────────────────────────────────────────
	// Deep reasoning: system design, task decomposition, orchestration
	"oc-architect": { group: "architects" },
	"oc-planner": { group: "architects" },
	autopilot: { group: "architects" },

	// ── Challengers ────────────────────────────────────────────
	// Adversarial to Architects: critique proposals, enhance ideas
	"oc-critic": { group: "challengers" },
	"oc-challenger": { group: "challengers" },

	// ── Builders ───────────────────────────────────────────────
	// Code generation
	"oc-implementer": { group: "builders" },

	// ── Reviewers ──────────────────────────────────────────────
	// Code analysis, adversarial to Builders
	// NOTE: The 21 internal ReviewAgent objects (logic-auditor, security-auditor,
	// etc.) are NOT in this registry. They use the ReviewAgent type from
	// src/review/types.ts, not AgentConfig. The review pipeline resolves their
	// model via resolveModelForGroup("reviewers") directly.
	"oc-reviewer": { group: "reviewers" },

	// ── Red Team ───────────────────────────────────────────────
	// Final adversarial pass
	// NOTE: red-team and product-thinker are ALSO internal ReviewAgent objects
	// in STAGE3_AGENTS (src/review/agents/index.ts). They appear here so the
	// review pipeline can resolve their model via resolveModelForGroup("red-team")
	// separately from the "reviewers" group.
	"red-team": { group: "red-team" },
	"product-thinker": { group: "red-team" },

	// ── Researchers ────────────────────────────────────────────
	// Domain research, feasibility analysis
	"oc-researcher": { group: "researchers" },
	researcher: { group: "researchers" },

	// ── Communicators ──────────────────────────────────────────
	// Docs, changelogs, lesson extraction
	"oc-shipper": { group: "communicators" },
	documenter: { group: "communicators" },
	"oc-retrospector": { group: "communicators" },

	// ── Utilities ──────────────────────────────────────────────
	// Fast lookups, prompt tuning, PR scanning
	"oc-explorer": { group: "utilities" },
	metaprompter: { group: "utilities" },
	"pr-reviewer": { group: "utilities" },
});

/**
 * All valid group IDs, derived from GROUP_DEFINITIONS keys.
 * Used for iteration and validation.
 */
export const ALL_GROUP_IDS: readonly GroupId[] = Object.freeze([
	"architects",
	"challengers",
	"builders",
	"reviewers",
	"red-team",
	"researchers",
	"communicators",
	"utilities",
]);

export const GROUP_DEFINITIONS: Readonly<Record<GroupId, GroupDefinition>> = Object.freeze({
	architects: {
		id: "architects",
		label: "Architects",
		purpose: "System design, task decomposition, pipeline orchestration",
		recommendation:
			"Most powerful model available. Bad architecture cascades into everything downstream.",
		tier: "heavy",
		order: 1,
	},
	challengers: {
		id: "challengers",
		label: "Challengers",
		purpose: "Challenge architecture proposals, enhance ideas, find design flaws",
		recommendation:
			"Strong model, different family from Architects for genuine adversarial review.",
		tier: "heavy",
		order: 2,
	},
	builders: {
		id: "builders",
		label: "Builders",
		purpose: "Write production code",
		recommendation: "Strong coding model. This is where most tokens are spent.",
		tier: "heavy",
		order: 3,
	},
	reviewers: {
		id: "reviewers",
		label: "Reviewers",
		purpose: "Find bugs, security issues, logic errors in code",
		recommendation:
			"Strong model, different family from Builders to catch different classes of bugs.",
		tier: "heavy",
		order: 4,
	},
	"red-team": {
		id: "red-team",
		label: "Red Team",
		purpose: "Final adversarial pass — hunt exploits, find UX gaps",
		recommendation: "Different family from both Builders and Reviewers for a third perspective.",
		tier: "heavy",
		order: 5,
	},
	researchers: {
		id: "researchers",
		label: "Researchers",
		purpose: "Domain research, feasibility analysis, information gathering",
		recommendation: "Good context window and comprehension. Any model family works.",
		tier: "medium",
		order: 6,
	},
	communicators: {
		id: "communicators",
		label: "Communicators",
		purpose: "Write docs, changelogs, extract lessons",
		recommendation: "Mid-tier model. Clear writing matters more than deep reasoning.",
		tier: "light",
		order: 7,
	},
	utilities: {
		id: "utilities",
		label: "Utilities",
		purpose: "Fast lookups, prompt tuning, PR scanning",
		recommendation:
			"Fastest available model. Speed over intelligence — don't waste expensive tokens on grep.",
		tier: "light",
		order: 8,
	},
});

export const DIVERSITY_RULES: readonly DiversityRule[] = Object.freeze([
	{
		groups: ["architects", "challengers"],
		severity: "strong",
		reason:
			"Challengers critique architect output. Same-model review creates confirmation bias — the model agrees with its own reasoning patterns.",
	},
	{
		groups: ["builders", "reviewers"],
		severity: "strong",
		reason:
			"Reviewers find bugs in builder code. Same model shares the same blind spots — it won't catch errors it would also make.",
	},
	{
		groups: ["red-team", "builders", "reviewers"],
		severity: "soft",
		reason:
			"Red Team is most effective as a third perspective. If you only have 2 model families, use whichever isn't assigned to Reviewers.",
	},
]);
