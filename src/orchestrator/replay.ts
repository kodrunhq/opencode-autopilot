import { orchestrateCore } from "../tools/orchestrate";
import type { ResultEnvelope } from "./contracts/result-envelope";

export async function replayEnvelopes(
	artifactDir: string,
	envelopes: readonly ResultEnvelope[],
): Promise<readonly string[]> {
	const outputs: string[] = [];
	for (const envelope of envelopes) {
		const result = await orchestrateCore({ result: JSON.stringify(envelope) }, artifactDir);
		outputs.push(result);
	}
	return Object.freeze(outputs);
}
