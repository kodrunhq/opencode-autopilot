#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const bunCheck = spawnSync("bun", ["--version"], { stdio: "ignore" });

if (bunCheck.status === 0) {
	process.exit(0);
}

console.error(
	[
		"",
		"@kodrunhq/opencode-autopilot requires Bun to run.",
		"",
		"Why:",
		"- The published CLI entrypoints use a Bun shebang.",
		"- The plugin uses Bun-specific APIs such as bun:sqlite.",
		"",
		"Next steps:",
		"- Install Bun first: https://bun.sh/",
		"- Or use the GitHub local bundle install path documented in the README.",
		"",
	].join("\n"),
);
process.exit(1);
