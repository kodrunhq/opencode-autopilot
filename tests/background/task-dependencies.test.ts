import { beforeEach, describe, expect, it } from "bun:test";
import { TaskDependencyTracker } from "../../src/background/task-dependencies";

describe("TaskDependencyTracker", () => {
	let tracker: TaskDependencyTracker;

	beforeEach(() => {
		tracker = new TaskDependencyTracker();
	});

	describe("register", () => {
		it("registers a task with no dependencies", () => {
			tracker.register("task-a");

			expect(tracker.getParent("task-a")).toBeNull();
			expect(tracker.getChildren("task-a")).toEqual([]);
			expect(tracker.areDependenciesMet("task-a", new Set())).toBe(true);
		});

		it("registers a task with dependencies", () => {
			tracker.register("task-a", { dependsOn: ["dep-1", "dep-2", "dep-1"] });

			expect(tracker.areDependenciesMet("task-a", new Set(["dep-1"]))).toBe(false);
			expect(tracker.areDependenciesMet("task-a", new Set(["dep-1", "dep-2"]))).toBe(true);
			expect(tracker.getDependency("task-a")?.dependsOn).toEqual(["dep-1", "dep-2"]);
		});

		it("registering twice updates the task without duplicating children", () => {
			tracker.register("parent-1");
			tracker.register("task-a", { parentId: "parent-1" });
			tracker.register("parent-2");
			tracker.register("task-a", { parentId: "parent-2" });

			expect(tracker.getParent("task-a")).toBe("parent-2");
			expect(tracker.getChildren("parent-1")).toEqual([]);
			expect(tracker.getChildren("parent-2")).toEqual(["task-a"]);
		});
	});

	describe("areDependenciesMet", () => {
		it("returns true when all dependencies are completed", () => {
			tracker.register("task-a", { dependsOn: ["dep-1", "dep-2"] });

			expect(tracker.areDependenciesMet("task-a", new Set(["dep-1", "dep-2"]))).toBe(true);
		});

		it("returns false when dependencies are not completed", () => {
			tracker.register("task-a", { dependsOn: ["dep-1", "dep-2"] });

			expect(tracker.areDependenciesMet("task-a", new Set(["dep-1"]))).toBe(false);
		});
	});

	describe("parent/children lookups", () => {
		it("returns correct child task ids", () => {
			tracker.register("parent");
			tracker.register("task-b", { parentId: "parent" });
			tracker.register("task-a", { parentId: "parent" });

			expect(tracker.getChildren("parent")).toEqual(["task-a", "task-b"]);
		});

		it("returns the correct parent", () => {
			tracker.register("parent");
			tracker.register("task-a", { parentId: "parent" });

			expect(tracker.getParent("task-a")).toBe("parent");
		});
	});

	describe("unregister", () => {
		it("removes a task and detaches it from its parent", () => {
			tracker.register("parent");
			tracker.register("task-a", { parentId: "parent", dependsOn: ["dep-1"] });

			tracker.unregister("task-a");

			expect(tracker.getParent("task-a")).toBeNull();
			expect(tracker.getChildren("parent")).toEqual([]);
			expect(tracker.getDependency("task-a")).toBeNull();
		});

		it("ignores unregistering a non-existent task", () => {
			tracker.unregister("missing");

			expect(tracker.getDependency("missing")).toBeNull();
		});
	});

	describe("getBlockedTasks", () => {
		it("returns tasks whose dependencies are not met", () => {
			tracker.register("task-a", { dependsOn: ["dep-1"] });
			tracker.register("task-b", { dependsOn: ["dep-1", "dep-2"] });
			tracker.register("task-c");

			expect(tracker.getBlockedTasks(new Set(["dep-1"]))).toEqual(["task-b"]);
		});
	});

	describe("clear", () => {
		it("removes all tasks and relationships", () => {
			tracker.register("parent");
			tracker.register("task-a", { parentId: "parent", dependsOn: ["dep-1"] });

			tracker.clear();

			expect(tracker.getParent("task-a")).toBeNull();
			expect(tracker.getChildren("parent")).toEqual([]);
			expect(tracker.areDependenciesMet("task-a", new Set(["dep-1"]))).toBe(true);
			expect(tracker.getBlockedTasks(new Set(["dep-1"]))).toEqual([]);
		});
	});
});
