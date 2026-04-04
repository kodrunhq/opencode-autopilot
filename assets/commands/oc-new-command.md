---
# opencode-autopilot
description: Create a new OpenCode command from within this session
agent: metaprompter
---
The user wants to create a new OpenCode slash command. Gather the following information conversationally before calling the tool:

1. **name** (required): Command name in lowercase with hyphens (e.g., "review", "deploy-check"). Must be 1-64 characters, alphanumeric with hyphens only. Cannot conflict with built-in commands (init, undo, redo, share, help, config, compact, clear, cost, login, logout, bug).
2. **description** (required): A clear description of what the command does when invoked (max 500 characters).
3. **agent** (optional): Agent to use when running this command (e.g., "code-reviewer").
4. **model** (optional): Model override for this command.

Once you have all the required information, call the `oc_create_command` tool with the collected parameters. The tool will validate the name, generate the command file, and write it to the correct location.

After creation, remind the user to restart OpenCode and suggest they edit the generated file to customize the command instructions. Mention that they can use `$ARGUMENTS` for user input and `@filename` to include file content.

$ARGUMENTS
