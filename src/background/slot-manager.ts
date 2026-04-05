export class SlotManager {
	private readonly occupiedSlots = new Set<string>();

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

	release(slotId: string): void {
		this.occupiedSlots.delete(slotId);
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
}
