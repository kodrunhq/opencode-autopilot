---
description: Configure opencode-autopilot model assignments for each agent group
agent: autopilot
---
Help the user configure opencode-autopilot by walking through the model
assignment process interactively.

## Step 1: Discover available models

Call the oc_configure tool with subcommand "start". This returns:
- `availableModels`: a map of provider -> list of "provider/model" strings
- `groups`: the 8 agent groups with descriptions and recommendations
- `currentConfig`: existing assignments if reconfiguring
- `diversityRules`: adversarial diversity constraints

If `availableModels` is empty or has no entries, tell the user:
"No models were discovered from your providers. Run `opencode models`
in your terminal to see available models, then type them manually below."

## Step 2: Build the complete model list

Combine ALL models from ALL providers into a single numbered list.
Every model the user has access to must appear. Do NOT filter, summarize,
or show only "recommended" models. The user decides — you present options.

Example (show ALL of them, not a subset). The IDs must match exactly
what `availableModels` returns (provider prefix comes from the provider):
```
Available models:
 1. anthropic/claude-opus-4-6
 2. anthropic/claude-sonnet-4-6
 3. anthropic/claude-haiku-4-5
 4. openai/gpt-5.4
 5. openai/gpt-5.4-mini
 6. openai/gpt-5.4-codex
 7. google/gemini-3.1-pro
 8. google/gemini-3-flash
 ...
```

## Step 3: Walk through each group

For each of the 8 groups (architects first, utilities last):

1. Explain what the group does and which agents belong to it
2. Show the tier recommendation
3. For adversarial groups (challengers, reviewers, red-team): explain WHY
   model diversity matters and which group they are adversarial to
4. Show the full numbered model list again whenever asking for selections

### Collecting models for each group

For each group, collect an ORDERED LIST of models (not just one):

```
Group: Architects
Pick models in priority order. The first is the primary; the rest are
fallbacks tried in sequence when the primary is rate-limited or fails.

Enter model numbers separated by commas (e.g. 1,4,7):
```

- The FIRST number is the primary model
- All subsequent numbers are fallbacks, tried in the order given
- Minimum 1 model (the primary), recommend 2-3 total
- Emphasize that fallbacks are the core feature: "When your primary model
  hits a rate limit, the plugin automatically retries with the next model
  in your fallback chain. More fallbacks = more resilience."

Parse the user's response:
- If they send numbers like "1,4,7": map to model IDs
- If they send model IDs directly: use as-is
- If they send a single number: that's the primary with no fallbacks

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

## Step 4: Commit and verify

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

- NEVER pre-select models for the user. Always present the full list.
- NEVER skip fallback collection. Always ask for ordered model lists.
- NEVER filter the model list to "recommended" models. Show everything.
- If the user says "pick for me" or "use defaults", THEN you may suggest
  assignments based on the tier recommendations and diversity rules, but
  still show what you picked and ask for confirmation.
