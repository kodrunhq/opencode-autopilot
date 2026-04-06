import { EXT_TO_LANG } from "./language-mappings";

export function getLanguageId(extension: string): string {
	return EXT_TO_LANG[extension] ?? "plaintext";
}
