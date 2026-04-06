import { describe, expect, it } from "bun:test";
import { createToolOutputTruncatorHandler } from "../../src/hooks/tool-output-truncator";

function makeHookInput() {
	return {
		tool: "bash",
		sessionID: "s1",
		callID: "c1",
		args: {},
	};
}

function makeOutput(output: string) {
	return { title: "result", output, metadata: {} };
}

describe("createToolOutputTruncatorHandler", () => {
	it("returns a function", () => {
		const handler = createToolOutputTruncatorHandler({});
		expect(typeof handler).toBe("function");
	});

	it("does not modify output shorter than max length", async () => {
		const handler = createToolOutputTruncatorHandler({ maxOutputLength: 100 });
		const outputObj = makeOutput("short output");

		await handler(makeHookInput(), outputObj);

		expect(outputObj.output).toBe("short output");
	});

	it("does not modify output exactly at max length", async () => {
		const maxOutputLength = 10;
		const handler = createToolOutputTruncatorHandler({ maxOutputLength });
		const content = "a".repeat(maxOutputLength);
		const outputObj = makeOutput(content);

		await handler(makeHookInput(), outputObj);

		expect(outputObj.output).toBe(content);
	});

	it("truncates output exceeding max length", async () => {
		const maxOutputLength = 20;
		const handler = createToolOutputTruncatorHandler({ maxOutputLength });
		const content = "a".repeat(100);
		const outputObj = makeOutput(content);

		await handler(makeHookInput(), outputObj);

		expect(outputObj.output.startsWith("a".repeat(maxOutputLength))).toBe(true);
		expect(outputObj.output.length).toBeGreaterThan(maxOutputLength);
	});

	it("adds truncation notice with original and capped lengths", async () => {
		const maxOutputLength = 20;
		const handler = createToolOutputTruncatorHandler({ maxOutputLength });
		const originalLength = 100;
		const outputObj = makeOutput("b".repeat(originalLength));

		await handler(makeHookInput(), outputObj);

		expect(outputObj.output).toContain(
			`[Output truncated from ${originalLength} to ${maxOutputLength} characters]`,
		);
	});

	it("preserves the first maxOutputLength characters of the original output", async () => {
		const maxOutputLength = 5;
		const handler = createToolOutputTruncatorHandler({ maxOutputLength });
		const outputObj = makeOutput("abcdefghij");

		await handler(makeHookInput(), outputObj);

		expect(outputObj.output.startsWith("abcde")).toBe(true);
	});

	it("handles empty output without error", async () => {
		const handler = createToolOutputTruncatorHandler({ maxOutputLength: 100 });
		const outputObj = makeOutput("");

		await handler(makeHookInput(), outputObj);

		expect(outputObj.output).toBe("");
	});

	it("uses default max length (50000) when no option provided", async () => {
		const handler = createToolOutputTruncatorHandler({});
		const shortContent = "x".repeat(1000);
		const outputObj = makeOutput(shortContent);

		await handler(makeHookInput(), outputObj);

		expect(outputObj.output).toBe(shortContent);
	});

	it("truncates output exceeding the default max length (50000)", async () => {
		const handler = createToolOutputTruncatorHandler({});
		const bigContent = "z".repeat(60000);
		const outputObj = makeOutput(bigContent);

		await handler(makeHookInput(), outputObj);

		expect(outputObj.output).toContain("[Output truncated from 60000 to 50000 characters]");
		expect(outputObj.output.startsWith("z".repeat(50000))).toBe(true);
	});

	it("falls back to default max length when maxOutputLength is NaN", async () => {
		const handler = createToolOutputTruncatorHandler({ maxOutputLength: Number.NaN });
		const shortContent = "n".repeat(1000);
		const outputObj = makeOutput(shortContent);

		await handler(makeHookInput(), outputObj);

		expect(outputObj.output).toBe(shortContent);
	});

	it("clamps negative maxOutputLength to 0", async () => {
		const handler = createToolOutputTruncatorHandler({ maxOutputLength: -5 });
		const outputObj = makeOutput("hello");

		await handler(makeHookInput(), outputObj);

		expect(outputObj.output).toContain("[Output truncated from 5 to 0 characters]");
	});

	it("mutates the output object in-place", async () => {
		const handler = createToolOutputTruncatorHandler({ maxOutputLength: 10 });
		const outputObj = makeOutput("a".repeat(50));
		const ref = outputObj;

		await handler(makeHookInput(), outputObj);

		expect(outputObj).toBe(ref);
		expect(outputObj.output).toContain("[Output truncated");
	});
});
