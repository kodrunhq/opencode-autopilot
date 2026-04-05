import type { PriorityLevel } from "./priority-queue";

export class SlotManager {
	private readonly occupiedSlots = new Set<string>();
	private readonly slotPriorities = new Map<string, PriorityLevel>();

	constructor(private readonly maxSlots: number) {
		if (!Number.isInteger(maxSlots) || maxSlots < 1) {
			throw new Error("SlotManager requires at least one slot");
		}
	}

	acquire(): string | null {
		if (this.isFull()) {
			return null;
		}

		for (let index = 1; index <= this.maxSlots; index += 1) {
			const slotId = `slot-${index}`;
			if (!this.occupiedSlots.has(slotId)) {
				this.occupiedSlots.add(slotId);
				return slotId;
			}
		}

		return null;
	}

	acquireByPriority(priority: PriorityLevel): string | null {
		const slotId = this.acquire();
		if (!slotId) {
			return null;
		}

		this.setSlotPriority(slotId, priority);
		return slotId;
	}

	release(slotId: string): void {
		this.occupiedSlots.delete(slotId);
		this.slotPriorities.delete(slotId);
	}

	getActiveCount(): number {
		return this.occupiedSlots.size;
	}

	isFull(): boolean {
		return this.occupiedSlots.size >= this.maxSlots;
	}

	getCapacity(): number {
		return this.maxSlots;
	}

	canAcquire(priority: PriorityLevel): boolean {
		if (!this.isFull()) {
			return true;
		}

		const lowestPriority = this.getLowestPriority();
		return lowestPriority !== null && priority < lowestPriority;
	}

	getLowestPriority(): PriorityLevel | null {
		let lowestPriority: PriorityLevel | null = null;
		for (const priority of this.slotPriorities.values()) {
			if (lowestPriority === null || priority > lowestPriority) {
				lowestPriority = priority;
			}
		}

		return lowestPriority;
	}

	setSlotPriority(slotId: string, priority: PriorityLevel): void {
		if (!this.occupiedSlots.has(slotId)) {
			return;
		}

		this.slotPriorities.set(slotId, priority);
	}

	getPreemptionCandidate(): string | null {
		let candidateSlotId: string | null = null;
		let candidatePriority: PriorityLevel | null = null;
		for (const [slotId, priority] of this.slotPriorities) {
			if (candidatePriority === null || priority > candidatePriority) {
				candidateSlotId = slotId;
				candidatePriority = priority;
			}
		}

		return candidateSlotId;
	}
}
