# Installation

## For Humans

Paste this into your AI session:

```
Install and configure opencode-autopilot by following the instructions here:
https://raw.githubusercontent.com/kodrunhq/opencode-autopilot/main/docs/guide/installation.md
```

**Alternative — do it yourself:**

```bash
bunx @kodrunhq/opencode-autopilot install
```

Then launch OpenCode and run `/oc-configure` to set up model assignments.

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
- **21 specialized code review agents** — security, logic, concurrency,
  type soundness, stack-specific patterns (React, Go, Python, Rust, etc.)
- **Intelligent model routing** — different models for different jobs.
  Your architect designs in one model, your critic challenges in another,
  your red team attacks from a third perspective.
- **Automatic model fallback** — when a model is rate-limited, the system
  retries with the next model in the chain.

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

### Step 2: Run the CLI installer

```bash
bunx @kodrunhq/opencode-autopilot install --no-tui
```

This registers the plugin in opencode.json and creates a starter config.

### Step 3: Launch OpenCode and configure model assignments

Tell the user to launch OpenCode, then run /oc-configure.

The /oc-configure command will walk through 8 agent groups:

1. **Architects** — System design, planning, orchestration
   - Agents: oc-architect, oc-planner, autopilot
   - Recommendation: Most powerful model (e.g. Claude Opus, GPT-5.4)

2. **Challengers** — Challenge architecture, find design flaws
   - Agents: oc-critic, oc-challenger
   - Recommendation: Strong model, DIFFERENT FAMILY from Architects
   - ⚠ Same family = confirmation bias

3. **Builders** — Write production code
   - Agents: oc-implementer
   - Recommendation: Strong coding model

4. **Reviewers** — Find bugs, security issues, logic errors
   - Agents: oc-reviewer + 19 internal review agents
   - Recommendation: Strong model, DIFFERENT FAMILY from Builders
   - ⚠ Same family = shared blind spots

5. **Red Team** — Final adversarial pass, hunt exploits
   - Agents: red-team, product-thinker
   - Recommendation: DIFFERENT FAMILY from both Builders and Reviewers
   - ⚠ Most effective as a third perspective

6. **Researchers** — Domain research, feasibility
   - Agents: oc-researcher, researcher
   - Recommendation: Good comprehension, any family

7. **Communicators** — Docs, changelogs, lessons
   - Agents: oc-shipper, documenter, oc-retrospector
   - Recommendation: Mid-tier model, clear writing

8. **Utilities** — Fast lookups, scanning
   - Agents: oc-explorer, metaprompter, pr-reviewer
   - Recommendation: Fastest/cheapest model

For each group, the user picks a primary model and optional fallbacks.

### Step 4: Verify setup

```bash
bunx @kodrunhq/opencode-autopilot doctor
```

This checks config health, model assignments, and adversarial diversity.

### Step 5: Educate the user

After configuration, tell the user:

- Use the **autopilot** agent for full autonomous pipelines
- Use **/review-pr** to review pull requests with 21 agents
- Use **/new-agent**, **/new-skill**, **/new-command** to extend the plugin
- Run **/oc-configure** any time to change model assignments

### ⚠ Warning

Unless the user explicitly requests it, do not change model settings,
disable agents, or modify the configuration. The plugin works as
configured by the user.
