import { describe, expect, test } from "bun:test";
import { parseFile } from "../../src/graph/parser";

describe("graph parser", () => {
	test("extracts function declarations from TypeScript", () => {
		const source = `
export function hello(name: string): string {
	return "Hello, " + name;
}

export function add(a: number, b: number): number {
	return a + b;
}
`;
		const result = parseFile(source, "src/greeting.ts");

		const functions = result.nodes.filter((node) => node.type === "function");
		expect(functions.length).toBe(2);
		expect(functions.map((node) => node.name).sort()).toEqual(["add", "hello"]);
	});

	test("extracts class with methods", () => {
		const source = `
export class UserService {
	constructor(private db: Database) {}

	async getUser(id: string): Promise<User> {
		return this.db.find(id);
	}

	setUser(user: User): void {
		this.db.save(user);
	}
}
`;
		const result = parseFile(source, "src/service.ts");

		const classes = result.nodes.filter((node) => node.type === "class");
		expect(classes.length).toBe(1);
		expect(classes[0]?.name).toBe("UserService");

		const methods = result.nodes.filter((node) => node.type === "method");
		expect(methods.length).toBe(3);
		expect(methods.map((node) => node.name).sort()).toEqual(["constructor", "getUser", "setUser"]);
	});

	test("extracts interface declarations", () => {
		const source = `
export interface User {
	id: string;
	name: string;
	email: string;
}

export interface Repository<T> {
	find(id: string): Promise<T>;
	save(entity: T): Promise<void>;
}
`;
		const result = parseFile(source, "src/types.ts");

		const interfaces = result.nodes.filter((node) => node.type === "interface");
		expect(interfaces.length).toBe(2);
		expect(interfaces.map((node) => node.name).sort()).toEqual(["Repository", "User"]);
	});

	test("extracts file node", () => {
		const source = `export const x = 1;\n`;
		const result = parseFile(source, "src/const.ts");

		const files = result.nodes.filter((node) => node.type === "file");
		expect(files.length).toBe(1);
		expect(files[0]?.name).toBe("src/const.ts");
		expect(files[0]?.lineStart).toBe(1);
	});

	test("extracts import edges", () => {
		const source = `
import { Database } from "./database";
import * as utils from "./utils";
import type { User } from "./types";

export function main(): void {}
`;
		const result = parseFile(source, "src/main.ts");

		const importEdges = result.edges.filter((edge) => edge.type === "imports");
		expect(importEdges.length).toBe(3);
		const targets = importEdges.map((edge) => edge.to).sort();
		expect(targets).toContain("./database");
		expect(targets).toContain("./utils");
		expect(targets).toContain("./types");
	});

	test("extracts export-from edges", () => {
		const source = `export { something } from "./module";\n`;
		const result = parseFile(source, "src/index.ts");

		const exportEdges = result.edges.filter((edge) => edge.type === "exports");
		expect(exportEdges.length).toBe(1);
		expect(exportEdges[0]?.to).toBe("./module");
	});

	test("extracts extends edges", () => {
		const source = `
export class BaseService {
	notify(): void {}
}

export class UserService extends BaseService {
	getUser(): void {}
}
`;
		const result = parseFile(source, "src/service.ts");

		const extendsEdges = result.edges.filter((edge) => edge.type === "extends");
		expect(extendsEdges.length).toBe(1);
		expect(extendsEdges[0]?.to).toBe("BaseService");
	});

	test("extracts implements edges", () => {
		const source = `
export interface Loggable {
	log(): void;
}

export class Logger implements Loggable {
	log(): void {
		console.log("log");
	}
}
`;
		const result = parseFile(source, "src/logger.ts");

		const implementationEdges = result.edges.filter((edge) => edge.type === "implements");
		expect(implementationEdges.length).toBe(1);
		expect(implementationEdges[0]?.to).toBe("Loggable");
	});

	test("extracts contains edges for file -> top-level and class -> method", () => {
		const source = `
export class Calculator {
	add(a: number, b: number): number {
		return a + b;
	}
}

export function helper(): void {}
`;
		const result = parseFile(source, "src/calc.ts");

		const containsEdges = result.edges.filter((edge) => edge.type === "contains");
		expect(containsEdges.length).toBeGreaterThanOrEqual(3);
	});

	test("produces correct byte offsets for ASCII source", () => {
		const source = `export function hello(): string {\n  return "world";\n}\n`;
		const result = parseFile(source, "src/hello.ts");

		const fn = result.nodes.find((node) => node.type === "function" && node.name === "hello");
		expect(fn).toBeDefined();
		expect(fn?.byteStart).toBeGreaterThanOrEqual(0);
		expect(fn?.byteEnd).toBeGreaterThan(fn?.byteStart ?? -1);
		expect(fn?.byteStart).toBe(source.indexOf("function hello"));
	});

	test("produces correct byte offsets for multibyte source", () => {
		const source = `// Comentario en español: ñoño\nexport function greet(): string {\n  return "hola ñ";\n}\n`;
		const result = parseFile(source, "src/greet.ts");

		const fn = result.nodes.find((node) => node.type === "function" && node.name === "greet");
		expect(fn).toBeDefined();
		expect(fn?.byteStart).toBeGreaterThanOrEqual(0);
		expect(fn?.byteEnd).toBeGreaterThan(fn?.byteStart ?? -1);
		expect(fn?.byteStart).toBeGreaterThan(source.indexOf("function greet"));
	});

	test("parses TSX files", () => {
		const source = `
export function App(): JSX.Element {
	return <div>Hello</div>;
}
`;
		const result = parseFile(source, "src/App.tsx");

		const functions = result.nodes.filter((node) => node.type === "function");
		expect(functions.length).toBe(1);
		expect(functions[0]?.name).toBe("App");
	});

	test("parses JSX files", () => {
		const source = `
export function Component() {
	return <span>test</span>;
}
`;
		const result = parseFile(source, "src/Component.jsx");

		const functions = result.nodes.filter((node) => node.type === "function");
		expect(functions.length).toBe(1);
		expect(functions[0]?.name).toBe("Component");
	});

	test("handles empty source", () => {
		const result = parseFile("", "src/empty.ts");

		const nonFileNodes = result.nodes.filter((node) => node.type !== "file");
		expect(nonFileNodes.length).toBe(0);
	});

	test("handles source with no extractable declarations", () => {
		const source = `export const x = 1;\nexport type ID = string;\n`;
		const result = parseFile(source, "src/constants.ts");

		const nonFileNodes = result.nodes.filter((node) => node.type !== "file");
		expect(nonFileNodes.length).toBe(0);
	});
});
