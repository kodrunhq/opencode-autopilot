---
# opencode-autopilot
name: domain-research
description: Methodology for researching a project's domain during the RECON phase to understand what it does, who it serves, and what problem it solves.
stacks: []
requires: []
---

# Domain Research

Systematic methodology for understanding a project's domain before writing any code. The goal is to answer: what problem does this solve, for whom, and why does it matter?

## When to Use

- First phase of any new project (RECON)
- Taking over an unfamiliar codebase
- Evaluating whether a feature request aligns with the project's core domain

## The Domain Research Process

### Step 1: Identify the Problem Space

Read the README, project description, and any mission statements. Answer:

- What problem does this project exist to solve?
- Who experiences this problem?
- What happens if this problem is NOT solved?

**DO:**
- Start with the project's own documentation (README, docs/, wiki)
- Look at the package name and description in package.json, Cargo.toml, pyproject.toml
- Check the repository description on GitHub

**DON'T:**
- Jump into source code before understanding the problem
- Assume you know the domain from the project name alone
- Skip this step because "the code will tell me"

### Step 2: Map Key Domain Concepts

Identify the nouns and verbs of the domain:

- **Entities**: What are the main things this project manages? (users, orders, transactions, files)
- **Relationships**: How do these entities relate? (user owns orders, order contains items)
- **Operations**: What can be done to/with these entities? (create, validate, transform, publish)

**DO:**
- Create a glossary of domain terms as you discover them
- Note synonyms and aliases (client = user = customer?)
- Identify bounded contexts (where does one domain concept end and another begin?)

**DON'T:**
- Confuse implementation details with domain concepts (a "cache" is technical, not domain)
- Assume technical naming reflects domain naming

### Step 3: Identify Stakeholders and Workflows

Map who interacts with the system and how:

- **Primary users**: Who directly uses this project?
- **Secondary users**: Who benefits indirectly? (developers, ops, end-users of a downstream system)
- **Workflows**: What are the step-by-step processes stakeholders follow?

**DO:**
- Trace at least one complete workflow from start to finish
- Identify decision points in workflows (where does the system branch?)
- Note error paths (what happens when things go wrong?)

**DON'T:**
- Only trace the happy path
- Assume workflows are linear (they rarely are)

### Step 4: Distinguish Core Domain from Supporting Infrastructure

Not all code is equally important to the domain:

- **Core domain**: The unique business logic that makes this project valuable
- **Supporting subdomains**: Necessary but not differentiating (auth, logging, database access)
- **Generic subdomains**: Commodity functionality (email sending, file I/O)

**DO:**
- Focus research effort on the core domain
- Note which parts are commodity vs. competitive advantage
- Identify where the project's complexity concentrates

**DON'T:**
- Spend equal time on auth configuration and core business logic
- Mistake framework boilerplate for domain logic

### Step 5: Document Findings

Produce a domain summary that answers:

1. What problem does this solve?
2. Who are the stakeholders?
3. What are the key domain entities and their relationships?
4. What are the primary workflows?
5. Where does complexity concentrate?
6. What assumptions am I making that need verification?

**DO:**
- Write for someone who has never seen this project
- Use domain language, not technical jargon
- Flag uncertainties explicitly

**DON'T:**
- Write a code walkthrough (that's exploration, not domain research)
- Present assumptions as facts