import { describe, expect, it } from "bun:test";
import { updateDocsCore } from "../../src/tools/update-docs";

describe("updateDocsCore", () => {
	it("returns a JSON string with changedFiles and affectedDocs", async () => {
		// Running in a real git repo, so this should work
		const result = await updateDocsCore({ scope: "changed" }, process.cwd());
		const parsed = JSON.parse(result);
		expect(parsed).toHaveProperty("changedFiles");
		expect(parsed).toHaveProperty("affectedDocs");
		expect(parsed).toHaveProperty("summary");
		expect(typeof parsed.summary).toBe("string");
	});

	it("handles 'all' scope", async () => {
		const result = await updateDocsCore({ scope: "all" }, process.cwd());
		const parsed = JSON.parse(result);
		expect(parsed).toHaveProperty("changedFiles");
		expect(parsed).toHaveProperty("summary");
	});
});
