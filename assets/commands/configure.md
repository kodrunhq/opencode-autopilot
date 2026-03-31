---
description: Configure the opencode-assets plugin -- assign models to agents
---
The opencode-assets plugin supports configuration for model mapping. You can assign specific models to each agent provided by the plugin by editing the config file at `~/.config/opencode/opencode-assets.json`.

The config file uses this format:
```json
{
  "version": 1,
  "configured": true,
  "models": {
    "agent-name": "provider/model-id"
  }
}
```

Note: An interactive `oc_configure` tool will be added in Phase 2 to automate this process.
