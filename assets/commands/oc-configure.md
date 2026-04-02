---
description: Configure opencode-autopilot model assignments for each agent group
agent: autopilot
---
Model configuration uses an interactive terminal wizard with searchable
model selection. This cannot be done inside the OpenCode TUI — it requires
a separate terminal.

Tell the user to open a terminal and run:

```
bunx @kodrunhq/opencode-autopilot configure
```

This will:
1. Discover all available models from their configured providers
2. Walk through each of the 8 agent groups with a searchable model picker
3. For each group, select a primary model and optional fallback models
4. Check adversarial diversity (different families for groups that review each other)
5. Save the configuration

After running the wizard, tell the user to restart OpenCode to pick up
the new model assignments.

Do NOT attempt to configure models through the oc_configure tool's assign
subcommand directly. The interactive wizard is the supported configuration
method.
