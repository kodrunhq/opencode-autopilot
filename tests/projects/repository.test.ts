import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { initMemoryDb } from "../../src/memory/database";
import {
	getProjectByAnyPath,
	getProjectByCurrentPath,
	listProjectGitFingerprints,
	listProjectPaths,
	setProjectCurrentPath,
	upsertProjectGitFingerprint,
	upsertProjectRecord,
} from "../../src/projects/repository";

describe("projects repository", () => {
	let db: Database;

	beforeEach(() => {
		db = new Database(":memory:");
		initMemoryDb(db);
	});

	afterEach(() => {
		db.close();
	});

	test("creates and loads a project by current path", () => {
		upsertProjectRecord(
			{
				id: "project-1",
				path: "/tmp/project-a",
				name: "project-a",
				firstSeenAt: "2026-04-05T00:00:00.000Z",
				lastUpdated: "2026-04-05T00:00:00.000Z",
			},
			db,
		);

		const loaded = getProjectByCurrentPath("/tmp/project-a", db);
		expect(loaded?.id).toBe("project-1");
		expect(loaded?.firstSeenAt).toBe("2026-04-05T00:00:00.000Z");
	});

	test("retains historical paths after a path change", () => {
		upsertProjectRecord(
			{
				id: "project-1",
				path: "/tmp/project-a",
				name: "project-a",
				firstSeenAt: "2026-04-05T00:00:00.000Z",
				lastUpdated: "2026-04-05T00:00:00.000Z",
			},
			db,
		);

		setProjectCurrentPath(
			"project-1",
			"/tmp/project-a-renamed",
			"project-a-renamed",
			"2026-04-06T00:00:00.000Z",
			db,
		);

		const current = getProjectByCurrentPath("/tmp/project-a-renamed", db);
		const historical = getProjectByAnyPath("/tmp/project-a", db);
		const paths = listProjectPaths("project-1", db);

		expect(current?.id).toBe("project-1");
		expect(historical?.id).toBe("project-1");
		expect(paths).toHaveLength(2);
		expect(paths[0]?.isCurrent).toBe(true);
		expect(paths.some((entry) => entry.path === "/tmp/project-a")).toBe(true);
	});

	test("stores git fingerprint metadata", () => {
		upsertProjectRecord(
			{
				id: "project-1",
				path: "/tmp/project-a",
				name: "project-a",
				firstSeenAt: "2026-04-05T00:00:00.000Z",
				lastUpdated: "2026-04-05T00:00:00.000Z",
			},
			db,
		);

		upsertProjectGitFingerprint(
			"project-1",
			{
				normalizedRemoteUrl: "https://github.com/example/project-a",
				defaultBranch: "main",
			},
			"2026-04-05T01:00:00.000Z",
			db,
		);

		const fingerprints = listProjectGitFingerprints("project-1", db);
		expect(fingerprints).toHaveLength(1);
		expect(fingerprints[0]?.normalizedRemoteUrl).toBe("https://github.com/example/project-a");
		expect(fingerprints[0]?.defaultBranch).toBe("main");
	});
});
