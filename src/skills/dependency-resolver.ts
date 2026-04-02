/**
 * Topological sort with cycle detection for skill dependencies.
 *
 * Uses iterative DFS-based topological ordering. Skills not in the map are
 * silently skipped (graceful degradation). All cycle participants are reported
 * in the `cycles` array so callers can exclude them.
 */

export interface DependencyNode {
	readonly requires: readonly string[];
}

export interface ResolutionResult {
	readonly ordered: readonly string[];
	readonly cycles: readonly string[];
}

/** Hard cap on skill count to prevent DoS via crafted dependency chains. */
const MAX_SKILLS = 500;

/**
 * Iterative topological sort with cycle detection.
 * Skills not in the map are silently skipped (graceful degradation).
 * All nodes participating in a cycle are reported (not just the re-entry point).
 */
export function resolveDependencyOrder(
	skills: ReadonlyMap<string, DependencyNode>,
): ResolutionResult {
	if (skills.size > MAX_SKILLS) {
		return { ordered: [], cycles: [...skills.keys()] };
	}

	const visited = new Set<string>();
	const inStack = new Set<string>();
	const stackArr: string[] = [];
	const ordered: string[] = [];
	const cycleSet = new Set<string>();

	for (const startName of skills.keys()) {
		if (visited.has(startName)) continue;

		// Iterative DFS using explicit stack
		const dfsStack: Array<{ name: string; depIndex: number }> = [
			{ name: startName, depIndex: 0 },
		];
		inStack.add(startName);
		visited.add(startName);
		stackArr.push(startName);

		while (dfsStack.length > 0) {
			const frame = dfsStack[dfsStack.length - 1];
			const skill = skills.get(frame.name);
			const deps = skill ? skill.requires : [];

			if (frame.depIndex < deps.length) {
				const dep = deps[frame.depIndex];
				frame.depIndex++;

				if (!skills.has(dep)) continue; // skip unknown deps

				if (inStack.has(dep)) {
					// Cycle detected — record all nodes in the cycle path
					const cycleStart = stackArr.indexOf(dep);
					for (let i = cycleStart; i < stackArr.length; i++) {
						cycleSet.add(stackArr[i]);
					}
					continue;
				}

				if (!visited.has(dep)) {
					visited.add(dep);
					inStack.add(dep);
					stackArr.push(dep);
					dfsStack.push({ name: dep, depIndex: 0 });
				}
			} else {
				// All deps processed — pop this node
				dfsStack.pop();
				inStack.delete(frame.name);
				stackArr.pop();
				ordered.push(frame.name);
			}
		}
	}

	return Object.freeze({
		ordered: Object.freeze(ordered),
		cycles: Object.freeze([...cycleSet]),
	});
}
