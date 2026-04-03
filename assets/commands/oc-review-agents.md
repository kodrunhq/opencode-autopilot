---
description: Review and improve your project's agents.md file with structure validation and prompt quality feedback
argument-hint: "[path-to-agents.md]"
agent: metaprompter
---

Review and score the project's agents.md file. Follow every step below in order.

## Step 1: Locate the agents.md file

- If `$ARGUMENTS` is provided and non-empty, use that path
- Otherwise, check `.opencode/agents.md` in the project root
- Then check `agents.md` in the project root
- If not found, tell the user no agents.md was found and suggest:
  1. Create one manually
  2. Copy a starter template from `~/.config/opencode/templates/` (available types: web-api, cli-tool, library, fullstack)
  - Show the copy command: `cp ~/.config/opencode/templates/<type>.md .opencode/agents.md`
  - Stop here — do not continue with the review

## Step 2: Read and parse the file

Read the located file and parse each agent block:

- Look for level-2 headings (`## Agent:` or `## <name>`) as agent delimiters
- For each agent, extract:
  - **Name** — the heading text
  - **Description** — any text immediately following the heading
  - **System prompt** — the main instruction body for the agent
  - **Tool permissions** — any allow/deny lists for tools
  - **Model assignment** — any model field if present

## Step 3: Validate structure (0-3 per agent)

Score each agent's structure:

| Points | Criterion |
|--------|-----------|
| +1 | Has a clear name and description |
| +1 | Has a system prompt with specific (not generic) instructions |
| +1 | Has explicit tool permissions (allow or deny lists) |

Deductions:
- -1 for missing description entirely
- -1 for empty or placeholder system prompt
- -1 for no tool configuration at all

Minimum score is 0.

## Step 4: Assess prompt quality (0-4 per agent)

Score each agent's prompt quality:

| Points | Criterion |
|--------|-----------|
| +1 | **Role clarity** — prompt defines WHO the agent is (role, expertise, personality) |
| +1 | **Task specificity** — prompt defines WHAT the agent does with concrete instructions, not vague directives |
| +1 | **Guardrails** — prompt defines what NOT to do, boundaries, or constraints |
| +1 | **Output format** — prompt specifies HOW to format responses (structure, sections, style) |

## Step 5: Check coverage for project type

- Read project manifest files to detect type:
  - `package.json` — check for framework indicators (express, fastify, next, react, vue, svelte)
  - `pom.xml`, `build.gradle` — Java project
  - `Cargo.toml` — Rust project
  - `go.mod` — Go project
  - `pyproject.toml`, `setup.py` — Python project
- Classify as: web-api, cli-tool, library, fullstack, or unknown
- Compare the agents found against recommended agents for that project type
- Note missing agent roles that would benefit the project
- Reference starter templates in `~/.config/opencode/templates/` for comparison

## Step 6: Output the review

Format your review exactly like this:

```
## agents.md Review

**File:** {path}
**Agents found:** {count}
**Overall Score:** {total}/{max} ({percentage}%)

### Per-Agent Assessment

#### {agent-name}
- Structure: {score}/3 — {brief notes}
- Prompt Quality: {score}/4 — {brief notes}
- Suggestions:
  - {specific actionable improvement}

### Coverage Analysis
- Project type detected: {type}
- Recommended agents for this type: {list}
- Missing: {list with brief explanation of why each would help}
- Starter template: {if type is web-api, cli-tool, library, or fullstack: `Run cat ~/.config/opencode/templates/{type}.md to see a reference`; otherwise: `No starter template available for this project type`}

### Top 3 Improvements
1. {Most impactful improvement with specific guidance}
2. {Second most impactful improvement}
3. {Third most impactful improvement}
```

The overall score is the sum of all per-agent structure + prompt quality scores. The max is `agent_count * 7`. Report the percentage rounded to the nearest whole number.
