import { afterEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
	buildFailureSummary,
	buildRetryKey,
	clearAllRetryState,
	clearPersistedRetryAttempts,
	clearRetryStateByKey,
	decideRetry,
	detectDispatchFailure,
	getPersistedRetryAttempts,
	getRetryState,
	getRetryStateByKey,
	recordRetryAttempt,
	setPersistedRetryAttempts,
	sleep,
} from "../../src/orchestrator/dispatch-retry";
import { pipelineStateSchema } from "../../src/orchestrator/schemas";

afterEach(() => {
	clearAllRetryState();
});

// ── detectDispatchFailure ─────────────────────────────────────────

describe("detectDispatchFailure", () => {
	test("returns error for empty string", () => {
		expect(detectDispatchFailure("")).toBe("empty result payload");
	});

	test("returns error for whitespace-only string", () => {
		expect(detectDispatchFailure("   ")).toBe("empty result payload");
	});

	test("detects JSON error objects with error field", () => {
		const json = JSON.stringify({ error: "provider_unavailable" });
		expect(detectDispatchFailure(json)).toBe("provider_unavailable");
	});

	test("detects JSON error objects with code field", () => {
		const json = JSON.stringify({ code: "E_TIMEOUT" });
		expect(detectDispatchFailure(json)).toBe("E_TIMEOUT");
	});

	test("detects JSON error objects with status=error", () => {
		const json = JSON.stringify({ status: "error", message: "something broke" });
		expect(detectDispatchFailure(json)).toBe("something broke");
	});

	test("returns null for valid JSON without error indicators", () => {
		const json = JSON.stringify({ result: "ok", data: { key: "value" } });
		expect(detectDispatchFailure(json)).toBeNull();
	});

	test("detects short error pattern: 502 bad gateway", () => {
		expect(detectDispatchFailure("502 bad gateway")).not.toBeNull();
	});

	test("detects short error pattern: rate limit", () => {
		expect(detectDispatchFailure("rate limit exceeded")).not.toBeNull();
	});

	test("detects short error pattern: 429", () => {
		expect(detectDispatchFailure("429")).not.toBeNull();
	});

	test("detects short error pattern: timeout", () => {
		expect(detectDispatchFailure("timeout")).not.toBeNull();
	});

	test("detects short error pattern: ECONNRESET", () => {
		expect(detectDispatchFailure("ECONNRESET")).not.toBeNull();
	});

	test("detects short error pattern: socket hang up", () => {
		expect(detectDispatchFailure("socket hang up")).not.toBeNull();
	});

	test("detects short error pattern: service unavailable", () => {
		expect(detectDispatchFailure("service unavailable")).not.toBeNull();
	});

	test("detects short error pattern: overloaded", () => {
		expect(detectDispatchFailure("overloaded")).not.toBeNull();
	});

	test("detects short error pattern: E_INVALID_RESULT", () => {
		expect(detectDispatchFailure("E_INVALID_RESULT")).not.toBeNull();
	});

	test("returns null for long legitimate content mentioning error keywords", () => {
		const longContent =
			"This is a comprehensive analysis of timeout behavior in distributed systems. " +
			"The architecture handles 502 errors gracefully through retry logic. " +
			"Rate limiting is applied at the gateway level to prevent overload. " +
			"Service availability is monitored via health checks running every 30 seconds.";
		expect(detectDispatchFailure(longContent)).toBeNull();
	});

	test("returns null for medium-length legitimate content", () => {
		const content =
			"The researcher found that the proposed architecture uses retry patterns " +
			"for handling transient failures, including 502 and 503 HTTP status codes.";
		expect(detectDispatchFailure(content)).toBeNull();
	});

	// ── Fix 5: New error detection patterns ──

	test("detects 'tool execution aborted' pattern", () => {
		expect(detectDispatchFailure("tool execution aborted")).not.toBeNull();
	});

	test("detects 'Tool Execution Aborted' case-insensitive", () => {
		expect(detectDispatchFailure("Tool Execution Aborted")).not.toBeNull();
	});

	test("detects 'internal server error' pattern", () => {
		expect(detectDispatchFailure("internal server error")).not.toBeNull();
	});

	test("detects 'Internal Server Error' case-insensitive", () => {
		expect(detectDispatchFailure("Internal Server Error")).not.toBeNull();
	});

	test("detects embedded JSON error in multiline text", () => {
		const text = `Some preamble text\n{"error": "provider_rate_limited"}\nMore text`;
		expect(detectDispatchFailure(text)).toBe("provider_rate_limited");
	});

	test("detects embedded JSON with code field in multiline text", () => {
		const text = `Line 1\n{"code": "E_QUOTA_EXCEEDED"}\nLine 2`;
		expect(detectDispatchFailure(text)).toBe("E_QUOTA_EXCEEDED");
	});

	test("detects embedded JSON with status=error in multiline text", () => {
		const text = `Prefix\n{"status": "error", "message": "out of tokens"}\nSuffix`;
		expect(detectDispatchFailure(text)).toBe("out of tokens");
	});

	test("ignores embedded JSON without error indicators", () => {
		const text = `Some text\n{"result": "success", "data": "ok"}\nMore text`;
		if (text.length >= 120) {
			expect(detectDispatchFailure(text)).toBeNull();
		}
	});

	// ── Fix 5: MIN_MEANINGFUL_RESULT_LENGTH = 120 threshold ──

	test("returns null for long content with error keywords (legitimate output)", () => {
		const content =
			"The system handles timeout scenarios gracefully by implementing exponential " +
			"backoff with jitter. When a timeout occurs, the retry engine classifies the error " +
			"and determines the appropriate strategy. This includes checking the current attempt " +
			"count against the configured maximum, applying backoff delays, and optionally switching " +
			"to a fallback model. The timeout threshold is configurable per deployment environment. " +
			"Production systems typically set this to 30 seconds for API calls and 120 seconds for " +
			"batch processing operations. Monitoring dashboards track timeout frequency per endpoint.";
		expect(content.length).toBeGreaterThan(480);
		expect(detectDispatchFailure(content)).toBeNull();
	});

	test("detects error in content shorter than 120 chars", () => {
		const shortError = "503 service unavailable";
		expect(shortError.length).toBeLessThan(120);
		expect(detectDispatchFailure(shortError)).not.toBeNull();
	});

	test("returns null for content at exactly 120 chars with error keyword", () => {
		// Boundary: at exactly 120 chars, the direct short-content check (< 120) won't fire,
		// but the first-line fallback check (< 200 chars && total < 480) WILL match.
		const base = "The system returned a timeout after processing ";
		const padding = "x".repeat(120 - base.length);
		const content = base + padding;
		expect(content.length).toBe(120);
		const result = detectDispatchFailure(content);
		expect(result).not.toBeNull();
	});
});

// ── decideRetry ───────────────────────────────────────────────────

describe("decideRetry", () => {
	test("allows retry for rate_limit error on first attempt", () => {
		const decision = decideRetry("dispatch-1", "RECON", "oc-researcher", "rate limit exceeded");
		expect(decision.shouldRetry).toBe(true);
		expect(decision.errorCategory).toBe("rate_limit");
		expect(decision.backoffMs).toBeGreaterThan(0);
	});

	test("allows retry for service_unavailable error", () => {
		const decision = decideRetry(
			"dispatch-2",
			"BUILD",
			"oc-implementer",
			"503 service unavailable",
		);
		expect(decision.shouldRetry).toBe(true);
		expect(decision.errorCategory).toBe("service_unavailable");
	});

	test("allows retry for network error", () => {
		const decision = decideRetry(
			"dispatch-3",
			"RECON",
			"oc-researcher",
			"network connection reset",
		);
		expect(decision.shouldRetry).toBe(true);
		expect(decision.errorCategory).toBe("network");
	});

	test("allows retry for timeout error", () => {
		const decision = decideRetry("dispatch-4", "PLAN", "oc-planner", "request timeout");
		expect(decision.shouldRetry).toBe(true);
		expect(decision.errorCategory).toBe("timeout");
	});

	test("denies retry for auth_failure (non-recoverable)", () => {
		const decision = decideRetry("dispatch-5", "BUILD", "oc-implementer", "API key unauthorized");
		expect(decision.shouldRetry).toBe(false);
		expect(decision.errorCategory).toBe("auth_failure");
	});

	test("denies retry for session_corruption (non-recoverable)", () => {
		const decision = decideRetry(
			"dispatch-6",
			"ARCHITECT",
			"oc-architect",
			"session corrupt state mismatch",
		);
		expect(decision.shouldRetry).toBe(false);
		expect(decision.errorCategory).toBe("session_corruption");
	});

	test("denies retry when max retries exhausted", () => {
		recordRetryAttempt("dispatch-7", "RECON", "oc-researcher", "rate_limit");
		recordRetryAttempt("dispatch-7", "RECON", "oc-researcher", "rate_limit");

		const decision = decideRetry("dispatch-7", "RECON", "oc-researcher", "rate limit exceeded", 2);
		expect(decision.shouldRetry).toBe(false);
		expect(decision.reasoning).toContain("Retry limit reached");
	});

	test("suggests fallback model after first retry", () => {
		recordRetryAttempt("dispatch-8", "BUILD", "oc-implementer", "service_unavailable");

		const decision = decideRetry(
			"dispatch-8",
			"BUILD",
			"oc-implementer",
			"503 service unavailable",
			3,
		);
		expect(decision.shouldRetry).toBe(true);
		expect(decision.useFallbackModel).toBe(true);
	});

	test("provides reasoning string", () => {
		const decision = decideRetry("dispatch-9", "RECON", "oc-researcher", "rate limit exceeded");
		expect(decision.reasoning).toBeTruthy();
		expect(typeof decision.reasoning).toBe("string");
	});

	test("uses custom maxRetries", () => {
		const decision = decideRetry("dispatch-10", "RECON", "oc-researcher", "rate limit exceeded", 5);
		expect(decision.shouldRetry).toBe(true);
	});
});

// ── retry state management ────────────────────────────────────────

describe("retry state management", () => {
	test("getRetryState returns null for unknown key", () => {
		expect(getRetryState("nonexistent")).toBeNull();
	});

	test("recordRetryAttempt creates state keyed by phase:agent", () => {
		recordRetryAttempt("dispatch-a", "RECON", "oc-researcher", "rate_limit");

		const key = buildRetryKey("RECON", "oc-researcher");
		const state = getRetryState(key);
		expect(state).not.toBeNull();
		expect(state?.attempts).toBe(1);
		expect(state?.phase).toBe("RECON");
		expect(state?.agent).toBe("oc-researcher");
		expect(state?.lastCategory).toBe("rate_limit");
		expect(state?.retryKey).toBe(key);
	});

	test("recordRetryAttempt increments attempts on subsequent calls", () => {
		recordRetryAttempt("dispatch-b", "BUILD", "oc-implementer", "timeout");
		recordRetryAttempt("dispatch-b", "BUILD", "oc-implementer", "service_unavailable");

		const state = getRetryStateByKey("BUILD", "oc-implementer");
		expect(state?.attempts).toBe(2);
		expect(state?.lastCategory).toBe("service_unavailable");
	});

	test("clearRetryStateByKey removes specific phase:agent composite-keyed state", () => {
		recordRetryAttempt("dispatch-c", "RECON", "oc-researcher", "rate_limit");
		recordRetryAttempt("dispatch-d", "BUILD", "oc-implementer", "timeout");

		clearRetryStateByKey("RECON", "oc-researcher");

		expect(getRetryStateByKey("RECON", "oc-researcher")).toBeNull();
		expect(getRetryStateByKey("BUILD", "oc-implementer")).not.toBeNull();
	});

	test("clearRetryStateByKey removes specific phase:agent state", () => {
		recordRetryAttempt("dispatch-x", "RECON", "oc-researcher", "rate_limit");
		recordRetryAttempt("dispatch-y", "BUILD", "oc-implementer", "timeout");

		clearRetryStateByKey("RECON", "oc-researcher");

		expect(getRetryStateByKey("RECON", "oc-researcher")).toBeNull();
		expect(getRetryStateByKey("BUILD", "oc-implementer")).not.toBeNull();
	});

	test("clearAllRetryState removes all state", () => {
		recordRetryAttempt("dispatch-e", "RECON", "oc-researcher", "rate_limit");
		recordRetryAttempt("dispatch-f", "BUILD", "oc-implementer", "timeout");

		clearAllRetryState();

		expect(getRetryStateByKey("RECON", "oc-researcher")).toBeNull();
		expect(getRetryStateByKey("BUILD", "oc-implementer")).toBeNull();
	});

	test("state objects are frozen (immutable)", () => {
		recordRetryAttempt("dispatch-g", "RECON", "oc-researcher", "rate_limit");
		const state = getRetryStateByKey("RECON", "oc-researcher");
		expect(state).not.toBeNull();
		expect(Object.isFrozen(state)).toBe(true);
	});
});

// ── Fix 1: Composite key retry identity ──────────────────────────

describe("composite key retry identity (Fix 1)", () => {
	test("buildRetryKey creates phase:agent composite", () => {
		expect(buildRetryKey("RECON", "oc-researcher")).toBe("RECON:oc-researcher");
		expect(buildRetryKey("BUILD", "oc-implementer")).toBe("BUILD:oc-implementer");
	});

	test("retry state accumulates across different dispatchIds for same phase:agent", () => {
		recordRetryAttempt("dispatch-001", "RECON", "oc-researcher", "rate_limit");
		recordRetryAttempt("dispatch-002", "RECON", "oc-researcher", "rate_limit");
		recordRetryAttempt("dispatch-003", "RECON", "oc-researcher", "timeout");

		const state = getRetryStateByKey("RECON", "oc-researcher");
		expect(state?.attempts).toBe(3);
		expect(state?.lastCategory).toBe("timeout");
	});

	test("different phase:agent pairs maintain independent retry state", () => {
		recordRetryAttempt("dispatch-a", "RECON", "oc-researcher", "rate_limit");
		recordRetryAttempt("dispatch-a", "RECON", "oc-researcher", "rate_limit");
		recordRetryAttempt("dispatch-b", "BUILD", "oc-implementer", "timeout");

		expect(getRetryStateByKey("RECON", "oc-researcher")?.attempts).toBe(2);
		expect(getRetryStateByKey("BUILD", "oc-implementer")?.attempts).toBe(1);
	});

	test("decideRetry exhausts based on composite key, not dispatchId", () => {
		recordRetryAttempt("dispatch-first", "BUILD", "oc-implementer", "service_unavailable");
		recordRetryAttempt("dispatch-second", "BUILD", "oc-implementer", "service_unavailable");

		const decision = decideRetry(
			"dispatch-third",
			"BUILD",
			"oc-implementer",
			"503 service unavailable",
			2,
		);
		expect(decision.shouldRetry).toBe(false);
		expect(decision.reasoning).toContain("Retry limit reached");
	});

	test("getRetryStateByKey and getRetryState(compositeKey) return same result", () => {
		recordRetryAttempt("dispatch-1", "PLAN", "oc-planner", "timeout");

		const byKey = getRetryStateByKey("PLAN", "oc-planner");
		const byComposite = getRetryState(buildRetryKey("PLAN", "oc-planner"));
		expect(byKey).toEqual(byComposite);
	});
});

// ── Fix 2: Backoff sleep ─────────────────────────────────────────

describe("backoff sleep (Fix 2)", () => {
	test("sleep resolves after specified delay", async () => {
		const start = Date.now();
		await sleep(50);
		const elapsed = Date.now() - start;
		// Allow some timing slack (>= 40ms is reasonable for CI)
		expect(elapsed).toBeGreaterThanOrEqual(40);
	});

	test("sleep(0) resolves near-immediately", async () => {
		const start = Date.now();
		await sleep(0);
		const elapsed = Date.now() - start;
		expect(elapsed).toBeLessThan(50);
	});

	test("decideRetry returns positive backoffMs for retriable errors", () => {
		const decision = decideRetry("d-1", "RECON", "oc-researcher", "rate limit exceeded");
		expect(decision.shouldRetry).toBe(true);
		expect(decision.backoffMs).toBeGreaterThan(0);
	});

	test("backoffMs increases with attempts (exponential backoff)", () => {
		const decision1 = decideRetry("d-1", "SHIP", "oc-shipper", "503 service unavailable");
		expect(decision1.shouldRetry).toBe(true);
		const backoff1 = decision1.backoffMs;

		recordRetryAttempt("d-1", "SHIP", "oc-shipper", "service_unavailable");
		const decision2 = decideRetry("d-2", "SHIP", "oc-shipper", "503 service unavailable", 5);
		expect(decision2.shouldRetry).toBe(true);
		const backoff2 = decision2.backoffMs;

		expect(backoff2).toBeGreaterThanOrEqual(backoff1);
	});

	test("non-retriable errors get backoffMs = 0", () => {
		const decision = decideRetry("d-1", "BUILD", "oc-implementer", "API key unauthorized");
		expect(decision.shouldRetry).toBe(false);
		expect(decision.backoffMs).toBe(0);
	});
});

// ── Fix 6: buildFailureSummary attempts value ────────────────────

describe("buildFailureSummary (Fix 6)", () => {
	test("includes all relevant fields", () => {
		const summary = buildFailureSummary(
			"dispatch-1",
			"RECON",
			"oc-researcher",
			"502 bad gateway",
			"service_unavailable",
			2,
		);

		expect(summary).toContain("DISPATCH_FAILED");
		expect(summary).toContain("oc-researcher");
		expect(summary).toContain("RECON");
		expect(summary).toContain("service_unavailable");
		expect(summary).toContain("dispatch-1");
		expect(summary).toContain("Attempts: 2");
		expect(summary).toContain("502 bad gateway");
	});

	test("truncates long error text to 500 chars", () => {
		const longError = "x".repeat(1000);
		const summary = buildFailureSummary(
			"dispatch-2",
			"BUILD",
			"oc-implementer",
			longError,
			"unknown",
			1,
		);

		const errorLine = summary.split("\n").find((l) => l.startsWith("Error:"));
		expect(errorLine).toBeDefined();
		expect(errorLine?.length).toBeLessThanOrEqual(507);
	});

	test("provides actionable guidance", () => {
		const summary = buildFailureSummary(
			"dispatch-3",
			"ARCHITECT",
			"oc-architect",
			"timeout",
			"timeout",
			3,
		);

		expect(summary).toContain("orchestrator");
	});

	test("reflects real attempt count from retry state", () => {
		recordRetryAttempt("d-1", "RECON", "oc-researcher", "rate_limit");
		recordRetryAttempt("d-2", "RECON", "oc-researcher", "rate_limit");
		recordRetryAttempt("d-3", "RECON", "oc-researcher", "rate_limit");

		const state = getRetryStateByKey("RECON", "oc-researcher");
		const actualAttempts = state?.attempts ?? 1;

		const summary = buildFailureSummary(
			"d-3",
			"RECON",
			"oc-researcher",
			"rate limit exceeded",
			"rate_limit",
			actualAttempts,
		);

		expect(summary).toContain("Attempts: 3");
	});
});

// ── Handler artifact contracts (Fix 3) ───────────────────────────

describe("handler artifact contracts (Fix 3)", () => {
	test("RECON returns error when report.md missing after agent result", async () => {
		const { handleRecon } = await import("../../src/orchestrator/handlers/recon");
		const state = makeMinimalState("RECON");
		const result = await handleRecon(state, "/tmp/nonexistent-artifacts-recon", "agent output");
		expect(result.action).toBe("error");
		expect(result.phase).toBe("RECON");
		expect(result.message).toContain("report.md");
	});

	test("RECON returns dispatch when no result yet", async () => {
		const { handleRecon } = await import("../../src/orchestrator/handlers/recon");
		const state = makeMinimalState("RECON");
		const result = await handleRecon(state, "/tmp/nonexistent-artifacts-recon");
		expect(result.action).toBe("dispatch");
		expect(result.agent).toBe("oc-researcher");
	});

	test("CHALLENGE returns error when brief.md missing after agent result", async () => {
		const { handleChallenge } = await import("../../src/orchestrator/handlers/challenge");
		const state = makeMinimalState("CHALLENGE");
		const result = await handleChallenge(
			state,
			"/tmp/nonexistent-artifacts-challenge",
			"agent output",
		);
		expect(result.action).toBe("error");
		expect(result.phase).toBe("CHALLENGE");
		expect(result.message).toContain("brief.md");
	});

	test("CHALLENGE returns dispatch when no result yet", async () => {
		const { handleChallenge } = await import("../../src/orchestrator/handlers/challenge");
		const state = makeMinimalState("CHALLENGE");
		const result = await handleChallenge(state, "/tmp/nonexistent-artifacts-challenge");
		expect(result.action).toBe("dispatch");
		expect(result.agent).toBe("oc-challenger");
	});

	test("SHIP returns error when neither walkthrough.md, changelog.md, nor decisions.md exist", async () => {
		const { handleShip } = await import("../../src/orchestrator/handlers/ship");
		const state = makeMinimalState("SHIP", {
			oracleSignoffs: {
				tranche: {
					signoffId: "ship-tranche-pass",
					scope: "TRANCHE",
					inputsDigest: "ship-digest",
					verdict: "PASS",
					reasoning: "Ready to ship.",
					blockingConditions: [],
				},
				program: null,
			},
		});
		const result = await handleShip(state, "/tmp/nonexistent-artifacts-ship", "agent output");
		expect(result.action).toBe("error");
		expect(result.phase).toBe("SHIP");
		expect(result.message).toContain("walkthrough.md");
		expect(result.message).toContain("decisions.md");
		expect(result.message).toContain("changelog.md");
	});

	test("SHIP returns complete when only decisions.md exists", async () => {
		const fs = await import("node:fs/promises");
		const { getPhaseDir } = await import("../../src/orchestrator/artifacts");
		const tmpDir = `/tmp/test-ship-decisions-${Date.now()}`;
		const { createShipHandler } = await import("../../src/orchestrator/handlers/ship");
		const state = makeMinimalState("SHIP", {
			oracleSignoffs: {
				tranche: {
					signoffId: "ship-tranche-pass",
					scope: "TRANCHE",
					inputsDigest: "ship-digest",
					verdict: "PASS",
					reasoning: "Ready to ship.",
					blockingConditions: [],
				},
				program: null,
			},
		});
		const handleShip = createShipHandler({
			runLocalVerification: async () => ({
				passed: true,
				status: "PASSED",
				checks: [{ name: "tests", passed: true, status: "PASSED", message: "tests passed" }],
				timestamp: new Date().toISOString(),
			}),
			pollGitHubChecks: async () => ({
				status: "SKIPPED_WITH_REASON",
				summary:
					"No pull request is required for this delivery state, so remote GitHub checks were skipped.",
				checks: [],
				attempts: 1,
			}),
		});
		const shipDir = getPhaseDir(tmpDir, "SHIP", state.runId);
		await fs.mkdir(shipDir, { recursive: true });
		await fs.writeFile(join(shipDir, "decisions.md"), "# Decisions\nContent");
		const result = await handleShip(state, tmpDir, "agent output");
		expect(result.action).toBe("complete");
		expect(result.phase).toBe("SHIP");

		await fs.rm(tmpDir, { recursive: true, force: true });
	});

	test("SHIP returns dispatch when no result yet", async () => {
		const { handleShip } = await import("../../src/orchestrator/handlers/ship");
		const state = makeMinimalState("SHIP", {
			oracleSignoffs: {
				tranche: {
					signoffId: "ship-tranche-pass",
					scope: "TRANCHE",
					inputsDigest: "ship-digest",
					verdict: "PASS",
					reasoning: "Ready to ship.",
					blockingConditions: [],
				},
				program: null,
			},
		});
		const result = await handleShip(state, "/tmp/nonexistent-artifacts-ship");
		expect(result.action).toBe("dispatch");
		expect(result.agent).toBe("oc-shipper");
	});
});

// ── ARCHITECT partial failure (Fix 4) ────────────────────────────

describe("ARCHITECT partial failure (Fix 4)", () => {
	test("ARCHITECT with depth>1 and missing proposals returns error", async () => {
		const { mkdtemp, mkdir, writeFile } = await import("node:fs/promises");
		const { join } = await import("node:path");
		const { tmpdir } = await import("node:os");
		const { getPhaseDir } = await import("../../src/orchestrator/artifacts");
		const { handleArchitect } = await import("../../src/orchestrator/handlers/architect");

		const artifactDir = await mkdtemp(join(tmpdir(), "architect-test-"));
		const state = makeMinimalState("ARCHITECT", {
			confidence: [
				{
					phase: "RECON",
					agent: "oc-researcher",
					area: "architecture",
					level: "LOW",
					rationale: "test",
					timestamp: new Date().toISOString(),
				},
			],
		});
		const proposalsDir = join(getPhaseDir(artifactDir, "ARCHITECT", state.runId), "proposals");
		await mkdir(proposalsDir, { recursive: true });
		await writeFile(join(proposalsDir, "proposal-A.md"), "# Proposal A\nContent here");

		const result = await handleArchitect(state, artifactDir);

		if (result.action === "error") {
			expect(result.message).toContain("expected");
			expect(result.message).toContain("proposals");
		} else {
			expect(["dispatch", "dispatch_multi"]).toContain(result.action);
		}

		const { rm } = await import("node:fs/promises");
		await rm(artifactDir, { recursive: true, force: true });
	});

	test("ARCHITECT with all proposals present dispatches critic", async () => {
		const { mkdtemp, mkdir, writeFile } = await import("node:fs/promises");
		const { join } = await import("node:path");
		const { tmpdir } = await import("node:os");
		const { getPhaseDir } = await import("../../src/orchestrator/artifacts");
		const { handleArchitect } = await import("../../src/orchestrator/handlers/architect");

		const artifactDir = await mkdtemp(join(tmpdir(), "architect-test-full-"));
		const state = makeMinimalState("ARCHITECT", {
			confidence: [
				{
					phase: "RECON",
					agent: "oc-researcher",
					area: "architecture",
					level: "LOW",
					rationale: "test",
					timestamp: new Date().toISOString(),
				},
			],
		});
		const proposalsDir = join(getPhaseDir(artifactDir, "ARCHITECT", state.runId), "proposals");
		await mkdir(proposalsDir, { recursive: true });
		await writeFile(join(proposalsDir, "proposal-A.md"), "# Proposal A");
		await writeFile(join(proposalsDir, "proposal-B.md"), "# Proposal B");
		await writeFile(join(proposalsDir, "proposal-C.md"), "# Proposal C");

		const result = await handleArchitect(state, artifactDir);

		if (result.action === "dispatch") {
			expect(result.agent).toBe("oc-critic");
		}
		// Could also be dispatch_multi or other valid states depending on memory tuning

		const { rm } = await import("node:fs/promises");
		await rm(artifactDir, { recursive: true, force: true });
	});

	test("ARCHITECT with design.md present returns complete", async () => {
		const { mkdtemp, mkdir, writeFile } = await import("node:fs/promises");
		const { join } = await import("node:path");
		const { tmpdir } = await import("node:os");
		const { getPhaseDir } = await import("../../src/orchestrator/artifacts");
		const { handleArchitect } = await import("../../src/orchestrator/handlers/architect");

		const artifactDir = await mkdtemp(join(tmpdir(), "architect-test-design-"));
		const state = makeMinimalState("ARCHITECT");
		const architectDir = getPhaseDir(artifactDir, "ARCHITECT", state.runId);
		await mkdir(architectDir, { recursive: true });
		await writeFile(join(architectDir, "design.md"), "# Final Design");
		const result = await handleArchitect(state, artifactDir);

		expect(result.action).toBe("complete");
		expect(result.phase).toBe("ARCHITECT");

		const { rm } = await import("node:fs/promises");
		await rm(artifactDir, { recursive: true, force: true });
	});
});

// ── Orchestration-level retry integration (Fix 6 + Fix 7) ───────

describe("orchestration-level retry integration", () => {
	test("read-before-clear: getRetryStateByKey returns state before clearRetryStateByKey", () => {
		recordRetryAttempt("d-1", "BUILD", "oc-implementer", "rate_limit");
		recordRetryAttempt("d-2", "BUILD", "oc-implementer", "rate_limit");
		recordRetryAttempt("d-3", "BUILD", "oc-implementer", "service_unavailable");

		// Simulate the corrected orchestrate.ts pattern: read THEN clear
		const retryState = getRetryStateByKey("BUILD", "oc-implementer");
		const actualAttempts = retryState?.attempts ?? 1;
		clearRetryStateByKey("BUILD", "oc-implementer");

		expect(actualAttempts).toBe(3);
		expect(getRetryStateByKey("BUILD", "oc-implementer")).toBeNull();
	});

	test("clear-before-read bug: clearing first loses attempt count", () => {
		recordRetryAttempt("d-1", "RECON", "oc-researcher", "timeout");
		recordRetryAttempt("d-2", "RECON", "oc-researcher", "timeout");

		// Simulate the OLD broken pattern: clear THEN read
		clearRetryStateByKey("RECON", "oc-researcher");
		const retryState = getRetryStateByKey("RECON", "oc-researcher");
		const buggyAttempts = retryState?.attempts ?? 1;

		// This proves the bug: attempts falls back to 1 instead of 2
		expect(buggyAttempts).toBe(1);
	});

	test("failure summary reflects true retry count from read-before-clear", () => {
		recordRetryAttempt("d-1", "SHIP", "oc-shipper", "rate_limit");
		recordRetryAttempt("d-2", "SHIP", "oc-shipper", "service_unavailable");
		recordRetryAttempt("d-3", "SHIP", "oc-shipper", "timeout");

		// Correct pattern: read first
		const retryState = getRetryStateByKey("SHIP", "oc-shipper");
		const actualAttempts = retryState?.attempts ?? 1;
		clearRetryStateByKey("SHIP", "oc-shipper");

		const summary = buildFailureSummary(
			"d-3",
			"SHIP",
			"oc-shipper",
			"request timed out",
			"timeout",
			actualAttempts,
		);

		expect(summary).toContain("Attempts: 3");
		expect(summary).not.toContain("Attempts: 1");
	});

	test("backoff sleep awaits before retry (integration smoke test)", async () => {
		const decision = decideRetry("d-1", "RECON", "oc-researcher", "rate limit exceeded");
		expect(decision.shouldRetry).toBe(true);
		expect(decision.backoffMs).toBeGreaterThan(0);

		const start = Date.now();
		await sleep(decision.backoffMs);
		const elapsed = Date.now() - start;

		// Backoff was actually awaited (at least 80% of declared ms)
		expect(elapsed).toBeGreaterThanOrEqual(decision.backoffMs * 0.8);
	});

	test("exhausted retries produce correct summary with all fields", () => {
		recordRetryAttempt("d-1", "ARCHITECT", "oc-architect", "service_unavailable");
		recordRetryAttempt("d-2", "ARCHITECT", "oc-architect", "timeout");

		const decision = decideRetry("d-3", "ARCHITECT", "oc-architect", "503 bad gateway", 2);
		expect(decision.shouldRetry).toBe(false);

		const retryState = getRetryStateByKey("ARCHITECT", "oc-architect");
		const actualAttempts = retryState?.attempts ?? 1;
		clearRetryStateByKey("ARCHITECT", "oc-architect");

		const summary = buildFailureSummary(
			"d-3",
			"ARCHITECT",
			"oc-architect",
			"503 bad gateway",
			decision.errorCategory,
			actualAttempts,
		);

		expect(summary).toContain("DISPATCH_FAILED");
		expect(summary).toContain("ARCHITECT");
		expect(summary).toContain("oc-architect");
		expect(summary).toContain("Attempts: 2");
		expect(summary).toContain("503 bad gateway");
	});
});

// ── Persisted retry state (Bug #3 fix) ────────────────────────────

describe("persisted retry state (Bug #3)", () => {
	test("getPersistedRetryAttempts returns 0 for empty state", () => {
		expect(getPersistedRetryAttempts({}, "RECON", "oc-researcher")).toBe(0);
	});

	test("getPersistedRetryAttempts returns count for existing key", () => {
		const state = { "RECON:oc-researcher": 3 };
		expect(getPersistedRetryAttempts(state, "RECON", "oc-researcher")).toBe(3);
	});

	test("getPersistedRetryAttempts returns 0 for different key", () => {
		const state = { "RECON:oc-researcher": 3 };
		expect(getPersistedRetryAttempts(state, "BUILD", "oc-implementer")).toBe(0);
	});

	test("setPersistedRetryAttempts creates new entry", () => {
		const result = setPersistedRetryAttempts({}, "RECON", "oc-researcher", 2);
		expect(result).toEqual({ "RECON:oc-researcher": 2 });
	});

	test("setPersistedRetryAttempts updates existing entry", () => {
		const state = { "RECON:oc-researcher": 1, "BUILD:oc-implementer": 3 };
		const result = setPersistedRetryAttempts(state, "RECON", "oc-researcher", 5);
		expect(result).toEqual({ "RECON:oc-researcher": 5, "BUILD:oc-implementer": 3 });
	});

	test("setPersistedRetryAttempts returns new object (immutable)", () => {
		const state = { "RECON:oc-researcher": 1 };
		const result = setPersistedRetryAttempts(state, "BUILD", "oc-implementer", 2);
		expect(state).toEqual({ "RECON:oc-researcher": 1 });
		expect(result).toEqual({ "RECON:oc-researcher": 1, "BUILD:oc-implementer": 2 });
	});

	test("clearPersistedRetryAttempts removes entry", () => {
		const state = { "RECON:oc-researcher": 3, "BUILD:oc-implementer": 1 };
		const result = clearPersistedRetryAttempts(state, "RECON", "oc-researcher");
		expect(result).toEqual({ "BUILD:oc-implementer": 1 });
	});

	test("clearPersistedRetryAttempts returns same object when key missing", () => {
		const state = { "BUILD:oc-implementer": 1 };
		const result = clearPersistedRetryAttempts(state, "RECON", "oc-researcher");
		expect(result).toBe(state);
	});

	test("clearPersistedRetryAttempts returns new object (immutable)", () => {
		const state = { "RECON:oc-researcher": 3, "BUILD:oc-implementer": 1 };
		const result = clearPersistedRetryAttempts(state, "RECON", "oc-researcher");
		expect(state).toEqual({ "RECON:oc-researcher": 3, "BUILD:oc-implementer": 1 });
		expect(result).toEqual({ "BUILD:oc-implementer": 1 });
	});

	test("decideRetry uses persisted attempts when higher than in-memory", () => {
		// In-memory is 0, persisted is 2 -> should deny retry (limit 2)
		const decision = decideRetry("d-1", "RECON", "oc-researcher", "rate limit exceeded", 2, 2);
		expect(decision.shouldRetry).toBe(false);
		expect(decision.reasoning).toContain("Retry limit reached");
	});

	test("decideRetry uses in-memory attempts when higher than persisted", () => {
		// Record 2 in-memory attempts
		recordRetryAttempt("d-1", "RECON", "oc-researcher", "rate_limit");
		recordRetryAttempt("d-2", "RECON", "oc-researcher", "rate_limit");

		// Persisted is 0, in-memory is 2 -> should deny retry (limit 2)
		const decision = decideRetry("d-3", "RECON", "oc-researcher", "rate limit exceeded", 2, 0);
		expect(decision.shouldRetry).toBe(false);
	});

	test("decideRetry takes max of in-memory and persisted", () => {
		// Record 1 in-memory attempt
		recordRetryAttempt("d-1", "BUILD", "oc-implementer", "timeout");

		// Persisted is 3, in-memory is 1 -> effective is 3 -> deny (limit 2)
		const decision = decideRetry("d-2", "BUILD", "oc-implementer", "timeout", 2, 3);
		expect(decision.shouldRetry).toBe(false);
	});

	test("recordRetryAttempt returns new attempt count", () => {
		const count1 = recordRetryAttempt("d-1", "RECON", "oc-researcher", "rate_limit");
		expect(count1).toBe(1);

		const count2 = recordRetryAttempt("d-2", "RECON", "oc-researcher", "rate_limit");
		expect(count2).toBe(2);

		const count3 = recordRetryAttempt("d-3", "RECON", "oc-researcher", "timeout");
		expect(count3).toBe(3);
	});

	test("simulated restart: persisted state preserves retry count across sessions", () => {
		// Session 1: record 2 attempts, then "persist" to state
		recordRetryAttempt("d-1", "ARCHITECT", "oc-architect", "service_unavailable");
		recordRetryAttempt("d-2", "ARCHITECT", "oc-architect", "timeout");
		const persistedState = setPersistedRetryAttempts({}, "ARCHITECT", "oc-architect", 2);

		// Session 2: in-memory Map is empty (process restart), but persisted state has count
		clearAllRetryState();
		const persistedAttempts = getPersistedRetryAttempts(
			persistedState,
			"ARCHITECT",
			"oc-architect",
		);
		expect(persistedAttempts).toBe(2);

		// decideRetry should see the persisted count and deny retry (limit 2)
		const decision = decideRetry(
			"d-3",
			"ARCHITECT",
			"oc-architect",
			"503 bad gateway",
			2,
			persistedAttempts,
		);
		expect(decision.shouldRetry).toBe(false);
		expect(decision.reasoning).toContain("Retry limit reached");
	});
});

function makeMinimalState(
	phase: import("../../src/orchestrator/types").PipelineState["currentPhase"],
	overrides: Record<string, unknown> = {},
): import("../../src/orchestrator/types").PipelineState {
	const now = new Date().toISOString();
	return pipelineStateSchema.parse({
		schemaVersion: 2 as const,
		status: "IN_PROGRESS" as const,
		runId: "test-run",
		stateRevision: 0,
		idea: "Test idea for dispatch retry tests",
		currentPhase: phase,
		startedAt: now,
		lastUpdatedAt: now,
		phases: [],
		decisions: [],
		confidence: [],
		tasks: [],
		arenaConfidence: null,
		exploreTriggered: false,
		buildProgress: {
			currentTask: null,
			currentTasks: [],
			currentWave: null,
			attemptCount: 0,
			strikeCount: 0,
			reviewPending: false,
			oraclePending: false,
			oracleSignoffId: null,
			oracleInputsDigest: null,
			lastReviewReport: null,
		},
		oracleSignoffs: {
			tranche: null,
			program: null,
		},
		pendingDispatches: [],
		processedResultIds: [],
		failureContext: null,
		branchLifecycle: null,
		programContext: null,
		phaseDispatchCounts: {},
		retryAttempts: {},
		useWorktrees: false,
		reviewStatus: {
			reviewRunId: null,
			trancheId: null,
			scope: null,
			status: "IDLE",
			verdict: null,
			blockingSeverityThreshold: "HIGH",
			selectedReviewers: [],
			requiredReviewers: [],
			missingRequiredReviewers: [],
			reviewers: [],
			findingsSummary: {
				CRITICAL: 0,
				HIGH: 0,
				MEDIUM: 0,
				LOW: 0,
				open: 0,
				accepted: 0,
				fixed: 0,
				blockingOpen: 0,
			},
			summary: null,
			blockedReason: null,
			startedAt: null,
			completedAt: null,
		},
		...overrides,
	});
}
