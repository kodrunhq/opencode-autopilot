import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initMemoryDb } from "../../src/memory/database";
import { upsertProjectGitFingerprint, upsertProjectRecord } from "../../src/projects/repository";
import {
	normalizeGitRemoteUrl,
	resolveProjectIdentity,
	resolveProjectIdentitySync,
} from "../../src/projects/resolve";

describe("resolveProjectIdentity", () => {
	let db: Database;

	beforeEach(() => {
		db = new Database(":memory:");
		initMemoryDb(db);
	});

	afterEach(() => {
		db.close();
	});

	test("creates a new project record when none exists", async () => {
		const project = await resolveProjectIdentity("/tmp/project-a", {
			db,
			now: () => "2026-04-05T00:00:00.000Z",
			createProjectId: () => "project-1",
			readGitFingerprint: async () => null,
		});

		expect(project.id).toBe("project-1");
		expect(project.path).toBe("/tmp/project-a");
		expect(project.firstSeenAt).toBe("2026-04-05T00:00:00.000Z");
	});

	test("returns the current-path project when one already exists", async () => {
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

		const project = await resolveProjectIdentity("/tmp/project-a", {
			db,
			now: () => "2026-04-06T00:00:00.000Z",
			readGitFingerprint: async () => null,
		});

		expect(project.id).toBe("project-1");
		expect(project.lastUpdated).toBe("2026-04-06T00:00:00.000Z");
	});

	test("relinks by unique git fingerprint when path changed", async () => {
		await resolveProjectIdentity("/tmp/project-a", {
			db,
			now: () => "2026-04-05T00:00:00.000Z",
			createProjectId: () => "project-1",
			readGitFingerprint: async () => ({
				normalizedRemoteUrl: "https://github.com/example/project-a",
				defaultBranch: "main",
			}),
		});

		const project = await resolveProjectIdentity("/tmp/project-a-renamed", {
			db,
			now: () => "2026-04-06T00:00:00.000Z",
			readGitFingerprint: async () => ({
				normalizedRemoteUrl: "https://github.com/example/project-a",
				defaultBranch: "main",
			}),
		});

		expect(project.id).toBe("project-1");
		expect(project.path).toBe("/tmp/project-a-renamed");
	});

	test("creates a new project when git fingerprint is ambiguous", async () => {
		upsertProjectRecord(
			{
				id: "project-1",
				path: "/tmp/project-a-1",
				name: "project-a-1",
				firstSeenAt: "2026-04-05T00:00:00.000Z",
				lastUpdated: "2026-04-05T00:00:00.000Z",
			},
			db,
		);
		upsertProjectRecord(
			{
				id: "project-2",
				path: "/tmp/project-b-1",
				name: "project-b-1",
				firstSeenAt: "2026-04-05T01:00:00.000Z",
				lastUpdated: "2026-04-05T01:00:00.000Z",
			},
			db,
		);
		upsertProjectGitFingerprint(
			"project-1",
			{
				normalizedRemoteUrl: "https://github.com/example/shared",
				defaultBranch: "main",
			},
			"2026-04-05T00:30:00.000Z",
			db,
		);
		upsertProjectGitFingerprint(
			"project-2",
			{
				normalizedRemoteUrl: "https://github.com/example/shared",
				defaultBranch: "main",
			},
			"2026-04-05T01:30:00.000Z",
			db,
		);

		const project = await resolveProjectIdentity("/tmp/project-c", {
			db,
			now: () => "2026-04-06T00:00:00.000Z",
			createProjectId: () => "project-3",
			readGitFingerprint: async () => ({
				normalizedRemoteUrl: "https://github.com/example/shared",
				defaultBranch: "main",
			}),
		});

		expect(project.id).toBe("project-3");
		expect(project.path).toBe("/tmp/project-c");
	});

	test("readonly sync resolution returns existing project without mutating", async () => {
		const dbPath = join(await mkdtemp(join(tmpdir(), "project-resolve-")), "memory.db");
		const writableDb = new Database(dbPath);
		initMemoryDb(writableDb);

		try {
			upsertProjectRecord(
				{
					id: "project-1",
					path: "/tmp/project-a",
					name: "project-a",
					firstSeenAt: "2026-04-05T00:00:00.000Z",
					lastUpdated: "2026-04-05T00:00:00.000Z",
				},
				writableDb,
			);
		} finally {
			writableDb.close();
		}

		const readonlyDb = new Database(dbPath, { readonly: true });

		try {
			const project = resolveProjectIdentitySync("/tmp/project-a", {
				db: readonlyDb,
				now: () => "2026-04-06T00:00:00.000Z",
				readGitFingerprint: () => null,
				allowCreate: false,
			});

			expect(project.id).toBe("project-1");
			expect(project.lastUpdated).toBe("2026-04-05T00:00:00.000Z");
		} finally {
			readonlyDb.close();
			await rm(dbPath, { force: true });
		}
	});

	test("normalizes URL and SCP remotes to the same fingerprint", () => {
		expect(normalizeGitRemoteUrl("git@github.com:Example/Repo.git")).toBe(
			"github.com/Example/Repo",
		);
		expect(normalizeGitRemoteUrl("https://github.com/Example/Repo.git")).toBe(
			"github.com/Example/Repo",
		);
	});
});
