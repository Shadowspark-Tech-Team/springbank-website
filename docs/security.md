# Security Model

> Spring Bank is a **demonstration application**. The security controls described here
> reflect production-grade patterns implemented in the codebase. They are designed to be
> educational as well as functional.

---

## Table of Contents

1. [Authentication](#authentication)
2. [Password Security](#password-security)
3. [Account Lockout](#account-lockout)
4. [Two-Factor Authentication](#two-factor-authentication)
5. [API Security](#api-security)
6. [Input Validation](#input-validation)
7. [SQL Injection Prevention](#sql-injection-prevention)
8. [XSS Prevention](#xss-prevention)
9. [CSRF Notes](#csrf-notes)
10. [Audit Logging](#audit-logging)
11. [Session Timeout](#session-timeout)
12. [Data Encryption](#data-encryption)

---

## Authentication

Spring Bank uses a **stateless JWT + refresh token** scheme with short-lived access tokens
and server-side refresh token rotation.

### Token lifecycle

```
LOGIN
  │
  ├─► Sign accessToken  (HS256, 15 min TTL)
  └─► Sign refreshToken (HS256, 7 day TTL)
       └─► Store SHA-256 hash in refresh_tokens table
              │
              │  (every API request)
              ▼
       Bearer accessToken in Authorization header
              │
              ├─► Verify signature (JWT_SECRET)
              ├─► Check exp claim
              └─► Attach decoded user to request context

  (accessToken nearing expiry)
              │
              ▼
       POST /api/auth/refresh { refreshToken }
              │
              ├─► Hash provided token, look up in DB
              ├─► Check revoked_at IS NULL and expires_at > NOW()
              ├─► Revoke old token (set revoked_at = NOW())
              ├─► Issue new accessToken (15 min)
              └─► Issue new refreshToken (7 days), store hash

LOGOUT
  └─► Set revoked_at = NOW() on active refresh token
```

### Token configuration

| Token | Algorithm | TTL | Storage (client) |
|-------|-----------|-----|-----------------|
| Access token | HS256 | 15 minutes | `sessionStorage` (cleared on tab close) |
| Refresh token | HS256 | 7 days | `sessionStorage` |

> **Why `sessionStorage`?** Storing tokens in `localStorage` makes them accessible to
> any JavaScript on the page. `sessionStorage` is scoped to the tab and cleared automatically,
> reducing the XSS attack surface.

### Secrets

`JWT_SECRET` and `REFRESH_SECRET` must be cryptographically random strings of at least 64 bytes:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

They are injected at runtime via environment variables and **never** committed to source control.

---

## Password Security

### Hashing

All passwords are hashed with **bcrypt** using a work factor (cost) of **12**.

```
cost 12 → ~250 ms per hash on a modern CPU
         → brute-force of 1 billion common passwords ≈ 8 years on one GPU
```

The raw password **never** touches the database. Only the bcrypt hash is stored.

### Complexity requirements

Passwords must satisfy all of the following (enforced by a Zod `refine`):

| Requirement | Rule |
|-------------|------|
| Minimum length | ≥ 8 characters |
| Uppercase | ≥ 1 character [A-Z] |
| Lowercase | ≥ 1 character [a-z] |
| Digit | ≥ 1 character [0-9] |
| Special character | ≥ 1 character from `!@#$%^&*()_+-=[]{}` |
| Maximum length | ≤ 128 characters (bcrypt limit) |

### Password reset flow

1. User submits email to `POST /api/auth/reset-password`.
2. Server generates a random 32-byte hex token, stores its SHA-256 hash with a 1-hour expiry.
3. Reset URL with the raw token is emailed via Resend.
4. User clicks link → `POST /api/auth/reset-password/confirm { token, newPassword }`.
5. Server hashes incoming token, looks up match, checks expiry, updates `passwordHash`, revokes all refresh tokens.
6. Endpoint always returns 200 to prevent email enumeration.

---

## Account Lockout

### Automatic lockout

The server tracks `failedLogins` on each user row.

```
POST /api/auth/login (wrong password)
  └─► failedLogins += 1
       ├─► if failedLogins < 5 → return 401 "Invalid credentials"
       └─► if failedLogins >= 5 → isLocked = true, failedLogins = 0
                                    return 403 "Account locked"
```

A **locked** account cannot log in regardless of the correct password.

### Unlock procedure

1. An admin navigates to the Admin dashboard → User management.
2. Admin calls `PATCH /api/admin/users/{id}/lock { locked: false }`.
3. Server sets `isLocked = false`, resets `failedLogins = 0`.
4. Action recorded in `audit_logs` with `action: "USER_UNLOCKED"`.

### Frozen vs Locked

| State | Set by | Cleared by | Effect |
|-------|--------|------------|--------|
| `isFrozen` | Admin manually | Admin manually | No login, no transactions |
| `isLocked` | Automatic (5 failures) | Admin manually | No login only |

---

## Two-Factor Authentication

Spring Bank's backend is architected to support **TOTP-based 2FA** (RFC 6238, compatible with
Google Authenticator / Authy) in a future release.

### Planned flow

1. User enables 2FA: server generates a TOTP secret (`speakeasy.generateSecret()`), returns a QR code URI.
2. User scans with authenticator app and confirms by entering a TOTP code.
3. Secret is stored encrypted in the `users` table.
4. On subsequent logins: after password validation, server requires a `totpCode` field and verifies with a 30-second window.

> Currently **not enforced** – the infrastructure for it is scaffolded. Production deployments
> should enable it for all Admin and Staff accounts.

---

## API Security

### Rate limiting

Per-route limits enforced by `express-rate-limit`, keyed on IP address.

| Route group | Window | Max requests |
|-------------|--------|-------------|
| `POST /api/auth/*` | 15 minutes | 10 requests |
| `GET /api/*` | 1 minute | 100 requests |
| `POST /api/transactions/*` | 1 minute | 30 requests |
| `PATCH /api/admin/*` | 1 minute | 50 requests |

On breach the API returns `429 Too Many Requests` with a `Retry-After` header.

### HTTP security headers (helmet)

`helmet` is applied as global middleware and sets:

| Header | Value / Effect |
|--------|----------------|
| `Content-Security-Policy` | Restricts script/style sources; blocks inline eval |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `X-Frame-Options` | `DENY` – prevents clickjacking |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `X-XSS-Protection` | `0` (modern browsers use CSP instead) |
| `Cross-Origin-Opener-Policy` | `same-origin` |

### CORS policy

Origins allowed by the API are configured via the `CORS_ORIGIN` environment variable
(comma-separated list). In production, only the specific frontend domain is listed.

```
CORS_ORIGIN=https://springbank.demo,https://www.springbank.demo
```

All other origins receive a `403` from the CORS preflight.

---

## Input Validation

Every request body, query parameter, and URL parameter is validated by a **Zod schema**
before reaching the business logic layer.

```typescript
// Example: transfer request schema
const transferSchema = z.object({
  fromAccountId: z.string().uuid(),
  toAccountId:   z.string().uuid(),
  amountCents:   z.number().int().positive().max(10_000_000), // $100k max
  description:   z.string().max(255).optional(),
});
```

A central `validate` middleware extracts Zod errors and returns them as structured 400 responses:

```json
{
  "success": false,
  "error": "Validation failed.",
  "code": "VALIDATION_ERROR",
  "details": [
    { "field": "amountCents", "message": "Must be a positive integer" }
  ]
}
```

---

## SQL Injection Prevention

Spring Bank uses **Prisma ORM** exclusively for all database operations. Prisma:

- Generates parameterised prepared statements for all queries.
- Never interpolates raw user input into SQL strings.
- The `$queryRaw` and `$executeRaw` escape functions are not used in application code.

**There are no raw SQL strings constructed from user input anywhere in the codebase.**

---

## XSS Prevention

### API layer

The API returns JSON only. `Content-Type: application/json` is set on all responses.
`helmet` sets a strict CSP that blocks inline scripts.

### Frontend layer

The frontend dashboards:
- Insert data using `.textContent` (not `.innerHTML`) wherever possible.
- Where HTML must be constructed dynamically, values are passed through a
  `sanitize()` helper that strips tags before insertion.
- CSP headers from `helmet` (in production via Netlify headers) provide a second line of defence.

---

## CSRF Notes

Spring Bank's frontend is a **separate static site** that communicates with the API via
`fetch` with explicit `Authorization: Bearer <token>` headers. This architecture is
**not vulnerable to classic CSRF** because:

1. CSRF exploits rely on the browser automatically sending session cookies. Spring Bank
   uses JWT in `sessionStorage` – cookies are not used for authentication.
2. An attacker's page cannot read `sessionStorage` from another origin.
3. The CORS policy rejects cross-origin preflight requests from unknown origins.

> If cookies are ever introduced (e.g., for HttpOnly refresh tokens), implement
> `csurf` or SameSite cookie attributes immediately.

---

## Audit Logging

All state-changing actions are written to the `audit_logs` table **within the same database
transaction** as the action itself. This guarantees that if the action commits, the log
entry commits too – and vice versa.

### What is logged

- Every authentication event (login, logout, failed attempt, register)
- Every fund movement (transfer, withdrawal, deposit, bill payment)
- Every admin action (freeze, unfreeze, lock, unlock, balance adjustment)
- Password reset requests and completions

### Log entry structure

```json
{
  "id": "uuid",
  "userId": "uuid-of-actor",
  "action": "USER_FROZEN",
  "metadata": {
    "targetUserId": "uuid-of-target",
    "reason": "Suspected fraudulent activity",
    "previousState": { "isFrozen": false }
  },
  "ipAddress": "192.168.1.100",
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

### Immutability

Audit log rows have **no UPDATE or DELETE** permissions in the application layer. Prisma
models for `AuditLog` have no `update` or `delete` operations defined.

---

## Session Timeout

The frontend implements a **15-minute inactivity timeout** in addition to the server-side
15-minute token expiry.

```
User activity detected (mousemove, keydown, click)
  └─► Reset inactivity timer to 15 minutes

Inactivity timer expires
  └─► Clear sessionStorage (tokens, user data)
  └─► Redirect to /signin.html
  └─► Display "You were signed out due to inactivity."
```

This protects against an unattended browser session in a shared environment.

---

## Data Encryption

### In transit

- All production traffic is served over **HTTPS / TLS 1.2+**.
- The backend enforces HTTPS via the `HSTS` header set by `helmet`.
- The database connection uses TLS by default (required by Neon and Supabase).

### At rest

- **Passwords** are stored as bcrypt hashes – the original value is irrecoverable.
- **Refresh tokens** are stored as SHA-256 hashes – the raw token exists only in transit.
- Database-level encryption at rest is provided by the managed PostgreSQL host (Neon / Supabase / RDS all encrypt volumes by default).
- **No PII** is stored beyond what is necessary (name, email, account numbers). No SSN,
  card numbers, or full addresses are stored in this demo.

### Key management

- `JWT_SECRET` and `REFRESH_SECRET` are 64-byte random hex strings injected as environment variables.
- In a production system, secrets should be stored in a managed secrets service (AWS Secrets Manager, HashiCorp Vault, etc.) and rotated periodically.
- Secret rotation invalidates all active sessions; users must re-authenticate.
