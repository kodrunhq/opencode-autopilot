import { createHash } from "node:crypto";

/**
 * Legacy path-hash project key.
 *
 * Kept only for migration compatibility while the runtime moves to the
 * project registry / stable project identity model.
 */
export function computeProjectKey(projectPath: string): string {
	return createHash("sha256").update(projectPath).digest("hex");
}
