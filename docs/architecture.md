# Spring Bank – System Architecture Overview

> **Note:** Spring Bank is an enterprise-grade banking demonstration application.  
> It is **not** a regulated financial institution. All data is synthetic.

---

## Table of Contents

1. [Overview](#overview)
2. [High-Level Architecture](#high-level-architecture)
3. [Component Breakdown](#component-breakdown)
4. [Data Flow](#data-flow)
5. [Security Layers](#security-layers)
6. [Deployment Architecture](#deployment-architecture)
7. [Scalability Considerations](#scalability-considerations)
8. [Technology Choices & Rationale](#technology-choices--rationale)

---

## Overview

Spring Bank is a full-stack banking simulation built to demonstrate modern web-application patterns in a realistic financial domain. It provides:

- **Customer-facing dashboards** – account overviews, fund transfers, bill payments, transaction history.
- **Staff portal** – customer account management and transaction visibility.
- **Admin panel** – user management, account adjustments, and audit log review.
- **RESTful API** – JWT-secured, validated, rate-limited, and documented with OpenAPI 3.0.

The project is structured as a monorepo:

```
springbank-website/
├── frontend/          # Static HTML/CSS/JS dashboards
├── backend/           # Node.js + Express + TypeScript API server
├── shared/            # TypeScript types shared by both layers
├── scripts/           # Dev tooling (setup, seed)
└── docs/              # Architecture, API, security, and deployment docs
```

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT BROWSER                          │
│                                                                 │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐   │
│  │  Public Site  │   │  Customer UI │   │  Admin / Staff   │   │
│  │  (index.html) │   │  (frontend/) │   │  Dashboards      │   │
│  └──────┬───────┘   └──────┬───────┘   └────────┬─────────┘   │
└─────────┼──────────────────┼────────────────────┼─────────────┘
          │ Static Assets    │ REST / JSON         │ REST / JSON
          ▼                  ▼                     ▼
┌─────────────────┐   ┌──────────────────────────────────────────┐
│   CDN / Static  │   │              API SERVER                  │
│   Host          │   │                                          │
│  (Netlify /     │   │  Node.js 18 + Express + TypeScript       │
│   Vercel)       │   │                                          │
└─────────────────┘   │  ┌────────────┐  ┌────────────────────┐ │
                       │  │ Auth       │  │ Business Logic     │ │
                       │  │ Middleware │  │ (accounts,         │ │
                       │  │ (JWT)      │  │  transactions,     │ │
                       │  └────────────┘  │  admin)            │ │
                       │                  └────────────────────┘ │
                       │  ┌────────────┐  ┌────────────────────┐ │
                       │  │ Rate       │  │ Zod Validation     │ │
                       │  │ Limiter    │  │ Layer              │ │
                       │  └────────────┘  └────────────────────┘ │
                       └──────────────────────┬───────────────────┘
                                              │ Prisma ORM
                                              ▼
                              ┌───────────────────────────┐
                              │        PostgreSQL          │
                              │                           │
                              │  users  accounts          │
                              │  transactions  audit_logs │
                              └───────────────────────────┘
```

---

## Component Breakdown

### Frontend (`frontend/`)

| Aspect | Detail |
|--------|--------|
| Build tool | Vite (dev server) + plain HTML/CSS/JS for production |
| Dashboards | `customer.html`, `staff.html`, `admin.html` |
| Auth | JWT stored in `sessionStorage`; refresh handled transparently |
| API client | Thin `fetch` wrapper in `frontend/js/api.js` |
| Hosting | Netlify or Vercel (static files, no SSR required) |

### Backend (`backend/`)

| Aspect | Detail |
|--------|--------|
| Runtime | Node.js 18 LTS |
| Framework | Express 4 |
| Language | TypeScript 5 (compiled to `dist/`) |
| ORM | Prisma 5 |
| Validation | Zod schemas mirroring `shared/types.ts` |
| Auth | JWT (`jsonwebtoken`) + bcrypt password hashing |
| Security | helmet, express-rate-limit, cors |
| Logging | Morgan (HTTP) + custom audit logger |

#### Route structure

```
/api/auth        → register, login, refresh, logout, reset-password
/api/accounts    → list, detail, transactions
/api/transactions → transfer, external-transfer, bill-payment, deposit, withdrawal
/api/admin       → user management, audit logs, account adjustments
```

### Database (PostgreSQL + Prisma)

| Aspect | Detail |
|--------|--------|
| Engine | PostgreSQL 15 |
| Schema | Defined in `backend/prisma/schema.prisma` |
| Migrations | Managed by `prisma migrate` |
| Hosting | Neon (serverless Postgres, free tier) or Supabase |
| Connection | Single `DATABASE_URL` environment variable |

---

## Data Flow

### Authentication Flow

```
Browser                    API Server                  Database
  │                             │                          │
  │── POST /api/auth/login ────►│                          │
  │   { email, password }       │── SELECT user by email ─►│
  │                             │◄─ user row ──────────────│
  │                             │                          │
  │                             │  bcrypt.compare()        │
  │                             │  (password vs hash)      │
  │                             │                          │
  │                             │  if OK:                  │
  │                             │  sign accessToken (15m)  │
  │                             │  sign refreshToken (7d)  │
  │                             │  store refreshToken hash │
  │◄── 200 { accessToken,       │── INSERT refresh_token ─►│
  │          refreshToken,      │                          │
  │          user } ────────────│                          │
  │                             │                          │
  │  (store tokens in           │                          │
  │   sessionStorage)           │                          │
  │                             │                          │
  │── GET /api/accounts ───────►│                          │
  │   Authorization: Bearer ... │  verify JWT signature    │
  │                             │  check expiry            │
  │                             │── SELECT accounts ──────►│
  │◄── 200 { data: [...] } ─────│◄─ rows ──────────────────│
```

### Transaction Flow (Internal Transfer)

```
Browser              API Server                      Database
  │                       │                              │
  │── POST /api/          │                              │
  │   transactions/       │                              │
  │   transfer ──────────►│                              │
  │                       │  1. Authenticate JWT         │
  │                       │  2. Zod validate body        │
  │                       │  3. Load fromAccount         │
  │                       │── SELECT account ───────────►│
  │                       │◄─ account row ───────────────│
  │                       │                              │
  │                       │  4. Check ownership          │
  │                       │  5. Check sufficient funds   │
  │                       │                              │
  │                       │  6. BEGIN TRANSACTION        │
  │                       │── UPDATE fromAccount balance►│
  │                       │── UPDATE toAccount balance ─►│
  │                       │── INSERT transaction row ───►│
  │                       │── INSERT audit_log row ─────►│
  │                       │  COMMIT                      │
  │                       │                              │
  │◄── 200 { data:        │                              │
  │    transaction } ─────│                              │
```

---

## Security Layers

Spring Bank applies **defence in depth** – multiple independent controls so that no single failure exposes sensitive data.

| Layer | Mechanism |
|-------|-----------|
| Transport | HTTPS enforced in production (TLS 1.2+) |
| Headers | `helmet` sets CSP, HSTS, X-Frame-Options, etc. |
| CORS | Allowlist-based origin policy via `CORS_ORIGIN` env var |
| Rate limiting | Per-route limits (auth: 10 req/15 min; API: 100 req/min) |
| Authentication | Short-lived JWT (15 min) + refresh token rotation |
| Password storage | bcrypt with cost factor 12 |
| Account lockout | 5 consecutive failures → locked; admin unlock required |
| Input validation | Zod schemas on every request body and query parameter |
| SQL injection | Prisma parameterised queries; no raw SQL with user input |
| Audit logging | All state-changing actions recorded with user + IP |
| Double-entry ledger | Transactions are atomic DB operations; no partial updates |

---

## Deployment Architecture

```
┌──────────────────────────┐     ┌────────────────────────────────┐
│  Netlify / Vercel (CDN)  │     │   Render / Railway / Fly.io    │
│                          │     │                                │
│  Static files:           │     │  Docker container:             │
│  - index.html            │     │  - Node.js 18                  │
│  - frontend/*.html       │  ──►│  - Express API                 │
│  - styles.css            │     │  - PORT 3001                   │
│  - main.js               │     │                                │
│                          │     │  Env vars injected at runtime  │
└──────────────────────────┘     └────────────┬───────────────────┘
                                               │
                                               │ DATABASE_URL (TLS)
                                               ▼
                                  ┌────────────────────────┐
                                  │   Neon / Supabase      │
                                  │   PostgreSQL (managed) │
                                  └────────────────────────┘
```

### Environment variables

All secrets are injected at runtime via environment variables – **never** baked into Docker images or committed to source control. See `.env.example` for the full list.

---

## Scalability Considerations

| Concern | Current approach | Path to scale |
|---------|-----------------|---------------|
| API concurrency | Single Express process | Add PM2 cluster or horizontal replicas behind a load balancer |
| Database connections | Single `DATABASE_URL` | Use PgBouncer connection pooling (Neon provides this natively) |
| Session state | Stateless JWT | Already horizontally scalable; refresh tokens stored in DB |
| Static assets | Served from CDN | Already globally distributed via Netlify/Vercel edge network |
| Heavy queries | Basic indexes | Add composite indexes on `(userId, createdAt)` for transaction lists |
| Background jobs | Synchronous | Introduce a job queue (BullMQ + Redis) for external transfers |

---

## Technology Choices & Rationale

| Technology | Chosen over | Reason |
|------------|-------------|--------|
| **Express** | Fastify, NestJS | Minimal footprint; widely understood; easy to demo |
| **Prisma** | TypeORM, Sequelize, Drizzle | Excellent TypeScript DX; migration tooling; readable schema |
| **Zod** | Joi, class-validator | TypeScript-first; schema → type inference; composable |
| **JWT** | Sessions, OAuth | Stateless; works across separate frontend/backend origins |
| **bcrypt** | Argon2, PBKDF2 | Battle-tested Node.js support; tunable cost factor |
| **PostgreSQL** | MySQL, SQLite | ACID guarantees essential for financial data; rich JSON support |
| **Neon** | Supabase, RDS | Generous free tier; serverless scale-to-zero; Prisma compatible |
| **Netlify/Vercel** | S3 + CloudFront | Zero-config deploys from Git; free tier; preview deployments |
