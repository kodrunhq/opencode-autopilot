const DEFAULT_TERMINAL_WIDTH = 120;
const MIN_WRAP_WIDTH = 24;

interface TableOptions {
	readonly minWidths?: readonly number[];
	readonly maxWidth?: number;
}

export function sanitizeCell(value: string | number | boolean | null): string {
	return String(value ?? "")
		.replace(/\|/g, "\\|")
		.replace(/\n/g, " ");
}

export function formatTimestamp(value: string | null): string {
	return value ?? "-";
}

export function truncateText(value: string, maxLength: number): string {
	if (value.length <= maxLength) {
		return value;
	}

	return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

export function getTerminalWidth(): number {
	return process.stdout.columns ?? DEFAULT_TERMINAL_WIDTH;
}

function normalizeCell(value: string): string {
	return sanitizeCell(value).replace(/\r?\n/g, " ");
}

function padCell(value: string, width: number): string {
	return truncateText(normalizeCell(value), width).padEnd(width, " ");
}

function separatorWidth(columnCount: number): number {
	return columnCount * 3 + 1;
}

export function calculateColumnWidths(
	headers: readonly string[],
	rows: readonly (readonly string[])[],
	options: TableOptions = {},
): readonly number[] {
	const desiredWidths = headers.map((header, index) => {
		const rowWidths = rows.map((row) => normalizeCell(row[index] ?? "").length);
		return Math.max(normalizeCell(header).length, ...rowWidths);
	});
	const minWidths = desiredWidths.map((desired, index) =>
		Math.min(desired, options.minWidths?.[index] ?? desired),
	);
	const availableWidth = Math.max(
		minWidths.reduce((sum, width) => sum + width, 0),
		(options.maxWidth ?? getTerminalWidth()) - separatorWidth(headers.length),
	);
	const desiredWidth = desiredWidths.reduce((sum, width) => sum + width, 0);
	if (desiredWidth <= availableWidth) {
		return desiredWidths;
	}

	const widths = [...minWidths];
	let remainingWidth = availableWidth - minWidths.reduce((sum, width) => sum + width, 0);
	const expandable = desiredWidths.map((desired, index) =>
		Math.max(0, desired - (minWidths[index] ?? 0)),
	);
	const totalExpandable = expandable.reduce((sum, width) => sum + width, 0);
	if (remainingWidth <= 0 || totalExpandable === 0) {
		return widths;
	}

	for (const [index, extraWidth] of expandable.entries()) {
		const allocation = Math.min(
			extraWidth,
			Math.floor((remainingWidth * extraWidth) / totalExpandable),
		);
		widths[index] = (widths[index] ?? 0) + allocation;
		remainingWidth -= allocation;
	}

	while (remainingWidth > 0) {
		const nextIndex = expandable.findIndex(
			(extraWidth, index) => extraWidth > (widths[index] ?? 0) - (minWidths[index] ?? 0),
		);
		if (nextIndex < 0) {
			break;
		}
		widths[nextIndex] = (widths[nextIndex] ?? 0) + 1;
		remainingWidth -= 1;
	}

	return widths;
}

export function renderTable(
	headers: readonly string[],
	rows: readonly (readonly string[])[],
	options: TableOptions = {},
): string {
	const widths = calculateColumnWidths(headers, rows, options);
	const renderRow = (cells: readonly string[]) =>
		`| ${cells.map((cell, index) => padCell(cell, widths[index] ?? 1)).join(" | ")} |`;
	const divider = `|-${widths.map((width) => "-".repeat(width)).join("-|-")}-|`;
	return [renderRow(headers), divider, ...rows.map(renderRow)].join("\n");
}

export function wrapText(value: string, width = getTerminalWidth() - 4): readonly string[] {
	const wrapWidth = Math.max(MIN_WRAP_WIDTH, width);
	const lines: string[] = [];

	for (const paragraph of value.split(/\r?\n/)) {
		if (paragraph.length === 0) {
			lines.push("");
			continue;
		}

		let currentLine = "";
		for (const word of paragraph.split(/\s+/)) {
			if (currentLine.length === 0) {
				currentLine = word;
				continue;
			}
			if (`${currentLine} ${word}`.length <= wrapWidth) {
				currentLine = `${currentLine} ${word}`;
				continue;
			}
			lines.push(currentLine);
			currentLine = word;
		}
		if (currentLine.length > 0) {
			lines.push(currentLine);
		}
	}

	return lines;
}

export function indentLines(lines: readonly string[], indent = "  "): readonly string[] {
	return lines.map((line) => `${indent}${line}`);
}
