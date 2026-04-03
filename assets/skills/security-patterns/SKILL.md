---
name: security-patterns
description: OWASP Top 10 security patterns, authentication, authorization, input validation, secret management, and secure coding practices
stacks: []
requires: []
---

# Security Patterns

Actionable security patterns for building, reviewing, and hardening applications. Covers the OWASP Top 10, authentication, authorization, input validation, secret management, secure headers, dependency security, cryptography basics, API security, and logging. Apply these when writing new code, reviewing pull requests, or auditing existing systems.

## 1. Injection Prevention (OWASP A03)

**DO:** Use parameterized queries and prepared statements for all database interactions. Never concatenate user input into queries.

```sql
-- DO: Parameterized query
SELECT * FROM users WHERE email = ? AND status = ?

-- DON'T: String concatenation
SELECT * FROM users WHERE email = '" + userInput + "' AND status = 'active'
```

- Use ORM query builders with bound parameters
- Apply the same principle to LDAP, OS commands, and XML parsers
- Use allowlists for dynamic column/table names (never interpolate directly)

**DON'T:**

- Build SQL strings with template literals or concatenation
- Trust "sanitized" input as a substitute for parameterization
- Use dynamic code evaluation with user-controlled input
- Pass user input directly to shell commands -- use argument arrays instead:
  ```
  // DO: Argument array (no shell interpretation)
  spawn("convert", [inputFile, "-resize", "200x200", outputFile])

  // DON'T: Shell string (command injection risk)
  runShellCommand("convert " + inputFile + " -resize 200x200 " + outputFile)
  ```

## 2. Authentication Patterns

**DO:** Use proven authentication libraries and standards. Never roll your own crypto or session management.

- **JWT best practices:**
  - Use short-lived access tokens (5-15 minutes) with refresh token rotation
  - Validate `iss`, `aud`, `exp`, and `nbf` claims on every request
  - Use asymmetric signing (RS256/ES256) for distributed systems; symmetric (HS256) only for single-service
  - Store refresh tokens server-side (database or Redis) with revocation support
  - Never store JWTs in `localStorage` -- use `httpOnly` cookies

- **Session management:**
  - Regenerate session ID after login (prevent session fixation)
  - Set absolute session timeout (e.g., 8 hours) and idle timeout (e.g., 30 minutes)
  - Invalidate sessions on password change and logout
  - Store sessions server-side; the cookie holds only the session ID

- **Password handling:**
  - Hash with bcrypt (cost factor 12+), scrypt, or Argon2id -- never MD5 or SHA-256 alone
  - Enforce minimum length (12+ characters), no maximum length under 128
  - Check against breached password databases (Have I Been Pwned API)
  - Use constant-time comparison for password verification

**DON'T:**

- Store passwords in plaintext or with reversible encryption
- Implement custom JWT libraries -- use well-maintained ones (jose, jsonwebtoken)
- Send tokens in URL query parameters (logged in server logs, browser history, referrer headers)
- Use predictable session IDs or sequential tokens

## 3. Authorization (OWASP A01)

**DO:** Enforce authorization on every request, server-side. Never rely on client-side checks alone.

- **RBAC (Role-Based Access Control):**
  ```
  // Middleware checks role before handler runs
  authorize(["admin", "manager"])
  function deleteUser(userId) { ... }
  ```

- **ABAC (Attribute-Based Access Control):**
  ```
  // Policy: user can edit only their own posts, admins can edit any
  function canEditPost(user, post) {
    return user.role === "admin" || post.authorId === user.id
  }
  ```

- Check ownership on every resource access (IDOR prevention):
  ```
  // DO: Verify ownership
  post = await getPost(postId)
  if (post.authorId !== currentUser.id && !currentUser.isAdmin) {
    throw new ForbiddenError()
  }

  // DON'T: Trust that the user only accesses their own resources
  post = await getPost(postId)  // No ownership check
  ```

- Apply the principle of least privilege -- default deny, explicitly grant
- Log all authorization failures for monitoring

**DON'T:**

- Hide UI elements as a security measure (security by obscurity)
- Use sequential/guessable IDs for sensitive resources -- use UUIDs
- Check permissions only at the UI layer
- Grant broad roles when narrow permissions suffice

## 4. Cross-Site Scripting Prevention (OWASP A07)

**DO:** Escape all output by default. Use context-aware encoding.

- Use framework auto-escaping (React JSX, Vue templates, Angular binding)
- Sanitize HTML when rich text is required (use libraries like DOMPurify or sanitize-html)
- Use `textContent` instead of `innerHTML` for dynamic text
- Apply Content Security Policy headers (see Section 7)

**DON'T:**

- Use raw HTML injection props (React, Vue) with user-supplied content
- Insert user data into script tags, event handlers, or `href="javascript:..."`
- Trust server-side sanitization alone -- defense in depth means escaping at every layer
- Disable framework auto-escaping without explicit justification

## 5. Cross-Site Request Forgery Prevention (OWASP A01)

**DO:** Protect state-changing operations with anti-CSRF tokens.

- Use the synchronizer token pattern (server-generated, per-session or per-request)
- For SPAs: use the double-submit cookie pattern or custom request headers
- Set `SameSite=Lax` or `SameSite=Strict` on session cookies
- Verify `Origin` and `Referer` headers as an additional layer

**DON'T:**

- Rely solely on `SameSite` cookies (older browsers may not support it)
- Use GET requests for state-changing operations
- Accept CSRF tokens in query parameters (leaks via referrer)

## 6. Server-Side Request Forgery Prevention (OWASP A10)

**DO:** Validate and restrict all server-initiated outbound requests.

- Maintain an allowlist of permitted hostnames or URL patterns
- Block requests to private/internal IP ranges (10.x, 172.16-31.x, 192.168.x, 127.x, ::1)
- Use a dedicated HTTP client with timeout, redirect limits, and DNS rebinding protection
- Resolve DNS and validate the IP before connecting (prevent DNS rebinding)

**DON'T:**

- Allow user-controlled URLs to reach internal services
- Follow redirects blindly from user-provided URLs
- Trust URL parsing alone -- resolve and check the actual IP address

## 7. Secure Headers

**DO:** Set security headers on all HTTP responses.

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; frame-ancestors 'none'
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

- Start with a strict CSP and loosen only as needed
- Use `nonce` or `hash` for inline scripts instead of `'unsafe-inline'`
- Enable HSTS preloading for production domains
- Set `X-Frame-Options: DENY` unless embedding is required

**DON'T:**

- Use `'unsafe-eval'` in CSP (enables XSS via code evaluation)
- Skip HSTS on HTTPS-only sites
- Set permissive CORS (`Access-Control-Allow-Origin: *`) on authenticated endpoints

## 8. Input Validation and Sanitization

**DO:** Validate all input at system boundaries. Reject invalid input before processing.

- Use schema validation (Zod, Joi, JSON Schema) for structured input
- Validate type, length, range, and format
- Use allowlists over blocklists for security-sensitive fields
- Sanitize for the output context (HTML-encode for HTML, parameterize for SQL)
- Validate file uploads: check MIME type, file extension, file size, and magic bytes

**DON'T:**

- Trust `Content-Type` headers alone for file type validation
- Use regex-only validation for complex formats (emails, URLs) -- use dedicated parsers
- Validate on the client only -- always re-validate server-side
- Accept unbounded input (always set maximum lengths)

## 9. Secret Management

**DO:** Keep secrets out of source code and version control.

- Use environment variables for deployment-specific secrets
- Use a secrets manager (Vault, AWS Secrets Manager, GCP Secret Manager) for production
- Rotate secrets on a schedule and immediately after suspected exposure
- Use separate secrets per environment (dev, staging, production)
- Validate that required secrets are present at startup -- fail fast if missing

**DON'T:**

- Commit secrets to Git (even in "private" repos)
- Log secrets in application logs or error messages
- Store secrets in `.env` files in production (use the platform's secret injection)
- Share secrets via chat, email, or documentation -- use a secrets manager
- Hardcode API keys, database passwords, or tokens in source files

```
// DO: Environment variable
const apiKey = process.env.API_KEY
if (!apiKey) throw new Error("API_KEY environment variable is required")

// DON'T: Hardcoded
const apiKey = "sk-1234567890abcdef"
```

## 10. Dependency Security

**DO:** Treat dependencies as an attack surface. Audit regularly and keep them updated.

- Run `npm audit`, `pip audit`, or equivalent on every CI build
- Use lockfiles (`package-lock.json`, `bun.lockb`, `poetry.lock`) and commit them
- Pin major versions; allow patch updates with automated PR tools (Dependabot, Renovate)
- Review new dependencies before adding: check maintenance status, download count, and known vulnerabilities
- Use Software Composition Analysis (SCA) tools in CI

**DON'T:**

- Ignore audit warnings -- triage and fix or document accepted risk
- Use `*` or `latest` as version specifiers
- Add dependencies without evaluating their transitive dependency tree
- Skip lockfile commits (reproducible builds require locked versions)

## 11. Cryptography Basics

**DO:** Use standard algorithms and libraries. Never implement your own cryptographic primitives.

- **Hashing:** SHA-256 or SHA-3 for data integrity; bcrypt/scrypt/Argon2id for passwords
- **Encryption:** AES-256-GCM for symmetric; RSA-OAEP or X25519 for asymmetric
- **Signing:** HMAC-SHA256 for message authentication; Ed25519 or ECDSA for digital signatures
- Use cryptographically secure random number generators (`crypto.randomUUID()`, `crypto.getRandomValues()`)
- Store encryption keys separate from encrypted data

**DON'T:**

- Use MD5 or SHA-1 for anything security-sensitive (broken collision resistance)
- Use ECB mode for block ciphers (patterns leak through)
- Reuse initialization vectors (IVs) or nonces
- Store encryption keys alongside the encrypted data
- Roll your own encryption scheme

## 12. API Security

**DO:** Protect APIs at multiple layers.

- Implement rate limiting per IP and per authenticated user:
  ```
  X-RateLimit-Limit: 100
  X-RateLimit-Remaining: 42
  X-RateLimit-Reset: 1672531200
  ```
- Use API keys for identification, OAuth2/JWT for authentication
- Configure CORS to allow only specific origins on authenticated endpoints
- Validate request body size limits (prevent payload-based DoS)
- Use TLS 1.2+ for all API traffic -- no exceptions

**DON'T:**

- Expose internal error details in API responses (stack traces, SQL errors)
- Allow unlimited request sizes or query complexity (GraphQL depth/cost limiting)
- Use API keys as the sole authentication mechanism for sensitive operations
- Disable TLS certificate validation in production clients

## 13. Logging and Monitoring

**DO:** Log security-relevant events for detection and forensics.

- Log: authentication attempts (success and failure), authorization failures, input validation failures, privilege escalation, configuration changes
- Include: timestamp, user ID, action, resource, IP address, result (success/failure)
- Use structured logging (JSON) for machine-parseable audit trails
- Set up alerts for: brute force patterns, unusual access times, privilege escalation, mass data access

**DON'T:**

- Log passwords, tokens, session IDs, credit card numbers, or PII
- Log at a level that makes it easy to reconstruct sensitive user data
- Store logs on the same system they are monitoring (compromised system = compromised logs)
- Ignore log volume -- implement log rotation and retention policies

```
// DO: Structured security log (PII redacted)
logger.warn("auth.failed", {
  userId: attempt.userId,
  ip: request.ip,
  reason: "invalid_password",
  attemptCount: 3,
})

// DON'T: Leak credentials
logger.warn("Login failed for user@example.com with password P@ssw0rd!")
```
