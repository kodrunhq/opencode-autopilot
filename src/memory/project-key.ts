import { createHash } from "node:crypto";

export function computeProjectKey(projectPath: string): string {
	return createHash("sha256").update(projectPath).digest("hex");
}
