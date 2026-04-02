---
description: Configure opencode-autopilot model assignments for each agent group
agent: autopilot
---
Help the user configure opencode-autopilot by walking through the model
assignment process interactively.

Start by calling the oc_configure tool with subcommand "start". This returns:
- Available models grouped by provider (from the user's OpenCode config)
- The 8 agent groups with descriptions and recommendations
- Current assignments if reconfiguring
- Adversarial diversity rules

Then walk through each of the 8 agent groups in order (architects first,
utilities last), explaining for each:

1. What the group does and which agents belong to it
2. The model tier recommendation
3. For adversarial groups (challengers, reviewers, red-team): explain WHY
   model diversity matters and which group they're adversarial to
4. List available models from the user's providers

For each group, present the available models as a numbered list:

Example format:
  Primary model for Architects:
  1. anthropic/claude-opus-4-6
  2. openai/gpt-5.4
  3. google/gemini-3.1-pro

  Pick a number (or type a model ID):

If the user sends just a number, map it to the corresponding model.
Then ask for optional fallbacks the same way (1-3 fallback models).
Call oc_configure with subcommand "assign" for each group.

If the assign response contains diversityWarnings, explain them
conversationally. Strong warnings should be highlighted — the user can
still proceed, but make the quality trade-off clear.

After all 8 groups are assigned, call oc_configure with subcommand "commit"
to persist the configuration.

End by showing the final summary table and running the "doctor" subcommand
to verify everything is healthy.
