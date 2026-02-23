# Migration Plan

> This document tracks the evolution of Spring Bank from a **static demo site with
> serverless API routes** to a **full-stack monorepo** with a dedicated Express backend,
> PostgreSQL database, and integrated frontend dashboards.

---

## Table of Contents

1. [Current State](#current-state)
2. [Target State](#target-state)
3. [Phase 1 – Backend Setup](#phase-1--backend-setup-week-12)
4. [Phase 2 – Database Migration](#phase-2--database-migration-week-3)
5. [Phase 3 – Frontend Integration](#phase-3--frontend-integration-week-4)
6. [Phase 4 – Security Hardening](#phase-4--security-hardening-week-5)
7. [Phase 5 – Testing & QA](#phase-5--testing--qa-week-6)
8. [Rollback Strategy](#rollback-strategy)
9. [Data Migration Considerations](#data-migration-considerations)

---

## Current State

```
springbank-website/
├── index.html          ← Public marketing site
├── signin.html         ← Login page (frontend only)
├── api/                ← Netlify serverless functions (JavaScript)
│   ├── auth.js
│   ├── accounts.js
│   └── contact.js
├── frontend/           ← Stub dashboard HTML files
├── styles.css
└── main.js
```

**Characteristics:**
- Serverless API functions deployed alongside static files on Netlify
- No persistent database – mock/in-memory data
- No real authentication – JWT generation without verification chain
- No shared type safety between API and frontend
- No audit logging or security middleware

**Pain points:**
- Cannot persist data across requests or users
- No server-side validation
- Cannot scale business logic independently of the frontend
- Difficult to test in isolation

---

## Target State

```
springbank-website/
├── frontend/           ← Static dashboards (customer, staff, admin)
├── backend/            ← Node.js + Express + TypeScript API server
│   ├── src/
│   ├── prisma/
│   └── Dockerfile
├── shared/             ← TypeScript types (single source of truth)
├── scripts/            ← Dev tooling
└── docs/               ← Architecture, API, security, deployment docs
```

**Characteristics:**
- Dedicated Express API server with full middleware stack
- PostgreSQL database with Prisma ORM and migration history
- Real JWT authentication with refresh token rotation
- Zod input validation on every endpoint
- Audit logging for all state-changing operations
- Shared TypeScript types ensuring frontend/backend consistency
- Docker-ready for portable deployment
- Comprehensive documentation

---

## Phase 1 – Backend Setup (Week 1–2)

**Goal:** Stand up a functional Express API server that can replace the Netlify functions.

### Tasks

| # | Task | Owner | Done |
|---|------|-------|------|
| 1.1 | Create `backend/` directory structure | Dev | ✅ |
| 1.2 | Initialise `package.json` with TypeScript, Express, Prisma dependencies | Dev | ✅ |
| 1.3 | Configure `tsconfig.json` for strict TypeScript | Dev | ✅ |
| 1.4 | Implement `src/server.ts` with helmet, cors, rate-limit, morgan | Dev | ✅ |
| 1.5 | Create `shared/types.ts` with all shared interfaces and enums | Dev | ✅ |
| 1.6 | Implement auth routes (register, login, refresh, logout, reset-password) | Dev | ✅ |
| 1.7 | Implement account routes (list, detail, transactions) | Dev | ✅ |
| 1.8 | Implement transaction routes (transfer, external, bill payment, deposit, withdrawal) | Dev | ✅ |
| 1.9 | Implement admin routes (users, freeze, lock, audit logs, adjust) | Dev | ✅ |
| 1.10 | Add `/health` endpoint | Dev | ✅ |
| 1.11 | Write Zod schemas for all request bodies | Dev | ✅ |
| 1.12 | Write `backend/Dockerfile` for containerised deployment | Dev | ✅ |

### Acceptance criteria

- `npm run dev` starts the server without errors
- `GET /health` returns 200
- `POST /api/auth/register` creates a user and returns tokens
- `POST /api/auth/login` returns tokens for valid credentials

---

## Phase 2 – Database Migration (Week 3)

**Goal:** Replace in-memory mock data with a real PostgreSQL database.

### Tasks

| # | Task | Owner | Done |
|---|------|-------|------|
| 2.1 | Design Prisma schema (`schema.prisma`) with all models | Dev | ✅ |
| 2.2 | Create initial migration with `prisma migrate dev` | Dev | ✅ |
| 2.3 | Provision Neon database for staging environment | DevOps | ⬜ |
| 2.4 | Apply migrations to staging: `prisma migrate deploy` | DevOps | ⬜ |
| 2.5 | Write and run `scripts/seed.ts` to populate demo data | Dev | ✅ |
| 2.6 | Update `scripts/setup.sh` to automate local setup | Dev | ✅ |
| 2.7 | Verify all CRUD operations against real DB | QA | ⬜ |
| 2.8 | Add DB indexes for all foreign keys and hot query paths | Dev | ✅ |

### Acceptance criteria

- All migrations apply cleanly on a fresh database
- Seed script creates demo users and transactions without errors
- Transaction endpoints are atomic (test with concurrent requests)

---

## Phase 3 – Frontend Integration (Week 4)

**Goal:** Connect the existing frontend dashboards to the real API.

### Tasks

| # | Task | Owner | Done |
|---|------|-------|------|
| 3.1 | Audit existing `frontend/` HTML files for API usage patterns | Dev | ⬜ |
| 3.2 | Create `frontend/js/api.js` fetch wrapper with token refresh interceptor | Dev | ⬜ |
| 3.3 | Update `signin.html` to POST to `/api/auth/login` | Dev | ⬜ |
| 3.4 | Update customer dashboard to load real accounts and transactions | Dev | ⬜ |
| 3.5 | Wire up transfer form to `POST /api/transactions/transfer` | Dev | ⬜ |
| 3.6 | Wire up bill payment form | Dev | ⬜ |
| 3.7 | Update staff dashboard to load real user/account data | Dev | ⬜ |
| 3.8 | Update admin dashboard: user management, audit logs, adjust balances | Dev | ⬜ |
| 3.9 | Implement session timeout (15-minute inactivity logout) | Dev | ⬜ |
| 3.10 | Update `netlify.toml` to proxy `/api/*` to backend URL | DevOps | ⬜ |
| 3.11 | Remove Netlify serverless functions from `api/` once replaced | Dev | ⬜ |

### Acceptance criteria

- Customer can log in, view real accounts, and submit a transfer
- Admin can freeze/unfreeze users from the dashboard
- All forms validate input client-side before submitting
- Token refresh works transparently (no unexpected logouts)

---

## Phase 4 – Security Hardening (Week 5)

**Goal:** Ensure the application meets security requirements before public demo.

### Tasks

| # | Task | Owner | Done |
|---|------|-------|------|
| 4.1 | Penetration test checklist: OWASP Top 10 review | Security | ⬜ |
| 4.2 | Verify rate limiting blocks brute-force on `/api/auth/login` | QA | ⬜ |
| 4.3 | Verify account lockout after 5 failed logins | QA | ⬜ |
| 4.4 | Audit all admin endpoints for proper role checks | Dev | ⬜ |
| 4.5 | Review CSP headers; test with browser devtools | Dev | ⬜ |
| 4.6 | Rotate `JWT_SECRET` and `REFRESH_SECRET` in staging | DevOps | ⬜ |
| 4.7 | Set up Sentry error tracking | DevOps | ⬜ |
| 4.8 | Enable HSTS in production Netlify headers | DevOps | ⬜ |
| 4.9 | Verify all `.env` secrets are excluded from version control | Dev | ⬜ |
| 4.10 | Run `npm audit` and resolve critical/high CVEs | Dev | ⬜ |

### Acceptance criteria

- Zero critical/high issues in `npm audit`
- All OWASP Top 10 items reviewed and addressed or documented as accepted risk
- Staging environment passes security checklist

---

## Phase 5 – Testing & QA (Week 6)

**Goal:** Achieve sufficient test coverage and perform end-to-end QA before launch.

### Tasks

| # | Task | Owner | Done |
|---|------|-------|------|
| 5.1 | Write unit tests for auth service (register, login, refresh) | Dev | ⬜ |
| 5.2 | Write unit tests for transaction service (transfer, insufficient funds) | Dev | ⬜ |
| 5.3 | Write integration tests for all API endpoints (supertest) | Dev | ⬜ |
| 5.4 | Write E2E tests for customer transfer flow (Playwright) | QA | ⬜ |
| 5.5 | Load test `/api/transactions/transfer` with 50 concurrent users | QA | ⬜ |
| 5.6 | Cross-browser testing (Chrome, Firefox, Safari, mobile) | QA | ⬜ |
| 5.7 | Accessibility audit (WCAG 2.1 AA) on all dashboard pages | QA | ⬜ |
| 5.8 | Review and update all documentation | Dev | ⬜ |
| 5.9 | Tag release `v1.0.0` and deploy to production | DevOps | ⬜ |

### Acceptance criteria

- Backend test coverage ≥ 80%
- All critical user journeys pass E2E tests
- Application functions correctly on Chrome, Firefox, and Safari
- `v1.0.0` deployed to production with no P0 bugs outstanding

---

## Rollback Strategy

### Frontend rollback

The frontend is deployed to Netlify/Vercel with immutable deployments. Every deployment
has a unique URL and can be instantly rolled back from the hosting dashboard in < 30 seconds.

```
Netlify → Deploys → select previous deployment → Publish deploy
```

### Backend rollback

For Railway/Render/Fly.io, each deploy creates a new container image. Rollback procedure:

1. Identify the previous successful deployment in the platform dashboard.
2. Re-deploy the previous image (one-click in Railway/Render).
3. If the schema migration is destructive, restore from the database backup first (see below).

### Database rollback

Prisma does not provide automatic down migrations. Rollback procedure:

1. Restore the database from the automated snapshot taken before each deploy.
   - Neon: Project → Branches → restore from point-in-time
   - Supabase: Dashboard → Database → Backups → restore
2. Re-deploy the previous API version (compatible with the restored schema).

> **Prevention:** Never make destructive schema changes in a single migration. Use the
> expand-contract pattern: add the new structure, migrate data, then remove old columns
> in a subsequent release.

---

## Data Migration Considerations

### From static/mock data to PostgreSQL

Since the current application has no persistent data (all data is mocked), there is
**no production data to migrate**. The seed script (`scripts/seed.ts`) provides the
initial demo dataset.

### Future migrations

For any future schema changes:

1. **Additive changes** (new columns with defaults, new tables): backward-compatible; deploy API first, then apply migration.
2. **Renaming columns**: use a two-phase migration (add new column, backfill, remove old column across separate releases).
3. **Data type changes**: always use `ALTER TABLE ... ADD COLUMN` + data copy + `DROP COLUMN` pattern; never attempt an in-place type cast on large tables.
4. **Removing columns**: API must stop reading/writing the column before it is dropped from the schema.

### Prisma migration checklist

Before running `prisma migrate deploy` in production:
- [ ] Back up the database (or confirm automated backup ran < 24 h ago)
- [ ] Review the migration SQL file in `backend/prisma/migrations/`
- [ ] Test the migration on a staging environment with a production-size dataset
- [ ] Verify the application starts successfully after migration
- [ ] Have a rollback plan ready (restored snapshot + previous API version)
