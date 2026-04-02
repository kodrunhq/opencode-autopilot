/**
 * Topological sort with cycle detection for skill dependencies.
 *
 * Uses DFS-based topological ordering. Skills not in the map are silently
 * skipped (graceful degradation). Cycle participants are reported in the
 * `cycles` array so callers can exclude them.
 */

export interface DependencyNode {
	readonly requires: readonly string[];
}

export interface ResolutionResult {
	readonly ordered: readonly string[];
	readonly cycles: readonly string[];
}

/**
 * Topological sort with cycle detection via DFS.
 * Skills not in the map are silently skipped (graceful degradation).
 */
export function resolveDependencyOrder(
	skills: ReadonlyMap<string, DependencyNode>,
): ResolutionResult {
	const visited = new Set<string>();
	const inStack = new Set<string>();
	const ordered: string[] = [];
	const cycles: string[] = [];

	function visit(name: string): void {
		if (inStack.has(name)) {
			cycles.push(name);
			return;
		}
		if (visited.has(name)) return;

		inStack.add(name);
		visited.add(name);

		const skill = skills.get(name);
		if (skill) {
			for (const dep of skill.requires) {
				if (skills.has(dep)) visit(dep);
			}
		}

		inStack.delete(name);
		ordered.push(name);
	}

	for (const name of skills.keys()) {
		visit(name);
	}

	return { ordered, cycles };
}
