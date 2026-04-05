import { architectureVerifier } from "./architecture-verifier";
import { codeHygieneAuditor } from "./code-hygiene-auditor";
import { codeQualityAuditor } from "./code-quality-auditor";
import { contractVerifier } from "./contract-verifier";
import { correctnessAuditor } from "./correctness-auditor";
import { databaseAuditor } from "./database-auditor";
import { frontendAuditor } from "./frontend-auditor";
import { languageIdiomsAuditor } from "./language-idioms-auditor";
import { logicAuditor } from "./logic-auditor";
import { productThinker } from "./product-thinker";
import { redTeam } from "./red-team";
import { securityAuditor } from "./security-auditor";
import { testInterrogator } from "./test-interrogator";

export {
	architectureVerifier,
	codeHygieneAuditor,
	codeQualityAuditor,
	contractVerifier,
	correctnessAuditor,
	databaseAuditor,
	frontendAuditor,
	languageIdiomsAuditor,
	logicAuditor,
	productThinker,
	redTeam,
	securityAuditor,
	testInterrogator,
};

export const REVIEW_AGENTS = Object.freeze([
	logicAuditor,
	securityAuditor,
	codeQualityAuditor,
	testInterrogator,
	codeHygieneAuditor,
	contractVerifier,
] as const);

/** Stage 3 agents: adversarial red team + product completeness. */
export const STAGE3_AGENTS = Object.freeze([redTeam, productThinker] as const);

export const SPECIALIZED_AGENTS = Object.freeze([
	architectureVerifier,
	databaseAuditor,
	correctnessAuditor,
	frontendAuditor,
	languageIdiomsAuditor,
] as const);

export const ALL_REVIEW_AGENTS = Object.freeze([
	...REVIEW_AGENTS,
	...SPECIALIZED_AGENTS,
	...STAGE3_AGENTS,
] as const);
