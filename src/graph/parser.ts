/**
 * Code graph parser using the TypeScript compiler API.
 *
 * Extracts structural nodes (functions, classes, interfaces, methods)
 * and relationships (imports, exports, extends, implements, contains)
 * from TypeScript/JavaScript source files.
 */
import { createHash } from "node:crypto";
import ts from "typescript";
import { buildUtf16ToUtf8OffsetMap, utf16ToUtf8ByteOffset } from "./offsets";
import type { GraphEdge, GraphNode, GraphNodeType, ParsedFile } from "./types";

/** Check if a declaration name should be included in the graph. */
function isGraphableName(name: string): boolean {
	return name.length > 0 && !name.startsWith("__");
}

function createContentHash(content: string): string {
	return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

function findChildTokenStart(
	sourceFile: ts.SourceFile,
	node: ts.Node,
	kind: ts.SyntaxKind,
): number | null {
	for (const child of node.getChildren(sourceFile)) {
		if (child.kind === kind) {
			return child.getStart(sourceFile);
		}
	}

	return null;
}

function getGraphNodeStart(sourceFile: ts.SourceFile, node: ts.Node): number {
	if (ts.isFunctionDeclaration(node)) {
		return (
			findChildTokenStart(sourceFile, node, ts.SyntaxKind.FunctionKeyword) ??
			node.getStart(sourceFile)
		);
	}

	if (ts.isClassDeclaration(node)) {
		return (
			findChildTokenStart(sourceFile, node, ts.SyntaxKind.ClassKeyword) ?? node.getStart(sourceFile)
		);
	}

	if (ts.isInterfaceDeclaration(node)) {
		return (
			findChildTokenStart(sourceFile, node, ts.SyntaxKind.InterfaceKeyword) ??
			node.getStart(sourceFile)
		);
	}

	if (ts.isConstructorDeclaration(node)) {
		return (
			findChildTokenStart(sourceFile, node, ts.SyntaxKind.ConstructorKeyword) ??
			node.getStart(sourceFile)
		);
	}

	if (ts.isMethodDeclaration(node)) {
		return node.name.getStart(sourceFile);
	}

	return node.getStart(sourceFile);
}

function getLineCount(sourceText: string): number {
	if (sourceText.length === 0) {
		return 1;
	}

	let lineCount = 1;
	for (const character of sourceText) {
		if (character === "\n") {
			lineCount += 1;
		}
	}

	return lineCount;
}

function makeNode(
	filePath: string,
	name: string,
	type: GraphNodeType,
	node: ts.Node,
	sourceFile: ts.SourceFile,
	sourceText: string,
	offsetMap: readonly number[],
): GraphNode {
	const start = getGraphNodeStart(sourceFile, node);
	const end = node.end;
	const startPosition = ts.getLineAndCharacterOfPosition(sourceFile, start);
	const endPosition = ts.getLineAndCharacterOfPosition(sourceFile, end);
	const content = sourceText.slice(start, end);

	return {
		id: `${filePath}:${startPosition.line + 1}:${name}`,
		type,
		name,
		filePath,
		byteStart: utf16ToUtf8ByteOffset(offsetMap, start),
		byteEnd: utf16ToUtf8ByteOffset(offsetMap, end),
		lineStart: startPosition.line + 1,
		lineEnd: endPosition.line + 1,
		hash: createContentHash(content),
	};
}

/** Extract all graph nodes from a parsed source file. */
function extractNodes(
	sourceFile: ts.SourceFile,
	filePath: string,
	sourceText: string,
	offsetMap: readonly number[],
): readonly GraphNode[] {
	const nodes: GraphNode[] = [
		{
			id: `${filePath}:1:${filePath}`,
			type: "file",
			name: filePath,
			filePath,
			byteStart: 0,
			byteEnd: utf16ToUtf8ByteOffset(offsetMap, sourceText.length),
			lineStart: 1,
			lineEnd: getLineCount(sourceText),
			hash: createContentHash(sourceText),
		},
	];

	function visit(node: ts.Node): void {
		if (ts.isFunctionDeclaration(node)) {
			const name = node.name?.getText(sourceFile);
			if (name && isGraphableName(name)) {
				nodes.push(makeNode(filePath, name, "function", node, sourceFile, sourceText, offsetMap));
			}
		} else if (ts.isClassDeclaration(node)) {
			const name = node.name?.getText(sourceFile);
			if (name && isGraphableName(name)) {
				nodes.push(makeNode(filePath, name, "class", node, sourceFile, sourceText, offsetMap));

				for (const member of node.members) {
					if (ts.isMethodDeclaration(member)) {
						const methodName = member.name.getText(sourceFile);
						if (isGraphableName(methodName)) {
							nodes.push(
								makeNode(filePath, methodName, "method", member, sourceFile, sourceText, offsetMap),
							);
						}
					} else if (ts.isConstructorDeclaration(member)) {
						nodes.push(
							makeNode(
								filePath,
								"constructor",
								"method",
								member,
								sourceFile,
								sourceText,
								offsetMap,
							),
						);
					}
				}
			}
		} else if (ts.isInterfaceDeclaration(node)) {
			const name = node.name.getText(sourceFile);
			if (isGraphableName(name)) {
				nodes.push(makeNode(filePath, name, "interface", node, sourceFile, sourceText, offsetMap));
			}
		}

		ts.forEachChild(node, visit);
	}

	ts.forEachChild(sourceFile, visit);
	return Object.freeze(nodes);
}

function getNodeId(
	sourceFile: ts.SourceFile,
	filePath: string,
	node: ts.Node,
	name: string,
): string {
	const start = node.getStart(sourceFile);
	const position = ts.getLineAndCharacterOfPosition(sourceFile, start);
	return `${filePath}:${position.line + 1}:${name}`;
}

/** Extract edges from import/export/extends/implements declarations. */
function extractEdges(
	sourceFile: ts.SourceFile,
	filePath: string,
	nodes: readonly GraphNode[],
): readonly GraphEdge[] {
	const edges = new Map<string, GraphEdge>();
	const fileId = `${filePath}:1:${filePath}`;

	function addEdge(edge: GraphEdge): void {
		edges.set(`${edge.from}:${edge.type}:${edge.to}`, edge);
	}

	for (const node of nodes) {
		if (node.type === "function" || node.type === "class" || node.type === "interface") {
			addEdge({ from: fileId, to: node.id, type: "contains" });
		}
	}

	for (const statement of sourceFile.statements) {
		if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
			addEdge({
				from: fileId,
				to: statement.moduleSpecifier.text,
				type: "imports",
			});
		}

		if (
			ts.isExportDeclaration(statement) &&
			statement.moduleSpecifier &&
			ts.isStringLiteral(statement.moduleSpecifier)
		) {
			addEdge({
				from: fileId,
				to: statement.moduleSpecifier.text,
				type: "exports",
			});
		}

		if (!ts.isClassDeclaration(statement)) {
			continue;
		}

		const className = statement.name?.getText(sourceFile);
		if (!className || !isGraphableName(className)) {
			continue;
		}

		const classNodeId = getNodeId(sourceFile, filePath, statement, className);

		for (const member of statement.members) {
			if (ts.isMethodDeclaration(member)) {
				const methodName = member.name.getText(sourceFile);
				if (isGraphableName(methodName)) {
					addEdge({
						from: classNodeId,
						to: getNodeId(sourceFile, filePath, member, methodName),
						type: "contains",
					});
				}
			} else if (ts.isConstructorDeclaration(member)) {
				addEdge({
					from: classNodeId,
					to: getNodeId(sourceFile, filePath, member, "constructor"),
					type: "contains",
				});
			}
		}

		for (const clause of statement.heritageClauses ?? []) {
			if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
				for (const heritageType of clause.types) {
					addEdge({
						from: classNodeId,
						to: heritageType.expression.getText(sourceFile),
						type: "extends",
					});
				}
			}

			if (clause.token === ts.SyntaxKind.ImplementsKeyword) {
				for (const heritageType of clause.types) {
					addEdge({
						from: classNodeId,
						to: heritageType.expression.getText(sourceFile),
						type: "implements",
					});
				}
			}
		}
	}

	return Object.freeze([...edges.values()]);
}

function resolveScriptKind(filePath: string, scriptKind?: ts.ScriptKind): ts.ScriptKind {
	if (scriptKind !== undefined) {
		return scriptKind;
	}

	if (filePath.endsWith(".tsx")) {
		return ts.ScriptKind.TSX;
	}

	if (filePath.endsWith(".jsx")) {
		return ts.ScriptKind.JSX;
	}

	if (filePath.endsWith(".js")) {
		return ts.ScriptKind.JS;
	}

	return ts.ScriptKind.TS;
}

/**
 * Parse a source file and extract graph nodes and edges.
 *
 * @param sourceText - The source code text.
 * @param filePath - The relative file path (used as the node ID prefix).
 * @param scriptKind - Optional TypeScript script kind override.
 * @returns The parsed file with nodes and edges.
 */
export function parseFile(
	sourceText: string,
	filePath: string,
	scriptKind?: ts.ScriptKind,
): ParsedFile {
	const sourceFile = ts.createSourceFile(
		filePath,
		sourceText,
		ts.ScriptTarget.Latest,
		true,
		resolveScriptKind(filePath, scriptKind),
	);
	const offsetMap = buildUtf16ToUtf8OffsetMap(sourceText);
	const nodes = extractNodes(sourceFile, filePath, sourceText, offsetMap);
	const edges = extractEdges(sourceFile, filePath, nodes);

	return Object.freeze({
		filePath,
		nodes,
		edges,
	});
}
