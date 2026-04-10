#!/usr/bin/env bun

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { access, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

function isStringArray(value: unknown): value is ReadonlyArray<string> {
	return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

async function pathExists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

async function removePackageDir(nodeModulesDir: string, packageName: string): Promise<void> {
	await rm(join(nodeModulesDir, ...packageName.split("/")), { recursive: true, force: true });
}

export function stripPackageJson(pkg: Record<string, unknown>): Record<string, unknown> {
	const files = isStringArray(pkg.files)
		? pkg.files.filter((entry) => entry !== "bin" && entry !== "bin/")
		: undefined;

	return {
		...(typeof pkg.name === "string" ? { name: pkg.name } : {}),
		...(typeof pkg.version === "string" ? { version: pkg.version } : {}),
		...(typeof pkg.description === "string" ? { description: pkg.description } : {}),
		...(typeof pkg.main === "string" ? { main: pkg.main } : {}),
		...(pkg.dependencies && typeof pkg.dependencies === "object"
			? { dependencies: pkg.dependencies }
			: {}),
		...(pkg.peerDependencies && typeof pkg.peerDependencies === "object"
			? { peerDependencies: pkg.peerDependencies }
			: {}),
		...(typeof pkg.type === "string" ? { type: pkg.type } : {}),
		...(typeof pkg.license === "string" ? { license: pkg.license } : {}),
		...(files ? { files } : {}),
	};
}

function collectPackageNames(pkg: Record<string, unknown>, field: string): ReadonlyArray<string> {
	const value = pkg[field];
	return value && typeof value === "object" ? Object.keys(value) : [];
}

export async function prepareBundleDir(sourceDir: string, targetDir: string): Promise<void> {
	const sourcePackagePath = join(sourceDir, "package.json");
	const targetPackagePath = join(targetDir, "package.json");
	const sourcePackage = JSON.parse(await readFile(sourcePackagePath, "utf8")) as Record<
		string,
		unknown
	>;

	const devOnly = new Set(collectPackageNames(sourcePackage, "devDependencies"));
	const productionNames = new Set([
		...collectPackageNames(sourcePackage, "dependencies"),
		...collectPackageNames(sourcePackage, "peerDependencies"),
	]);
	for (const name of productionNames) {
		devOnly.delete(name);
	}

	await mkdir(targetDir, { recursive: true });
	await cp(join(sourceDir, "src"), join(targetDir, "src"), { recursive: true });
	await cp(join(sourceDir, "assets"), join(targetDir, "assets"), { recursive: true });
	const runtimeCheckPath = join(sourceDir, "bin", "check-runtime.js");
	if (await pathExists(runtimeCheckPath)) {
		await mkdir(join(targetDir, "bin"), { recursive: true });
		await cp(runtimeCheckPath, join(targetDir, "bin", "check-runtime.js"));
	}

	// Install from the original package.json + lockfile for reproducible builds,
	// then overwrite with the stripped version for the final bundle.
	await cp(sourcePackagePath, targetPackagePath);
	const sourceLockPath = join(sourceDir, "bun.lock");
	if (await pathExists(sourceLockPath)) {
		await cp(sourceLockPath, join(targetDir, "bun.lock"));
	}

	execFileSync("bun", ["install", "--frozen-lockfile"], {
		cwd: targetDir,
		stdio: "inherit",
	});

	await writeFile(
		targetPackagePath,
		`${JSON.stringify(stripPackageJson(sourcePackage), null, "\t")}\n`,
	);
	await rm(join(targetDir, "bun.lock"), { force: true });

	const nodeModulesDir = join(targetDir, "node_modules");
	for (const packageName of devOnly) {
		await removePackageDir(nodeModulesDir, packageName);
	}

	for (const requiredDep of ["yaml", join("@opencode-ai", "plugin")]) {
		if (!(await pathExists(join(nodeModulesDir, requiredDep)))) {
			throw new Error(`Missing required dependency: ${requiredDep}`);
		}
	}
}

async function createBundle(): Promise<string> {
	const sourceDir = process.cwd();
	const sourcePackage = JSON.parse(
		await readFile(join(sourceDir, "package.json"), "utf8"),
	) as Record<string, unknown>;
	const version = sourcePackage.version;

	if (typeof version !== "string") {
		throw new Error("package.json version must be a string");
	}

	const tempDir = await mkdtemp(join(tmpdir(), "oca-bundle-"));
	try {
		await prepareBundleDir(sourceDir, tempDir);
		const tarballName = `opencode-autopilot-local-v${version}.tar.gz`;
		const tarballPath = join(sourceDir, tarballName);

		execFileSync("tar", ["-czf", tarballPath, "-C", tempDir, "."], {
			stdio: "inherit",
		});

		const tarballBuffer = await readFile(tarballPath);
		const checksum = createHash("sha256").update(tarballBuffer).digest("hex");
		await writeFile(join(sourceDir, `${tarballName}.sha256`), `${checksum}  ${tarballName}\n`);
		return tarballName;
	} finally {
		await rm(tempDir, { recursive: true, force: true });
	}
}

if (import.meta.main) {
	try {
		const tarballName = await createBundle();
		console.log(tarballName);
	} catch (error: unknown) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	}
}
