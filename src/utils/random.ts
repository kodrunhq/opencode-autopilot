/**
 * A simple seeded random number generator.
 * Uses the Mulberry32 algorithm which provides decent quality and is very fast.
 */
export function createSeededRandom(seedString: string) {
	// Simple hash function (djb2) to convert string to 32-bit integer seed
	let seed = 5381;
	for (let i = 0; i < seedString.length; i++) {
		seed = (seed * 33) ^ seedString.charCodeAt(i);
	}
	// Add an arbitrary constant to avoid passing 0 to mulberry32
	let a = seed + 1831565813;

	// Mulberry32 generator
	return function random(): number {
		let t = (a += 0x6d2b79f5);
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/**
 * Shuffles an array in-place deterministically using the provided seeded RNG.
 */
export function deterministicShuffle<T>(array: T[], rng: () => number): T[] {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
	return array;
}
