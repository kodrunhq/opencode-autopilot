import { beforeEach, describe, expect, it } from "bun:test";
import { PRIORITY, PriorityQueue } from "../../src/background/priority-queue";

describe("PriorityQueue", () => {
	let queue: PriorityQueue<string>;

	beforeEach(() => {
		queue = new PriorityQueue<string>();
	});

	describe("enqueue/dequeue", () => {
		it("dequeues lower numbers before higher numbers", () => {
			queue.enqueue("low", PRIORITY.LOW);
			queue.enqueue("critical", PRIORITY.CRITICAL);
			queue.enqueue("normal", PRIORITY.NORMAL);

			expect(queue.dequeue()).toBe("critical");
			expect(queue.dequeue()).toBe("normal");
			expect(queue.dequeue()).toBe("low");
		});

		it("preserves fifo order for equal priorities", () => {
			queue.enqueue("first", PRIORITY.HIGH);
			queue.enqueue("second", PRIORITY.HIGH);
			queue.enqueue("third", PRIORITY.HIGH);

			expect(queue.dequeue()).toBe("first");
			expect(queue.dequeue()).toBe("second");
			expect(queue.dequeue()).toBe("third");
		});

		it("dequeues null when empty", () => {
			expect(queue.dequeue()).toBeNull();
		});

		it("handles a single item", () => {
			queue.enqueue("only", PRIORITY.NORMAL);

			expect(queue.dequeue()).toBe("only");
			expect(queue.dequeue()).toBeNull();
		});

		it("handles many items in sorted order", () => {
			const values = Array.from({ length: 25 }, (_, index) => `task-${index}`);

			for (const [index, value] of values.entries()) {
				queue.enqueue(value, index % 4);
			}

			const result: string[] = [];
			while (!queue.isEmpty()) {
				const item = queue.dequeue();
				expect(item).not.toBeNull();
				if (item) {
					result.push(item);
				}
			}

			expect(result).toHaveLength(25);
			expect(result.slice(0, 7)).toEqual([
				"task-0",
				"task-4",
				"task-8",
				"task-12",
				"task-16",
				"task-20",
				"task-24",
			]);
		});
	});

	describe("peek", () => {
		it("returns highest priority item without removing it", () => {
			queue.enqueue("low", PRIORITY.LOW);
			queue.enqueue("high", PRIORITY.HIGH);

			expect(queue.peek()).toBe("high");
			expect(queue.size()).toBe(2);
			expect(queue.dequeue()).toBe("high");
		});
	});

	describe("size", () => {
		it("tracks the number of queued items", () => {
			expect(queue.size()).toBe(0);

			queue.enqueue("one", PRIORITY.NORMAL);
			queue.enqueue("two", PRIORITY.NORMAL);

			expect(queue.size()).toBe(2);
			queue.dequeue();
			expect(queue.size()).toBe(1);
		});
	});

	describe("isEmpty", () => {
		it("returns true when empty and false when populated", () => {
			expect(queue.isEmpty()).toBe(true);

			queue.enqueue("item", PRIORITY.NORMAL);

			expect(queue.isEmpty()).toBe(false);
		});
	});

	describe("clear", () => {
		it("removes all items", () => {
			queue.enqueue("one", PRIORITY.CRITICAL);
			queue.enqueue("two", PRIORITY.LOW);

			queue.clear();

			expect(queue.size()).toBe(0);
			expect(queue.isEmpty()).toBe(true);
			expect(queue.peek()).toBeNull();
			expect(queue.dequeue()).toBeNull();
		});
	});

	describe("toArray", () => {
		it("returns items sorted by priority and fifo within equal priorities", () => {
			queue.enqueue("low-a", PRIORITY.LOW);
			queue.enqueue("critical", PRIORITY.CRITICAL);
			queue.enqueue("high-a", PRIORITY.HIGH);
			queue.enqueue("high-b", PRIORITY.HIGH);

			expect(queue.toArray().map((entry) => entry.item)).toEqual([
				"critical",
				"high-a",
				"high-b",
				"low-a",
			]);
		});
	});
});
