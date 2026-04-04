---
description: Run a security audit of recent code changes
agent: security-auditor
---
Audit the code specified by $ARGUMENTS for security vulnerabilities.

Detect the project language and framework from manifest files (package.json, tsconfig.json, go.mod, Cargo.toml, pom.xml, *.csproj, pyproject.toml, requirements.txt) and adapt security checks to that language/framework.

If $ARGUMENTS specifies file paths, audit those files. If $ARGUMENTS is empty or says "all", audit recent changes (use git diff to identify modified files).

Review for:

1. **OWASP Top 10** -- Injection, broken auth, sensitive data exposure, XXE, broken access control, security misconfiguration, XSS, insecure deserialization, known vulnerabilities, insufficient logging
2. **Hardcoded secrets** -- API keys, passwords, tokens, connection strings in source code
3. **Input validation** -- Missing or insufficient validation at system boundaries
4. **Authentication and authorization** -- Missing auth checks, weak session management, privilege escalation
5. **Dependency vulnerabilities** -- Run `npm audit`, `pip audit`, `cargo audit`, or equivalent

Present findings grouped by severity: CRITICAL, HIGH, MEDIUM, LOW. For each finding, include the file path, line range, issue description, and a concrete remediation with code example.
