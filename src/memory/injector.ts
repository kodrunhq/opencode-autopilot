/**
 * System prompt injection for memory context.
 *
 * Creates a per-session cached injector that retrieves relevant memories
 * and pushes them into the system prompt via output.system.
 *
 * V2 retrieval (memories table) is preferred when active memories exist.
 * Falls back to V1 (observations/preferences) for backward compatibility.
 *
 * Best-effort: all errors are silently caught to never break the session.
 * Same pattern as skill-injection.ts.
 *
 * @module
 */

import type { Database } from "bun:sqlite";
import { getLogger } from "../logging/domains";
import { retrieveMemoryContext, retrieveMemoryContextV2 } from "./retrieval";

const logger = getLogger("memory", "injector");

export interface MemoryInjectorConfig {
	readonly projectRoot: string;
	readonly tokenBudget: number;
	readonly halfLifeDays: number;
	readonly getDb: () => Database;
}

interface InjectorInput {
	readonly sessionID?: string;
	readonly model: Record<string, unknown>;
}

interface InjectorOutput {
	system: string[];
}

function hasMemoriesTable(db: Database): boolean {
	try {
		const row = db
			.query("SELECT name FROM sqlite_master WHERE type='table' AND name='memories'")
			.get() as { name: string } | null;
		return row !== null;
	} catch {
		return false;
	}
}

export function createMemoryInjector(config: MemoryInjectorConfig) {
	const cache = new Map<string, string>();

	function invalidate(): void {
		cache.clear();
	}

	const injector = async (input: InjectorInput, output: InjectorOutput): Promise<void> => {
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
			let context: string;

			if (hasMemoriesTable(db)) {
				context = retrieveMemoryContextV2(config.projectRoot, config.tokenBudget, db);
				if (context.length === 0) {
					context = retrieveMemoryContext(
						config.projectRoot,
						config.tokenBudget,
						db,
						config.halfLifeDays,
					);
				}
			} else {
				context = retrieveMemoryContext(
					config.projectRoot,
					config.tokenBudget,
					db,
					config.halfLifeDays,
				);
			}

			cache.set(input.sessionID, context);

			if (context.length > 0) {
				output.system.push(context);
			}
		} catch (err) {
			logger.warn("memory injection failed", { error: String(err) });
		}
	};

	injector.invalidateCache = invalidate;

	return injector;
}

export function invalidateMemoryCache(injector: ReturnType<typeof createMemoryInjector>): void {
	injector.invalidateCache();
}
