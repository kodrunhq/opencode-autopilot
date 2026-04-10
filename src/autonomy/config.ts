export interface AutonomyDefaults {
	readonly maxIterations: number;
	readonly maxVerificationAttempts: number;
	readonly hardMaxIterations: number;
}

export const AUTONOMY_DEFAULTS: AutonomyDefaults = Object.freeze({
	maxIterations: 100,
	maxVerificationAttempts: 3,
	hardMaxIterations: 100,
});
