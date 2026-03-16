# SpringBank Next.js Demo Foundation

This repository runs a **Next.js 15 App Router + TypeScript + Prisma** full-stack demo while preserving the original SpringBank public visual identity.

## Stack

- Next.js 15 (App Router)
- TypeScript
- Prisma ORM
- **PostgreSQL** (hosted; Supabase / Neon / Prisma Postgres compatible)

## What changed for deployability

- Prisma datasource moved from SQLite to PostgreSQL.
- Prisma now supports pooled `DATABASE_URL` plus `DIRECT_URL` for migration-safe operations.
- Existing auth, dashboard, transfers, and admin approvals logic is unchanged functionally and remains Prisma-backed.

## Environment variables

Create `.env` from `.env.example` and set:

- `DATABASE_URL` → pooled/runtime Postgres URL
- `DIRECT_URL` → direct Postgres URL (used by Prisma Migrate)
- `NEXT_PUBLIC_APP_URL` → app base URL

## Local development (Postgres)

```bash
npm install
cp .env.example .env
# set DATABASE_URL and DIRECT_URL to your local/hosted postgres instance
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run prisma:seed
npm run dev
```

Open `http://localhost:3000`.

## Hosted Postgres + Vercel deployment

### 1) Provision database
Use Supabase, Neon, or Prisma Postgres and get:
- pooled connection string
- direct connection string

### 2) Set Vercel environment variables
In Vercel Project Settings → Environment Variables:
- `DATABASE_URL` = pooled URL
- `DIRECT_URL` = direct URL
- `NEXT_PUBLIC_APP_URL` = your production URL (e.g. `https://your-app.vercel.app`)

### 3) Run migrations + seed before/after first deploy
From your local machine (or CI) against the hosted DB:

```bash
npm install
npm run prisma:generate
npm run prisma:migrate:deploy
npm run prisma:seed
```

### 4) Deploy app to Vercel
Deploy normally via Git integration or CLI.

## Demo credentials

Shared password for all seeded users:

- `DemoBank!123`

Examples:

- Customer: `customer1@springbank.demo` → `/dashboard`
- Admin: `admin1@springbank.demo` → `/admin`

## Operational notes

- Transfer approval threshold is configured in `lib/banking/service.ts`.
- Seed data includes historical activity back to 2023 for mature demo realism.
- This is an evaluation environment simulation: no external payment rails are used.

## Optional follow-up (not blocker)

- Add a dedicated production seed command (or make seeding idempotent by environment guard) for CI/CD workflows.
- Add a Vercel build hook/CI step that runs `prisma migrate deploy` automatically before app promotion.
