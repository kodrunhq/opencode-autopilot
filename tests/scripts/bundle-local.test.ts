import { afterEach, describe, expect, mock, test } from "bun:test";
import type { ExecFileSyncOptions } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const originalExecFileSync = (await import("node:child_process")).execFileSync;

interface BunInstallSnapshot {
	readonly args: ReadonlyArray<string>;
	readonly hadLockfile: boolean;
	readonly hadDevDependencies: boolean;
	readonly hadRuntimeCheck: boolean;
}

const bunInstallSnapshots: BunInstallSnapshot[] = [];

mock.module("node:child_process", () => ({
	execFileSync: (
		file: string,
		args: ReadonlyArray<string>,
		options?: ExecFileSyncOptions,
	): string | Buffer => {
		if (file === "bun" && args[0] === "install") {
			const cwd = String(options?.cwd ?? process.cwd());
			const fs = require("node:fs");
			const hadLockfile = fs.existsSync(join(cwd, "bun.lock"));
			const pkg = JSON.parse(fs.readFileSync(join(cwd, "package.json"), "utf8")) as Record<
				string,
				unknown
			>;
			const hadDevDependencies =
				pkg.devDependencies != null && Object.keys(pkg.devDependencies as object).length > 0;
			const hadRuntimeCheck = fs.existsSync(join(cwd, "bin", "check-runtime.js"));
			bunInstallSnapshots.push({
				args: [...args],
				hadLockfile,
				hadDevDependencies,
				hadRuntimeCheck,
			});
			const deps = pkg.dependencies as Record<string, string> | undefined;
			const peers = pkg.peerDependencies as Record<string, string> | undefined;

			for (const name of Object.keys(deps ?? {})) {
				const parts = name.split("/");
				const dir = join(cwd, "node_modules", ...parts);
				require("node:fs").mkdirSync(dir, { recursive: true });
				require("node:fs").writeFileSync(
					join(dir, "package.json"),
					JSON.stringify({ name, version: "0.0.0-stub" }),
				);
			}
			for (const name of Object.keys(peers ?? {})) {
				const parts = name.split("/");
				const dir = join(cwd, "node_modules", ...parts);
				require("node:fs").mkdirSync(dir, { recursive: true });
				require("node:fs").writeFileSync(
					join(dir, "package.json"),
					JSON.stringify({ name, version: "0.0.0-stub" }),
				);
			}
			return "";
		}
		return originalExecFileSync(file, args as string[], options);
	},
}));

const { prepareBundleDir, stripPackageJson } = await import("../../scripts/bundle-local");

const tempDirs: string[] = [];

async function createTempDir(): Promise<string> {
	const tempDir = await mkdtemp(join(tmpdir(), "oca-bundle-test-"));
	tempDirs.push(tempDir);
	return tempDir;
}

afterEach(async () => {
	bunInstallSnapshots.length = 0;
	await Promise.all(
		tempDirs.splice(0).map((tempDir) => rm(tempDir, { recursive: true, force: true })),
	);
});

describe("stripPackageJson", () => {
	test("removes non-production fields and excludes bin from files", () => {
		const result = stripPackageJson({
			name: "test-package",
			version: "1.2.3",
			description: "bundle test",
			main: "src/index.ts",
			dependencies: { yaml: "^2.8.3" },
			peerDependencies: { "@opencode-ai/plugin": ">=1.3.0" },
			type: "module",
			license: "MIT",
			files: ["src/", "assets/", "bin/"],
			devDependencies: { "@biomejs/biome": "^2.4.10" },
			scripts: { lint: "biome check ." },
			publishConfig: { access: "public" },
			bin: { cli: "bin/cli.ts" },
		});

		expect(result).toEqual({
			name: "test-package",
			version: "1.2.3",
			description: "bundle test",
			main: "src/index.ts",
			dependencies: { yaml: "^2.8.3" },
			peerDependencies: { "@opencode-ai/plugin": ">=1.3.0" },
			type: "module",
			license: "MIT",
			files: ["src/", "assets/"],
		});
	});
});

describe("prepareBundleDir", () => {
	test("copies production assets, installs with frozen lockfile, and strips package.json", async () => {
		const sourceDir = await createTempDir();
		const targetDir = await createTempDir();

		await mkdir(join(sourceDir, "src"), { recursive: true });
		await mkdir(join(sourceDir, "assets"), { recursive: true });
		await mkdir(join(sourceDir, "bin"), { recursive: true });
		await writeFile(join(sourceDir, "src", "index.ts"), "export const value = 1;\n");
		await writeFile(join(sourceDir, "assets", "test.md"), "# asset\n");
		await writeFile(join(sourceDir, "bin", "check-runtime.js"), "#!/usr/bin/env node\n");
		await writeFile(join(sourceDir, "bun.lock"), "# bun lockfile\n");
		await writeFile(
			join(sourceDir, "package.json"),
			`${JSON.stringify(
				{
					name: "bundle-test-package",
					version: "0.0.1",
					description: "bundle test package",
					main: "src/index.ts",
					dependencies: { yaml: "^2.8.3" },
					devDependencies: { "@biomejs/biome": "^2.4.10" },
					peerDependencies: { "@opencode-ai/plugin": ">=1.3.0" },
					type: "module",
					license: "MIT",
					files: ["src/", "assets/", "bin/"],
					scripts: {
						preinstall: "node ./bin/check-runtime.js",
						lint: "biome check .",
					},
					publishConfig: { access: "public" },
					bin: { cli: "bin/cli.ts" },
				},
				null,
				"\t",
			)}\n`,
		);

		await prepareBundleDir(sourceDir, targetDir);

		expect(bunInstallSnapshots).toHaveLength(1);
		expect(bunInstallSnapshots[0].args).toEqual(["install", "--frozen-lockfile"]);
		expect(bunInstallSnapshots[0].hadLockfile).toBe(true);
		expect(bunInstallSnapshots[0].hadDevDependencies).toBe(true);
		expect(bunInstallSnapshots[0].hadRuntimeCheck).toBe(true);

		expect(await readFile(join(targetDir, "src", "index.ts"), "utf8")).toBe(
			"export const value = 1;\n",
		);
		expect(await readFile(join(targetDir, "assets", "test.md"), "utf8")).toBe("# asset\n");
		expect(await readFile(join(targetDir, "bin", "check-runtime.js"), "utf8")).toBe(
			"#!/usr/bin/env node\n",
		);

		const bundledPackage = JSON.parse(
			await readFile(join(targetDir, "package.json"), "utf8"),
		) as Record<string, unknown>;
		expect(bundledPackage.devDependencies).toBeUndefined();
		expect(bundledPackage.files).toEqual(["src/", "assets/"]);

		await expect(access(join(targetDir, "node_modules", "yaml")).then(() => true)).resolves.toBe(
			true,
		);
		await expect(
			access(join(targetDir, "node_modules", "@opencode-ai", "plugin")).then(() => true),
		).resolves.toBe(true);

		await expect(access(join(targetDir, "bun.lock"))).rejects.toThrow();
	});

	test("preserves packages that are both devDependencies and peerDependencies", async () => {
		const sourceDir = await createTempDir();
		const targetDir = await createTempDir();

		await mkdir(join(sourceDir, "src"), { recursive: true });
		await mkdir(join(sourceDir, "assets"), { recursive: true });
		await mkdir(join(sourceDir, "bin"), { recursive: true });
		await writeFile(join(sourceDir, "src", "index.ts"), "export const v = 1;\n");
		await writeFile(join(sourceDir, "assets", "a.md"), "# a\n");
		await writeFile(join(sourceDir, "bin", "check-runtime.js"), "#!/usr/bin/env node\n");
		await writeFile(join(sourceDir, "bun.lock"), "# bun lockfile\n");
		await writeFile(
			join(sourceDir, "package.json"),
			`${JSON.stringify(
				{
					name: "overlap-test",
					version: "0.0.1",
					main: "src/index.ts",
					dependencies: { yaml: "^2.8.3" },
					devDependencies: {
						"@opencode-ai/plugin": "^1.3.8",
						"@biomejs/biome": "^2.4.10",
					},
					peerDependencies: { "@opencode-ai/plugin": ">=1.3.0" },
					scripts: { preinstall: "node ./bin/check-runtime.js" },
					type: "module",
				},
				null,
				"\t",
			)}\n`,
		);

		await prepareBundleDir(sourceDir, targetDir);

		expect(bunInstallSnapshots).toHaveLength(1);
		expect(bunInstallSnapshots[0].args).toEqual(["install", "--frozen-lockfile"]);
		expect(bunInstallSnapshots[0].hadRuntimeCheck).toBe(true);

		const pluginPath = join(targetDir, "node_modules", "@opencode-ai", "plugin");
		await expect(access(pluginPath).then(() => true)).resolves.toBe(true);

		const biomePath = join(targetDir, "node_modules", "@biomejs");
		await expect(access(biomePath).then(() => true)).rejects.toThrow();
	});
});
