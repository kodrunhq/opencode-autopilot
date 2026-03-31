import { codeQualityAuditor } from "./code-quality-auditor";
import { contractVerifier } from "./contract-verifier";
import { logicAuditor } from "./logic-auditor";
import { productThinker } from "./product-thinker";
import { redTeam } from "./red-team";
import { securityAuditor } from "./security-auditor";
import { silentFailureHunter } from "./silent-failure-hunter";
import { testInterrogator } from "./test-interrogator";

export {
	codeQualityAuditor,
	contractVerifier,
	logicAuditor,
	productThinker,
	redTeam,
	securityAuditor,
	silentFailureHunter,
	testInterrogator,
};

/** The 6 universal specialist agents (Stage 1 & 2 reviews). */
export const REVIEW_AGENTS = Object.freeze([
	logicAuditor,
	securityAuditor,
	codeQualityAuditor,
	testInterrogator,
	silentFailureHunter,
	contractVerifier,
] as const);

/** Stage 3 agents: adversarial red team + product completeness. */
export const STAGE3_AGENTS = Object.freeze([redTeam, productThinker] as const);

/** All 8 review agents combined. */
export const ALL_REVIEW_AGENTS = Object.freeze([
	logicAuditor,
	securityAuditor,
	codeQualityAuditor,
	testInterrogator,
	silentFailureHunter,
	contractVerifier,
	redTeam,
	productThinker,
] as const);
