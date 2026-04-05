import { describe, expect, test } from "bun:test";
import { SlotManager } from "../../src/background/slot-manager";

describe("SlotManager", () => {
	test("acquires slots until full and never exceeds capacity", () => {
		const manager = new SlotManager(2);

		const first = manager.acquire();
		const second = manager.acquire();
		const third = manager.acquire();

		expect(first).toBe("slot-1");
		expect(second).toBe("slot-2");
		expect(third).toBeNull();
		expect(manager.getActiveCount()).toBe(2);
		expect(manager.isFull()).toBe(true);
		expect(manager.getCapacity()).toBe(2);
	});

	test("reuses released slots", () => {
		const manager = new SlotManager(2);
		const first = manager.acquire();
		const second = manager.acquire();
		expect(first).toBe("slot-1");
		if (!first) {
			throw new Error("Expected first slot to be acquired");
		}
		manager.release(first);

		const recycled = manager.acquire();

		expect(second).toBe("slot-2");
		expect(recycled).toBe("slot-1");
		expect(manager.getActiveCount()).toBe(2);
	});
});
