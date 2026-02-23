# Deployment Guide

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development Setup](#local-development-setup)
3. [Environment Variables](#environment-variables)
4. [Database Setup](#database-setup)
5. [Running the Backend](#running-the-backend)
6. [Frontend Deployment](#frontend-deployment)
7. [Backend Deployment](#backend-deployment)
8. [Docker Deployment](#docker-deployment)
9. [Connecting Frontend to Backend](#connecting-frontend-to-backend)
10. [Health Checks](#health-checks)
11. [Monitoring Recommendations](#monitoring-recommendations)
12. [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Tool | Required version | Install |
|------|-----------------|---------|
| Node.js | ≥ 18 LTS | https://nodejs.org or `nvm install 18` |
| npm | ≥ 9 (bundled with Node 18) | Bundled with Node.js |
| Git | Any recent version | https://git-scm.com |
| PostgreSQL | ≥ 14 (local) or a managed service | See [Database Setup](#database-setup) |

Verify your setup:

```bash
node --version   # must print v18.x.x or higher
npm --version    # must print 9.x.x or higher
git --version
```

---

## Local Development Setup

### 1. Clone the repository

```bash
git clone https://github.com/your-org/springbank-website.git
cd springbank-website
```

### 2. Run the automated setup script

```bash
chmod +x scripts/setup.sh
./scripts/setup.sh
```

This script:
- Verifies Node ≥ 18
- Installs backend dependencies (`npm install` inside `backend/`)
- Copies `.env.example` → `.env` if `.env` doesn't exist
- Runs `prisma generate`

### 3. Manual setup (if you prefer)

```bash
# Install backend dependencies
cd backend
npm install

# Copy environment template
cp ../.env.example .env
# Edit .env and fill in your DATABASE_URL, JWT_SECRET, REFRESH_SECRET
```

---

## Environment Variables

Copy `.env.example` to `.env` in the project root and fill in each value:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | 64-byte random hex string for signing access tokens |
| `REFRESH_SECRET` | ✅ | 64-byte random hex string for signing refresh tokens |
| `PORT` | Optional | API server port (default: `3001`) |
| `NODE_ENV` | Optional | `development` or `production` |
| `CORS_ORIGIN` | Optional | Allowed frontend origin(s), comma-separated |
| `RESEND_API_KEY` | Optional | Resend.com API key for password reset emails |
| `RESEND_FROM_EMAIL` | Optional | Sender address for system emails |
| `CONTACT_TO_EMAIL` | Optional | Recipient for contact form submissions |

Generate strong secrets:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Database Setup

### Option A – Neon (recommended, free tier)

1. Sign up at https://neon.tech
2. Create a new project named `springbank`
3. Copy the connection string from the dashboard
4. Paste it as `DATABASE_URL` in your `.env`:

```
DATABASE_URL=postgresql://user:password@ep-cool-forest-123456.us-east-2.aws.neon.tech/springbank?sslmode=require
```

### Option B – Supabase (free tier)

1. Sign up at https://supabase.com
2. Create a project, navigate to **Settings → Database**
3. Copy the "Connection string" (URI format)
4. Set `DATABASE_URL` accordingly

### Option C – Local PostgreSQL

```bash
# macOS (Homebrew)
brew install postgresql@15
brew services start postgresql@15
createdb springbank

# Ubuntu/Debian
sudo apt install postgresql-15
sudo -u postgres createdb springbank

# Connection string for local:
DATABASE_URL=postgresql://postgres:@localhost:5432/springbank
```

### Apply migrations

```bash
cd backend
npx prisma migrate deploy   # apply migrations to target DB
npx prisma generate          # regenerate Prisma client
```

### Seed demo data

```bash
cd backend
npx ts-node ../scripts/seed.ts
```

This creates:
- `admin@springbank.demo` / `Spring@2024!` (Admin)
- `staff@springbank.demo` / `Spring@2024!` (Staff)
- `customer@springbank.demo` / `Spring@2024!` (Customer, 2 accounts, 10 transactions)

---

## Running the Backend

### Development (hot reload)

```bash
cd backend
npm run dev
# Server starts at http://localhost:3001
# Watches for TypeScript changes via ts-node-dev / nodemon
```

### Production build

```bash
cd backend
npm run build    # tsc → dist/
npm start        # node dist/server.js
```

### Verify the server is running

```bash
curl http://localhost:3001/health
# Expected: {"status":"ok","timestamp":"..."}
```

---

## Frontend Deployment

The frontend is a collection of static HTML/CSS/JS files and can be deployed to any
static hosting service with zero configuration.

### Netlify

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start)

1. Push the repo to GitHub.
2. In Netlify: **New site from Git** → select your repo.
3. Build settings:
   - **Build command:** *(leave blank – no build step)*
   - **Publish directory:** `/` (or `frontend/` if serving dashboards only)
4. Add environment variable in Netlify UI: `VITE_API_URL=https://your-backend.onrender.com`
5. The `netlify.toml` in this repo configures redirects and headers automatically.

### Vercel

1. Install Vercel CLI: `npm i -g vercel`
2. From the repo root: `vercel deploy`
3. Set `VITE_API_URL` in the Vercel project settings.
4. The `vercel.json` in this repo handles routing.

### Custom / self-hosted

Serve the static files with any web server (nginx, Caddy, Apache):

```nginx
server {
    listen 80;
    server_name springbank.demo;
    root /var/www/springbank;
    index index.html;
    try_files $uri $uri/ /index.html;
}
```

---

## Backend Deployment

### Railway (recommended, generous free tier)

1. Push the repo to GitHub.
2. Go to https://railway.app → **New Project → Deploy from GitHub**.
3. Select the repo. Railway auto-detects Node.js.
4. Add environment variables in the Railway dashboard.
5. Set the start command to `cd backend && npm start` (or use the Dockerfile).
6. Railway provides a public HTTPS URL automatically.

### Render

1. Go to https://render.com → **New → Web Service**.
2. Connect your GitHub repo.
3. Settings:
   - **Root directory:** `backend`
   - **Build command:** `npm ci && npm run build && npx prisma generate`
   - **Start command:** `node dist/server.js`
4. Add environment variables in the Render dashboard.
5. Under **Advanced**, add `DATABASE_URL` and run `npx prisma migrate deploy` as a pre-deploy command.

### Fly.io

```bash
# Install flyctl: https://fly.io/docs/hands-on/install-flyctl/
fly auth login

cd backend
fly launch              # creates fly.toml and provisions app
fly secrets set JWT_SECRET="..." REFRESH_SECRET="..." DATABASE_URL="..."
fly deploy              # builds and deploys using backend/Dockerfile
```

---

## Docker Deployment

The `backend/Dockerfile` uses a multi-stage build for a minimal production image.

### Build and run locally

```bash
cd backend
docker build -t springbank-api .

docker run -d \
  --name springbank-api \
  -p 3001:3001 \
  -e DATABASE_URL="postgresql://..." \
  -e JWT_SECRET="..." \
  -e REFRESH_SECRET="..." \
  -e NODE_ENV=production \
  springbank-api
```

### docker-compose (backend + PostgreSQL)

```yaml
version: "3.9"
services:
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: springbank
      POSTGRES_USER: springbank
      POSTGRES_PASSWORD: secret
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U springbank"]
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    build: ./backend
    ports:
      - "3001:3001"
    depends_on:
      db:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://springbank:secret@db:5432/springbank
      JWT_SECRET: ${JWT_SECRET}
      REFRESH_SECRET: ${REFRESH_SECRET}
      NODE_ENV: production
      PORT: 3001

volumes:
  pgdata:
```

```bash
# Start services
docker compose up -d

# Apply migrations
docker compose exec api npx prisma migrate deploy

# Seed data
docker compose exec api npx ts-node /app/scripts/seed.ts
```

---

## Connecting Frontend to Backend

The frontend reads the API base URL from a configuration variable. Set it before deploying:

### Netlify / Vercel

Add `VITE_API_URL` environment variable in the hosting dashboard:

```
VITE_API_URL=https://springbank-api.onrender.com
```

### Manual configuration

Edit `frontend/js/config.js` (or wherever the API URL is defined):

```js
export const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001";
```

### CORS configuration

Ensure the backend's `CORS_ORIGIN` includes your frontend URL:

```
CORS_ORIGIN=https://springbank.netlify.app
```

---

## Health Checks

The API exposes a health endpoint:

```
GET /health
→ 200 { "status": "ok", "timestamp": "2024-01-15T10:30:00.000Z", "uptime": 3600 }
```

Use this for:
- **Container health checks** – configured in `backend/Dockerfile`
- **Load balancer health checks** – set the path to `/health`
- **Uptime monitoring** – see [Monitoring](#monitoring-recommendations)

Database connectivity is verified separately:

```
GET /health/db
→ 200 { "status": "ok", "database": "connected" }
→ 503 { "status": "error", "database": "disconnected" }
```

---

## Monitoring Recommendations

| Tool | Purpose | Free tier |
|------|---------|-----------|
| [Better Uptime](https://betteruptime.com) | Uptime monitoring + alerting | Yes |
| [Sentry](https://sentry.io) | Error tracking + performance | Yes (5k errors/month) |
| [Logtail](https://logtail.com) | Structured log management | Yes (1 GB/month) |
| [Neon dashboard](https://neon.tech) | DB query analytics | Built-in |
| [Railway metrics](https://railway.app) | Container CPU/memory/latency | Built-in |

### Recommended alerts

- API error rate > 1% over 5 minutes
- P95 response time > 2 seconds
- `/health` endpoint returns non-200
- Database connection pool exhausted

---

## Troubleshooting

### `DATABASE_URL` connection refused

```
Error: Can't reach database server at localhost:5432
```

- Verify PostgreSQL is running: `pg_isready -h localhost -p 5432`
- Check the `DATABASE_URL` value in `.env`
- For Neon/Supabase: ensure `?sslmode=require` is appended to the connection string

### Prisma client not generated

```
Error: @prisma/client did not initialize yet.
```

```bash
cd backend
npx prisma generate
```

### JWT errors (`invalid signature`, `jwt expired`)

- Ensure `JWT_SECRET` in `.env` matches what the server started with
- Access tokens expire in 15 minutes – the frontend should refresh automatically
- If tokens are consistently invalid after a deploy, the secret may have changed; users must re-login

### CORS errors in browser (`blocked by CORS policy`)

- Verify `CORS_ORIGIN` in the backend `.env` exactly matches the frontend origin (including protocol and no trailing slash)
- Example: `CORS_ORIGIN=https://springbank.netlify.app`

### `prisma migrate deploy` fails on first deploy

```
Error: Migration engine error: column "..." of relation "..." already exists
```

- This usually means a previous partial migration; run `npx prisma migrate resolve --applied <migration_name>` to mark it as applied without re-running it

### Port already in use

```
Error: listen EADDRINUSE: address already in use :::3001
```

```bash
lsof -ti:3001 | xargs kill -9
# or change PORT in .env
```

### TypeScript compilation errors after pulling changes

```bash
cd backend
npm run build
```

If there are type errors in `shared/types.ts`, ensure the TypeScript version in `backend/package.json` matches what the shared types require (≥ 5.0).
