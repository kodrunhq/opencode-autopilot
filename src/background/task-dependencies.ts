export interface TaskDependency {
	readonly taskId: string;
	readonly dependsOn: readonly string[];
	readonly parentId: string | null;
	readonly children: readonly string[];
}

function createDependency(input: {
	readonly taskId: string;
	readonly dependsOn: readonly string[];
	readonly parentId: string | null;
	readonly children: readonly string[];
}): TaskDependency {
	return Object.freeze({
		taskId: input.taskId,
		dependsOn: Object.freeze([...input.dependsOn]),
		parentId: input.parentId,
		children: Object.freeze([...input.children]),
	});
}

export class TaskDependencyTracker {
	private readonly dependencies = new Map<string, TaskDependency>();
	private readonly childrenByParent = new Map<string, Set<string>>();

	register(
		taskId: string,
		options: { parentId?: string; dependsOn?: readonly string[] } = {},
	): void {
		const existing = this.dependencies.get(taskId);
		if (existing?.parentId) {
			this.removeChildReference(existing.parentId, taskId);
		}

		const parentId = options.parentId ?? null;
		const dependsOn = Object.freeze(
			[...(options.dependsOn ?? [])].filter(
				(dependencyId, index, values) =>
					dependencyId !== taskId && values.indexOf(dependencyId) === index,
			),
		);

		if (parentId) {
			const children = this.childrenByParent.get(parentId) ?? new Set<string>();
			children.add(taskId);
			this.childrenByParent.set(parentId, children);
			this.refreshDependency(parentId);
		}

		this.dependencies.set(
			taskId,
			createDependency({
				taskId,
				dependsOn,
				parentId,
				children: this.getChildIds(taskId),
			}),
		);
	}

	areDependenciesMet(taskId: string, completedTasks: ReadonlySet<string>): boolean {
		const dependency = this.dependencies.get(taskId);
		if (!dependency) {
			return true;
		}

		return dependency.dependsOn.every((dependencyId) => completedTasks.has(dependencyId));
	}

	getChildren(taskId: string): readonly string[] {
		return Object.freeze(this.getChildIds(taskId));
	}

	getParent(taskId: string): string | null {
		return this.dependencies.get(taskId)?.parentId ?? null;
	}

	unregister(taskId: string): void {
		const dependency = this.dependencies.get(taskId);
		if (!dependency) {
			return;
		}

		if (dependency.parentId) {
			this.removeChildReference(dependency.parentId, taskId);
			this.refreshDependency(dependency.parentId);
		}

		this.childrenByParent.delete(taskId);
		this.dependencies.delete(taskId);
	}

	getDependency(taskId: string): TaskDependency | null {
		const dependency = this.dependencies.get(taskId);
		if (!dependency) {
			return null;
		}

		return createDependency({
			taskId: dependency.taskId,
			dependsOn: dependency.dependsOn,
			parentId: dependency.parentId,
			children: this.getChildIds(taskId),
		});
	}

	getBlockedTasks(completedTasks: ReadonlySet<string>): readonly string[] {
		const blockedTaskIds: string[] = [];
		for (const [taskId, dependency] of this.dependencies) {
			if (dependency.dependsOn.some((dependencyId) => !completedTasks.has(dependencyId))) {
				blockedTaskIds.push(taskId);
			}
		}

		return Object.freeze(blockedTaskIds);
	}

	clear(): void {
		this.dependencies.clear();
		this.childrenByParent.clear();
	}

	private getChildIds(taskId: string): string[] {
		const children = this.childrenByParent.get(taskId);
		if (!children) {
			return [];
		}

		return [...children].sort((left, right) => left.localeCompare(right));
	}

	private refreshDependency(taskId: string): void {
		const dependency = this.dependencies.get(taskId);
		if (!dependency) {
			return;
		}

		this.dependencies.set(
			taskId,
			createDependency({
				taskId,
				dependsOn: dependency.dependsOn,
				parentId: dependency.parentId,
				children: this.getChildIds(taskId),
			}),
		);
	}

	private removeChildReference(parentId: string, taskId: string): void {
		const children = this.childrenByParent.get(parentId);
		if (!children) {
			return;
		}

		children.delete(taskId);
		if (children.size === 0) {
			this.childrenByParent.delete(parentId);
		}
	}
}
