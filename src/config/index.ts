export {
	CONFIG_PATH,
	confidenceConfigSchema,
	confidenceDefaults,
	createDefaultConfig,
	isFirstLoad,
	loadConfig,
	memoryConfigSchema,
	memoryDefaults,
	migrateV6toV7,
	orchestratorConfigSchema,
	orchestratorDefaults,
	type PluginConfig,
	pluginConfigSchema,
	saveConfig,
	v7ConfigDefaults,
} from "../config";
// Re-export migration schemas and functions for backward compatibility
export {
	migrateV1toV2,
	migrateV2toV3,
	migrateV3toV4,
	migrateV4toV5,
	migrateV5toV6,
	pluginConfigSchemaV1,
	pluginConfigSchemaV2,
	pluginConfigSchemaV3,
	pluginConfigSchemaV4,
	pluginConfigSchemaV5,
} from "./migrations";
export type { PluginConfigV7 } from "./v7";
