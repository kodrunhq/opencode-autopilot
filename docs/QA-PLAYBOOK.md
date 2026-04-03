# QA Playbook -- OpenCode Autopilot Plugin

**Version:** 1.0
**Date:** 2026-04-03
**Coverage:** Commands (11), Agents (8), Tools (20)

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
- Type `@researcher` in the chat. It should appear in @-mention autocomplete (mode: `subagent`).
- It should NOT appear in Tab cycle (subagent mode only).

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

### Diagnostic Tools

#### oc_doctor

**Purpose:** Run plugin health diagnostics. Reports pass/fail status for config, agents, assets, skills, memory, commands, and hooks.

**Input Parameters:**
- None (no arguments)

**Prerequisites:**
- Plugin installed and loaded

**Steps:**
1. Invoke `oc_doctor` (no arguments needed).
2. Observe the JSON response.

**Expected Output:**
- JSON with `action: "doctor"`, `checks` array, `allPassed` boolean, `displayText`, and `duration` in milliseconds.
- Checks include: `config-validity`, `agent-injection`, `asset-directories`, `skill-loading`, `memory-db`, `command-accessibility`, `hook-registration`.
- Each check has `name`, `status` ("pass" or "fail"), `message`, and `fixSuggestion` (null if passing).
- `displayText` shows human-readable `[OK]` or `[FAIL]` per check with fix suggestions.

**Negative Test:**
- Delete or corrupt `~/.config/opencode/opencode-autopilot.json` and run `oc_doctor`.
- Expected: The `config-validity` check reports "fail" with a fix suggestion: "Run `bunx @kodrunhq/opencode-autopilot configure` to reconfigure."

**Pass/Fail:**
- PASS: Returns structured JSON with all 7 checks. Failed checks include actionable fix suggestions. `allPassed` is true only when every check passes.
- FAIL: Missing checks, no fix suggestions on failures, or tool crashes.

---

#### oc_session_stats

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

#### oc_logs

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

#### oc_memory_status

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

### Configuration Tools

#### oc_configure

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

#### oc_mock_fallback

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

### Asset Tools

#### oc_stocktake

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

#### oc_create_agent

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

#### oc_create_skill

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

#### oc_create_command

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

#### oc_update_docs

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

#### oc_quick

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

### Pipeline Tools

#### oc_orchestrate

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

#### oc_phase

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

#### oc_state

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

#### oc_plan

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

#### oc_confidence

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

#### oc_pipeline_report

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

#### oc_forensics

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

### Review Tools

#### oc_review

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
