import type { AgentEntry, DiversityRule, GroupDefinition, GroupId } from "./types";

function deepFreeze<T extends object>(obj: T): Readonly<T> {
	for (const value of Object.values(obj)) {
		if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
			deepFreeze(value as object);
		}
	}
	return Object.freeze(obj);
}

export const AGENT_REGISTRY: Readonly<Record<string, AgentEntry>> = deepFreeze({
	// ── Architects ─────────────────────────────────────────────
	"oc-architect": { group: "architects" },
	"oc-planner": { group: "architects" },
	autopilot: { group: "architects" },
	planner: { group: "architects" },

	// ── Challengers ────────────────────────────────────────────
	"oc-critic": { group: "challengers" },
	"oc-challenger": { group: "challengers" },

	// ── Builders ───────────────────────────────────────────────
	"oc-implementer": { group: "builders" },
	coder: { group: "builders" },
	debugger: { group: "builders" },

	// ── Reviewers ──────────────────────────────────────────────
	"oc-reviewer": { group: "reviewers" },
	reviewer: { group: "reviewers" },

	// ── Red Team ───────────────────────────────────────────────
	"red-team": { group: "red-team" },
	"product-thinker": { group: "red-team" },

	// ── Researchers ────────────────────────────────────────────
	"oc-researcher": { group: "researchers" },
	researcher: { group: "researchers" },

	// ── Communicators ──────────────────────────────────────────
	"oc-shipper": { group: "communicators" },

	// ── Utilities ──────────────────────────────────────────────
	metaprompter: { group: "utilities" },
	"pr-reviewer": { group: "utilities" },
	"security-auditor": { group: "reviewers" },
});

export const GROUP_DEFINITIONS: Readonly<Record<GroupId, GroupDefinition>> = deepFreeze({
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

/**
 * All valid group IDs, derived from GROUP_DEFINITIONS and sorted by order.
 * Adding a new group to GROUP_DEFINITIONS auto-includes it here.
 */
export const ALL_GROUP_IDS: readonly GroupId[] = Object.freeze(
	[...(Object.values(GROUP_DEFINITIONS) as GroupDefinition[])]
		.sort((a: GroupDefinition, b: GroupDefinition) => a.order - b.order)
		.map((d: GroupDefinition) => d.id),
);

export const DIVERSITY_RULES: readonly DiversityRule[] = Object.freeze([
	Object.freeze({
		groups: Object.freeze(["architects", "challengers"] as const),
		severity: "strong" as const,
		reason:
			"Challengers critique architect output. Same-model review creates confirmation bias — the model agrees with its own reasoning patterns.",
	}),
	Object.freeze({
		groups: Object.freeze(["builders", "reviewers"] as const),
		severity: "strong" as const,
		reason:
			"Reviewers find bugs in builder code. Same model shares the same blind spots — it won't catch errors it would also make.",
	}),
	Object.freeze({
		groups: Object.freeze(["red-team", "builders", "reviewers"] as const),
		severity: "soft" as const,
		reason:
			"Red Team is most effective as a third perspective. If you only have 2 model families, use whichever isn't assigned to Reviewers.",
	}),
]);
