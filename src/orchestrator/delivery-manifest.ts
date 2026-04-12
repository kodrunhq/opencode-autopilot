import { z } from "zod";
import type { BranchLifecycle, PipelineState, Task } from "./types";

const MAX_PROGRAM_ID_LENGTH = 24;
const MAX_TRANCHE_ID_LENGTH = 16;
const MAX_TITLE_SLUG_LENGTH = 40;
const MAX_HUMAN_TITLE_LENGTH = 72;

export const commitStrategyPolicySchema = z.enum(["per_task", "per_wave", "squash"]);

export type CommitStrategyPolicy = z.infer<typeof commitStrategyPolicySchema>;

export const deliverySummarySchema = z.object({
	verdict: z.string().max(32),
	summary: z.string().max(4096),
});

export const deliveryGateStatusSchema = z.enum([
	"PASSED",
	"FAILED",
	"BLOCKED",
	"PENDING",
	"SKIPPED_WITH_REASON",
]);

export type DeliveryGateStatus = z.infer<typeof deliveryGateStatusSchema>;

export const commitPlanItemSchema = z.object({
	id: z.string().max(128),
	scope: z.enum(["task", "wave", "tranche"]),
	title: z.string().max(512),
	recommendedMessage: z.string().max(256),
});

export const commitPlanSchema = z.object({
	policy: commitStrategyPolicySchema,
	summary: z.string().max(2048),
	items: z.array(commitPlanItemSchema).max(200),
});

export const verificationSummarySchema = z.object({
	status: deliveryGateStatusSchema,
	summary: z.string().max(4096),
	localSummary: z.string().max(4096),
	ciSummary: z.string().max(4096),
});

export const deliveryManifestSchema = z.object({
	programId: z.string().max(128),
	trancheId: z.string().max(128),
	humanTitle: z.string().max(256),
	branchName: z.string().max(256),
	commitPlan: commitPlanSchema,
	reviewSummary: deliverySummarySchema,
	oracleSummary: deliverySummarySchema,
	verificationSummary: verificationSummarySchema,
	residualRisks: z.array(z.string().max(1024)).max(100),
	remainingBacklog: z.array(z.string().max(1024)).max(100),
	nextTranche: z.string().max(1024).nullable(),
});

export type DeliveryManifest = z.infer<typeof deliveryManifestSchema>;
export type DeliverySummary = z.infer<typeof deliverySummarySchema>;
export type VerificationSummary = z.infer<typeof verificationSummarySchema>;

function collapseWhitespace(value: string): string {
	return value.replace(/\s+/g, " ").trim();
}

export function toHumanTitle(value: string | null | undefined): string {
	const normalized = collapseWhitespace(value ?? "").replace(/[.!?]+$/g, "");
	const fallback = normalized.length > 0 ? normalized : "Autopilot delivery tranche";
	return fallback.slice(0, MAX_HUMAN_TITLE_LENGTH);
}

export function slugifyDeliverySegment(
	value: string | null | undefined,
	maxLength: number,
	fallback: string,
): string {
	const normalized = (value ?? "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, maxLength)
		.replace(/-+$/g, "");

	return normalized.length > 0 ? normalized : fallback;
}

function buildRecommendedCommitMessage(scope: string, title: string): string {
	const normalizedTitle = collapseWhitespace(title).toLowerCase();
	const stem = normalizedTitle.length > 0 ? normalizedTitle : "delivery update";
	return `${scope}: ${stem}`.slice(0, 72);
}

export function deriveProgramId(runId: string, humanTitle: string): string {
	const titleSlug = slugifyDeliverySegment(humanTitle, 18, "program");
	const runSuffix = slugifyDeliverySegment(runId.replace(/^run[_-]?/i, ""), 6, "000000");
	return `${titleSlug}-${runSuffix}`.slice(0, MAX_PROGRAM_ID_LENGTH);
}

export function deriveTrancheId(runId: string, explicitTrancheId?: string | null): string {
	if (explicitTrancheId) {
		return slugifyDeliverySegment(explicitTrancheId, MAX_TRANCHE_ID_LENGTH, "t-01");
	}

	const runSuffix = slugifyDeliverySegment(runId.replace(/^run[_-]?/i, ""), 10, "00000000");
	return `t-${runSuffix}`.slice(0, MAX_TRANCHE_ID_LENGTH);
}

export function computeManifestBranchName(
	programId: string,
	trancheId: string,
	humanTitle: string,
): string {
	const programSegment = slugifyDeliverySegment(programId, MAX_PROGRAM_ID_LENGTH, "program");
	const trancheSegment = slugifyDeliverySegment(trancheId, MAX_TRANCHE_ID_LENGTH, "t-01");
	const titleSegment = slugifyDeliverySegment(humanTitle, MAX_TITLE_SLUG_LENGTH, "delivery");
	return `autopilot/${programSegment}/${trancheSegment}/${titleSegment}`;
}

function defaultReviewSummary(
	rawSummary?: string | null,
	rawVerdict?: string | null,
): DeliverySummary {
	return Object.freeze({
		verdict: rawVerdict ?? (rawSummary ? "APPROVED" : "NOT_RUN"),
		summary: rawSummary ?? "No tranche review summary recorded yet.",
	});
}

function defaultOracleSummary(rawSummary?: string | null): DeliverySummary {
	return Object.freeze({
		verdict: rawSummary ? "APPROVED" : "NOT_REQUIRED",
		summary: rawSummary ?? "No Oracle escalation was required for this tranche.",
	});
}

export function createPendingVerificationSummary(): VerificationSummary {
	return Object.freeze({
		status: "PENDING",
		summary: "Required local verification and remote CI checks are still pending.",
		localSummary: "Local verification has not completed yet.",
		ciSummary: "GitHub CI checks have not completed yet.",
	});
}

function buildCommitPlanItems(
	tasks: readonly Task[],
	policy: CommitStrategyPolicy,
): readonly z.infer<typeof commitPlanItemSchema>[] {
	const actionableTasks = tasks.filter(
		(task) => task.status === "DONE" || task.status === "FAILED",
	);

	if (policy === "squash") {
		return Object.freeze([
			{
				id: "tranche",
				scope: "tranche" as const,
				title: "Squash commit for the tranche",
				recommendedMessage: buildRecommendedCommitMessage("chore", "squash tranche delivery"),
			},
		]);
	}

	if (policy === "per_wave") {
		const waves = [...new Set(actionableTasks.map((task) => task.wave))].sort((a, b) => a - b);
		return Object.freeze(
			waves.map((wave) => ({
				id: `wave-${wave}`,
				scope: "wave" as const,
				title: `Wave ${wave} delivery`,
				recommendedMessage: buildRecommendedCommitMessage("feat", `complete wave ${wave}`),
			})),
		);
	}

	const perTaskItems = actionableTasks.length > 0 ? actionableTasks : tasks;
	return Object.freeze(
		perTaskItems.map((task) => ({
			id: `task-${task.id}`,
			scope: "task" as const,
			title: `Task ${task.id}: ${task.title}`,
			recommendedMessage: buildRecommendedCommitMessage("feat", task.title),
		})),
	);
}

export function createCommitPlan(
	tasks: readonly Task[],
	policy: CommitStrategyPolicy = "per_task",
): z.infer<typeof commitPlanSchema> {
	const items = buildCommitPlanItems(tasks, policy);
	const summary =
		policy === "squash"
			? "Squash commits only when policy explicitly allows it; opaque default squashing is disabled."
			: policy === "per_wave"
				? "Default delivery groups commits by implementation wave so each wave stays reviewable."
				: "Default delivery creates a deliberate commit per task; one opaque tranche commit is not allowed by default.";

	return commitPlanSchema.parse({
		policy,
		summary,
		items,
	});
}

function buildRemainingBacklog(tasks: readonly Task[]): readonly string[] {
	return tasks
		.filter((task) => task.status !== "DONE" && task.status !== "SKIPPED")
		.map((task) => `Task ${task.id}: ${task.title} [${task.status}]`);
}

function buildResidualRisks(
	tasks: readonly Task[],
	reviewSummary: DeliverySummary,
	oracleSummary: DeliverySummary,
	verificationSummary: VerificationSummary,
): readonly string[] {
	const risks: string[] = [];

	for (const task of tasks) {
		if (task.status === "FAILED" || task.status === "BLOCKED") {
			risks.push(`Task ${task.id} remains ${task.status.toLowerCase()}: ${task.title}`);
		}
	}

	if (!["APPROVED", "NOT_RUN"].includes(reviewSummary.verdict)) {
		risks.push(reviewSummary.summary);
	}

	if (!["APPROVED", "NOT_REQUIRED"].includes(oracleSummary.verdict)) {
		risks.push(oracleSummary.summary);
	}

	if (verificationSummary.status !== "PASSED") {
		risks.push(verificationSummary.summary);
	}

	return Object.freeze(risks);
}

function buildNextTranche(
	remainingBacklog: readonly string[],
	residualRisks: readonly string[],
): string | null {
	if (remainingBacklog.length > 0) {
		return "Follow up with the next tranche to clear the remaining backlog before final delivery.";
	}

	if (residualRisks.length > 0) {
		return "Schedule a hardening tranche to close the recorded residual risks.";
	}

	return null;
}

export interface DeliveryManifestInput {
	readonly state: Readonly<PipelineState>;
	readonly branchLifecycle?: Readonly<BranchLifecycle> | null;
	readonly verificationSummary?: VerificationSummary;
}

export function createDeliveryManifest(input: DeliveryManifestInput): DeliveryManifest {
	const lifecycle = input.branchLifecycle ?? input.state.branchLifecycle;
	const programIdentity = input.state.programContext;
	const humanTitle =
		lifecycle?.humanTitle ??
		input.state.programContext?.trancheTitle ??
		toHumanTitle(input.state.idea);
	const programId =
		programIdentity?.programId ??
		lifecycle?.programId ??
		deriveProgramId(input.state.runId, humanTitle);
	const trancheId =
		programIdentity?.trancheId ??
		lifecycle?.trancheId ??
		deriveTrancheId(input.state.runId, lifecycle?.trancheId);
	const shouldRecomputeBranchName =
		programIdentity !== null &&
		(lifecycle?.programId !== programIdentity.programId ||
			lifecycle?.trancheId !== programIdentity.trancheId);
	const branchName =
		shouldRecomputeBranchName ||
		lifecycle?.currentBranch === null ||
		lifecycle?.currentBranch === undefined
			? computeManifestBranchName(programId, trancheId, humanTitle)
			: lifecycle.currentBranch;
	const commitPolicy = lifecycle?.commitStrategy ?? "per_task";
	const commitPlan = createCommitPlan(input.state.tasks, commitPolicy);
	const reviewSummary =
		input.state.reviewStatus.status !== "IDLE"
			? defaultReviewSummary(
					input.state.reviewStatus.summary ?? lifecycle?.reviewSummary ?? null,
					input.state.reviewStatus.verdict ?? null,
				)
			: defaultReviewSummary(lifecycle?.reviewSummary ?? null);
	const oracleSummary = defaultOracleSummary(lifecycle?.oracleSummary ?? null);
	const verificationSummary = input.verificationSummary ?? createPendingVerificationSummary();
	const remainingBacklog = buildRemainingBacklog(input.state.tasks);
	const residualRisks = buildResidualRisks(
		input.state.tasks,
		reviewSummary,
		oracleSummary,
		verificationSummary,
	);
	const nextTranche = buildNextTranche(remainingBacklog, residualRisks);

	return deliveryManifestSchema.parse({
		programId,
		trancheId,
		humanTitle,
		branchName,
		commitPlan,
		reviewSummary,
		oracleSummary,
		verificationSummary,
		residualRisks,
		remainingBacklog,
		nextTranche,
	});
}

export function summarizeReviewOutcome(resultText: string): DeliverySummary {
	const trimmed = collapseWhitespace(resultText);
	if (trimmed.length === 0) {
		return defaultReviewSummary();
	}

	try {
		const parsed = JSON.parse(resultText) as Record<string, unknown>;
		const reportCandidate: Record<string, unknown> =
			parsed.report && typeof parsed.report === "object"
				? (parsed.report as Record<string, unknown>)
				: parsed;
		const summary =
			typeof reportCandidate.summary === "string"
				? reportCandidate.summary
				: typeof parsed.message === "string"
					? parsed.message
					: trimmed;
		const verdict =
			typeof reportCandidate.verdict === "string" ? reportCandidate.verdict : "APPROVED";
		return deliverySummarySchema.parse({ verdict, summary });
	} catch {
		return deliverySummarySchema.parse({
			verdict: trimmed.toLowerCase().includes("critical") ? "BLOCKED" : "APPROVED",
			summary: trimmed.slice(0, 4096),
		});
	}
}

export function summarizeOracleOutcome(input: {
	readonly recommendedAction: string;
	readonly reasoning: string;
}): DeliverySummary {
	const recommendedAction = collapseWhitespace(input.recommendedAction);
	const reasoning = collapseWhitespace(input.reasoning);
	const verdict = /block|stop/i.test(recommendedAction) ? "BLOCKED" : "APPROVED";
	const summary =
		reasoning.length > 0
			? `${recommendedAction}. ${reasoning}`.slice(0, 4096)
			: recommendedAction.slice(0, 4096);
	return deliverySummarySchema.parse({ verdict, summary });
}

export function renderDeliveryPrTitle(manifest: DeliveryManifest): string {
	return manifest.humanTitle.slice(0, 72);
}

function renderList(items: readonly string[], emptyText: string): readonly string[] {
	return items.length > 0 ? items.map((item) => `- ${item}`) : [`- ${emptyText}`];
}

export function renderDeliveryPrBody(manifest: DeliveryManifest): string {
	const lines = [
		"## Scope",
		"",
		`- Program: \`${manifest.programId}\``,
		`- Tranche: \`${manifest.trancheId}\``,
		`- Branch: \`${manifest.branchName}\``,
		`- Commit policy: \`${manifest.commitPlan.policy}\``,
		"",
		"## Commit Plan",
		"",
		manifest.commitPlan.summary,
		"",
		...manifest.commitPlan.items.map((item) => `- ${item.title} -> \`${item.recommendedMessage}\``),
		"",
		"## Review Summary",
		"",
		`**${manifest.reviewSummary.verdict}** — ${manifest.reviewSummary.summary}`,
		"",
		"## Oracle Verdict",
		"",
		`**${manifest.oracleSummary.verdict}** — ${manifest.oracleSummary.summary}`,
		"",
		"## Verification Summary",
		"",
		`**${manifest.verificationSummary.status}** — ${manifest.verificationSummary.summary}`,
		`- Local: ${manifest.verificationSummary.localSummary}`,
		`- CI: ${manifest.verificationSummary.ciSummary}`,
		"",
		"## Remaining Work",
		"",
		...renderList(manifest.remainingBacklog, "No remaining backlog recorded."),
		"",
		"## Residual Risks",
		"",
		...renderList(manifest.residualRisks, "No residual risks recorded."),
		"",
		"## Next Tranche",
		"",
		manifest.nextTranche ?? "No follow-up tranche is currently required.",
	];

	return lines.join("\n");
}
