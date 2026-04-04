/**
 * Curated regex patterns for detecting AI-generated comment bloat ("slop").
 * All exports are frozen for immutability.
 */

/** Code file extensions eligible for anti-slop scanning. */
export const CODE_EXTENSIONS: ReadonlySet<string> = Object.freeze(
	new Set([
		".ts",
		".tsx",
		".js",
		".jsx",
		".py",
		".go",
		".rs",
		".java",
		".cs",
		".rb",
		".cpp",
		".c",
		".h",
	]),
);

/** Maps file extension to its single-line comment prefix. */
export const EXT_COMMENT_STYLE: Readonly<Record<string, string>> = Object.freeze({
	".ts": "//",
	".tsx": "//",
	".js": "//",
	".jsx": "//",
	".java": "//",
	".cs": "//",
	".go": "//",
	".rs": "//",
	".c": "//",
	".cpp": "//",
	".h": "//",
	".py": "#",
	".rb": "#",
});

/** Regex to extract comment text from a line given its comment prefix.
 * Matches both full-line comments and inline trailing comments.
 * Negative lookbehind (?<!:) prevents matching :// in URLs.
 * Hash-line exclusions (shebangs, hex colors) are handled by isExcludedHashLine(). */
export const COMMENT_PATTERNS: Readonly<Record<string, RegExp>> = Object.freeze({
	"//": /(?<!:)\/\/\s*(.+)/,
	"#": /#\s*(.+)/,
});

/** Returns true if a line should be excluded from `#`-style comment scanning. */
export function isExcludedHashLine(line: string): boolean {
	// Shebangs: lines starting with #!
	if (line.trimStart().startsWith("#!")) return true;
	// Hex colors: lines containing #RGB / #RRGGBB / #RRGGBBAA patterns
	if (/#[0-9a-fA-F]{3,8}\b/.test(line)) return true;
	return false;
}

/**
 * Minimum number of distinct pattern matches required to trigger a slop warning.
 * A single match in isolation is likely a false positive for broad patterns.
 */
export const MINIMUM_SLOP_INDICATORS = 2;

/**
 * Patterns matching obvious/sycophantic AI comment text.
 * Tested against extracted comment body only (not raw code lines).
 *
 * Broad adjective patterns (robust, comprehensive, powerful) require a narrating
 * context prefix ("this is", "our", "the", "it is") to reduce false positives
 * from legitimate technical usage.
 */
export const SLOP_PATTERNS: readonly RegExp[] = Object.freeze([
	/^increment\s+.*\s+by\s+\d+$/i,
	/^decrement\s+.*\s+by\s+\d+$/i,
	/^return\s+the\s+(result|value|data)\s*$/i,
	/^(?:this|the)\s+(?:function|method|class)\s+(?:does|will|is used to|handles)/i,
	/^(?:initialize|init)\s+(?:the\s+)?(?:variable|value|state)/i,
	/^import\s+(?:the\s+)?(?:necessary|required|needed)/i,
	/^define\s+(?:the\s+)?(?:interface|type|class|function)/i,
	/\belegantly?\b/i,
	/(?:this|the|it|our)\s+(?:is\s+)?(?:a\s+)?\brobust(?:ly|ness)?\b/i,
	/(?:this|the|it|our)\s+(?:is\s+)?(?:a\s+)?\bcomprehensive(?:ly)?\b/i,
	/\bseamless(?:ly)?\b/i,
	/\blever(?:age|aging)\b/i,
	/(?:this|the|it|our)\s+(?:is\s+)?(?:a\s+)?\bpowerful\b/i,
	/\bsophisticated\b/i,
	/\bstate[\s-]of[\s-]the[\s-]art\b/i,
	/\bcutting[\s-]edge\b/i,
]);
