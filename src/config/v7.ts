import type { PluginConfig } from "../config";

export type PluginConfigV7 = Omit<PluginConfig, "version"> & {
	readonly version: 7;
	readonly background?: {
		readonly enabled: boolean;
		readonly maxConcurrent: number;
		readonly defaultTimeout: number;
	};
	readonly autonomy?: {
		readonly enabled: boolean;
		readonly verification: "strict" | "normal" | "lenient";
		readonly maxIterations: number;
	};
};

export function migrateV6toV7(v6Config: PluginConfig): PluginConfigV7 {
	return {
		...v6Config,
		version: 7,
		background: {
			enabled: true,
			maxConcurrent: 5,
			defaultTimeout: 300000,
		},
		autonomy: {
			enabled: false,
			verification: "normal",
			maxIterations: 10,
		},
	};
}

export const v7ConfigDefaults = {
	background: {
		enabled: true,
		maxConcurrent: 5,
		defaultTimeout: 300000,
	},
	autonomy: {
		enabled: false,
		verification: "normal",
		maxIterations: 10,
	},
} as const;
