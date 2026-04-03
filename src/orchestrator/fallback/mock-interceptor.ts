import { createMockError } from "../../observability/mock/mock-provider";
import type { MockFailureMode } from "../../observability/mock/types";
import type { TestModeConfig } from "./fallback-config";

/**
 * Deterministic sequence interceptor for fallback chain testing.
 * Cycles through a configured sequence of failure modes, generating
 * mock error objects compatible with the error classifier.
 */
export class MockInterceptor {
	private index = 0;
	private readonly sequence: readonly MockFailureMode[];

	constructor(sequence: readonly MockFailureMode[]) {
		this.sequence = sequence;
	}

	/** Get the next failure mode in the sequence (cycles). */
	nextMode(): MockFailureMode {
		if (this.sequence.length === 0) {
			throw new Error("MockInterceptor: cannot call nextMode() on an empty sequence");
		}
		const mode = this.sequence[this.index % this.sequence.length];
		this.index = (this.index + 1) % this.sequence.length;
		return mode;
	}

	/** Get the next mock error object (frozen, matches error-classifier shapes). */
	nextError(): unknown {
		return createMockError(this.nextMode());
	}

	/** Reset the cycle index to 0. */
	reset(): void {
		this.index = 0;
	}

	/** Current position in the sequence. */
	get position(): number {
		return this.index;
	}
}

/**
 * Factory: returns MockInterceptor if testMode is enabled and has a
 * non-empty sequence, null otherwise.
 */
export function createMockInterceptor(config: TestModeConfig): MockInterceptor | null {
	if (!config.enabled || config.sequence.length === 0) return null;
	return new MockInterceptor(config.sequence as readonly MockFailureMode[]);
}
