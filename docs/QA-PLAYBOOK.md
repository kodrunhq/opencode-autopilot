# QA Playbook -- OpenCode Autopilot Plugin

**Version:** 2.0
**Date:** 2026-04-03
**Coverage:** Commands (11), Agents (8), Tools (20), Skills (18), Memory, Fallback, Doctor, Observability, Orchestrator E2E

---

## Table of Contents

1. [Commands](#commands)
2. [Agents](#agents)
3. [Tools](#tools)
4. [Skills and Adaptive Injection](#skills-and-adaptive-injection)
5. [Memory System](#memory-system)
6. [Fallback Chain](#fallback-chain)
7. [Doctor and Health Checks](#doctor-and-health-checks)
8. [Observability](#observability)
9. [Orchestrator Pipeline E2E](#orchestrator-pipeline-e2e)

---

## How to Use This Playbook

Execute this playbook top-to-bottom in a single OpenCode session. Each section contains numbered test procedures with prerequisites, steps, expected output, and pass/fail criteria. Every feature includes at least one negative test case for invalid input or missing prerequisites. A feature passes only when all its criteria are met. Mark each test as PASS or FAIL as you go, then tally results at the end.

**Maintenance:** When a future phase adds or changes features, that phase's task list must include a step to update the relevant playbook section. This keeps the playbook in sync with the codebase without requiring a separate maintenance pass.

---

## Commands

All commands are invoked inside an OpenCode session using the `/` prefix. They are installed as markdown files in `~/.config/opencode/commands/`.

### /oc-brainstorm

**Prerequisites:**
- OpenCode session open in a project directory
- Plugin installed and loaded (commands visible via `/` autocomplete)

**Steps:**
1. Open an OpenCode session.
2. Type `/oc-brainstorm API rate limiting strategies`.
3. Observe the output.

**Expected Output:**
- The agent uses the brainstorming skill to explore the topic.
- Output includes Socratic questioning, at least 3 distinct approaches, and a structured design recommendation.
- If a project manifest file exists (e.g., `package.json`), code examples and library suggestions are tailored to that language ecosystem.

**Negative Test:**
- Type `/oc-brainstorm` with no arguments (empty `$ARGUMENTS`).
- Expected: The agent should either ask for a topic or produce a generic brainstorming prompt. It should not crash or produce an unrelated error.

**Pass/Fail:**
- PASS: Brainstorming output contains multiple approaches, Socratic-style questions, and a recommendation. Language detection adapts examples to the project stack.
- FAIL: Output is empty, generic advice without structure, or command is not found.

---

### /oc-tdd

**Prerequisites:**
- OpenCode session open in a project with a test framework configured (e.g., `bun test`, `jest`, `vitest`)
- A feature or bug to implement via TDD

**Steps:**
1. Open an OpenCode session.
2. Type `/oc-tdd Add a utility function that validates email addresses`.
3. Observe the output.

**Expected Output:**
- The agent follows strict RED-GREEN-REFACTOR methodology using the tdd-workflow skill.
- First writes a failing test (RED), then implements minimally to pass (GREEN), then refactors (REFACTOR).
- Language detection adapts test framework recommendations to the project.

**Negative Test:**
- Type `/oc-tdd` with no arguments.
- Expected: The agent should ask what feature to implement via TDD, not proceed with an empty task.

**Pass/Fail:**
- PASS: Output demonstrates the RED-GREEN-REFACTOR cycle with test code written before implementation.
- FAIL: Implementation written before tests, or TDD methodology not followed.

---

### /oc-review-pr

**Prerequisites:**
- OpenCode session open in a Git repository
- `gh` CLI authenticated and a valid PR number available
- The PR must exist in the repository's GitHub remote

**Steps:**
1. Open an OpenCode session.
2. Type `/oc-review-pr 42` (replace 42 with a valid PR number).
3. Observe the output.

**Expected Output:**
- The pr-reviewer agent is invoked (set via the `agent: pr-reviewer` frontmatter).
- Runs `gh pr view 42` and `gh pr diff 42` to gather context.
- Produces a structured review with Summary, Findings (by severity: CRITICAL, HIGH, MEDIUM, LOW), Positive Notes, and Verdict (APPROVE, REQUEST_CHANGES, or NEEDS_DISCUSSION).

**Negative Test:**
- Type `/oc-review-pr abc!@#` (shell metacharacters in the argument).
- Expected: The agent validates the input and asks for a valid PR number. It does not execute arbitrary shell commands.

**Pass/Fail:**
- PASS: Review output contains all structured sections (Summary, Findings, Positive Notes, Verdict) with severity-tagged findings and specific file/line references.
- FAIL: Review is unstructured, missing sections, or executes arbitrary input as a shell command.

---

### /oc-write-plan

**Prerequisites:**
- OpenCode session open in a project directory
- A feature or task to decompose into a plan

**Steps:**
1. Open an OpenCode session.
2. Type `/oc-write-plan Add user authentication with JWT tokens`.
3. Observe the output.

**Expected Output:**
- The agent uses the plan-writing skill to produce a structured plan.
- Plan includes exact file paths, dependency waves, verification commands, and done criteria for each task.
- Language detection adapts tooling and build commands to the project ecosystem.

**Negative Test:**
- Type `/oc-write-plan` with no arguments.
- Expected: The agent should ask what feature to plan, not produce an empty plan.

**Pass/Fail:**
- PASS: Output is a structured plan with numbered tasks, file paths, waves, and verification steps.
- FAIL: Output is vague advice without file paths, or command is not found.

---

### /oc-stocktake

**Prerequisites:**
- OpenCode session open
- Plugin installed with assets in `~/.config/opencode/`

**Steps:**
1. Open an OpenCode session.
2. Type `/oc-stocktake`.
3. Observe the output.

**Expected Output:**
- Invokes the `oc_stocktake` tool.
- Returns a JSON audit of all installed skills, commands, and agents with counts, origins (built-in, config-hook, user-created), and lint validation results.

**Negative Test:**
- Type `/oc-stocktake --invalid-flag`.
- Expected: The argument is passed as the lint option. Since it is not a valid boolean, the tool should still run (lint defaults to true) without crashing.

**Pass/Fail:**
- PASS: Output includes skills, commands, and agents arrays with summary counts.
- FAIL: Tool returns an error or reports zero agents when config-hook agents are registered.

---

### /oc-update-docs

**Prerequisites:**
- OpenCode session open in a Git repository
- At least one non-markdown source file changed relative to HEAD

**Steps:**
1. Open an OpenCode session in a Git repo with uncommitted source changes.
2. Type `/oc-update-docs`.
3. Observe the output.

**Expected Output:**
- Invokes the `oc_update_docs` tool.
- Analyzes recent code changes via `git diff --name-only HEAD`.
- Lists markdown documentation files that may need updating, with reasons and suggestions.

**Negative Test:**
- Run `/oc-update-docs` in a directory with no Git repository.
- Expected: Returns an empty list of changed files (git command fails gracefully).

**Pass/Fail:**
- PASS: Output lists changed source files and identifies potentially affected documentation.
- FAIL: Tool crashes on git errors or fails to identify related documentation.

---

### /oc-new-agent

**Prerequisites:**
- OpenCode session open
- Plugin installed
- No existing agent with the test name

**Steps:**
1. Open an OpenCode session.
2. Type `/oc-new-agent`.
3. When prompted, provide: name = `test-helper`, description = `Helps with test setup`, mode = `subagent`.
4. Observe the output.

**Expected Output:**
- The command gathers agent parameters conversationally.
- Calls `oc_create_agent` with the collected parameters.
- Returns a success message: `Agent 'test-helper' created at ~/.config/opencode/agents/test-helper.md`.
- Reminds the user to restart OpenCode.

**Negative Test:**
- Provide name = `InvalidName` (uppercase characters).
- Expected: Returns a validation error because names must match `^[a-z0-9]+(-[a-z0-9]+)*$`.

**Pass/Fail:**
- PASS: Agent file created at the correct path with proper YAML frontmatter. Uppercase names are rejected.
- FAIL: File created with invalid name, or validation error not shown.

---

### /oc-new-skill

**Prerequisites:**
- OpenCode session open
- Plugin installed
- No existing skill with the test name

**Steps:**
1. Open an OpenCode session.
2. Type `/oc-new-skill`.
3. When prompted, provide: name = `api-design`, description = `Best practices for REST API design`.
4. Observe the output.

**Expected Output:**
- The command gathers skill parameters conversationally.
- Calls `oc_create_skill` with the collected parameters.
- Returns a success message: `Skill 'api-design' created at ~/.config/opencode/skills/api-design/SKILL.md`.
- Reminds the user to restart OpenCode.

**Negative Test:**
- Provide name = `api design` (contains a space).
- Expected: Returns a validation error because names must be lowercase alphanumeric with hyphens only.

**Pass/Fail:**
- PASS: Skill directory and SKILL.md created at the correct path. Names with spaces are rejected.
- FAIL: Directory created with invalid name, or validation error not shown.

---

### /oc-new-command

**Prerequisites:**
- OpenCode session open
- Plugin installed
- No existing command with the test name

**Steps:**
1. Open an OpenCode session.
2. Type `/oc-new-command`.
3. When prompted, provide: name = `deploy-check`, description = `Verify deployment readiness`.
4. Observe the output.

**Expected Output:**
- The command gathers command parameters conversationally.
- Calls `oc_create_command` with the collected parameters.
- Returns a success message: `Command 'deploy-check' created at ~/.config/opencode/commands/deploy-check.md`.
- Reminds the user to restart OpenCode and mentions `$ARGUMENTS` for user input.

**Negative Test:**
- Provide name = `help` (a built-in command: init, undo, redo, share, help, config, compact, clear, cost, login, logout, bug).
- Expected: Returns a validation error because the name conflicts with a built-in command.

**Pass/Fail:**
- PASS: Command file created at the correct path. Built-in command names are rejected.
- FAIL: File created with a built-in name, or validation error not shown.

---

### /oc-quick

**Prerequisites:**
- OpenCode session open in a project directory
- No in-progress orchestration run

**Steps:**
1. Open an OpenCode session.
2. Type `/oc-quick Add a function that formats dates as ISO strings`.
3. Observe the output.

**Expected Output:**
- Invokes the `oc_quick` tool, which skips RECON, CHALLENGE, ARCHITECT, and EXPLORE phases.
- Pipeline starts directly at PLAN phase, then proceeds through BUILD, SHIP, and RETROSPECTIVE.
- Produces a completed pipeline result with implementation.

**Negative Test:**
- Type `/oc-quick` with no arguments (empty idea).
- Expected: Returns an error: `No idea provided. Usage: /oc-quick <describe the task>`.

**Pass/Fail:**
- PASS: Pipeline runs from PLAN onward, skipping discovery phases. Empty input returns a clear error.
- FAIL: Discovery phases are not skipped, or empty input causes a crash.

---

### /oc-review-agents

**Prerequisites:**
- OpenCode session open in a project directory
- An `agents.md` file exists at `.opencode/agents.md` or at the project root

**Steps:**
1. Open an OpenCode session in a project that has `.opencode/agents.md`.
2. Type `/oc-review-agents`.
3. Observe the output.

**Expected Output:**
- Locates and reads the agents.md file.
- Parses each agent block (delimited by `##` headings).
- Scores structure (0-3 per agent) and prompt quality (0-4 per agent).
- Checks coverage against detected project type.
- Outputs a structured review with per-agent assessment, coverage analysis, and top 3 improvements.
- Overall score as `{total}/{max} ({percentage}%)`.

**Negative Test:**
- Run `/oc-review-agents` in a project with no agents.md file.
- Expected: Reports that no agents.md was found and suggests creating one or copying a starter template.

**Pass/Fail:**
- PASS: Review output includes per-agent scoring, coverage analysis with project type detection, and actionable top 3 improvements.
- FAIL: Output is unstructured, scoring is missing, or missing-file case is not handled.

---

## Agents

All agents are injected via the config hook at plugin load time. Primary agents are Tab-cycleable, subagents are @-callable. Agent definitions live in `src/agents/`.

### @autopilot

**Prerequisites:**
- Plugin installed and loaded
- OpenCode session open

**Availability Test:**
- Press Tab to cycle through primary agents. Autopilot should appear (mode: `all`).
- Type `@autopilot` in the chat. It should be available via @-mention as well (mode `all` means both Tab and @-mention).

**Skill Loading Test:**
- No embedded skills (autopilot delegates to the orchestrator pipeline via `oc_orchestrate`).

**Core Behavior Test:**
1. Switch to the autopilot agent (Tab or @-mention).
2. Type: `Build a simple greeting function that says hello by name`.
3. Observe: Autopilot calls `oc_orchestrate` with the idea, then loops through the dispatch/result cycle until the pipeline completes.

**Negative Test:**
- Invoke autopilot with `@autopilot` but provide no task description (empty message).
- Expected: Autopilot should prompt the user for an idea or pass the empty input to `oc_orchestrate`, which returns an error if no idea is provided.

**Pass/Fail:**
- PASS: Autopilot is visible in Tab cycle, drives the pipeline via `oc_orchestrate`, and completes the full dispatch loop. Permissions include edit:allow, bash:allow, webfetch:allow.
- FAIL: Autopilot not visible in Tab cycle, does not call `oc_orchestrate`, or pipeline stalls.

---

### @debugger

**Prerequisites:**
- Plugin installed and loaded
- A reproducible bug or failing test in the project

**Availability Test:**
- Press Tab to cycle through primary agents. Debugger should appear (mode: `all`).
- Type `@debugger` to verify @-mention access.

**Skill Loading Test:**
- Embedded skill: `systematic-debugging` (4-phase process: Reproduce, Isolate, Diagnose, Fix).

**Core Behavior Test:**
1. Create a test that fails (e.g., `expect(add(1, 2)).toBe(4)` where `add` is correct).
2. Switch to `@debugger`.
3. Type: `This test is failing: tests/math.test.ts`.
4. Observe: Debugger follows the 4-phase process -- reproduces the bug, isolates, diagnoses, and produces a fix with a regression test.

**Negative Test:**
- Invoke `@debugger` with `Debug this` without specifying any file, test, or error message.
- Expected: Debugger should ask for more context (what bug, which file, what error) before proceeding.

**Pass/Fail:**
- PASS: Debugger follows the 4-phase Reproduce-Isolate-Diagnose-Fix process. Uses bash and edit tools. Denies webfetch. Writes regression tests.
- FAIL: Debugger skips directly to fixing, uses shotgun debugging, or does not produce a regression test.

---

### @planner

**Prerequisites:**
- Plugin installed and loaded
- A feature or task to decompose

**Availability Test:**
- Press Tab to cycle through primary agents. Planner should appear (mode: `all`).
- Type `@planner` to verify @-mention access.

**Skill Loading Test:**
- Embedded skills: `plan-writing`, `plan-executing`.

**Core Behavior Test:**
1. Switch to `@planner`.
2. Type: `Add rate limiting to all API endpoints`.
3. Observe: Planner produces a structured plan with goals, artifacts (exact file paths), dependency waves, tasks, and verification commands.

**Negative Test:**
- Invoke `@planner` with `Build everything` (extremely vague request).
- Expected: Planner should ask clarifying questions to narrow scope before producing a plan. It should not produce a plan for "everything."

**Pass/Fail:**
- PASS: Produces a structured plan with exact file paths, dependency waves, and verification steps. Does NOT write code (edit:allow for plan files, bash:allow for verification, webfetch:deny).
- FAIL: Planner writes implementation code directly, or produces a plan without file paths.

---

### @reviewer

**Prerequisites:**
- Plugin installed and loaded
- Code changes to review (staged, unstaged, or branch diff)

**Availability Test:**
- Press Tab to cycle through primary agents. Reviewer should appear (mode: `all`).
- Type `@reviewer` to verify @-mention access.

**Skill Loading Test:**
- Embedded skill: `code-review`.

**Core Behavior Test:**
1. Stage some code changes (`git add .`).
2. Switch to `@reviewer`.
3. Type: `Review my staged changes`.
4. Observe: Reviewer invokes `oc_review` with scope `staged`, dispatches specialist agents, and presents findings organized by severity (CRITICAL, HIGH, MEDIUM, LOW).

**Negative Test:**
- Invoke `@reviewer` and type `Fix the bug in auth.ts`.
- Expected: Reviewer should clarify that it reviews code but does NOT fix it. It should not apply edits (edit:deny).

**Pass/Fail:**
- PASS: Reviewer always invokes `oc_review` for reviews. Findings are severity-tagged. edit:deny prevents code modifications. bash:allow enables git commands. webfetch:deny.
- FAIL: Reviewer performs manual review without `oc_review`, applies code fixes, or gives unstructured feedback.

---

### @researcher

**Prerequisites:**
- Plugin installed and loaded

**Availability Test:**
- Press Tab to cycle through primary agents. Researcher should appear (mode: `all`).
- Type `@researcher` in the chat. It should also be available via @-mention (mode `all` means both Tab and @-mention).

**Skill Loading Test:**
- No embedded skills (general-purpose research via web fetch).

**Core Behavior Test:**
1. Type: `@researcher Compare Bun vs Deno as JavaScript runtimes in 2026`.
2. Observe: Researcher uses the webfetch tool to search and fetch web pages, consults multiple sources, and produces a structured markdown report with Summary, Key Findings, Detailed Analysis, and Sources.

**Negative Test:**
- Type: `@researcher` followed by a request to edit source code (`Edit src/index.ts and add a new export`).
- Expected: Researcher has edit:allow but its prompt constrains it to only create NEW files for research output, not edit existing source files.

**Pass/Fail:**
- PASS: Researcher produces a structured report with cited sources. Uses webfetch. Does not run bash commands (bash:deny). Does not edit existing source files.
- FAIL: Researcher fabricates sources, runs shell commands, or edits existing files.

---

### @metaprompter

**Prerequisites:**
- Plugin installed and loaded

**Availability Test:**
- Type `@metaprompter` in the chat. It should appear in @-mention autocomplete (mode: `subagent`).
- It should NOT appear in Tab cycle.

**Skill Loading Test:**
- No embedded skills (prompt engineering is its core competency).

**Core Behavior Test:**
1. Type: `@metaprompter Create a system prompt for a code-optimizer agent that focuses on performance`.
2. Observe: Metaprompter reads existing assets to understand patterns, then produces a complete agent file with YAML frontmatter and detailed system prompt, ready to save.

**Negative Test:**
- Type: `@metaprompter Run npm install and set up the project`.
- Expected: Metaprompter has all tools denied (edit:deny, bash:deny, webfetch:deny). It should explain that it cannot run commands and can only produce prompt/configuration content.

**Pass/Fail:**
- PASS: Produces complete, ready-to-save agent/skill/command file content with YAML frontmatter. All tool permissions denied (edit:deny, bash:deny, webfetch:deny).
- FAIL: Attempts to run commands, produces incomplete fragments, or has incorrect permissions.

---

### @documenter

**Prerequisites:**
- Plugin installed and loaded
- A codebase with source files to document

**Availability Test:**
- Type `@documenter` in the chat. It should appear in @-mention autocomplete (mode: `subagent`).
- It should NOT appear in Tab cycle.

**Skill Loading Test:**
- No embedded skills (references coding-standards skill at the standard path for conventions).

**Core Behavior Test:**
1. Type: `@documenter Create a README for this project`.
2. Observe: Documenter reads the codebase to understand structure, then produces polished markdown documentation with project overview, installation, usage, and contributing guidelines.

**Negative Test:**
- Type: `@documenter Fix the bug in src/config.ts`.
- Expected: Documenter should clarify it only creates/edits documentation files (.md, .txt), not source code files. edit:allow is limited by its prompt to documentation files only.

**Pass/Fail:**
- PASS: Produces polished documentation with proper markdown formatting (headings, lists, code blocks, tables). Has edit:allow (for docs only), bash:deny, webfetch:deny.
- FAIL: Edits source code files, runs commands, or produces poorly formatted output.

---

### @pr-reviewer

**Prerequisites:**
- Plugin installed and loaded
- `gh` CLI authenticated
- A valid PR available in the repository

**Availability Test:**
- Type `@pr-reviewer` in the chat. It should appear in @-mention autocomplete (mode: `subagent`).
- It should NOT appear in Tab cycle.

**Skill Loading Test:**
- No embedded skills (PR review methodology embedded in its prompt).

**Core Behavior Test:**
1. Type: `@pr-reviewer Review PR #42` (use a valid PR number).
2. Observe: PR Reviewer runs `gh pr view 42` and `gh pr diff 42` to gather context, then produces a structured review with Summary, Findings (severity-tagged), and Positives.

**Negative Test:**
- Type: `@pr-reviewer Merge PR #42`.
- Expected: PR Reviewer should refuse to merge. Its constraints state: "DO NOT approve or merge the PR -- only provide feedback."

**Pass/Fail:**
- PASS: Produces structured review with severity-tagged findings. Uses bash (for git/gh commands only). edit:deny prevents code changes. webfetch:deny. Does not merge or approve.
- FAIL: Attempts to merge, writes code changes, or gives unstructured feedback.

---

## Tools

All tools are registered programmatically via the plugin entry point (`src/index.ts`). They are invoked by agents during pipeline execution or directly by the user through agent interactions. Each tool name starts with `oc_`.

**Diagnostic Tools**

### oc_doctor

**Purpose:** Run plugin health diagnostics. Reports pass/fail status for config, agents,
native plan/build suppression, assets, skills, memory, commands, and hooks.

**Input Parameters:**
- None (no arguments)

**Prerequisites:**
- Plugin installed and loaded

**Steps:**
1. Invoke `oc_doctor` (no arguments needed).
2. Observe the JSON response.

**Expected Output:**
- JSON with `action: "doctor"`, `checks` array, `allPassed` boolean, `displayText`, and `duration` in milliseconds.
- Checks include: `config-validity`, `agent-injection`, `native-agent-suppression`, `asset-directories`, `skill-loading`, `memory-db`, `command-accessibility`, `hook-registration`.
- Each check has `name`, `status` ("pass" or "fail"), `message`, and `fixSuggestion` (null if passing).
- `displayText` shows human-readable `[OK]` or `[FAIL]` per check with fix suggestions.

**Negative Test:**
- Delete or corrupt `~/.config/opencode/opencode-autopilot.json` and run `oc_doctor`.
- Expected: The `config-validity` check reports "fail" with a fix suggestion: "Run `bunx @kodrunhq/opencode-autopilot configure` to reconfigure."

**Pass/Fail:**
- PASS: Returns structured JSON with all 8 checks. Failed checks include actionable fix suggestions. `allPassed` is true only when every check passes.
- FAIL: Missing checks, no fix suggestions on failures, or tool crashes.

---

### oc_session_stats

**Purpose:** View session statistics including event counts, decisions, errors, and per-phase breakdown.

**Input Parameters:**
- `sessionID` (string, optional): Session ID to view. Uses latest if omitted. Must match `^[a-zA-Z0-9_-]{1,256}$`.

**Prerequisites:**
- At least one session log exists in `~/.config/opencode/logs/`

**Steps:**
1. Invoke `oc_session_stats` with no arguments (uses latest session).
2. Observe the JSON response.

**Expected Output:**
- JSON with `action: "session_stats"`, `sessionId`, `duration` (ms), `eventCount`, `decisionCount`, `errorSummary` (object), `phaseBreakdown` (array), and `displayText`.
- `phaseBreakdown` entries have `phase`, `decisionCount`, `errorCount`.
- `displayText` contains a human-readable table.

**Negative Test:**
- Invoke `oc_session_stats` with `sessionID: "nonexistent-session-id"`.
- Expected: Returns `action: "error"` with message `Session "nonexistent-session-id" not found.`

**Pass/Fail:**
- PASS: Returns session stats with event counts, decision counts, error summary, and per-phase breakdown. Invalid session ID returns a clear error.
- FAIL: Crashes on missing session, or returns incomplete statistics.

---

### oc_logs

**Purpose:** View session logs. Modes: list (all sessions), detail (full log with summary), search (filter events by type/time).

**Input Parameters:**
- `mode` (enum: "list" | "detail" | "search", required): View mode
- `sessionID` (string, optional): Session ID to view (uses latest if omitted)
- `eventType` (string, optional): Filter events by type (for search mode)
- `after` (string, optional): ISO timestamp lower bound (for search mode)
- `before` (string, optional): ISO timestamp upper bound (for search mode)

**Prerequisites:**
- At least one session log exists for detail/search modes

**Steps:**
1. Invoke `oc_logs` with `mode: "list"`.
2. Observe: Returns a table of all session logs with session ID, start time, event count, decisions, and errors.
3. Pick a session ID from the list.
4. Invoke `oc_logs` with `mode: "detail"` and the chosen `sessionID`.
5. Observe: Returns the full session log with a markdown summary.

**Expected Output:**
- List mode: `action: "logs_list"`, `sessions` array, `displayText` with table format.
- Detail mode: `action: "logs_detail"`, `sessionLog` object, `summary` markdown, `displayText`.
- Search mode: `action: "logs_search"`, `events` array, `displayText`.

**Negative Test:**
- Invoke `oc_logs` with `mode: "detail"` and `sessionID: "does-not-exist"`.
- Expected: Returns `action: "error"` with message `Session "does-not-exist" not found.`

**Pass/Fail:**
- PASS: All three modes return structured JSON with displayText. Missing sessions return clear errors.
- FAIL: Any mode crashes, or missing session produces an unhandled exception.

---

### oc_memory_status

**Purpose:** Show memory system status: observation counts, recent memories, preferences, and storage size.

**Input Parameters:**
- `detail` (enum: "summary" | "full", default: "summary"): Level of detail

**Prerequisites:**
- Plugin installed (memory DB may or may not exist yet)

**Steps:**
1. Invoke `oc_memory_status` with `detail: "summary"`.
2. Observe the JSON response.

**Expected Output:**
- JSON with `stats` object (or null if DB error), `recentObservations` array, `preferences` array.
- `stats` includes: `totalObservations`, `totalProjects`, `totalPreferences`, `storageSizeKb`, `observationsByType` (keyed by observation type).
- `recentObservations` shows last 10 observations with `type`, `summary`, `createdAt`, `confidence`.

**Negative Test:**
- Delete the memory database file and invoke `oc_memory_status`.
- Expected: Returns `stats: null` with `error` field: `Memory system error: ...` (does not crash).

**Pass/Fail:**
- PASS: Returns structured status with counts and recent observations. Handles missing DB gracefully with error field.
- FAIL: Crashes when DB is missing, or returns incorrect counts.

---

**Configuration Tools**

### oc_configure

**Purpose:** Configure model assignments for agent groups. Supports a multi-step session workflow: start, assign, commit, doctor, reset.

**Input Parameters:**
- `subcommand` (enum: "start" | "assign" | "commit" | "doctor" | "reset", required): Action to perform
- `group` (string, optional): Group ID for assign subcommand
- `primary` (string, optional): Primary model ID for assign subcommand
- `fallbacks` (string, optional): Comma-separated fallback model IDs for assign subcommand

**Prerequisites:**
- Plugin installed

**Steps:**
1. Invoke `oc_configure` with `subcommand: "start"`.
2. Observe: Returns available models, group definitions, and current config.
3. Invoke `oc_configure` with `subcommand: "assign"`, `group: "architects"`, `primary: "anthropic/claude-opus-4-6"`.
4. Observe: Returns assignment confirmation with diversity warnings.
5. Repeat assign for all groups.
6. Invoke `oc_configure` with `subcommand: "commit"`.
7. Observe: Persists all assignments to `~/.config/opencode/opencode-autopilot.json`.

**Expected Output:**
- Start: `stage: "start"`, `displayText` with numbered model list, `groups` array, `diversityRules`.
- Assign: `stage: "assigned"`, `group`, `primary`, `fallbacks`, `assignedCount`, `diversityWarnings`.
- Commit: `stage: "committed"`, `groups` object, `configPath`.
- Doctor: `stage: "doctor"`, `checks` object, `allPassed`.
- Reset: `stage: "reset"`, `message`.

**Negative Test:**
- Invoke `oc_configure` with `subcommand: "assign"` and `group: "invalid-group"`.
- Expected: Returns `action: "error"` with message listing valid group names.

**Pass/Fail:**
- PASS: Full start-assign-commit workflow persists config. Invalid groups return clear errors. Diversity warnings surface when same model family is used across groups.
- FAIL: Config not persisted after commit, invalid groups accepted, or diversity warnings missing.

---

### oc_mock_fallback

**Purpose:** Generate mock errors for fallback chain testing. Simulates various failure modes and shows how the fallback system would classify them.

**Input Parameters:**
- `mode` (string, required): Failure mode to simulate or "list" for available modes

**Prerequisites:**
- Plugin installed

**Steps:**
1. Invoke `oc_mock_fallback` with `mode: "list"`.
2. Observe: Returns available failure modes (rate_limit, quota_exceeded, timeout, malformed, service_unavailable).
3. Invoke `oc_mock_fallback` with `mode: "rate_limit"`.
4. Observe: Returns the generated mock error with classification and retryability.

**Expected Output:**
- List mode: `action: "mock_fallback_list"`, `modes` array, `displayText` with descriptions.
- Failure mode: `action: "mock_fallback"`, `mode`, `error` (name, message, status), `classification`, `retryable` boolean, `displayText`.
- `rate_limit`: classification is rate_limit, retryable is true (status 429).
- `malformed`: retryable is false (corrupt response).

**Negative Test:**
- Invoke `oc_mock_fallback` with `mode: "nonexistent"`.
- Expected: Returns `action: "error"` with message `Invalid failure mode. Use 'list' to see available modes.`

**Pass/Fail:**
- PASS: Lists all 5 failure modes. Each mode generates correct classification and retryability. Invalid modes return clear errors.
- FAIL: Missing failure modes, incorrect classification, or crashes on invalid input.

---

**Asset Tools**

### oc_stocktake

**Purpose:** Audit all installed skills, commands, and agents with optional YAML frontmatter lint validation.

**Input Parameters:**
- `lint` (boolean, optional, default: true): Run YAML frontmatter linter on all assets

**Prerequisites:**
- Plugin installed with assets in `~/.config/opencode/`

**Steps:**
1. Invoke `oc_stocktake` with default arguments.
2. Observe the JSON response.

**Expected Output:**
- JSON with `skills` array, `commands` array, `agents` array, and `summary` object.
- Each entry has `name`, `type`, `origin` ("built-in", "config-hook", or "user-created").
- Config-hook agents include `mode`, `group`, `hidden` fields.
- When `lint: true`, each entry includes `lint` object with `valid`, `errors`, and `warnings`.
- Summary includes `total`, `builtIn`, `userCreated`, `configHook`, `lintErrors`, `lintWarnings`.

**Negative Test:**
- Delete `~/.config/opencode/skills/` directory and invoke `oc_stocktake`.
- Expected: The skills array is empty but the tool does not crash. Commands and agents are still reported.

**Pass/Fail:**
- PASS: Reports all three asset types with correct origin classification. Config-hook agents (standard + pipeline) are included. Lint results show errors/warnings for invalid frontmatter.
- FAIL: Config-hook agents missing, lint not running, or crashes on missing directories.

---

### oc_create_agent

**Purpose:** Create a new OpenCode agent markdown file.

**Input Parameters:**
- `name` (string, 1-64 chars, required): Agent name, lowercase alphanumeric with hyphens
- `description` (string, 1-500 chars, required): What the agent does
- `mode` (enum: "primary" | "subagent" | "all", default: "subagent"): Agent mode
- `model` (string, max 128, optional): Model identifier
- `temperature` (number, 0.0-1.0, optional): Temperature setting

**Prerequisites:**
- Plugin installed
- No existing agent with the given name

**Steps:**
1. Invoke `oc_create_agent` with `name: "test-agent"`, `description: "A test agent"`, `mode: "subagent"`.
2. Observe the response.

**Expected Output:**
- Success: `Agent 'test-agent' created at ~/.config/opencode/agents/test-agent.md. Restart OpenCode to use it.`
- The file is written atomically with `wx` flag (no-clobber).

**Negative Test:**
- Invoke `oc_create_agent` with `name: ""` (empty name).
- Expected: Returns `Error: ...` with validation failure message.
- Invoke again with the same `name: "test-agent"`.
- Expected: Returns `Error: Agent 'test-agent' already exists at ...`

**Pass/Fail:**
- PASS: Creates agent file at the correct path. Empty names rejected. Duplicate names rejected (EEXIST).
- FAIL: Overwrites existing agent, accepts invalid names, or writes to wrong directory.

---

### oc_create_skill

**Purpose:** Create a new OpenCode skill directory with SKILL.md.

**Input Parameters:**
- `name` (string, 1-64 chars, required): Skill name, lowercase alphanumeric with hyphens
- `description` (string, 1-1024 chars, required): What the skill provides
- `license` (string, max 64, optional): License
- `compatibility` (string, max 64, optional): Compatibility target
- `stacks` (string array, optional): Stack tags for adaptive loading
- `requires` (string array, optional): Required skill dependencies

**Prerequisites:**
- Plugin installed
- No existing skill with the given name

**Steps:**
1. Invoke `oc_create_skill` with `name: "test-skill"`, `description: "A test skill for QA"`.
2. Observe the response.

**Expected Output:**
- Success: `Skill 'test-skill' created at ~/.config/opencode/skills/test-skill/SKILL.md. Restart OpenCode to use it.`
- Creates directory `test-skill/` with `SKILL.md` inside.

**Negative Test:**
- Invoke `oc_create_skill` with `name: "123"` (starts with a number -- this is valid per regex).
- Then invoke with `name: "test skill"` (contains space).
- Expected: Space in name returns `Error: ...` validation failure.

**Pass/Fail:**
- PASS: Creates skill directory and SKILL.md. Names with spaces rejected. Duplicate names rejected.
- FAIL: Creates flat file instead of directory, accepts invalid names, or overwrites existing skill.

---

### oc_create_command

**Purpose:** Create a new OpenCode command markdown file.

**Input Parameters:**
- `name` (string, 1-64 chars, required): Command name, lowercase alphanumeric with hyphens
- `description` (string, 1-500 chars, required): What the command does
- `agent` (string, max 64, optional): Agent to use when running this command
- `model` (string, max 128, optional): Model override

**Prerequisites:**
- Plugin installed
- No existing command with the given name
- Name must not conflict with built-in commands

**Steps:**
1. Invoke `oc_create_command` with `name: "test-cmd"`, `description: "A test command"`.
2. Observe the response.

**Expected Output:**
- Success: `Command 'test-cmd' created at ~/.config/opencode/commands/test-cmd.md. Restart OpenCode to use it.`

**Negative Test:**
- Invoke `oc_create_command` with `name: "config"` (built-in command).
- Expected: Returns `Error: ...` because the name conflicts with OpenCode's built-in `config` command.

**Pass/Fail:**
- PASS: Creates command file. Built-in names (init, undo, redo, share, help, config, compact, clear, cost, login, logout, bug) are rejected.
- FAIL: Allows built-in command names, or writes to wrong directory.

---

### oc_update_docs

**Purpose:** Detect documentation affected by recent code changes and suggest updates.

**Input Parameters:**
- `scope` (enum: "changed" | "all", default: "changed"): Scope of analysis

**Prerequisites:**
- OpenCode session in a Git repository
- Source files changed relative to HEAD (for "changed" scope)

**Steps:**
1. Make a change to a source file (e.g., `src/config.ts`).
2. Invoke `oc_update_docs` with `scope: "changed"`.
3. Observe the response.

**Expected Output:**
- JSON with `changedFiles` (non-markdown files), `affectedDocs` (markdown files that may need updates), and `summary`.
- Each `affectedDocs` entry has `doc` (path), `reason`, and `suggestion`.
- Uses heuristics: path/name matches between changed files and markdown files.

**Negative Test:**
- Invoke `oc_update_docs` in a clean working tree (no changes).
- Expected: Returns `changedFiles: []` and `affectedDocs: []` with summary `0 source files changed, 0 docs may need updates`.

**Pass/Fail:**
- PASS: Identifies related documentation files based on path/name heuristics. Clean repos return empty results.
- FAIL: Crashes on clean repos, or fails to identify obvious documentation relationships.

---

### oc_quick

**Purpose:** Run a task through a simplified pipeline, skipping RECON, CHALLENGE, ARCHITECT, and EXPLORE phases.

**Input Parameters:**
- `idea` (string, 1-4096 chars, required): The task to accomplish

**Prerequisites:**
- OpenCode session in a project directory
- No in-progress orchestration run

**Steps:**
1. Invoke `oc_quick` with `idea: "Create a hello world function"`.
2. Observe: Pipeline creates state starting at PLAN phase with discovery phases marked as SKIPPED.
3. Pipeline proceeds through PLAN, BUILD, SHIP, and RETROSPECTIVE.

**Expected Output:**
- Returns orchestrator dispatch/complete JSON as the pipeline advances.
- Initial state has RECON, CHALLENGE, ARCHITECT, EXPLORE as `SKIPPED` and PLAN as `IN_PROGRESS`.
- Stub artifacts created for ARCHITECT (`design.md`) and CHALLENGE (`brief.md`).

**Negative Test:**
- Invoke `oc_quick` with `idea: ""` (empty string).
- Expected: Returns `action: "error"` with message `No idea provided. Usage: /oc-quick <describe the task>`.
- Invoke while another run is in progress.
- Expected: Returns `action: "error"` with message about existing in-progress run.

**Pass/Fail:**
- PASS: Skips 4 discovery phases, starts at PLAN. Empty ideas rejected. Concurrent runs prevented.
- FAIL: Does not skip phases, accepts empty ideas, or allows concurrent runs.

---

**Pipeline Tools**

### oc_orchestrate

**Purpose:** Drive the orchestrator pipeline. Provide an idea to start, or a result to advance the current phase.

**Input Parameters:**
- `idea` (string, max 4096, optional): Idea to start a new orchestration run
- `result` (string, max 1,048,576, optional): Result from previous agent to advance the pipeline

**Prerequisites:**
- OpenCode session in a project directory

**Steps:**
1. Invoke `oc_orchestrate` with `idea: "Build a utility to format dates"`.
2. Observe: Returns a dispatch instruction with an agent name and prompt for the RECON phase.
3. Execute the dispatched agent and collect its output.
4. Invoke `oc_orchestrate` with `result: "<agent output>"`.
5. Repeat until `action: "complete"` is returned.

**Expected Output:**
- Start: `action: "dispatch"` or `action: "dispatch_multi"` with `agent`, `prompt`, and `phase`.
- Advance: Next phase dispatch or `action: "complete"` with summary.
- Errors: `action: "error"` with message.
- State persisted at `.opencode-autopilot/pipeline-state.json`.

**Negative Test:**
- Invoke `oc_orchestrate` with no arguments (no idea, no result, no existing state).
- Expected: Returns `action: "error"` with message `No active run. Provide an idea to start.`

**Pass/Fail:**
- PASS: Starts pipeline on idea, advances on result, completes after all 8 phases. Saves state to disk. Error on no args without state.
- FAIL: State not persisted, phases skipped, or no error on empty invocation.

---

### oc_phase

**Purpose:** Manage orchestrator phase transitions.

**Input Parameters:**
- `subcommand` (enum: "status" | "complete" | "validate", required): Operation to perform
- `from` (string, optional): Source phase for validate subcommand
- `to` (string, optional): Target phase for validate subcommand

**Prerequisites:**
- An active orchestration run (pipeline state exists)

**Steps:**
1. Start a pipeline via `oc_orchestrate`.
2. Invoke `oc_phase` with `subcommand: "status"`.
3. Observe: Returns current phase and its status.
4. Invoke `oc_phase` with `subcommand: "validate"`, `from: "RECON"`, `to: "CHALLENGE"`.
5. Observe: Returns `{ valid: true }`.

**Expected Output:**
- Status: `{ currentPhase: "RECON", status: "IN_PROGRESS" }`.
- Complete: `{ ok: true, previousPhase: "RECON", currentPhase: "CHALLENGE" }`.
- Validate: `{ valid: true }` or `{ valid: false, error: "..." }`.

**Negative Test:**
- Invoke `oc_phase` with `subcommand: "status"` when no pipeline state exists.
- Expected: Returns `{ error: "no_state" }`.
- Invoke with `subcommand: "validate"` without `from` or `to`.
- Expected: Returns `{ error: "from and to phases are required" }`.

**Pass/Fail:**
- PASS: Status returns current phase. Complete advances phase. Validate checks transition legality. No-state returns error.
- FAIL: Incorrect phase tracking, invalid transitions accepted, or crashes on missing state.

---

### oc_state

**Purpose:** Manage orchestrator pipeline state with CRUD operations.

**Input Parameters:**
- `subcommand` (enum: "load" | "get" | "patch" | "append-decision", required): Operation to perform
- `field` (string, optional): Field name for get/patch
- `value` (string, optional): Value for patch
- `phase` (string, optional): Phase name for append-decision
- `agent` (string, optional): Agent name for append-decision
- `decision` (string, optional): Decision text for append-decision
- `rationale` (string, optional): Rationale text for append-decision

**Prerequisites:**
- An active orchestration run (pipeline state exists)

**Steps:**
1. Start a pipeline.
2. Invoke `oc_state` with `subcommand: "load"`.
3. Observe: Returns the full pipeline state object.
4. Invoke `oc_state` with `subcommand: "get"`, `field: "currentPhase"`.
5. Observe: Returns `{ field: "currentPhase", value: "RECON" }`.

**Expected Output:**
- Load: Full state JSON.
- Get: `{ field, value }` for the requested field.
- Patch: `{ ok: true }`. Only `status`, `arenaConfidence`, `exploreTriggered` are patchable.
- Append-decision: `{ ok: true, decisions: N }`.

**Negative Test:**
- Invoke `oc_state` with `subcommand: "patch"`, `field: "idea"`.
- Expected: Returns `{ error: "field not patchable: idea. Allowed: status, arenaConfidence, exploreTriggered" }`.
- Invoke `oc_state` with `subcommand: "load"` when no state exists.
- Expected: Returns `{ error: "no_state" }`.

**Pass/Fail:**
- PASS: Load returns full state. Get returns specific fields. Patch restricts to allowed fields. Append-decision adds entries. No-state returns error.
- FAIL: Allows patching restricted fields, crashes on missing state, or loses data.

---

### oc_plan

**Purpose:** Query orchestrator plan data: tasks by wave and status counts.

**Input Parameters:**
- `subcommand` (enum: "waves" | "status-count", required): Operation to perform

**Prerequisites:**
- An active orchestration run with tasks defined

**Steps:**
1. Start a pipeline that progresses to PLAN phase (tasks get created).
2. Invoke `oc_plan` with `subcommand: "waves"`.
3. Observe: Returns tasks grouped by wave number.
4. Invoke `oc_plan` with `subcommand: "status-count"`.
5. Observe: Returns counts by task status.

**Expected Output:**
- Waves: `{ waves: { "1": [...], "2": [...] } }`.
- Status-count: `{ pending: N, done: N, failed: N, ... }`.

**Negative Test:**
- Invoke `oc_plan` with `subcommand: "waves"` when no pipeline state exists.
- Expected: Returns `{ error: "no_state" }`.

**Pass/Fail:**
- PASS: Waves groups tasks by wave number. Status-count returns accurate tallies. No-state returns error.
- FAIL: Incorrect grouping, wrong counts, or crashes on missing state.

---

### oc_confidence

**Purpose:** Manage the orchestrator confidence ledger: append entries, get summary, filter by phase.

**Input Parameters:**
- `subcommand` (enum: "append" | "summary" | "filter", required): Operation to perform
- `phase` (string, optional): Phase name for append/filter
- `agent` (string, optional): Agent name for append
- `area` (string, optional): Area of confidence for append
- `level` (enum: "HIGH" | "MEDIUM" | "LOW", optional): Confidence level for append
- `rationale` (string, optional): Rationale text for append

**Prerequisites:**
- An active orchestration run

**Steps:**
1. Start a pipeline.
2. Invoke `oc_confidence` with `subcommand: "append"`, `phase: "RECON"`, `agent: "oc-researcher"`, `area: "requirements"`, `level: "HIGH"`, `rationale: "Clear user requirements identified"`.
3. Observe: Returns `{ ok: true, entries: 1 }`.
4. Invoke `oc_confidence` with `subcommand: "summary"`.
5. Observe: Returns aggregate counts by level.

**Expected Output:**
- Append: `{ ok: true, entries: N }`.
- Summary: Aggregate confidence counts (HIGH, MEDIUM, LOW).
- Filter: `{ entries: [...] }` filtered by the specified phase.

**Negative Test:**
- Invoke `oc_confidence` with `subcommand: "append"` but omit required fields (e.g., no `level`).
- Expected: Returns `{ error: "phase, agent, area, level, and rationale are required" }`.

**Pass/Fail:**
- PASS: Append adds entries. Summary aggregates correctly. Filter returns phase-specific entries. Missing fields return clear errors.
- FAIL: Missing field validation, incorrect aggregation, or crashes.

---

### oc_pipeline_report

**Purpose:** View pipeline decision trace with phase-by-phase breakdown.

**Input Parameters:**
- `sessionID` (string, optional): Session ID to view (uses latest if omitted). Must match `^[a-zA-Z0-9_-]{1,256}$`.

**Prerequisites:**
- At least one session log with decisions exists

**Steps:**
1. Complete a pipeline run (or partial run with decisions).
2. Invoke `oc_pipeline_report` with no arguments (uses latest session).
3. Observe the response.

**Expected Output:**
- JSON with `action: "pipeline_report"`, `sessionId`, `phases` array (each with `phase` and `decisions`), `totalDecisions`, `displayText`.
- Each decision has `agent`, `decision`, `rationale`.
- `displayText` shows phase-by-phase breakdown in human-readable format.

**Negative Test:**
- Invoke `oc_pipeline_report` with `sessionID: "nonexistent"`.
- Expected: Returns `action: "error"` with message `Session "nonexistent" not found.`

**Pass/Fail:**
- PASS: Reports decisions grouped by phase with agent and rationale context. Invalid session returns clear error.
- FAIL: Missing phase grouping, empty report for sessions with decisions, or crashes.

---

### oc_forensics

**Purpose:** Diagnose a failed orchestrator pipeline run. Returns structured failure analysis.

**Input Parameters:**
- None (no arguments)

**Prerequisites:**
- A pipeline run that has failed (status: "FAILED" with `failureContext` populated)

**Steps:**
1. Trigger a pipeline failure (e.g., provide input that causes an agent error).
2. Invoke `oc_forensics`.
3. Observe the response.

**Expected Output:**
- JSON with `failedPhase`, `failedAgent`, `errorMessage`, `lastSuccessfulPhase`, `recoverable` (boolean), `suggestedAction` ("resume" or "restart"), `phasesCompleted` (array).
- BUILD failures: `recoverable: false`, `suggestedAction: "restart"`.
- RECON failures: `recoverable: true`, `suggestedAction: "restart"` (nothing to resume from).
- Other failures: `recoverable: true`, `suggestedAction: "resume"`.

**Negative Test:**
- Invoke `oc_forensics` when no pipeline state exists.
- Expected: Returns `{ action: "error", message: "No pipeline state found" }`.
- Invoke when pipeline status is not "FAILED" (e.g., "IN_PROGRESS").
- Expected: Returns `{ action: "error", message: "No failure to diagnose -- pipeline status: IN_PROGRESS" }`.

**Pass/Fail:**
- PASS: Returns structured failure analysis with recoverability assessment. Correct suggested actions per phase. No-state and non-failed states return clear errors.
- FAIL: Incorrect recoverability, wrong suggested actions, or crashes on edge cases.

---

**Review Tools**

### oc_review

**Purpose:** Run multi-agent code review. Dispatches specialist reviewer agents and cross-verifies findings.

**Input Parameters:**
- `scope` (enum: "staged" | "unstaged" | "branch" | "all" | "directory", optional): Review scope
- `filter` (string, optional): Regex pattern to filter files
- `directory` (string, optional): Directory path for directory scope
- `findings` (string, optional): JSON findings from previously dispatched agents

**Prerequisites:**
- Git repository with code changes
- No active review in progress (or provide findings to advance an active one)

**Steps:**
1. Stage some code changes.
2. Invoke `oc_review` with `scope: "staged"`.
3. Observe: Returns `action: "dispatch"`, `stage: 1`, and `agents` array with specialist reviewer names and prompts.
4. Execute each dispatched agent and collect findings.
5. Invoke `oc_review` with `findings: "<JSON findings>"`.
6. Repeat until `action: "complete"` with final report.

**Expected Output:**
- Start: `action: "dispatch"`, `stage: 1`, `agents` array.
- Advance: Next stage dispatch or `action: "complete"` with `report`.
- Status (no args with active review): `action: "status"`, `stage`, `message`.
- Review state persisted at `.opencode-autopilot/current-review.json`.

**Negative Test:**
- Invoke `oc_review` with no arguments and no active review.
- Expected: Returns `action: "error"` with message `No active review. Provide scope to start.`

**Pass/Fail:**
- PASS: Starts review on scope, selects agents based on detected stacks, dispatches in stages, completes with structured report. State persisted to disk. Error on no args without state.
- FAIL: No agent selection, state not persisted, or crashes on empty invocation.

---

## Skills and Adaptive Injection

The plugin ships 18 skills in `assets/skills/`. Skills are loaded from `~/.config/opencode/skills/`, filtered by detected project stack, ordered by dependencies, and injected into the system prompt within a token budget. The adaptive injection system is implemented in `src/skills/adaptive-injector.ts`, `src/skills/loader.ts`, `src/skills/dependency-resolver.ts`, and `src/skills/linter.ts`.

### Skill Loading

**Prerequisites:**
- Plugin installed with assets copied to `~/.config/opencode/skills/`
- All 18 skill directories present: brainstorming, code-review, coding-standards, csharp-patterns, e2e-testing, frontend-design, git-worktrees, go-patterns, java-patterns, plan-executing, plan-writing, python-patterns, rust-patterns, strategic-compaction, systematic-debugging, tdd-workflow, typescript-patterns, verification

**Steps:**
1. Run `oc_doctor` and check the `skill-loading` health check result.
2. Alternatively, invoke `oc_stocktake` and inspect the `skills` array in the response.
3. Verify each skill has a valid SKILL.md with YAML frontmatter containing `name` and `description` fields.

**Expected Output:**
- `oc_doctor` skill-loading check reports "pass" with the count of loaded skills (18/18 or a filtered subset depending on detected stack).
- `oc_stocktake` skills array contains 18 entries, each with `name`, `type: "skill"`, and `origin: "built-in"`.

**Negative Test:**
- Delete a single skill's SKILL.md file (e.g., remove `~/.config/opencode/skills/brainstorming/SKILL.md`).
- Run `oc_stocktake` again.
- Expected: The deleted skill is missing from the skills array. The remaining 17 skills still load. No crash or error.

**Pass/Fail:**
- PASS: All 18 skills load without errors. Missing individual SKILL.md files are gracefully skipped without affecting other skills.
- FAIL: Skills fail to load, count is incorrect, or a missing file causes a crash.

---

### Stack Detection

**Prerequisites:**
- Plugin installed
- Access to project directories with different manifest files

**Steps:**
1. Open an OpenCode session in a TypeScript project (has `package.json` and `tsconfig.json`).
2. Run `oc_doctor` and observe the `skill-loading` check output.
3. Note the detected stacks (should include "javascript", "typescript").
4. Repeat in a Go project (has `go.mod`) -- should detect "go".
5. Repeat in a Python project (has `pyproject.toml` or `requirements.txt`) -- should detect "python".
6. Repeat in a Rust project (has `Cargo.toml`) -- should detect "rust".
7. Repeat in a Java project (has `pom.xml` or `build.gradle`) -- should detect "java".
8. Repeat in a C# project (has `*.csproj` or `*.sln` file at root) -- should detect "csharp".

**Expected Output:**
- Each project type produces the correct stack tags based on manifest files.
- `MANIFEST_TAGS` checks: `package.json` -> javascript, `tsconfig.json` -> typescript, `bunfig.toml` -> bun+typescript, `go.mod` -> go, `Cargo.toml` -> rust, `pyproject.toml`/`requirements.txt`/`Pipfile` -> python, `Gemfile` -> ruby, `pom.xml`/`build.gradle`/`build.gradle.kts` -> java.
- `EXT_MANIFEST_TAGS` checks: `*.csproj`/`*.sln` -> csharp (via readdir extension matching).
- Multiple manifest files produce merged tags (e.g., TypeScript project with Bun: ["javascript", "typescript", "bun"]).

**Negative Test:**
- Open a session in an empty directory with no manifest files.
- Expected: Detected stacks is empty (`[]`). All methodology skills (those with empty `stacks` arrays) still load.

**Pass/Fail:**
- PASS: Correct stack tags detected for all 6 major ecosystems (TypeScript, Go, Python, Rust, Java, C#). Empty directories produce empty tags.
- FAIL: Wrong tags detected, missing ecosystem support, or crash on empty directory.

---

### Adaptive Filtering

**Prerequisites:**
- Plugin installed with all 18 skills
- A TypeScript project directory

**Steps:**
1. Open an OpenCode session in a TypeScript project.
2. Run `oc_doctor` and note the skill-loading output: `Detected stacks: [javascript, typescript], N/18 skills matched`.
3. Verify that the matched skills include:
   - Language-specific: `typescript-patterns` (stacks: ["typescript"])
   - Methodology skills (empty stacks): `coding-standards`, `code-review`, `tdd-workflow`, `plan-writing`, `plan-executing`, `brainstorming`, `systematic-debugging`, `verification`, `strategic-compaction`, `e2e-testing`, `frontend-design`, `git-worktrees`
4. Verify that excluded skills are NOT matched:
   - `go-patterns` (stacks: ["go"]), `python-patterns` (stacks: ["python"]), `rust-patterns` (stacks: ["rust"]), `java-patterns` (stacks: ["java"]), `csharp-patterns` (stacks: ["csharp"])

**Expected Output:**
- Skills with empty `stacks` arrays are ALWAYS included (methodology skills).
- Skills with non-empty `stacks` arrays are included only when at least one tag matches the detected project stack.
- For a TypeScript project: ~13 skills matched out of 18.

**Negative Test:**
- Open a session in a Go project directory.
- Expected: `go-patterns` is included; `typescript-patterns`, `python-patterns`, `rust-patterns`, `java-patterns`, `csharp-patterns` are excluded. Methodology skills are still included.

**Pass/Fail:**
- PASS: Only matching language skills inject for the detected stack. All methodology skills always inject. Non-matching language skills are excluded.
- FAIL: Non-matching language skills inject, methodology skills are excluded, or filtering logic is inverted.

---

### Dependency Resolution

**Prerequisites:**
- Plugin installed
- Skills with `requires` fields exist in the skills directory

**Steps:**
1. Run `oc_stocktake` with `lint: true`.
2. Inspect skills that have non-empty `requires` arrays in their frontmatter.
3. Verify that when skills are injected into the system prompt, prerequisite skills appear before dependent skills.
4. Create a test skill with `requires: ["coding-standards"]` and verify it loads after `coding-standards`.

**Expected Output:**
- The dependency resolver uses topological sort (iterative DFS) to order skills.
- Skills with prerequisites are placed after their dependencies in the injection order.
- Unknown dependencies (not in the loaded skill set) are silently skipped (graceful degradation).

**Negative Test (Circular Dependency):**
- Create two test skills: `skill-a` with `requires: ["skill-b"]` and `skill-b` with `requires: ["skill-a"]`.
- Expected: Both skills are detected as cycle participants and excluded from injection. Other skills are unaffected. No crash or infinite loop.
- The dependency resolver has a hard cap of 500 skills (MAX_SKILLS) to prevent DoS.

**Pass/Fail:**
- PASS: Skills are ordered by dependencies. Circular dependencies are detected and excluded without crashing. Unknown dependencies are skipped gracefully.
- FAIL: Skills are in wrong order, circular dependencies cause a hang, or unknown dependencies cause errors.

---

### Token Budgeting

**Prerequisites:**
- Plugin installed with skills
- A project with a detected stack

**Steps:**
1. Open a session in a TypeScript project.
2. Observe that injected skill context does not exceed the default 8000-token budget (approximately 32,000 characters at 4 chars/token).
3. Optionally create many large custom skills to test budget enforcement.

**Expected Output:**
- The `buildMultiSkillContext` function concatenates skills in dependency order until the character budget (tokenBudget * 4) is exhausted.
- When the budget is reached mid-skill, that skill and all subsequent skills are omitted (no partial injection).
- The injected context is prefixed with "Skills context (follow these conventions and methodologies):".

**Negative Test:**
- Set an extremely low token budget (e.g., 10 tokens = 40 characters).
- Expected: Either zero or one very small skill injects. No crash. Returns empty string if no skill fits.

**Pass/Fail:**
- PASS: Skill injection respects the 8000-token default budget. No partial skills injected. Empty result when budget is too small.
- FAIL: Budget exceeded, partial skills injected, or crash on low budget.

---

### Skill Linter

**Prerequisites:**
- Plugin installed

**Steps:**
1. Run `oc_stocktake` with `lint: true`.
2. Inspect the `lint` field on each skill entry.
3. Verify all built-in skills have `valid: true` with no errors.

**Expected Output:**
- Each skill's lint result includes `valid` (boolean), `errors` (array), and `warnings` (array).
- Valid skills: `valid: true`, `errors: []`.
- The linter checks: YAML frontmatter exists, required fields (`name`, `description`) are present and non-empty, `stacks` and `requires` contain only strings, body content exists after frontmatter.
- Missing recommended fields (`stacks`, `requires`) produce warnings, not errors.

**Negative Test (Missing Frontmatter):**
- Create a skill file with no YAML frontmatter (just plain text).
- Expected: `valid: false`, `errors: ["Missing YAML frontmatter"]`.

**Negative Test (Invalid Frontmatter):**
- Create a skill with `stacks: [123, true]` (non-string values).
- Expected: `valid: false`, `errors: ["stacks must contain only strings"]`.

**Negative Test (Empty Body):**
- Create a skill with valid frontmatter but no content after the `---` block.
- Expected: `valid: true` (body is a warning, not an error), `warnings: ["Skill has no content after frontmatter"]`.

**Pass/Fail:**
- PASS: All built-in skills pass linting. Invalid skills produce specific error messages. Warnings are distinct from errors.
- FAIL: Built-in skills fail linting, invalid frontmatter is not detected, or linter crashes.

---

## Memory System

The memory system provides smart dual-scope memory (project patterns + user preferences) using SQLite with FTS5 full-text search. It captures observations from session events, scores them by relevance with time-based decay, and injects the most relevant context into the system prompt. Implemented in `src/memory/`.

### Memory Database Setup

**Prerequisites:**
- Plugin installed
- First session in any project (triggers DB creation)

**Steps:**
1. Check if `~/.config/opencode/memory/memory.db` exists.
2. If not, open an OpenCode session (triggers `getMemoryDb()` which creates the DB).
3. Verify the DB file is created at the expected path.
4. Run `oc_doctor` and check the `memory-db` health check.

**Expected Output:**
- SQLite database created at `~/.config/opencode/memory/memory.db`.
- Database uses WAL journal mode, foreign keys enabled, 5000ms busy timeout.
- Schema includes 3 tables: `projects`, `observations`, `preferences`.
- FTS5 virtual table `observations_fts` created for full-text search on `content` and `summary`.
- Triggers maintain FTS5 index on insert, update, and delete.
- Indexes on `observations(project_id)` and `observations(type)`.

**Negative Test:**
- Delete the memory DB file and run `oc_doctor`.
- Expected: `memory-db` check reports "pass" with message "Memory DB not yet initialized -- will be created on first memory capture". No crash.

**Pass/Fail:**
- PASS: DB created with correct schema (3 tables, FTS5, triggers, indexes). WAL mode enabled. Missing DB handled gracefully.
- FAIL: DB not created, schema incomplete, or missing DB causes crash.

---

### Observation Capture

**Prerequisites:**
- Plugin installed with memory system active
- An active OpenCode session

**Steps:**
1. Open an OpenCode session in a project directory.
2. Perform actions that generate memory-worthy events:
   - Make a decision (triggers `app.decision` event) -- e.g., run the orchestrator.
   - Trigger a phase transition (triggers `app.phase_transition` event).
   - Cause a session error (triggers `session.error` event).
3. Run `oc_memory_status` to verify observations were captured.

**Expected Output:**
- The capture handler (`createMemoryCaptureHandler`) listens for specific event types: `session.created`, `session.deleted`, `session.error`, `app.decision`, `app.phase_transition`.
- Noisy events (`tool_complete`, `context_warning`, `session_start/end`) are filtered out.
- `session.created`: Initializes project key and session ID, upserts project record.
- `app.decision`: Creates observation with type "decision", confidence 0.8.
- `app.phase_transition`: Creates observation with type "pattern", confidence 0.6.
- `session.error`: Creates observation with type "error", confidence 0.7.
- `session.deleted`: Triggers deferred pruning of stale observations.
- Each observation includes: `projectId`, `sessionId`, `type`, `content`, `summary` (truncated to 200 chars), `confidence`, `createdAt`, `lastAccessed`.

**Negative Test:**
- Send an event with no session ID.
- Expected: Capture handler silently returns without inserting. No crash.

**Pass/Fail:**
- PASS: Decision, phase transition, and error events produce observations in the DB. Noisy events are filtered. Missing session IDs are handled gracefully.
- FAIL: Events not captured, wrong observation types, or noisy events create observations.

---

### Retrieval and Ranking

**Prerequisites:**
- Memory DB exists with at least 5 observations

**Steps:**
1. Open a session in a project with existing memory observations.
2. Invoke `oc_memory_status` with `detail: "full"`.
3. Observe the `recentObservations` array -- observations should be ordered by relevance score (highest first).
4. Verify the 3-layer progressive disclosure:
   - Layer 1 (always): Observation summaries grouped by type (up to 5 per group).
   - Layer 2 (if budget allows): Recent Activity timeline (last 5 sessions).
   - Layer 3 (if budget allows): Full content for top 1-2 observations.

**Expected Output:**
- Relevance score formula: `timeDecay * frequencyWeight * typeWeight`.
  - `timeDecay = exp(-ageDays / halfLifeDays)` (default half-life: 90 days).
  - `frequencyWeight = max(log2(accessCount + 1), 1)`.
  - `typeWeight`: per-type multiplier from constants (decisions weighted highest).
- Section order in injected context: Key Decisions, Patterns, Recent Errors, Learned Preferences, Context Notes, Tool Usage Patterns.
- Max 5 observations per group in Layer 1.
- Layer 2 threshold: 500 chars remaining budget.
- Layer 3 threshold: 1000 chars remaining budget.

**Negative Test:**
- Empty memory store (no observations).
- Expected: `buildMemoryContext` returns empty string. No injection occurs. No crash.

**Pass/Fail:**
- PASS: Observations ranked by relevance score (descending). 3-layer progressive disclosure respects token budget. Empty memory returns empty string.
- FAIL: Wrong ranking order, layers overflow budget, or empty memory causes error.

---

### System Prompt Injection

**Prerequisites:**
- Plugin installed with memory system active
- At least one prior session with observations in the DB

**Steps:**
1. Open a new session in a project with existing memory.
2. Observe the system prompt content (via session logs or tool inspection).
3. Verify memory context is injected via the `experimental.chat.system.transform` hook.

**Expected Output:**
- The memory injector (`createMemoryInjector`) is registered on the system prompt transform hook.
- On first message of a session, it retrieves memory context for the project path.
- Context is cached per session ID (subsequent messages reuse the cached context).
- Injected context starts with: `## Project Memory (auto-injected)`.
- Includes project name and last session date.
- If no session ID is provided, injection is skipped.

**Negative Test:**
- Start a session with no prior observations for the project.
- Expected: Memory injector retrieves empty context. Nothing is pushed to `output.system`. No crash.

**Negative Test (DB Error):**
- Corrupt the memory database file.
- Expected: Memory injector catches the error silently (best-effort pattern), logs a warning, and does not inject any context. Session continues normally.

**Pass/Fail:**
- PASS: Memory context appears in system prompt on sessions with prior observations. Cached per session. Empty memory produces no injection. DB errors are silently caught.
- FAIL: Memory not injected, cache not working, or DB error crashes the session.

---

### Decay and Pruning

**Prerequisites:**
- Memory DB with observations of varying ages and access counts

**Steps:**
1. Create observations with different `lastAccessed` timestamps and `accessCount` values.
2. Observe relevance scores via `oc_memory_status`.
3. End a session (triggers `session.deleted`, which defers `pruneStaleObservations`).
4. Verify old/low-relevance observations are pruned.

**Expected Output:**
- Exponential decay: observations last accessed 90 days ago have ~37% of a fresh observation's time decay score (at default 90-day half-life).
- Observations last accessed 180 days ago have ~13.5% time decay.
- Frequency boost: `log2(accessCount + 1)` -- a 7-access observation gets 3x boost over a 0-access one.
- Pruning phase 1: Remove observations below `MIN_RELEVANCE_THRESHOLD`.
- Pruning phase 2: If remaining count exceeds `MAX_OBSERVATIONS_PER_PROJECT`, remove lowest-scored until at cap.
- Pruning runs asynchronously (deferred via `setTimeout`) on session end.

**Negative Test:**
- Project with zero observations.
- Expected: `pruneStaleObservations` returns `{ pruned: 0 }`. No crash.

**Pass/Fail:**
- PASS: Old observations decay in relevance. Pruning removes stale entries. Cap enforced. Empty projects handled gracefully.
- FAIL: Decay formula incorrect, pruning not triggered, or cap not enforced.

---

### Cross-Project Isolation

**Prerequisites:**
- Memory DB with observations from at least two different projects

**Steps:**
1. Open sessions in two different project directories (e.g., `project-a/` and `project-b/`).
2. Generate observations in both sessions.
3. Open a new session in `project-a/`.
4. Invoke `oc_memory_status` and verify only `project-a` observations appear.

**Expected Output:**
- Each project gets a unique `projectId` computed from `computeProjectKey(projectRoot)`.
- `getObservationsByProject` filters by `project_id` column.
- Memory context injection retrieves only the current project's observations.
- Preferences are global (not project-scoped) -- they appear in all projects.

**Negative Test:**
- Open a session in a brand-new project directory with no prior observations.
- Expected: Memory status shows zero observations. No observations from other projects leak in.

**Pass/Fail:**
- PASS: Project-level observations are isolated. No cross-project leakage. Preferences are global. New projects start with empty memory.
- FAIL: Observations from other projects appear, or project keys collide.

---

## Fallback Chain

The fallback chain provides automatic model failover when API calls fail. It classifies errors, transitions between models via a state machine, and degrades message content across 3 tiers for maximum compatibility. Implemented in `src/orchestrator/fallback/`.

### Mock Fallback Mode

**Prerequisites:**
- Plugin installed

**Steps:**
1. Invoke `oc_mock_fallback` with `mode: "list"`.
2. Observe the 5 available failure modes: `rate_limit`, `quota_exceeded`, `timeout`, `malformed`, `service_unavailable`.
3. Invoke `oc_mock_fallback` with `mode: "rate_limit"`.
4. Observe the generated mock error with classification and retryability fields.
5. Repeat for each failure mode.

**Expected Output:**
- `rate_limit`: classification "rate_limit", retryable true, status 429.
- `quota_exceeded`: classification "quota_exceeded", retryable true.
- `timeout`: retryable true.
- `malformed`: retryable false (corrupt response cannot be retried).
- `service_unavailable`: classification "service_unavailable", retryable true, status 503.
- The `MockInterceptor` class cycles through a configured sequence of failure modes deterministically.

**Negative Test:**
- Invoke `oc_mock_fallback` with `mode: "nonexistent"`.
- Expected: Returns `action: "error"` with message `Invalid failure mode. Use 'list' to see available modes.`

**Pass/Fail:**
- PASS: All 5 failure modes generate correct classifications and retryability. Deterministic cycling works. Invalid modes return clear errors.
- FAIL: Wrong classifications, incorrect retryability, or crash on invalid mode.

---

### Error Classification

**Prerequisites:**
- Plugin installed

**Steps:**
1. Use `oc_mock_fallback` to generate errors for each failure mode.
2. Verify the error classifier (`classifyErrorType`) categorizes each correctly:
   - Status 429 or "rate limit" / "too many requests" patterns -> `rate_limit`
   - "quota exceeded" / "insufficient credits" patterns -> `quota_exceeded`
   - "service unavailable" / "overloaded" patterns -> `service_unavailable`
   - "api key" + "missing" / "not found" patterns -> `missing_api_key`
   - "model not found" patterns -> `model_not_found`
   - "content filter" patterns -> `content_filter`
   - "context length" patterns -> `context_length`
   - Anything else -> `unknown`
3. Verify retryability rules:
   - `content_filter` and `context_length` are NOT retryable (same content will fail on any model).
   - `missing_api_key` and `model_not_found` ARE retryable (different model may work).
   - Rate limit, quota, and service unavailable ARE retryable.

**Expected Output:**
- Classification uses cascading checks: status code first, then message pattern matching.
- Built-in patterns include 15+ regexes for retryable errors (including status codes 429, 503, 529).
- User-provided patterns are also checked (with ReDoS protection: nested quantifiers and backtracking-risk patterns are skipped).

**Negative Test:**
- Provide an error with no message and no status code.
- Expected: Classified as `unknown`. Not retryable by default.

**Pass/Fail:**
- PASS: All error types classified correctly. Retryability matches expected rules. ReDoS protection active for user patterns.
- FAIL: Misclassification, wrong retryability, or ReDoS vulnerability.

---

### State Machine Transitions

**Prerequisites:**
- Plugin installed with fallback chain configured (primary + fallback models)

**Steps:**
1. Simulate a primary model failure using `oc_mock_fallback`.
2. Observe the fallback state machine transitions:
   - `createFallbackState(model)`: Creates initial state on primary model (fallbackIndex: -1, attemptCount: 0).
   - `planFallback(state, chain, maxAttempts, cooldownMs)`: Finds next available model not in cooldown.
   - `commitFallback(state, plan)`: Applies the planned transition, returns new state (never mutates input).
3. Verify the transition: primary -> fallback model.
4. Simulate a second failure on the fallback model.
5. Observe: State machine attempts next model in chain or reports exhaustion.

**Expected Output:**
- State machine is purely functional (plan/commit pattern, never mutates state).
- `planFallback` skips the current model and models in cooldown.
- `commitFallback` returns `{ committed: true, state: newState }` on success.
- `commitFallback` returns `{ committed: false }` if the plan is stale (current model changed).
- Max attempts enforcement: returns failure reason when `attemptCount >= maxAttempts`.
- Chain exhaustion: returns "All fallback models exhausted or in cooldown" when no models are available.

**Negative Test (All Models Exhausted):**
- Configure a fallback chain with 2 models. Fail both (set both in cooldown).
- Expected: `planFallback` returns `{ success: false, reason: "All fallback models exhausted or in cooldown" }`.

**Negative Test (Invalid Fallback Config):**
- Configure an empty fallback chain.
- Expected: `planFallback` immediately returns failure (no models to try).

**Pass/Fail:**
- PASS: State transitions are correct (primary -> fallback -> exhausted). Plan/commit pattern ensures immutability. Cooldown and max attempts enforced.
- FAIL: State mutated in place, cooldown not respected, or max attempts not enforced.

---

### Message Replay

**Prerequisites:**
- Plugin installed

**Steps:**
1. Create a message with multiple part types: text, image, tool_call, tool_result.
2. Apply `replayWithDegradation` with attempt 0.
3. Observe: Tier 1 -- all parts included (full fidelity).
4. Apply with attempt 1.
5. Observe: Tier 2 -- text + images only (tool_call and tool_result filtered out).
6. Apply with attempt 2.
7. Observe: Tier 3 -- text only (maximum compatibility).

**Expected Output:**
- `filterPartsByTier(parts, 1)`: Returns all parts unchanged.
- `filterPartsByTier(parts, 2)`: Filters out `tool_call` and `tool_result` parts.
- `filterPartsByTier(parts, 3)`: Returns only `text` parts.
- Tier selection based on attempt: 0 -> Tier 1, 1 -> Tier 2, 2+ -> Tier 3.

**Negative Test:**
- Apply degradation to an empty parts array.
- Expected: Returns `{ parts: [], tier: N }`. No crash.

**Pass/Fail:**
- PASS: 3-tier content degradation works correctly. Each tier filters the correct part types. Empty arrays handled gracefully.
- FAIL: Wrong parts filtered, tier mapping incorrect, or crash on empty input.

---

### Cooldown Recovery

**Prerequisites:**
- Plugin installed with fallback chain configured
- A model that was previously failed (in cooldown)

**Steps:**
1. Trigger a fallback transition (primary fails, switches to fallback model).
2. Wait for the cooldown period to elapse (or simulate time advancement).
3. Call `recoverToOriginal(state, cooldownMs)`.
4. Observe: Returns new state with `currentModel` set back to `originalModel` and `fallbackIndex` reset to -1.

**Expected Output:**
- `recoverToOriginal` checks if the original model's cooldown has expired.
- If cooldown expired: returns new state with original model restored.
- If cooldown still active: returns `null` (recovery not yet possible).
- If already on original model: returns `null` (no recovery needed).

**Negative Test:**
- Call `recoverToOriginal` when already on the original model.
- Expected: Returns `null`. No state change.
- Call `recoverToOriginal` when the original model is still in cooldown.
- Expected: Returns `null`. Model remains on fallback.

**Pass/Fail:**
- PASS: Recovery returns to original model after cooldown. Returns null when already on original or still in cooldown.
- FAIL: Recovery happens during cooldown, state not properly reset, or crash on edge cases.

---

## Doctor and Health Checks

The `oc_doctor` tool runs 7 independent health checks and reports pass/fail status for each. Health checks are implemented in `src/health/checks.ts` and aggregated by `src/health/runner.ts`. The anti-slop comment hook detects AI-generated comment bloat in code files.

### config-validity

**What it checks:** Plugin config file exists at `~/.config/opencode/opencode-autopilot.json` and passes Zod schema validation.

**Steps:**
1. Invoke `oc_doctor`.
2. Locate the `config-validity` check in the `checks` array.

**Expected Output:**
- Pass: `Config v{N} loaded and valid` (where N is the config schema version).
- Fail: `Plugin config file not found` or `Config validation failed: {error}`.

**Negative Test:**
- Delete `~/.config/opencode/opencode-autopilot.json`.
- Run `oc_doctor`.
- Expected: `config-validity` reports "fail" with message "Plugin config file not found".
- Corrupt the JSON file (e.g., add invalid characters).
- Expected: `config-validity` reports "fail" with message "Config validation failed: ...".

**Pass/Fail:**
- PASS: Valid config reports pass with version. Missing config reports fail. Corrupt config reports fail with specific error.
- FAIL: Missing config not detected, or corrupt config accepted as valid.

---

### agent-injection

**What it checks:** All expected agents (standard + pipeline) are present in the OpenCode config agent map.

**Steps:**
1. Invoke `oc_doctor`.
2. Locate the `agent-injection` check.

**Expected Output:**
- Pass: `All {N} agents injected` (includes standard agents: researcher, metaprompter, documenter, pr-reviewer, autopilot; plus pipeline agents from AGENT_NAMES).
- Fail: `{N} agent(s) missing: {list}`.

**Negative Test:**
- Remove one agent from the config hook registration.
- Expected: `agent-injection` reports "fail" listing the missing agent name.
- Provide no OpenCode config (null).
- Expected: "No OpenCode config or agent map available".

**Pass/Fail:**
- PASS: All agents detected when properly registered. Missing agents listed by name.
- FAIL: Missing agents not detected, or false positives reported.

---

### native-agent-suppression

**What it checks:** OpenCode native `plan` and `build` entries are suppressed so they do
not appear as primary Tab agents.

Suppression contract for both keys in `config.agent`:
- `disable: true`
- `mode: "subagent"`
- `hidden: true`

**Steps:**
1. Invoke `oc_doctor`.
2. Locate the `native-agent-suppression` check.

**Expected Output:**
- Pass: `Native plan/build agents are suppressed`.
- Fail: `{N} native suppression issue(s) found` with details (e.g., `plan: mode must be subagent`).

**Negative Test:**
- Simulate conflicting config that sets `plan` or `build` to primary mode.
- Run `oc_doctor`.
- Expected: `native-agent-suppression` reports fail with actionable fix suggestion.

**Pass/Fail:**
- PASS: Both native entries satisfy suppression contract.
- FAIL: Any missing key or incorrect suppression field is reported.

---

### asset-directories

**What it checks:** Source asset directory (bundled `assets/`) and target directory (`~/.config/opencode/`) exist and are accessible.

**Steps:**
1. Invoke `oc_doctor`.
2. Locate the `asset-directories` check.

**Expected Output:**
- Pass: `Asset directories exist: source={path}, target={path}`.
- Fail: `Asset source directory missing: {path}` or `Asset target directory inaccessible ({code}): {path}`.

**Negative Test:**
- Delete `~/.config/opencode/` directory.
- Expected: `asset-directories` reports "fail" with "missing" for the target directory.
- Make the directory read-only (no execute permission).
- Expected: Reports "inaccessible (EACCES)".

**Pass/Fail:**
- PASS: Both directories verified when present. Missing/inaccessible directories produce specific error messages with path and error code.
- FAIL: Missing directories not detected, or error codes not reported.

---

### skill-loading

**What it checks:** Skills load from the skills directory, project stacks are detected, and matching skills are filtered.

**Steps:**
1. Invoke `oc_doctor` from a project directory.
2. Locate the `skill-loading` check.

**Expected Output:**
- Pass: `Detected stacks: [{tags}], {matched}/{total} skills matched`.
- The `details` field contains the list of matched skill names.
- Fail: `Skill check failed: {error}`.

**Negative Test:**
- Delete the entire `~/.config/opencode/skills/` directory.
- Expected: `skill-loading` reports "pass" with 0/0 skills matched (loadAllSkills returns empty map on ENOENT).

**Pass/Fail:**
- PASS: Reports detected stacks and matched skill count. Details list skill names. Missing skills directory handled gracefully.
- FAIL: Incorrect stack detection, wrong count, or crash on missing directory.

---

### memory-db

**What it checks:** Memory database exists, is readable, and contains a valid observation count.

**Steps:**
1. Invoke `oc_doctor`.
2. Locate the `memory-db` check.

**Expected Output:**
- Pass (DB exists): `Memory DB exists ({N} observation(s), {size}KB)`.
- Pass (no DB yet): `Memory DB not yet initialized -- will be created on first memory capture`.
- Fail: `Memory DB inaccessible: {error}` or `Memory DB exists but is empty (0 bytes)` or `Memory DB read error: {error}`.

**Negative Test:**
- Delete the memory DB file.
- Expected: Reports pass (DB will be created on first use).
- Create a 0-byte file at the DB path.
- Expected: Reports "fail" with "Memory DB exists but is empty (0 bytes)".
- Corrupt the DB file (write random bytes).
- Expected: Reports "fail" with a read error message.

**Pass/Fail:**
- PASS: Valid DB reports observation count and size. Missing DB reports pending initialization. Empty and corrupt DBs report specific failures.
- FAIL: Missing DB causes crash, or corrupt DB not detected.

---

### command-accessibility

**What it checks:** All 11 expected command files exist in `~/.config/opencode/commands/` and have valid YAML frontmatter with non-empty descriptions.

**Steps:**
1. Invoke `oc_doctor`.
2. Locate the `command-accessibility` check.

**Expected Output:**
- Pass: `All 11 commands accessible`.
- Fail: `{N} command issue(s) found` with details listing each issue (e.g., "missing: oc-tdd", "oc-brainstorm: no frontmatter").
- Expected commands: oc-tdd, oc-review-pr, oc-brainstorm, oc-write-plan, oc-stocktake, oc-update-docs, oc-new-agent, oc-new-skill, oc-new-command, oc-quick, oc-review-agents.

**Negative Test:**
- Delete one command file (e.g., `oc-tdd.md`).
- Expected: Reports "1 command issue(s) found" with detail "missing: oc-tdd".
- Create a command file with invalid YAML frontmatter.
- Expected: Reports issue with "invalid YAML frontmatter".
- Create a command file with empty description in frontmatter.
- Expected: Reports issue with "missing or empty description".

**Pass/Fail:**
- PASS: All 11 commands verified when present. Missing and invalid commands listed with specific issues.
- FAIL: Missing commands not detected, or invalid frontmatter accepted.

---

### Full Doctor Run

**Prerequisites:**
- Plugin installed and loaded
- OpenCode session open

**Steps:**
1. Invoke `oc_doctor` with no arguments.
2. Observe the full JSON response.

**Expected Output:**
- JSON with `action: "doctor"`, `checks` array (7 health entries + 1 hook check), `allPassed` boolean, `displayText`, and `duration` in milliseconds.
- Each check runs independently (Promise.allSettled) -- a failure in one does not skip others.
- `allPassed` is true only when every check's status is "pass".
- `displayText` shows human-readable `[OK]` or `[FAIL]` per check with fix suggestions for failures.
- Duration reports total execution time in milliseconds.

**Negative Test:**
- Corrupt multiple components (delete config file, remove a command, corrupt memory DB).
- Run `oc_doctor`.
- Expected: Each affected check reports "fail" independently. Working components still report "pass". `allPassed` is false.

**Pass/Fail:**
- PASS: All 8 checks run independently (7 health checks + 1 informational hook-registration). Failed checks include actionable messages. `allPassed` correctly reflects aggregate status. Duration is reasonable (<5 seconds).
- FAIL: Checks not independent (one failure blocks others), missing fix suggestions, or incorrect aggregate status.

---

### Anti-Slop Comment Hook

**Prerequisites:**
- Plugin installed with the anti-slop `tool.execute.after` hook registered
- An OpenCode session with file-writing tools available

**Steps:**
1. Use a file-writing tool (write_file, edit_file) to write a code file containing obvious AI-generated comments.
2. Example slop comments to test:
   - `// This is a comprehensive and robust implementation`
   - `// Handle edge cases gracefully`
   - `// Ensure proper error handling`
3. Observe the toast notification.

**Expected Output:**
- The `createAntiSlopHandler` fires after file-writing tools (write_file, edit_file, write, edit, create_file).
- It reads the written file (not the tool output), scans for slop patterns using comment-aware regex.
- Only comments are scanned (not code) -- uses `EXT_COMMENT_STYLE` mapping and `COMMENT_PATTERNS` regex per language.
- Findings show line numbers and detected text (up to 5 in the preview).
- Toast notification: "Anti-Slop Warning: {N} AI comment(s) detected: {preview}".

**Negative Test:**
- Write a code file with no comments or only legitimate comments.
- Expected: No toast notification. Handler returns silently.
- Write a non-code file (e.g., `.md`, `.json`).
- Expected: `isCodeFile` returns false. Handler skips. No toast.
- Write a file with a relative path.
- Expected: Handler skips (requires absolute path within cwd for safety).

**Pass/Fail:**
- PASS: Slop comments detected in code files. Toast shows line numbers and text. Non-code files and clean code files are skipped. Path validation prevents traversal.
- FAIL: False positives on code tokens (not comments), or slop in comments not detected, or non-code files scanned.

---

## Observability

The observability system captures session events, tracks token usage, persists logs as JSON files, and provides tools for inspection. Implemented in `src/observability/`.

### Event Capture

**Prerequisites:**
- Plugin installed with observability hooks registered
- An active OpenCode session

**Steps:**
1. Open an OpenCode session. Observe the `session.created` event initializes the session in the event store.
2. Invoke a tool (e.g., `oc_doctor`). Observe the `tool.execute.before` and `tool.execute.after` hooks fire.
3. Send a message that generates a response. Observe the `message.updated` event accumulates tokens.
4. If running a pipeline, observe `decision` and `phase_transition` events.

**Expected Output:**
- `SessionEventStore` accumulates events in memory per session ID.
- Event types captured: `session_start`, `session_end`, `tool_complete`, `decision`, `phase_transition`, `error`, `fallback`, `model_switch`, `context_warning`.
- Tool execution metrics tracked: invocation count, total duration, successes, failures per tool name.
- Token tracking: input, output, reasoning, cache read/write, and cost accumulated from `message.updated`.
- All handlers are pure observers -- they never modify session state or output (Pitfall 5).

**Negative Test:**
- Attempt to append an event to a non-initialized session ID.
- Expected: `appendEvent` silently returns (session not in store). No crash.

**Pass/Fail:**
- PASS: Events accumulate in memory. Tool metrics tracked per tool. Token data accumulated from messages. Non-initialized sessions handled gracefully.
- FAIL: Events lost, metrics incorrect, or non-initialized sessions cause errors.

---

### Session Stats

**Prerequisites:**
- At least one session log exists in `~/.config/opencode/logs/`

**Steps:**
1. Invoke `oc_session_stats` with no arguments (uses latest session).
2. Observe the JSON response.

**Expected Output:**
- JSON with `action: "session_stats"`, `sessionId`, `duration` (ms), `eventCount`, `decisionCount`, `errorSummary` (object with error type counts), `phaseBreakdown` (array with per-phase stats), `displayText`.
- Phase breakdown entries have `phase`, `decisionCount`, `errorCount`.
- Display text contains a human-readable summary table.

**Negative Test:**
- Invoke `oc_session_stats` with `sessionID: "nonexistent-session-id"`.
- Expected: Returns `action: "error"` with message `Session "nonexistent-session-id" not found.`

**Pass/Fail:**
- PASS: Returns accurate session statistics with event counts, decision counts, error summary, and phase breakdown. Invalid session ID returns clear error.
- FAIL: Wrong counts, missing phase breakdown, or crash on missing session.

---

### Log Persistence

**Prerequisites:**
- Plugin installed with observability active

**Steps:**
1. Open an OpenCode session and perform some actions.
2. End the session (triggers `session.deleted` event).
3. Check `~/.config/opencode/logs/` for a new JSON file named `{sessionId}.json`.
4. Open the log file and verify its structure.

**Expected Output:**
- Session logs written as JSON files using atomic write pattern (temp file + rename).
- Log file schema version: 1.
- Log file contains: `schemaVersion`, `sessionId`, `startedAt`, `endedAt`, `events` (array), `decisions` (extracted from decision events), `errorSummary` (counts by error type).
- Logs written on `session.idle` (intermediate snapshot, fire-and-forget) and `session.deleted` (final flush).
- Log directory: `~/.config/opencode/logs/` (user-scoped, not project-scoped).
- Validated through `sessionLogSchema` (Zod) before writing.

**Negative Test:**
- Make the logs directory read-only.
- Expected: Write fails silently (fire-and-forget pattern). Session continues normally. Error logged to console.

**Pass/Fail:**
- PASS: JSON log files written atomically. Schema includes all required fields. Intermediate snapshots on idle. Final flush on session end. Write failures are non-fatal.
- FAIL: Logs not written, non-atomic writes (corruption risk), or write failure crashes session.

---

### Log Retrieval

**Prerequisites:**
- At least one session log exists

**Steps:**
1. Invoke `oc_logs` with `mode: "list"`.
2. Observe: Returns a table of all session logs with session ID, start time, event count, decisions, and errors.
3. Pick a session ID from the list.
4. Invoke `oc_logs` with `mode: "detail"` and the chosen `sessionID`.
5. Observe: Returns the full session log with a markdown summary.
6. Invoke `oc_logs` with `mode: "search"`, `eventType: "decision"`.
7. Observe: Returns filtered events matching the type.

**Expected Output:**
- List mode: `action: "logs_list"`, `sessions` array, `displayText` with table format.
- Detail mode: `action: "logs_detail"`, `sessionLog` object, `summary` markdown, `displayText`.
- Search mode: `action: "logs_search"`, `events` array, `displayText`.
- Search supports filtering by `eventType`, `after` (ISO timestamp lower bound), `before` (ISO timestamp upper bound).

**Negative Test:**
- Invoke `oc_logs` with `mode: "detail"` and `sessionID: "does-not-exist"`.
- Expected: Returns `action: "error"` with message `Session "does-not-exist" not found.`

**Pass/Fail:**
- PASS: All three modes return structured JSON with displayText. Search filters work for type and time range. Missing sessions return clear errors.
- FAIL: Any mode crashes, search filters not applied, or missing session produces unhandled exception.

---

### Log Retention

**Prerequisites:**
- Multiple session logs exist, some older than 30 days

**Steps:**
1. Verify some log files in `~/.config/opencode/logs/` have modification times older than 30 days (or create test files with old timestamps).
2. Trigger log pruning (runs non-blocking on plugin load).
3. Verify old log files are removed.

**Expected Output:**
- `pruneOldLogs` checks file modification time against the retention threshold (default: 30 days).
- Files older than the threshold are deleted via `unlink`.
- Files newer than the threshold are preserved.
- Handles missing logs directory gracefully (ENOENT returns `{ pruned: 0 }`).
- Race condition safety: files that disappear between `readdir` and `stat` are silently skipped.

**Negative Test:**
- Run pruning on an empty logs directory.
- Expected: Returns `{ pruned: 0 }`. No errors.
- Run pruning when the logs directory does not exist.
- Expected: Returns `{ pruned: 0 }`. No crash.

**Pass/Fail:**
- PASS: Logs older than 30 days are pruned. Recent logs preserved. Missing/empty directories handled gracefully. No race condition errors.
- FAIL: Old logs not pruned, recent logs deleted, or missing directory causes crash.

---

### Context Monitor

**Prerequisites:**
- Plugin installed with observability active
- An active session with message exchanges

**Steps:**
1. Open a session. The context monitor initializes with a default context limit (200,000 tokens).
2. Exchange messages until context utilization approaches 80%.
3. Observe: A one-time toast warning fires: "Context Warning: Context at {N}% -- consider compacting".
4. Continue messaging past 80%.
5. Observe: No additional toast (one-time per session per D-36).

**Expected Output:**
- `ContextMonitor` tracks per-session context utilization.
- Warning threshold: 80% of context limit (CONTEXT_WARNING_THRESHOLD = 0.8).
- Warning fires exactly once per session (tracked by `warned` flag).
- `processMessage(sessionID, inputTokens)` returns `{ utilization, shouldWarn }`.
- Zero context limit returns utilization 0 (no divide-by-zero).
- Unknown session IDs return `{ utilization: 0, shouldWarn: false }`.

**Negative Test:**
- Process a message for an unknown session ID (never initialized).
- Expected: Returns `{ utilization: 0, shouldWarn: false }`. No crash.
- Set context limit to 0.
- Expected: Returns `{ utilization: 0, shouldWarn: false }`. No division by zero.

**Pass/Fail:**
- PASS: Warning fires once at 80% utilization. Subsequent messages do not re-warn. Zero/unknown sessions handled gracefully.
- FAIL: Warning fires multiple times, wrong threshold, or division by zero on zero limit.

---

## Orchestrator Pipeline E2E

The orchestrator pipeline drives the full SDLC: RECON, CHALLENGE, ARCHITECT, EXPLORE, PLAN, BUILD, SHIP, RETROSPECTIVE. It is implemented in `src/orchestrator/handlers/` with entry point `src/tools/orchestrate.ts`.

### Full Pipeline Run

**Prerequisites:**
- OpenCode session open in a project directory
- No existing pipeline state file (`.opencode-autopilot/pipeline-state.json`)
- Plugin installed with all agents registered

**Steps:**
1. Invoke `oc_orchestrate` with `idea: "Add a hello-world utility function"`.
2. Receive a dispatch instruction for the RECON phase (research agent).
3. Execute the dispatched agent and collect its output.
4. Invoke `oc_orchestrate` with `result: "<agent output>"`.
5. Repeat the dispatch/result cycle through all phases:
   - **RECON:** Dispatches researcher agent. Produces research report with prior art, technology options, and constraints.
   - **CHALLENGE:** Dispatches challenger agent. Proposes enhancements, identifies risks, and refines the brief.
   - **ARCHITECT:** Dispatches architect agent. Produces system design with file structure, component interactions, and trade-offs.
   - **EXPLORE (conditional):** May dispatch explorer agent if confidence is low. Investigates specific uncertainties.
   - **PLAN:** Dispatches planner agent. Produces task list with dependency waves, file paths, and verification commands.
   - **BUILD:** Dispatches builder agent. Creates commits implementing the plan tasks.
   - **SHIP:** Dispatches shipper agent. Produces changelog, updates documentation, and prepares release notes.
   - **RETROSPECTIVE:** Dispatches retrospective agent. Extracts lessons learned and captures observations.
6. Receive `action: "complete"` with pipeline summary.

**Expected Output:**
- Pipeline state persisted at `.opencode-autopilot/pipeline-state.json` after each phase transition.
- Each phase transitions through: PENDING -> IN_PROGRESS -> COMPLETED.
- Artifacts produced for each phase are stored in the state.
- Decision log captures agent decisions with rationale at each phase.
- Confidence ledger tracks confidence levels across areas.
- Final status: "COMPLETED" with all 8 phases marked as completed.

**Negative Test:**
- Invoke `oc_orchestrate` with no arguments and no existing state.
- Expected: Returns `action: "error"` with message `No active run. Provide an idea to start.`
- Invoke `oc_orchestrate` with an idea while a run is already in progress.
- Expected: Resumes the existing run (does not start a new one).

**Pass/Fail:**
- PASS: Pipeline completes all 8 phases. State file shows "COMPLETED". Artifacts exist for each phase. Decision log captures rationale. Dispatch/result cycle works correctly.
- FAIL: Phases skipped, state not persisted, artifacts missing, or pipeline hangs.

---

### Quick Smoke Test Checklist

A rapid 10-item checklist for validating core plugin functionality before a release. Each item should take less than 1 minute to verify.

- [ ] **Plugin loads:** OpenCode starts without errors when the plugin is configured in `opencode.json`.
- [ ] **Tools register:** Invoke `oc_doctor` -- should return JSON with `action: "doctor"` and 8 checks (7 health + 1 hook-registration).
- [ ] **Commands accessible:** Type `/oc-` in the OpenCode TUI -- at least 11 commands should appear in autocomplete.
- [ ] **Agents visible:** Press Tab to cycle primary agents -- autopilot, coder, debugger, planner, researcher, reviewer should be available. Native `plan` and `build` should NOT appear. Type `@` and verify metaprompter, documenter, pr-reviewer are @-callable.
- [ ] **Skills inject:** Run `oc_doctor` in a TypeScript project -- `skill-loading` check should report detected stacks and matched skills.
- [ ] **Memory captures:** Run `oc_memory_status` -- should return `stats` object (or null if DB not yet created). After a session with decisions, stats should show non-zero observation counts.
- [ ] **Doctor passes:** Run `oc_doctor` -- all 8 checks should report "pass" with `allPassed: true`.
- [ ] **Logs write:** End a session, then check `~/.config/opencode/logs/` for a new JSON log file.
- [ ] **Config saves:** Run `oc_configure` start/assign/commit cycle -- config should persist to `~/.config/opencode/opencode-autopilot.json`.
- [ ] **Stocktake counts match:** Run `oc_stocktake` -- summary counts should match: 18 skills, 11 commands, 8+ agents (standard + pipeline).
