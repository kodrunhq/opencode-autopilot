# Research Report: Claude Code Skills - Value vs. Bloat Analysis

## Summary

The evidence is clear: the vast majority of skills in "everything-claude-code" and similar mega-repositories (156-854+ skills) are **predominantly bloat**. Community testing, measured token overhead, and expert consensus all point to the same conclusion: 4-6 carefully selected skills outperform 150+ installed skills, and most of what gets installed is never meaningfully used. The ecosystem has devolved into an "AI coding Chrome Web Store circa 2011" with minimal quality control and no reliable usage metrics.

---

## Key Findings

### 1. Token Overhead is Real and Significant

- **30 plugins = ~3,000 tokens of permanent overhead** before any conversation starts ([BSWEN](https://docs.bswen.com/blog/2026-03-10-claude-code-plugin-performance/))
- Measured token overhead can reach **66,000+ tokens** with heavily loaded configurations ([Nate's Newsletter](https://natesnewsletter.substack.com/p/your-claude-sessions-cost-10x-what))
- Each skill adds ~100 words of metadata that's **always loaded**, regardless of whether the skill triggers
- Context bloat causes slower responses, longer "thinking" pauses, and degraded code quality ([BSWEN](https://docs.bswen.com/blog/2026-03-10-claude-code-plugin-performance/))

### 2. The 4-6 Plugin Sweet Spot

Experienced users consistently recommend:
- **4-6 active plugins maximum** for optimal performance
- The "leaner the system prompt, the better the actual coding output" ([BSWEN citing Reddit](https://docs.bswen.com/blog/2026-03-10-claude-code-plugin-performance/))
- After reducing from 30 to 5 plugins: ~2,500 tokens recovered, noticeably faster responses, better code context

### 3. Signal-to-Noise Ratio is Brutal

From the Indie Hackers testing of 200 skills:
- **~15% were genuinely useful**
- **~30% duplicated built-in functionality**
- **~55% ranged from "interesting experiment" to "wraps a system prompt in SKILL.md"** ([Indie Hackers](https://www.indiehackers.com/post/i-tested-200-claude-code-skills-so-you-don-t-have-to-here-are-the-20-that-actually-changed-how-i-work-b383a23ce3))

Community consensus from self.md:
> "there are now over 250 Claude Code skill packages floating around GitHub. most of them are someone's `.claude/` folder copy-pasted into a repo with a README that says 'my claude skills.' roughly 30 of them are actually worth installing." ([self.md](https://self.md/guides/best-claude-code-plugins/))

### 4. What Actually Gets Used (Community Consensus)

**Tier 1 - Essential/Must-Have:**
- **Anthropic's 4 document skills** (PDF, DOCX, PPTX, XLSX) - cover actual knowledge worker workflows
- **Superpowers** - planning enforcement, TDD, debugging patterns (~43K stars)
- **claude-mem** - persistent memory across sessions (~20K stars)
- **Built-in skills**: `/simplify`, `/review`, `/batch`, `/loop`, `/debug`, `/claude-api` ([Bozhidar Batsov](https://batsov.com/articles/2026/03/11/essential-claude-code-skills-and-commands/))

**Tier 2 - High-Value Domain-Specific:**
- **Impeccable** (design audit/polish) - 10K stars
- **Planning with Files** - 17.7K stars
- **Trail of Bits security skills** - 4.1K stars
- **Frontend-design** (official Anthropic)
- **jeffallan's Fullstack Dev Skills** (65 skills covering Next.js, migrations, Jira)

**Tier 3 - Niche but Useful:**
- Godogen (Godot game building)
- Swift concurrency skills
- AWS/CloudFormation plugins
- Obsidian integration

### 5. Skills That Are Universally Considered Bloat

**"Just in case" plugins:**
- Any skill installed without a specific use case identified
- Domain-specific skills for languages/frameworks you don't use (Kotlin, Perl, Haskell, etc.)

**Redundant skills:**
- Skills that duplicate Claude Code's built-in capabilities
- Generic "coding best practices" that Claude already knows

**Abandoned/low-quality:**
- Skills with no recent commits
- Skills with vague descriptions
- Skills over 200 lines (complexity overhead) ([Prompt Shelf](https://thepromptshelf.dev/blog/best-claude-code-skills-2026))

### 6. Language-Specific Skills for Niche Languages

**Evidence suggests these are rarely used:**

Looking at "everything-claude-code" skill inventory:
- Kotlin skills (coroutines, exposed, ktor, patterns, testing) - **5+ skills**
- Haskell, Erlang, Scala - minimal community interest
- Even Ruby/Elixir skills have limited adoption

**Why niche language skills underperform:**
1. Small user base = fewer contributors/maintainers
2. LLMs already trained on these languages' patterns
3. Token overhead for rarely-used skills = pure waste
4. Most developers use 1-3 primary languages

### 7. Most Commonly Invoked Commands

From built-in skills and community use:

**High-frequency:**
- `/simplify` - post-edit cleanup
- `/review` - PR/diff review
- `/batch` - large migrations
- `/compact` - context management
- `/diff` - review changes
- `/plan` - complex task planning

**Medium-frequency:**
- `/debug` - troubleshooting
- `/memory` - memory management
- `/btw` - side questions

**Rarely-used:**
- Most niche language-specific skills
- Single-use workflow skills
- Complex automation skills

### 8. The Controllability Problem

Skills auto-activate based on LLM semantic matching—**you can't force or prevent invocation** ([paddo.dev](https://paddo.dev/blog/claude-skills-controllability-problem/)):

- Can't force-invoke when you need it
- Can't prevent unwanted auto-activation
- No visibility into why skills triggered
- Unpredictable context consumption

**Slash commands are often better** for engineering workflows:
- Explicit invocation control
- Deterministic behavior
- Better for context engineering

### 9. Expert Consensus: The Uncomfortable Truth

From Ray Svitla (self.md):
> "most people install plugins to avoid learning how their tools work. you don't need a TDD skill if you understand test-driven development... the best Claude Code users I've seen run 2-3 plugins max. some run zero. they write precise CLAUDE.md files instead."

> "before you install anything, ask: could I write these instructions myself in 20 minutes? if yes, do that."

### 10. The 87,000 Skills Problem

From Tom Piaggio (OpenClaw analysis):
> "Two weeks ago, there were 239 skills in the Claude Code ecosystem. Today, there are over 87,000."

> "The marketplaces that exist right now are directories, not curated stores. They list everything... browsing any of these feels like browsing a phone book. There's no editorial layer, no verified publishers, no meaningful quality signals beyond GitHub stars (which can be gamed and don't measure utility anyway)."

---

## Detailed Analysis

### Why High Skill Counts Are Misleading

1. **Star counts ≠ usage**: Stars can be gamed, don't measure actual utility
2. **Most forks are not active**: "everything-claude-code" has 19K forks but likely <1K active users
3. **Quantity ≠ quality**: 156 skills in one repo doesn't mean 156 useful skills
4. **Abandoned repos**: Many skills haven't been updated in months
5. **No install/download tracking**: No public data on actual installation counts

### The Context Window Math

Claude operates within ~200K token budget:
- System prompt
- Conversation history
- File contents
- User requests
- Model responses
- **Plugin metadata** (the hidden cost)

With 30 plugins @ ~100 words each = 3,000+ tokens = 1.5% of context **permanently reserved for descriptions** ([BSWEN](https://docs.bswen.com/blog/2026-03-10-claude-code-plugin-performance/))

### What Makes a Good Skill (According to Community)

| Criteria | Good Skill | Bad Skill |
|----------|-----------|----------|
| Scope | One focused task | Multiple vague features |
| Size | <200 lines | 500+ lines |
| Maintenance | Recent commits | Abandoned |
| Examples | Includes runnable examples | No usage guidance |
| Domain | Encodes real expertise | Generic best practices |

### Realistic Skill Stack Recommendations

**Minimal (2-3 skills):**
- Superpowers OR claude-mem
- One domain-specific skill for your stack
- skill-creator (to build your own)

**Optimal (4-6 skills):**
- Anthropic document skills (PDF/DOCX/PPTX/XLSX)
- Superpowers
- claude-mem
- One framework-specific skill
- security-review (if handling sensitive data)

**Don't install:**
- Language-specific skills for languages you don't use
- Skills that duplicate built-in functionality
- Skills you "might use someday"

---

## Sources

1. [BSWEN - Do Too Many Plugins Slow Down Claude Code?](https://docs.bswen.com/blog/2026-03-10-claude-code-plugin-performance/) - Token overhead measurements, plugin loading mechanics
2. [Blake Crosley - Commands, Skills, Subagents, Rules: What I Learned Organizing 139 Extensions](https://blakecrosley.com/blog/claude-code-organization) - Expert analysis of 139 extensions over 9 months
3. [Tom Piaggio - OpenClaw: The Best Skills for Your AI Setup](https://tompiagg.io/posts/openclaw-the-best-skills-for-your-ai-setup) - Ecosystem analysis, 87,000 skills overview
4. [Indie Hackers - I tested 200 Claude Code skills](https://www.indiehackers.com/post/i-tested-200-claude-code-skills-so-you-don-t-have-to-here-are-the-20-that-actually-changed-how-i-work-b383a23ce3) - First-hand testing of 200 skills
5. [Prompt Shelf - 15 Best Claude Code Skills 2026](https://thepromptshelf.dev/blog/best-claude-code-skills-2026) - Curated list with star counts and community feedback
6. [self.md - Best Claude Code Plugins 2026](https://self.md/guides/best-claude-code-plugins/) - Curated recommendations from 250+ reviewed
7. [paddo.dev - Claude Skills: The Controllability Problem](https://paddo.dev/blog/claude-skills-controllability-problem/) - Auto-invocation issues
8. [Bozhidar Batsov - Essential Claude Code Skills and Commands](https://batsov.com/articles/2026/03/11/essential-claude-code-skills-and-commands/) - Built-in skills analysis
9. [Vinta - Claude Code: Things I Learned After Using It Every Day](https://vinta.ws/code/claude-code-useful-plugins-skills-and-mcps.html) - Production usage patterns
10. [GitHub - affaan-m/everything-claude-code](https://github.com/affaan-m/everything-claude-code) - Primary mega-repo (134K stars)
11. [GitHub Issues - Context Bloat Bug Reports](https://github.com/anthropics/claude-code/issues/29971) - Community bug reports on overhead
12. [Nate's Newsletter - You're Loading 66,000 Tokens of Plugins](https://natesnewsletter.substack.com/p/your-claude-sessions-cost-10x-what) - Token overhead measurements
13. [GitHub - alirezarezvani/claude-skills](https://github.com/alirezarezvani/claude-skills) - Another mega-repo example (9K stars)
14. [Awesome Claude Code - hesreallyhim](https://github.com/hesreallyhim/awesome-claude-code) - 35K stars curated list

---

## Conclusion

**Verdict: Skills are valuable in small quantities; the mega-repositories are predominantly bloat.**

The evidence supports these conclusions:

1. **High skill counts are marketing, not utility** - No reliable data shows 156+ skills are actively used
2. **4-6 carefully chosen skills outperform 150+** - Token overhead, not feature count, determines effectiveness
3. **Niche language skills are rarely used** - Small user base, LLMs already trained, pure token overhead
4. **Built-in skills and ~5 core third-party skills cover 80% of needs**
5. **The ecosystem lacks quality signals** - No install counts, no verified publishers, star counts unreliable

**Recommendation:** Start with Anthropic's official skills + Superpowers + claude-mem. Add domain-specific skills only when you identify a specific, recurring pain point. Treat any "everything" repository as a menu, not a mandate.
