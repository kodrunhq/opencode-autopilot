export interface TimeProvider {
	readonly now: () => number;
}

export const systemTimeProvider: TimeProvider = Object.freeze({
	now: () => Date.now(),
});

export function createFixedTimeProvider(
	initialTimeMs: number,
): TimeProvider & { advance: (ms: number) => void; set: (ms: number) => void } {
	let currentTime = initialTimeMs;

	return Object.freeze({
		now: () => currentTime,
		advance: (ms: number) => {
			currentTime += ms;
		},
		set: (ms: number) => {
			currentTime = ms;
		},
	});
}
