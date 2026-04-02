---
name: git-worktrees
description: Git worktrees for isolated parallel development — work on multiple branches simultaneously without stashing
stacks: []
requires: []
---

# Git Worktrees

Git worktrees let you check out multiple branches simultaneously in separate directories, all sharing the same repository. Instead of stashing, switching branches, and losing context, you create isolated workspaces where each branch has its own working directory.

## When to Use

- **Working on multiple features simultaneously** — keep each feature in its own directory with its own running dev server, tests, and editor window
- **Need to switch context without stashing** — stashing is lossy (you forget what you stashed and why). Worktrees preserve full context
- **Running long-running tests on one branch while developing on another** — tests run in worktree A while you code in worktree B
- **Reviewing a PR while keeping your current work intact** — check out the PR branch in a new worktree, review and test it, then return to your main worktree
- **Comparing implementations side-by-side** — two worktrees with different approaches, run benchmarks in both
- **Hotfix on production while mid-feature** — create a worktree from the release branch, apply the fix, merge it, then return to your feature

## Git Worktrees Workflow

### Step 1: Create a Worktree

```bash
# Create a worktree for an existing branch
git worktree add ../project-feature-name feature-branch

# Create a worktree with a new branch
git worktree add -b new-feature ../project-new-feature main

# Create a worktree from a specific commit or tag
git worktree add ../project-hotfix v2.1.0
```

**What happens:** Git creates a new directory (the worktree) that shares the same `.git` repository as your main checkout. Both directories can have different branches checked out, different staged changes, and different working directory state — but they share the same commit history, remotes, and configuration.

**Key detail:** The `.git` directory in a worktree is a file (not a directory) that points back to the main repository's `.git/worktrees/` folder. This is how Git knows they are linked.

### Step 2: Naming Convention

Use a consistent naming pattern so worktrees are easy to find and identify:

```
../project-branchname        # Sibling directory pattern
../myapp-fix-auth            # Project name + branch purpose
../myapp-feature-search      # Project name + feature name
../myapp-pr-review-142       # Project name + PR number
```

**Rules:**
- Keep worktrees as siblings of the main repository (one directory up)
- Prefix with the project name to avoid confusion when working on multiple projects
- Include the purpose in the name (not just the branch name)
- Do not create worktrees inside the main repository directory

### Step 3: Working in Worktrees

Each worktree is independent:

```bash
# Switch to the worktree
cd ../project-feature-name

# Work normally — all git commands work as expected
git status
git add .
git commit -m "feat: implement search"
git push origin feature-branch

# Run project-specific tools
bun install          # Each worktree needs its own node_modules
bun test             # Tests run against this worktree's code
bun run dev          # Dev server runs independently
```

**What is shared:** Commit history, branches, remotes, tags, git config, hooks.

**What is NOT shared:** Working directory, staged changes (index), node_modules, build artifacts, .env files, editor state.

### Step 4: Synchronize Between Worktrees

Changes committed in one worktree are immediately visible to the other (they share the same repository):

```bash
# In worktree A: commit changes
git commit -m "feat: add user model"

# In worktree B: the commit exists (same repo)
git log --oneline    # Shows the commit from worktree A

# To get worktree A's changes into worktree B's branch
git merge feature-a  # Or git rebase, git cherry-pick
```

**Important:** Do not check out the same branch in two worktrees. Git prevents this because it would cause index corruption. If you need to see the same code, use `git show` or `git diff` instead.

### Step 5: Cleanup

```bash
# List all worktrees
git worktree list

# Remove a worktree (deletes the directory)
git worktree remove ../project-feature-name

# Clean up stale worktree references (if directory was manually deleted)
git worktree prune

# Force-remove a worktree with uncommitted changes
git worktree remove --force ../project-feature-name
```

**When to clean up:**
- After merging the branch (the worktree served its purpose)
- After closing the PR you were reviewing
- After the experiment failed and you want to discard it
- Regularly — run `git worktree list` weekly to find stale worktrees

## Common Patterns

### Pattern: Parallel Feature Development

**Scenario:** You are implementing feature A when a high-priority bug report comes in. You need to fix the bug immediately without losing your feature A context.

```bash
# You are in the main worktree, mid-feature-A
# Create a worktree for the hotfix
git worktree add -b hotfix/auth-bypass ../myapp-hotfix main

# Switch to the hotfix worktree
cd ../myapp-hotfix
bun install

# Fix the bug, test it, commit, push, create PR
# ...

# Return to your feature work — everything is exactly where you left it
cd ../myapp
# Continue feature A with full context preserved
```

**Benefit:** Zero context loss. No stashing, no branch switching, no re-running setup commands. Your feature A terminal, editor, and mental state are all preserved.

### Pattern: Safe Experimentation

**Scenario:** You want to try a risky refactor but are not sure it will work. You do not want to pollute your branch with experimental commits.

```bash
# Create an experimental worktree
git worktree add -b experiment/new-architecture ../myapp-experiment main

cd ../myapp-experiment
bun install

# Experiment freely — nothing affects your main worktree
# If it works: merge the branch into main
# If it fails: just remove the worktree
git worktree remove ../myapp-experiment
git branch -D experiment/new-architecture
```

**Benefit:** Zero risk. The experiment is completely isolated. If it fails, cleanup is a single command. No need to `git reset --hard`, no dangling commits, no stash entries to forget about.

### Pattern: PR Review with Full Testing

**Scenario:** You need to review a PR and want to run the tests locally, but you do not want to stop your current work.

```bash
# Fetch the PR branch
git fetch origin pull/142/head:pr-142

# Create a worktree for the review
git worktree add ../myapp-pr-142 pr-142

cd ../myapp-pr-142
bun install
bun test
bun run dev   # Test the feature manually

# Review complete — clean up
cd ../myapp
git worktree remove ../myapp-pr-142
git branch -D pr-142
```

**Benefit:** Full local testing of the PR without disrupting your work. You can run the PR's dev server alongside your own.

### Pattern: Comparison Testing

**Scenario:** You want to measure the performance impact of a change by comparing before and after.

```bash
# Worktree A: the branch with your optimization
git worktree add ../myapp-optimized optimization-branch

# Worktree B: the baseline (main branch, already your main worktree)

# Run benchmarks in both
cd ../myapp && bun run benchmark > /tmp/baseline.txt
cd ../myapp-optimized && bun run benchmark > /tmp/optimized.txt

# Compare results
diff /tmp/baseline.txt /tmp/optimized.txt
```

**Benefit:** True side-by-side comparison. No "run benchmarks, switch branches, run again, hope nothing changed" workflow.

## Anti-Pattern Catalog

### Anti-Pattern: Too Many Worktrees

**What goes wrong:** You create a worktree for every branch and end up with 10+ worktrees. You lose track of which ones are active, which are stale, and which have uncommitted work.

**Instead:** Limit yourself to 2-3 active worktrees at most. One for your main work, one for a hotfix or PR review, and optionally one for experimentation. Clean up worktrees as soon as their purpose is served.

**Check:** Run `git worktree list` regularly. If you see more than 3 entries, clean up.

### Anti-Pattern: Forgetting to Clean Up

**What goes wrong:** Stale worktrees waste disk space (each has its own node_modules, build artifacts, etc.) and create confusion when you stumble upon them weeks later.

**Instead:** Clean up immediately after the worktree's purpose is served. Set a reminder if needed. Run `git worktree list` as part of your weekly routine.

**Check:** `du -sh ../myapp-*` to see how much space worktrees are consuming.

### Anti-Pattern: Shared Dependencies

**What goes wrong:** You assume worktrees share node_modules (they do not). You run the project in a new worktree without installing dependencies and get cryptic errors.

**Instead:** Run `bun install` (or the project's dependency install command) in every new worktree. Each worktree has its own dependency tree. This is by design — different branches may have different dependencies.

### Anti-Pattern: Checking Out the Same Branch

**What goes wrong:** You try to check out the same branch in two worktrees. Git prevents this with an error. You bypass it with `--force` and corrupt the index.

**Instead:** Never check out the same branch in two worktrees. If you need to see the same code in two places, use `git show branch:file` or create a copy. If you need to move a branch to a different worktree, first remove the old worktree.

### Anti-Pattern: Worktrees Inside the Main Repo

**What goes wrong:** You create worktrees inside the main repository directory (`./worktrees/feature-name`). This confuses tools, IDEs, and sometimes Git itself.

**Instead:** Always create worktrees as siblings of the main repository (`../project-feature-name`). This keeps each worktree's directory tree clean and avoids nesting issues.

## Failure Modes

### "fatal: branch is already checked out"

**Cause:** You are trying to check out a branch that is already checked out in another worktree. Git prevents this to avoid index corruption.

**Fix:** Either: (a) use a different branch, (b) remove the other worktree first with `git worktree remove`, or (c) create a new branch from the desired commit with `git worktree add -b new-name ../path commit`.

### "fatal: path already exists"

**Cause:** The target directory for the worktree already exists (from a previous worktree that was not properly cleaned up, or a coincidental name collision).

**Fix:** Either: (a) choose a different path, (b) remove the existing directory if it is safe to do so, or (c) run `git worktree prune` if the directory is a stale worktree reference.

### Merge Conflicts When Syncing

**Cause:** Both worktrees modified the same files on different branches. When you try to merge or rebase, conflicts arise.

**Fix:** Handle like normal Git conflicts. The worktree does not change the conflict resolution process. Resolve in whichever worktree is doing the merge.

### Node Modules Out of Sync

**Cause:** You pulled new changes in a worktree but did not re-install dependencies. The lockfile changed but node_modules is stale.

**Fix:** Run `bun install` after pulling changes. If issues persist, delete node_modules and reinstall: `rm -rf node_modules && bun install`.

### IDE Not Recognizing Worktree

**Cause:** Some IDEs get confused when multiple directories share the same `.git` repository.

**Fix:** Open the worktree directory directly (not the parent). Most modern editors (VS Code, Cursor, Zed) handle worktrees correctly when you open the worktree root as the project.

## Quick Reference

```bash
# Create worktree (existing branch)
git worktree add ../project-branch branch-name

# Create worktree (new branch from base)
git worktree add -b new-branch ../project-branch base-branch

# List all worktrees
git worktree list

# Remove worktree
git worktree remove ../project-branch

# Clean stale references
git worktree prune
```

**Remember:** Install dependencies in every new worktree. Clean up when done. Limit to 2-3 active worktrees.
