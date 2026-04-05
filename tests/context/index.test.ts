import { describe, expect, test } from "bun:test";
import {
	allocateBudget,
	createCompactionHandler,
	createContextInjector,
	discoverContextFiles,
	truncateToTokens,
} from "../../src/context";

describe("context barrel exports", () => {
	test("exports the public context helpers", () => {
		expect(typeof discoverContextFiles).toBe("function");
		expect(typeof allocateBudget).toBe("function");
		expect(typeof truncateToTokens).toBe("function");
		expect(typeof createContextInjector).toBe("function");
		expect(typeof createCompactionHandler).toBe("function");
	});
});
