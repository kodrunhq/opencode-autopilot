---
description: Configure opencode-autopilot model assignments for each agent group
agent: autopilot
---
Help the user configure opencode-autopilot by walking through the model
assignment process interactively.

## Step 1: Discover models and show the list

Call the oc_configure tool with subcommand "start". The response contains:
- `displayText`: a pre-formatted numbered list of ALL available models.
  **Show this to the user VERBATIM. Do not summarize, truncate, or reformat it.**
- `modelIndex`: a map of number -> model ID (e.g. {"1": "anthropic/claude-opus-4-6"})
- `groups`: the 8 agent groups with descriptions and recommendations
- `currentConfig`: existing assignments if reconfiguring
- `diversityRules`: adversarial diversity constraints

Print `displayText` exactly as returned. This is the complete model list
with instructions. Do not add, remove, or reorder entries.

## Step 2: Walk through each group

For each of the 8 groups (architects first, utilities last):

1. Explain what the group does and which agents belong to it
2. Show the tier recommendation
3. For adversarial groups (challengers, reviewers, red-team): explain WHY
   model diversity matters and which group they are adversarial to
4. Re-print `displayText` so the user can see the numbered list

Then ask:

```
Enter model numbers for [Group Name], separated by commas (e.g. 1,4,7):
First = primary, rest = fallbacks in order.
```

### Parsing the user's response

- Numbers like "1,4,7": look up each in `modelIndex` to get model IDs
- Model IDs typed directly (e.g. "anthropic/claude-opus-4-6"): use as-is
- Single number (e.g. "1"): primary only, no fallbacks

The FIRST model is the primary. All subsequent models are fallbacks,
tried in sequence when the primary is rate-limited or fails.

Call oc_configure with subcommand "assign":
- `group`: the group ID
- `primary`: first model from the user's list
- `fallbacks`: remaining models as comma-separated string

### Diversity warnings

If the assign response contains `diversityWarnings`, explain them
conversationally. Strong warnings should be highlighted — the user can
still proceed, but make the quality trade-off clear.

Example: "Heads up: Architects and Challengers both use Claude models.
Challengers are supposed to critique Architect decisions — using the same
model family means you get confirmation bias instead of genuine challenge.
Consider picking a different family for one of them. Continue anyway?"

## Step 3: Commit and verify

After all 8 groups are assigned, call oc_configure with subcommand "commit".

Then call oc_configure with subcommand "doctor" to verify health.

Show a final summary table:

```
Group          | Primary                      | Fallbacks
───────────────┼──────────────────────────────┼──────────────────────────
Architects     | anthropic/claude-opus-4-6    | openai/gpt-5.4
Challengers    | openai/gpt-5.4              | google/gemini-3.1-pro
...
```

## Rules

- ALWAYS show `displayText` VERBATIM — never summarize or truncate the model list.
- ALWAYS re-print `displayText` before asking for each group's selection.
- ALWAYS ask for comma-separated numbers (ordered list, not just one pick).
- NEVER pre-select models for the user. They choose from the full list.
- NEVER skip fallback collection. Emphasize: more fallbacks = more resilience.
- If the user says "pick for me" or "use defaults", THEN you may suggest
  assignments based on the tier recommendations and diversity rules, but
  still show what you picked and ask for confirmation.
