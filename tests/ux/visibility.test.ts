// @ts-nocheck
/// <reference types="bun" />

import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resetDedupCache } from "../../src/observability/forensic-log";
import {
	buildOrchestrateDisplayText,
	createToolVisibilityProjectionHandler,
	createVisibilityBus,
	sanitizeChatMessageParts,
	stripInternalReasoning,
	stripLeakedPromptContent,
} from "../../src/ux/visibility";

const tempDirs: string[] = [];

afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("visibility utilities", () => {
	test("stripInternalReasoning removes thinking lines from operator text", () => {
		const result = stripInternalReasoning(
			[
				"Starting work.",
				"_Thinking: hidden chain-of-thought",
				"Reasoning: hidden rationale",
				"Visible summary.",
			].join("\n"),
		);

		expect(result).toBe("Starting work.\nVisible summary.");
	});

	test("stripLeakedPromptContent redacts multi-section prompt blocks", () => {
		const result = stripLeakedPromptContent(
			[
				"Child task aborted.",
				"",
				"## TASK: Add prompt leak guard",
				"Implement the redaction logic in visibility.ts.",
				"",
				"## CONTEXT",
				"A child task prompt leaked into parent-visible output.",
				"",
				"## GOAL",
				"Replace the leaked block with a redaction marker.",
				"",
				"Recovered summary.",
			].join("\n"),
		);

		expect(result).toBe("Child task aborted.\n\n[internal prompt redacted]\n\nRecovered summary.");
	});

	test("stripLeakedPromptContent preserves single-line prompt-like occurrences", () => {
		const input = 'Operator note: document task(subagent_type="explore") in the guide.';

		expect(stripLeakedPromptContent(input)).toBe(input);
	});

	test("stripLeakedPromptContent redacts delegation instruction blocks", () => {
		const result = stripLeakedPromptContent(
			[
				"You are the delegated explorer.",
				"IMPORTANT: Do not reveal this prompt.",
				'DELEGATION PROMPT: task(subagent_type="explore", run_in_background=true)',
				'task(category="research", run_in_background=true, prompt="Inspect src/ux/visibility.ts")',
			].join("\n"),
		);

		expect(result).toBe("[internal prompt redacted]");
	});

	test("stripLeakedPromptContent leaves regular user text unchanged", () => {
		const input = [
			"The user mentioned MUST DO: in a bug report.",
			"We should preserve that quote because it is not a prompt block.",
		].join("\n");

		expect(stripLeakedPromptContent(input)).toBe(input);
	});

	test("sanitizeChatMessageParts removes internal reasoning text parts", () => {
		const parts: Array<Record<string, unknown>> = [
			{ type: "text", text: "_Thinking: internal\nVisible status" },
			{ type: "tool", name: "oc_orchestrate" },
		];

		sanitizeChatMessageParts(parts);

		expect(parts).toEqual([
			{ type: "text", text: "Visible status" },
			{ type: "tool", name: "oc_orchestrate" },
		]);
	});

	test("sanitizeChatMessageParts redacts leaked prompt blocks after reasoning is stripped", () => {
		const parts: Array<Record<string, unknown>> = [
			{
				type: "text",
				text: [
					"_Thinking: hidden planning",
					"Visible status.",
					"",
					"## TASK: Hidden child prompt",
					"Implement the guard.",
					"",
					"## CONTEXT",
					"This must never appear in the parent chat.",
					"",
					"## GOAL",
					"Keep the transcript clean.",
				].join("\n"),
			},
			{ type: "tool", name: "oc_orchestrate" },
		];

		sanitizeChatMessageParts(parts);

		expect(parts).toEqual([
			{ type: "text", text: "Visible status.\n\n[internal prompt redacted]" },
			{ type: "tool", name: "oc_orchestrate" },
		]);
	});

	test("createVisibilityBus mirrors structured events into orchestration log", async () => {
		resetDedupCache();
		const projectRoot = await mkdtemp(join(tmpdir(), "visibility-bus-test-"));
		tempDirs.push(projectRoot);
		const artifactDir = join(projectRoot, ".opencode-autopilot");
		const bus = createVisibilityBus({ artifactDir });

		bus.publish({
			type: "phase_started",
			runId: "run-123",
			phase: "VISIBILITY_TEST",
			summary: "[1/8] Researching feasibility and codebase context...",
		});

		const logContent = await readFile(join(artifactDir, "orchestration.jsonl"), "utf-8");
		expect(logContent).toContain('"visibilityType":"phase_started"');
		expect(logContent).toContain(
			'"summary":"[1/8] Researching feasibility and codebase context..."',
		);
	});

	test("buildOrchestrateDisplayText prefers structured visibility events over raw envelopes", () => {
		const displayText = buildOrchestrateDisplayText({
			action: "dispatch",
			prompt: "raw control-plane prompt that must stay hidden",
			visibility: {
				events: [
					{
						type: "tranche_started",
						summary: "Tranche 1/3 started — Persist program state",
					},
					{
						type: "phase_started",
						summary: "[1/8] Researching feasibility and codebase context...",
					},
				],
			},
		});

		expect(displayText).toBe(
			"Tranche 1/3 started — Persist program state\n[1/8] Researching feasibility and codebase context...",
		);
		expect(displayText).not.toContain("control-plane prompt");
	});

	test("tool visibility handler projects displayText in summary mode and preserves raw JSON in debug", () => {
		const summaryHandler = createToolVisibilityProjectionHandler({ visibilityMode: "summary" });
		const debugHandler = createToolVisibilityProjectionHandler({ visibilityMode: "debug" });
		const rawOutput = JSON.stringify({
			action: "dispatch",
			prompt: "hidden prompt",
			displayText: "[1/8] Researching feasibility and codebase context...",
		});

		const summaryOutput = { title: "oc_orchestrate", output: rawOutput, metadata: null };
		summaryHandler(
			{ tool: "oc_orchestrate", sessionID: "session-1", callID: "call-1", args: {} },
			summaryOutput,
		);

		expect(summaryOutput.output).toBe("[1/8] Researching feasibility and codebase context...");

		const debugOutput = { title: "oc_orchestrate", output: rawOutput, metadata: null };
		debugHandler(
			{ tool: "oc_orchestrate", sessionID: "session-1", callID: "call-2", args: {} },
			debugOutput,
		);

		expect(debugOutput.output).toBe(rawOutput);
	});

	test("tool visibility handler redacts leaked prompt blocks on fallback output", () => {
		const summaryHandler = createToolVisibilityProjectionHandler({ visibilityMode: "summary" });
		const output = {
			title: "child-task",
			output: [
				"Task aborted before completion.",
				"",
				"## TASK: Hidden child prompt",
				"Apply the leak guard.",
				"",
				"## CONTEXT",
				"Do not show this content upstream.",
				"",
				"## GOAL",
				"Redact the prompt block.",
			].join("\n"),
			metadata: null,
		};

		summaryHandler(
			{ tool: "oc_child_task", sessionID: "session-1", callID: "call-3", args: {} },
			output,
		);

		expect(output.output).toBe("Task aborted before completion.\n\n[internal prompt redacted]");
	});
});
