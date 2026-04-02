---
name: strategic-compaction
description: Context window management through strategic summarization -- keep working memory lean without losing critical information
stacks: []
requires: []
---

# Strategic Compaction

Context window management through strategic summarization. When your working context grows large, compaction keeps you productive by preserving what matters and discarding what does not. This skill teaches when to compact, what to keep, and how to rebuild context from a summary.

## When to Use

- Context window is filling up (more than 60% used)
- Working on a long task spanning many files
- Need to switch subtasks without losing prior context
- Session is slowing down or responses are becoming less detailed
- You are about to start a new phase of work that does not need the details of the previous phase
- After completing a major subtask and before starting the next

## The Compaction Process

Compaction is a four-step process. Follow each step in order.

### Step 1: Identify What to Keep

These items are essential and must survive compaction:

- **Current task requirements** -- the active goal and acceptance criteria
- **Key decisions made so far** -- and the rationale behind each one (the WHY is more important than the WHAT)
- **File paths and function signatures** -- for files currently being modified or about to be modified
- **Error messages and test failures** -- if you are actively investigating or debugging
- **Constraints and invariants** -- rules that must not be violated (security requirements, API contracts, performance budgets)
- **Dependency relationships** -- what depends on what, what must be done in order

### Step 2: Identify What to Compact

These items can be summarized or discarded:

- **File contents already read and understood** -- keep only the path plus the key insight (e.g., "src/auth.ts: JWT validation using jose library, exports verifyToken()")
- **Exploration dead ends** -- reduce to one line: "Tried approach X, did not work because Y"
- **Verbose tool output** -- keep the conclusion, discard the raw output (e.g., "Tests pass: 47/47" instead of the full test runner output)
- **Background context not needed for the current subtask** -- prior phase decisions that are not relevant to what you are doing right now
- **Completed work details** -- reduce to "Task N done: implemented feature X in file Y" with the commit hash

### Step 3: Create a Summary

Structure your summary using this template:

```
## Working Context Summary

**Goal:** [one sentence describing the active objective]

**Key Decisions:**
- [Decision 1]: [rationale]
- [Decision 2]: [rationale]

**Current State:**
- Done: [what has been completed]
- In Progress: [what is currently being worked on]
- Next: [what comes after the current task]

**Active Files:**
- [path]: [what you are doing with this file]
- [path]: [key insight about this file]

**Constraints:**
- [constraint 1]
- [constraint 2]

**Errors/Blockers:**
- [any active issues being investigated]
```

Target 500-1000 tokens for the summary. This is your restore point -- it should contain everything needed to resume work without re-reading files.

### Step 4: Apply Compaction

When starting a new session or after context reset:

1. Load the summary first -- this is your map
2. Read only the files actively being modified (the "Active Files" list)
3. Re-read constraints and interfaces only if you need to verify a specific detail
4. Do NOT re-read files that were already summarized unless you need to edit them

## What to NEVER Compact

Some information is too dangerous to summarize. Always keep these in full:

- **Active error messages being debugged** -- the exact error text matters for diagnosis
- **Type definitions and interfaces being implemented against** -- approximate types lead to type errors
- **Test expectations being satisfied** -- the exact assertion values matter
- **Security constraints and validation rules** -- approximate security is no security
- **API contracts with external systems** -- exact field names, types, and required headers
- **Migration scripts in progress** -- partial migration state is dangerous to approximate

## Compaction Strategies by Scenario

### Scenario: Multi-File Refactoring

You have read 15 files and identified the refactoring pattern. Compact by keeping:
- The list of files to modify (paths only)
- The transformation pattern (e.g., "replace direct DB calls with repository pattern")
- Files already transformed (path + done status)
- The next file to transform

### Scenario: Debugging a Complex Issue

You have explored multiple hypotheses. Compact by keeping:
- The symptom (exact error message)
- Hypotheses tested and their results (one line each)
- Current hypothesis being investigated
- Files relevant to the current hypothesis

### Scenario: Implementing a Feature Across Layers

You are building a feature that touches API, service, and data layers. Compact by keeping:
- The feature requirements
- Interface contracts between layers (function signatures, types)
- Which layers are done, which are in progress
- Test status for completed layers

## Anti-Pattern Catalog

### Anti-Pattern: Compacting Too Early

**What it looks like:** Summarizing after reading just 2-3 files, before you have a full picture of the problem space.

**Why it is harmful:** You do not yet know what is important. Early summaries miss critical context that you discover later.

**Instead:** Compact when context is more than 60% full, or when you are transitioning between major subtasks. Not before.

### Anti-Pattern: Losing Key Decisions

**What it looks like:** Summarizing away the reasoning behind a decision, keeping only the outcome.

**Why it is harmful:** Without the WHY, you (or a future session) may revisit and reverse a well-reasoned decision, wasting time.

**Instead:** Always keep decision rationale. "Chose JWT over session cookies because the API is stateless and serves mobile clients" -- not just "Using JWT."

### Anti-Pattern: Over-Compacting

**What it looks like:** Reducing context to a single paragraph that says "working on auth feature."

**Why it is harmful:** Too little context means you have to re-read everything, defeating the purpose of compaction.

**Instead:** Keep file paths, function signatures, decision rationale, and current task state. The summary should be 500-1000 tokens, not 50.

### Anti-Pattern: Never Compacting

**What it looks like:** Accumulating context until the window is full and responses degrade.

**Why it is harmful:** The last 20% of the context window produces worse results. By the time you notice degradation, you have already lost quality.

**Instead:** Proactively compact when you pass 60% usage, or at natural transition points between subtasks.

### Anti-Pattern: Compacting Active Work

**What it looks like:** Summarizing files you are still actively editing, losing the detailed state.

**Why it is harmful:** You will need to re-read those files immediately, wasting the effort of compaction.

**Instead:** Only compact information from COMPLETED subtasks. Keep active work in full detail.

## Failure Modes

### Summary Is Too Vague

**Symptom:** After loading the summary, you do not know which file to open or what to do next.

**Fix:** Add specific file paths, function names, and the exact next action. A good summary answers: "What file do I open first, and what do I do in it?"

### Lost Critical Context

**Symptom:** You make a mistake that contradicts a decision or constraint from the compacted context.

**Fix:** The information is on disk -- re-read the relevant files. Then update your summary to include the missing constraint. This is recoverable, not catastrophic.

### Summary Is Too Long

**Symptom:** The summary itself is 2000+ tokens and does not fit well as a context primer.

**Fix:** Focus on what is needed for the NEXT task, not everything done so far. Completed work can be reduced to one line per task. Only the current and next tasks need detail.

### Rebuilt Context Drifts from Original

**Symptom:** After loading a summary and re-reading files, you reach a different understanding than before compaction.

**Fix:** Include concrete artifacts in your summary (exact function signatures, test names, error messages) rather than prose descriptions. Concrete details resist drift; abstract descriptions invite reinterpretation.

## Compaction Checklist

Use this checklist before and after compaction to ensure quality:

### Before Compacting

- [ ] Context is more than 60% full OR you are transitioning between major subtasks
- [ ] You have completed a logical unit of work (not mid-task)
- [ ] You are not actively debugging an error (keep full error context)
- [ ] You have identified the next task clearly

### Writing the Summary

- [ ] Goal is stated in one sentence
- [ ] Every key decision includes its rationale (the WHY)
- [ ] Active file paths are listed with their purpose
- [ ] Current state is explicit (done, in progress, next)
- [ ] Constraints and invariants are preserved verbatim
- [ ] Summary is between 500 and 1000 tokens

### After Loading a Summary

- [ ] You know which file to open first
- [ ] You know what action to take next
- [ ] You have not re-read files unnecessarily
- [ ] If anything is unclear, you re-read the specific source file (not everything)

## Anti-Pattern Catalog

### Premature Compaction
**Pattern:** Compacting before completing a logical task unit.
**Why it fails:** The summary is written before the task is done, so in-flight state (partial edits, uncommitted reasoning, temporary variables) is lost. The next session starts with an incomplete picture and often re-does work.
**Fix:** Always finish and commit the current task before compacting. The summary should describe completed state, not in-progress state.

### Over-Compaction
**Pattern:** Discarding intermediate results, debug findings, or alternative approaches during compaction.
**Why it fails:** Future decisions may depend on WHY something was done a certain way. Without rationale, the next session may reverse correct decisions or repeat failed approaches.
**Fix:** Include key decisions with rationale in the summary. Preserve the "why" even when discarding the "how."

### Compacting Mid-Debug
**Pattern:** Compacting while actively investigating a bug, before root cause is identified.
**Why it fails:** Error context (stack traces, reproduction steps, hypotheses tested) is extremely expensive to reconstruct. Compaction destroys the diagnostic trail.
**Fix:** Complete the debug cycle (reproduce, isolate, fix, verify) before compacting. If you must compact, preserve the full error message, reproduction steps, and hypotheses tested.

### Context Hoarding
**Pattern:** Never compacting, letting context fill to 100% before the system forces a lossy auto-compaction.
**Why it fails:** Auto-compaction is mechanical — it cannot prioritize project-specific context. Manual compaction at 60-70% lets you choose what survives.
**Fix:** Proactively compact at natural transition points (task complete, phase shift, subtask boundary).
