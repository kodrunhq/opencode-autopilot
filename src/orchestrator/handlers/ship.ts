import type { LoopContext, VerificationResult } from "../../autonomy/types";
import { summarizeVerificationResult, VerificationHandler } from "../../autonomy/verification";
import { fileExists } from "../../utils/fs-helpers";
import { getProjectRootFromArtifactDir } from "../../utils/paths";
import { getArtifactRef, getPhaseDir } from "../artifacts";
import {
	createDeliveryManifest,
	createPendingVerificationSummary,
	renderDeliveryPrTitle,
	type VerificationSummary,
} from "../delivery-manifest";
import { type GitHubChecksPollResult, pollRequiredGitHubChecks } from "../github-checks";
import { buildReviewGateMessage } from "../review-runner";
import { isPassingTrancheOracleSignoff } from "../signoff";
import type { PipelineVerificationStatus } from "../types";
import {
	buildPrBody,
	initBranchLifecycle,
	recordPrCreation,
	recordVerificationSummary,
	shouldCreatePr,
} from "./branch-pr";
import { cloneBranchLifecycle } from "./build-utils";
import type { DispatchResult, PhaseHandler } from "./types";
import { AGENT_NAMES } from "./types";

const PR_URL_PATTERN = /https?:\/\/[^\s)]+\/pull\/(\d+)(?:[/?#][^\s)]*)?/i;

export interface ShipHandlerDeps {
	readonly runLocalVerification?: (
		projectRoot: string,
		artifactPaths: readonly string[],
	) => Promise<VerificationResult>;
	readonly pollGitHubChecks?: (input: {
		readonly prNumber: number;
		readonly projectRoot: string;
	}) => Promise<GitHubChecksPollResult>;
}

function createShipVerificationContext(): LoopContext {
	const now = new Date().toISOString();
	return {
		taskDescription: "ship tranche",
		maxIterations: 1,
		currentIteration: 1,
		state: "verifying",
		startedAt: now,
		lastIterationAt: now,
		accumulatedContext: [],
		verificationResults: [],
		oracleVerification: null,
	};
}

function extractCreatedPr(
	resultText: string,
): { readonly prNumber: number; readonly prUrl: string } | null {
	const match = resultText.match(PR_URL_PATTERN);
	if (!match) return null;

	const prNumber = Number(match[1]);
	if (!Number.isInteger(prNumber) || prNumber < 1) {
		return null;
	}

	return Object.freeze({
		prNumber,
		prUrl: match[0],
	});
}

function getShipArtifactPaths(
	artifactDir: string,
	runId: string,
): {
	readonly walkthrough: string;
	readonly changelog: string;
	readonly decisions: string;
} {
	return Object.freeze({
		walkthrough: getArtifactRef(artifactDir, "SHIP", "walkthrough.md", runId),
		changelog: getArtifactRef(artifactDir, "SHIP", "changelog.md", runId),
		decisions: getArtifactRef(artifactDir, "SHIP", "decisions.md", runId),
	});
}

async function getShipArtifactsState(
	artifactDir: string,
	runId: string,
): Promise<{
	readonly shipDir: string;
	readonly paths: ReturnType<typeof getShipArtifactPaths>;
	readonly hasArtifacts: boolean;
}> {
	const shipDir = getPhaseDir(artifactDir, "SHIP", runId);
	const paths = getShipArtifactPaths(artifactDir, runId);
	const [walkthroughExists, changelogExists, decisionsExists] = await Promise.all([
		fileExists(paths.walkthrough),
		fileExists(paths.changelog),
		fileExists(paths.decisions),
	]);

	return Object.freeze({
		shipDir,
		paths,
		hasArtifacts: walkthroughExists || changelogExists || decisionsExists,
	});
}

function mapGitHubChecksToVerificationSummary(
	localVerification: VerificationResult,
	ciResult: GitHubChecksPollResult,
): VerificationSummary {
	const status =
		localVerification.status === "FAILED" || ciResult.status === "FAILED"
			? "FAILED"
			: localVerification.status === "BLOCKED" || ciResult.status === "BLOCKED"
				? "BLOCKED"
				: localVerification.status === "PENDING" || ciResult.status === "PENDING"
					? "PENDING"
					: "PASSED";

	const localSummary = summarizeVerificationResult(localVerification);
	const ciSummary = ciResult.summary;
	const summary =
		status === "PASSED"
			? "Required local verification and GitHub CI checks passed."
			: status === "FAILED"
				? `Delivery blocked by failed checks. ${localSummary} ${ciSummary}`.trim()
				: status === "BLOCKED"
					? `Delivery blocked until verification evidence is available. ${localSummary} ${ciSummary}`.trim()
					: `Delivery is waiting on outstanding verification or CI checks. ${localSummary} ${ciSummary}`.trim();

	return Object.freeze({
		status,
		summary: summary.slice(0, 4096),
		localSummary: localSummary.slice(0, 4096),
		ciSummary: ciSummary.slice(0, 4096),
	});
}

function buildPipelineVerificationStatus(
	localVerification: VerificationResult,
	ciResult: GitHubChecksPollResult,
	verificationSummary: VerificationSummary,
): PipelineVerificationStatus {
	const status: PipelineVerificationStatus["status"] =
		verificationSummary.status === "SKIPPED_WITH_REASON" ? "PASSED" : verificationSummary.status;

	return Object.freeze({
		status,
		summary: verificationSummary.summary,
		localStatus: localVerification.status,
		localSummary: verificationSummary.localSummary,
		ciStatus: ciResult.status,
		ciSummary: verificationSummary.ciSummary,
		updatedAt: new Date().toISOString(),
	});
}

async function defaultRunLocalVerification(
	projectRoot: string,
	artifactPaths: readonly string[],
): Promise<VerificationResult> {
	const handler = new VerificationHandler({ projectRoot, artifactPaths });
	return handler.verify(createShipVerificationContext());
}

function buildPrInstructions(state: Parameters<PhaseHandler>[0]): string {
	const branchLifecycle =
		state.branchLifecycle ??
		initBranchLifecycle({
			runId: state.runId,
			baseBranch: "main",
			description: state.idea,
			programId: state.programContext?.programId,
			trancheId: state.programContext?.trancheId,
		});
	if (!shouldCreatePr(branchLifecycle)) return "";

	const manifest = createDeliveryManifest({
		state: {
			...state,
			branchLifecycle,
		},
		verificationSummary: createPendingVerificationSummary(),
	});

	return [
		"",
		"## PR Creation Instructions",
		`Create a pull request from branch \`${manifest.branchName}\` into \`${branchLifecycle.baseBranch ?? "main"}\`.`,
		`Title: ${renderDeliveryPrTitle(manifest)}`,
		"",
		"PR body:",
		"```markdown",
		buildPrBody(manifest),
		"```",
	].join("\n");
}

async function evaluateShipGates(
	state: Parameters<PhaseHandler>[0],
	artifactDir: string,
	branchLifecycle: NonNullable<Parameters<PhaseHandler>[0]["branchLifecycle"]>,
	deps: ShipHandlerDeps,
): Promise<DispatchResult> {
	const projectRoot = getProjectRootFromArtifactDir(artifactDir);
	const shipArtifacts = getShipArtifactPaths(artifactDir, state.runId);
	const localVerification = await (deps.runLocalVerification ?? defaultRunLocalVerification)(
		projectRoot,
		[shipArtifacts.walkthrough, shipArtifacts.changelog, shipArtifacts.decisions],
	);

	let ciResult: GitHubChecksPollResult;
	if (branchLifecycle.prNumber !== null) {
		ciResult = await (deps.pollGitHubChecks ?? pollRequiredGitHubChecks)({
			prNumber: branchLifecycle.prNumber,
			projectRoot,
		});
	} else if (shouldCreatePr(branchLifecycle)) {
		ciResult = Object.freeze({
			status: "BLOCKED",
			summary: "Required pull request metadata is missing, so GitHub CI checks cannot be polled.",
			checks: [],
			attempts: 1,
		} satisfies GitHubChecksPollResult);
	} else {
		ciResult = Object.freeze({
			status: "SKIPPED_WITH_REASON",
			summary:
				"No pull request is required for this delivery state, so remote GitHub checks were skipped.",
			checks: [],
			attempts: 1,
		} satisfies GitHubChecksPollResult);
	}

	const verificationSummary = mapGitHubChecksToVerificationSummary(localVerification, ciResult);
	const verificationStatus = buildPipelineVerificationStatus(
		localVerification,
		ciResult,
		verificationSummary,
	);
	const nextBranchLifecycle = recordVerificationSummary(
		branchLifecycle,
		verificationSummary.summary,
	);
	const manifest = createDeliveryManifest({
		state: {
			...state,
			branchLifecycle: nextBranchLifecycle,
		},
		verificationSummary,
	});

	if (verificationSummary.status === "FAILED") {
		return Object.freeze({
			action: "error",
			code: ciResult.status === "FAILED" ? "E_SHIP_CI_FAILED" : "E_SHIP_VERIFICATION_FAILED",
			phase: "SHIP",
			message: manifest.verificationSummary.summary,
			progress: "SHIP blocked by failed verification or CI checks",
			_stateUpdates: {
				branchLifecycle: cloneBranchLifecycle(nextBranchLifecycle),
				verificationStatus,
			},
		} satisfies DispatchResult);
	}

	if (verificationSummary.status === "BLOCKED") {
		return Object.freeze({
			action: "error",
			code: ciResult.status === "BLOCKED" ? "E_SHIP_CI_BLOCKED" : "E_SHIP_VERIFICATION_BLOCKED",
			phase: "SHIP",
			message: manifest.verificationSummary.summary,
			progress: "SHIP blocked until verification evidence is available",
			_stateUpdates: {
				branchLifecycle: cloneBranchLifecycle(nextBranchLifecycle),
				verificationStatus,
			},
		} satisfies DispatchResult);
	}

	if (verificationSummary.status === "PENDING") {
		return Object.freeze({
			action: "error",
			code: "E_SHIP_CI_PENDING",
			phase: "SHIP",
			message: manifest.verificationSummary.summary,
			progress: "SHIP waiting for required GitHub checks",
			_stateUpdates: {
				branchLifecycle: cloneBranchLifecycle(nextBranchLifecycle),
				verificationStatus,
			},
		} satisfies DispatchResult);
	}

	return Object.freeze({
		action: "complete",
		resultKind: "phase_output",
		phase: "SHIP",
		progress: "Shipping complete — docs, verification, and CI gates passed",
		_stateUpdates: {
			branchLifecycle: cloneBranchLifecycle(nextBranchLifecycle),
			verificationStatus,
		},
	} satisfies DispatchResult);
}

export function createShipHandler(deps: ShipHandlerDeps = {}): PhaseHandler {
	return async (state, artifactDir, result) => {
		const { shipDir, hasArtifacts } = await getShipArtifactsState(artifactDir, state.runId);
		const branchLifecycle =
			state.branchLifecycle ??
			initBranchLifecycle({
				runId: state.runId,
				baseBranch: "main",
				description: state.idea,
				programId: state.programContext?.programId,
				trancheId: state.programContext?.trancheId,
			});
		const reviewGateMessage = buildReviewGateMessage(state.reviewStatus);
		if (reviewGateMessage) {
			return Object.freeze({
				action: "error",
				code: "E_SHIP_REVIEW_BLOCKED",
				phase: "SHIP",
				message: reviewGateMessage,
				progress: "SHIP blocked by review policy",
				_stateUpdates:
					state.branchLifecycle === null
						? { branchLifecycle: cloneBranchLifecycle(branchLifecycle) }
						: undefined,
			} satisfies DispatchResult);
		}

		if (state.reviewStatus.status === "RUNNING" || state.reviewStatus.status === "PLANNED") {
			return Object.freeze({
				action: "error",
				code: "E_SHIP_REVIEW_PENDING",
				phase: "SHIP",
				message: "Structured review is still running. Wait for required reviewers to finish.",
				progress: "SHIP waiting for review stage",
				_stateUpdates:
					state.branchLifecycle === null
						? { branchLifecycle: cloneBranchLifecycle(branchLifecycle) }
						: undefined,
			} satisfies DispatchResult);
		}

		const trancheSignoff = state.oracleSignoffs.tranche;
		if (!trancheSignoff) {
			return Object.freeze({
				action: "error",
				code: "E_ORACLE_TRANCHE_SIGNOFF_REQUIRED",
				phase: "SHIP",
				message: "SHIP requires a passing tranche Oracle signoff before delivery can continue.",
				progress: "SHIP blocked by missing Oracle tranche signoff",
				_stateUpdates:
					state.branchLifecycle === null
						? { branchLifecycle: cloneBranchLifecycle(branchLifecycle) }
						: undefined,
			} satisfies DispatchResult);
		}

		if (!isPassingTrancheOracleSignoff(trancheSignoff)) {
			return Object.freeze({
				action: "error",
				code: "E_ORACLE_TRANCHE_SIGNOFF_FAILED",
				phase: "SHIP",
				message: trancheSignoff.reasoning,
				progress: "SHIP blocked by Oracle tranche signoff",
				_stateUpdates:
					state.branchLifecycle === null
						? { branchLifecycle: cloneBranchLifecycle(branchLifecycle) }
						: undefined,
			} satisfies DispatchResult);
		}

		if (result) {
			if (!hasArtifacts) {
				return Object.freeze({
					action: "error",
					phase: "SHIP",
					message: `SHIP agent returned a result but did not write required artifacts in ${shipDir}. At least one of walkthrough.md, decisions.md, or changelog.md must exist.`,
				} satisfies DispatchResult);
			}

			const createdPr = branchLifecycle.prNumber === null ? extractCreatedPr(result) : null;
			const effectiveBranchLifecycle =
				createdPr === null
					? branchLifecycle
					: recordPrCreation(branchLifecycle, createdPr.prNumber, createdPr.prUrl);

			return evaluateShipGates(state, artifactDir, effectiveBranchLifecycle, deps);
		}

		if (hasArtifacts) {
			return evaluateShipGates(state, artifactDir, branchLifecycle, deps);
		}

		const reconRef = getArtifactRef(artifactDir, "RECON", "report.md", state.runId);
		const challengeRef = getArtifactRef(artifactDir, "CHALLENGE", "brief.md", state.runId);
		const architectRef = getArtifactRef(artifactDir, "ARCHITECT", "design.md", state.runId);
		const tasksJsonRef = getArtifactRef(artifactDir, "PLAN", "tasks.json", state.runId);
		const tasksMarkdownRef = getArtifactRef(artifactDir, "PLAN", "tasks.md", state.runId);
		const planRef = (await fileExists(tasksJsonRef)) ? tasksJsonRef : tasksMarkdownRef;
		const prInstructions = buildPrInstructions({
			...state,
			branchLifecycle,
		});

		const prompt = [
			"Review all prior phase artifacts:",
			`${reconRef},`,
			`${challengeRef},`,
			`${architectRef},`,
			`${planRef}.`,
			"Produce walkthrough.md (architecture overview),",
			"decisions.md (key decisions with rationale),",
			"changelog.md (user-facing changes).",
			`Write output to ${shipDir}/.`,
			prInstructions,
		]
			.filter(Boolean)
			.join(" ");

		return Object.freeze({
			action: "dispatch",
			agent: AGENT_NAMES.SHIP,
			resultKind: "phase_output",
			prompt,
			phase: "SHIP",
			progress: "Dispatching shipper",
			_stateUpdates:
				state.branchLifecycle === null
					? { branchLifecycle: cloneBranchLifecycle(branchLifecycle) }
					: undefined,
		} satisfies DispatchResult);
	};
}

export const handleShip: PhaseHandler = createShipHandler();
