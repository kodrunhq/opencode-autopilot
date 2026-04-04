---
# opencode-autopilot
description: Create a new OpenCode skill from within this session
agent: metaprompter
---
The user wants to create a new OpenCode skill. Gather the following information conversationally before calling the tool:

1. **name** (required): Skill name in lowercase with hyphens (e.g., "typescript-patterns", "api-design"). Must be 1-64 characters, alphanumeric with hyphens only.
2. **description** (required): A clear description of what the skill provides to the AI agent (max 1024 characters).
3. **license** (optional): License for the skill (e.g., "MIT").
4. **compatibility** (optional): Compatibility target (e.g., "opencode").

Once you have all the required information, call the `oc_create_skill` tool with the collected parameters. The tool will validate the name, create the skill directory, and write the SKILL.md file.

After creation, remind the user to restart OpenCode and suggest they edit the generated SKILL.md to add domain knowledge, rules, and examples.

$ARGUMENTS
