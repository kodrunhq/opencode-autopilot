/**
 * System prompt injection for memory context.
 *
 * Creates a per-session cached injector that retrieves relevant memories
 * and pushes them into the system prompt via output.system.
 *
 * Best-effort: all errors are silently caught to never break the session.
 * Same pattern as skill-injection.ts.
 *
 * @module
 */

import type { Database } from "bun:sqlite";
import { getLogger } from "../logging/domains";
import { retrieveMemoryContext } from "./retrieval";

const logger = getLogger("memory", "injector");

/**
 * Configuration for creating a memory injector.
 */
export interface MemoryInjectorConfig {
	readonly projectRoot: string;
	readonly tokenBudget: number;
	readonly halfLifeDays: number;
	readonly getDb: () => Database;
}

/**
 * Input shape matching the experimental.chat.system.transform hook signature.
 */
interface InjectorInput {
	readonly sessionID?: string;
	readonly model: Record<string, unknown>;
}

/**
 * Output shape matching the experimental.chat.system.transform hook signature.
 * system is mutable — the hook API expects callers to push into it.
 */
interface InjectorOutput {
	system: string[];
}

/**
 * Create a memory injector function for the experimental.chat.system.transform hook.
 *
 * Returns an async function that:
 * 1. Skips if no sessionID is provided
 * 2. Returns cached context for known sessions
 * 3. Retrieves and caches memory context for new sessions
 * 4. Pushes non-empty context to output.system
 *
 * All errors are silently caught (best-effort, per D-24 and skill-injection pattern).
 */
export function createMemoryInjector(config: MemoryInjectorConfig) {
	const cache = new Map<string, string>();

	return async (input: InjectorInput, output: InjectorOutput): Promise<void> => {
		try {
			if (!input.sessionID) return;

			const cached = cache.get(input.sessionID);
			if (cached !== undefined) {
				if (cached.length > 0) {
					output.system.push(cached);
				}
				return;
			}

			const db = config.getDb();
			const context = retrieveMemoryContext(
				config.projectRoot,
				config.tokenBudget,
				db,
				config.halfLifeDays,
			);

			cache.set(input.sessionID, context);

			if (context.length > 0) {
				output.system.push(context);
			}
		} catch (err) {
			logger.warn("memory injection failed", { error: String(err) });
		}
	};
}
