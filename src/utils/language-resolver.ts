import { detectProjectStackTags } from "../skills/adaptive-injector";

/** Cache: projectRoot -> resolved language string. */
const cache = new Map<string, string>();

type LanguageDetector = (projectRoot: string) => Promise<readonly string[]>;

/**
 * Resolve project language tags as a human-readable string.
 * Caches per projectRoot to avoid repeated filesystem access.
 */
export async function resolveLanguageTag(
	projectRoot: string,
	detect: LanguageDetector = detectProjectStackTags,
): Promise<string> {
	const cached = cache.get(projectRoot);
	if (cached !== undefined) return cached;

	try {
		const tags = await detect(projectRoot);
		const result = tags.length > 0 ? [...tags].sort().join(", ") : "unknown";
		cache.set(projectRoot, result);
		return result;
	} catch {
		return "unknown";
	}
}

/**
 * Substitute $LANGUAGE in a text string with the resolved language tag.
 */
export function substituteLanguageVar(text: string, language: string): string {
	return text.replaceAll("$LANGUAGE", language);
}

/** Clear the language cache (for testing). */
export function clearLanguageCache(): void {
	cache.clear();
}
