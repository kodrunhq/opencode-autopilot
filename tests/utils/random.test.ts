import { describe, expect, test } from "bun:test";
import { createSeededRandom, deterministicShuffle } from "../../src/utils/random";

describe("Random Utilities", () => {
	test("createSeededRandom generates reproducible sequences", () => {
		const rng1 = createSeededRandom("my-test-seed");
		const rng2 = createSeededRandom("my-test-seed");
		const rng3 = createSeededRandom("another-seed");

		const seq1 = [rng1(), rng1(), rng1()];
		const seq2 = [rng2(), rng2(), rng2()];
		const seq3 = [rng3(), rng3(), rng3()];

		expect(seq1).toEqual(seq2);
		expect(seq1).not.toEqual(seq3);
	});

	test("deterministicShuffle shuffles identically given same seed", () => {
		const rng1 = createSeededRandom("shuffle-seed");
		const rng2 = createSeededRandom("shuffle-seed");

		const arr1 = [1, 2, 3, 4, 5];
		const arr2 = [1, 2, 3, 4, 5];

		deterministicShuffle(arr1, rng1);
		deterministicShuffle(arr2, rng2);

		expect(arr1).toEqual(arr2);
		expect(arr1).not.toEqual([1, 2, 3, 4, 5]); // Highly unlikely to remain ordered
	});
});
