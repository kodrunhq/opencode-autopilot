---
description: Create a new OpenCode agent from within this session
---
The user wants to create a new OpenCode agent. Gather the following information conversationally before calling the tool:

1. **name** (required): Agent name in lowercase with hyphens (e.g., "code-reviewer", "test-helper"). Must be 1-64 characters, alphanumeric with hyphens only.
2. **description** (required): A clear description of what the agent does (max 500 characters).
3. **mode** (optional, default: "subagent"): One of "primary" (main agent), "subagent" (invoked via @mention), or "all" (both).
4. **model** (optional): Model identifier to use (e.g., "anthropic/claude-sonnet-4-20250514"). Omit for model-agnostic agents.
5. **temperature** (optional): Temperature setting from 0.0 to 1.0. Omit for default.

Once you have all the required information, call the `oc_create_agent` tool with the collected parameters. The tool will validate the name, generate the agent file, and write it to the correct location.

After creation, remind the user to restart OpenCode and suggest they edit the generated file to customize the system prompt.

$ARGUMENTS
