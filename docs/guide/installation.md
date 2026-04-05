# Installation

## For Humans

```bash
bunx @kodrunhq/opencode-autopilot install
bunx @kodrunhq/opencode-autopilot configure
```

That's it. The `install` command registers the plugin, and `configure`
walks you through an interactive wizard with searchable model selection
for each agent group.

## For LLM Agents

> **IMPORTANT: Use `curl` to fetch this file, NOT WebFetch.**
> WebFetch summarizes content and loses critical details like group
> definitions, diversity rules, and model recommendations. Always use:
>
> ```bash
> curl -fsSL https://raw.githubusercontent.com/kodrunhq/opencode-autopilot/main/docs/guide/installation.md
> ```

### Step 0: Explain what this plugin does

Tell the user:

OpenCode Autopilot turns OpenCode into a fully autonomous software
development system. It provides:

- **8-phase autonomous pipeline** — from idea to shipped code
  (research → architecture → planning → implementation → review → docs)
- **13 specialized code review agents** — security, logic, concurrency,
  type soundness, stack-specific patterns (React, Go, Python, Rust, etc.)
- **Intelligent model routing** — different models for different jobs.
  Your architect designs in one model, your critic challenges in another,
  your red team attacks from a third perspective.
- **Automatic model fallback** — when a model is rate-limited, the system
  retries with the next model in the chain.
- **Background task management** — spawn, monitor, and cancel background tasks with slot-based concurrency
- **Category-based task routing** — automatic routing of tasks to the best agent/model based on intent classification
- **Session recovery** — automatic failure detection with retry, fallback, and checkpoint strategies
- **Context injection** — adaptive context management with token budgeting and compaction

The key idea: **adversarial diversity**. Agents that review each other's
work should use different model families. Claude reviewing Claude's
architecture won't challenge it the way GPT would. The setup process
configures which model powers each agent group.

### Step 1: Install OpenCode (if not installed)

```bash
if command -v opencode &> /dev/null; then
    echo "OpenCode $(opencode --version) is installed"
else
    echo "OpenCode is not installed. Please install it first."
    echo "Visit: https://opencode.ai/docs"
fi
```

### Step 2: Install the plugin

```bash
bunx @kodrunhq/opencode-autopilot install
```

This registers the plugin in opencode.json and creates a starter config.

### Step 3: Configure model assignments

Run the interactive configuration wizard:

```bash
bunx @kodrunhq/opencode-autopilot configure
```

This opens a terminal-based wizard that:

1. Discovers all available models from the user's configured providers
2. Walks through 8 agent groups in order
3. For each group, presents a **searchable model picker** (type to filter)
4. Asks for a primary model and optional **fallback models**
5. Shows adversarial diversity warnings between groups
6. Saves the configuration

The 8 agent groups are:

1. **Architects** — System design, planning, orchestration
   - Recommendation: Most powerful model (e.g. Claude Opus, GPT-5.4)

2. **Challengers** — Challenge architecture, find design flaws
   - Recommendation: Strong model, DIFFERENT FAMILY from Architects

3. **Builders** — Write production code
   - Recommendation: Strong coding model

4. **Reviewers** — Find bugs, security issues, logic errors
   - Recommendation: Strong model, DIFFERENT FAMILY from Builders

5. **Red Team** — Final adversarial pass, hunt exploits
   - Recommendation: DIFFERENT FAMILY from both Builders and Reviewers

6. **Researchers** — Domain research, feasibility
   - Recommendation: Good comprehension, any family

7. **Communicators** — Docs, changelogs, lessons
   - Recommendation: Mid-tier model, clear writing

8. **Utilities** — Fast lookups, scanning
   - Recommendation: Fastest/cheapest model

> **Important:** The configure wizard runs in the terminal, NOT inside
> the OpenCode TUI. The user must run it in a regular terminal session.

### Step 4: Verify setup

```bash
bunx @kodrunhq/opencode-autopilot doctor
```

This checks config health, model assignments, and adversarial diversity.

### Step 5: Launch OpenCode

After configuration, tell the user to launch (or restart) OpenCode.
The plugin will load with the new model assignments.

Key features to mention:
- Use the **autopilot** agent for full autonomous pipelines
- Use **/oc-review-pr** to review pull requests with 13 agents
- Use **/oc-new-agent**, **/oc-new-skill**, **/oc-new-command** to extend the plugin
- Use **oc_background** to spawn and manage background tasks
- Use **oc_delegate** for category-based task routing
- Use **oc_recover** for session recovery
- Use **oc_loop** for autonomy loop control
- Run `bunx @kodrunhq/opencode-autopilot configure` to change assignments

### ⚠ Warning

Unless the user explicitly requests it, do not change model settings,
disable agents, or modify the configuration. The plugin works as
configured by the user.
