---
description: Configure the opencode-autopilot plugin -- assign models to agents
---
The opencode-autopilot plugin supports configuration for model mapping. You can assign specific models to each agent provided by the plugin by editing the config file at `~/.config/opencode/opencode-autopilot.json`.

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

Note: An interactive configuration tool will be added in a future phase to automate this process.
