export interface PriorityItem<T> {
	readonly item: T;
	readonly priority: number;
	readonly enqueuedAt: number;
}

export const PRIORITY = Object.freeze({
	CRITICAL: 0,
	HIGH: 1,
	NORMAL: 2,
	LOW: 3,
} as const);

export type PriorityLevel = (typeof PRIORITY)[keyof typeof PRIORITY];

function comparePriorityItems<T>(left: PriorityItem<T>, right: PriorityItem<T>): number {
	if (left.priority !== right.priority) {
		return left.priority - right.priority;
	}

	return left.enqueuedAt - right.enqueuedAt;
}

export class PriorityQueue<T> {
	private readonly heap: PriorityItem<T>[] = [];
	private nextEnqueuedAt = 0;

	enqueue(item: T, priority: number): void {
		const priorityItem = Object.freeze({
			item,
			priority,
			enqueuedAt: this.nextEnqueuedAt,
		});
		this.nextEnqueuedAt += 1;
		this.heap.push(priorityItem);
		this.bubbleUp(this.heap.length - 1);
	}

	dequeue(): T | null {
		if (this.heap.length === 0) {
			return null;
		}

		const [root] = this.heap;
		const last = this.heap.pop();
		if (last && this.heap.length > 0) {
			this.heap[0] = last;
			this.bubbleDown(0);
		}

		return root.item;
	}

	peek(): T | null {
		return this.heap[0]?.item ?? null;
	}

	size(): number {
		return this.heap.length;
	}

	isEmpty(): boolean {
		return this.heap.length === 0;
	}

	clear(): void {
		this.heap.length = 0;
	}

	toArray(): readonly PriorityItem<T>[] {
		return Object.freeze([...this.heap].sort(comparePriorityItems));
	}

	private bubbleUp(startIndex: number): void {
		let index = startIndex;
		while (index > 0) {
			const parentIndex = Math.floor((index - 1) / 2);
			if (comparePriorityItems(this.heap[index], this.heap[parentIndex]) >= 0) {
				return;
			}

			this.swap(index, parentIndex);
			index = parentIndex;
		}
	}

	private bubbleDown(startIndex: number): void {
		let index = startIndex;
		while (true) {
			const leftChildIndex = index * 2 + 1;
			const rightChildIndex = leftChildIndex + 1;
			let smallestIndex = index;

			if (
				leftChildIndex < this.heap.length &&
				comparePriorityItems(this.heap[leftChildIndex], this.heap[smallestIndex]) < 0
			) {
				smallestIndex = leftChildIndex;
			}

			if (
				rightChildIndex < this.heap.length &&
				comparePriorityItems(this.heap[rightChildIndex], this.heap[smallestIndex]) < 0
			) {
				smallestIndex = rightChildIndex;
			}

			if (smallestIndex === index) {
				return;
			}

			this.swap(index, smallestIndex);
			index = smallestIndex;
		}
	}

	private swap(leftIndex: number, rightIndex: number): void {
		const left = this.heap[leftIndex];
		this.heap[leftIndex] = this.heap[rightIndex];
		this.heap[rightIndex] = left;
	}
}
