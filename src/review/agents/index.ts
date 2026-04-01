import { authFlowVerifier } from "./auth-flow-verifier";
import { codeQualityAuditor } from "./code-quality-auditor";
import { concurrencyChecker } from "./concurrency-checker";
import { contractVerifier } from "./contract-verifier";
import { databaseAuditor } from "./database-auditor";
import { deadCodeScanner } from "./dead-code-scanner";
import { goIdiomsAuditor } from "./go-idioms-auditor";
import { logicAuditor } from "./logic-auditor";
import { productThinker } from "./product-thinker";
import { pythonDjangoAuditor } from "./python-django-auditor";
import { reactPatternsAuditor } from "./react-patterns-auditor";
import { redTeam } from "./red-team";
import { rustSafetyAuditor } from "./rust-safety-auditor";
import { scopeIntentVerifier } from "./scope-intent-verifier";
import { securityAuditor } from "./security-auditor";
import { silentFailureHunter } from "./silent-failure-hunter";
import { specChecker } from "./spec-checker";
import { stateMgmtAuditor } from "./state-mgmt-auditor";
import { testInterrogator } from "./test-interrogator";
import { typeSoundness } from "./type-soundness";
import { wiringInspector } from "./wiring-inspector";

export {
	authFlowVerifier,
	codeQualityAuditor,
	concurrencyChecker,
	contractVerifier,
	databaseAuditor,
	deadCodeScanner,
	goIdiomsAuditor,
	logicAuditor,
	productThinker,
	pythonDjangoAuditor,
	reactPatternsAuditor,
	redTeam,
	rustSafetyAuditor,
	scopeIntentVerifier,
	securityAuditor,
	silentFailureHunter,
	specChecker,
	stateMgmtAuditor,
	testInterrogator,
	typeSoundness,
	wiringInspector,
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

/** The 13 specialized agents added for stack-aware review. */
export const SPECIALIZED_AGENTS = Object.freeze([
	wiringInspector,
	deadCodeScanner,
	specChecker,
	databaseAuditor,
	authFlowVerifier,
	typeSoundness,
	stateMgmtAuditor,
	concurrencyChecker,
	scopeIntentVerifier,
	reactPatternsAuditor,
	goIdiomsAuditor,
	pythonDjangoAuditor,
	rustSafetyAuditor,
] as const);

/** All 21 review agents combined (6 universal + 13 specialized + 2 sequenced). */
export const ALL_REVIEW_AGENTS = Object.freeze([
	...REVIEW_AGENTS,
	...SPECIALIZED_AGENTS,
	...STAGE3_AGENTS,
] as const);
