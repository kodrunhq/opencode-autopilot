/**
 * Convert TypeScript compiler offsets (UTF-16 code units) to UTF-8 byte offsets.
 *
 * Builds a lookup table mapping each UTF-16 position to its corresponding
 * UTF-8 byte offset in the source text.
 */

/**
 * Build a mapping from UTF-16 code-unit positions to UTF-8 byte offsets.
 *
 * Returns an array where index `i` is the UTF-8 byte offset for UTF-16 position `i`.
 * The array has length `source.length + 1` so that end-of-source queries work.
 */
export function buildUtf16ToUtf8OffsetMap(source: string): readonly number[] {
	const map = new Array<number>(source.length + 1);
	let utf16Pos = 0;
	let byteOffset = 0;

	for (const character of source) {
		map[utf16Pos] = byteOffset;

		const utf16Width = character.length;
		const utf8Width = Buffer.byteLength(character, "utf8");

		if (utf16Width === 2) {
			map[utf16Pos + 1] = byteOffset + utf8Width;
		}

		utf16Pos += utf16Width;
		byteOffset += utf8Width;
	}

	map[source.length] = byteOffset;
	return Object.freeze(map);
}

/**
 * Convert a UTF-16 position to a UTF-8 byte offset using a pre-built map.
 */
export function utf16ToUtf8ByteOffset(offsetMap: readonly number[], utf16Pos: number): number {
	if (utf16Pos <= 0) {
		return 0;
	}

	if (utf16Pos >= offsetMap.length) {
		return offsetMap[offsetMap.length - 1] ?? 0;
	}

	return offsetMap[utf16Pos] ?? 0;
}

/**
 * Compute 1-based line/column from a UTF-16 position.
 */
export function positionToLineColumn(
	source: string,
	utf16Pos: number,
): { line: number; column: number } {
	let line = 1;
	let column = 1;

	for (let index = 0; index < utf16Pos && index < source.length; index += 1) {
		if (source.charCodeAt(index) === 0x0a) {
			line += 1;
			column = 1;
		} else {
			column += 1;
		}
	}

	return { line, column };
}
