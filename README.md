# Spring Bank – Enterprise Banking Demo

A production-grade online banking system prototype with full authentication, role-based dashboards, a double-entry transaction ledger simulation, and secure API architecture. Designed to demonstrate enterprise-ready patterns for financial applications.

> **Disclaimer:** This is a demonstration project only. It is not a licensed banking platform, does not integrate with real payment networks, and should not be used to process real financial transactions.

---

## Architecture Overview

```
springbank-website/
├── frontend/                   # Static & dashboard UI
│   ├── dashboard.html          # Customer banking dashboard
│   ├── admin-dashboard.html    # Admin management dashboard
│   └── public/assets/          # Self-contained SVG illustrations & icons
│
├── backend/                    # Node.js + TypeScript + Express API
│   ├── src/
│   │   ├── index.ts            # Express server entry point
│   │   ├── middleware/         # auth, security, validation
│   │   ├── routes/             # auth, accounts, transactions, admin
│   │   ├── services/           # authService, ledgerService
│   │   └── types/              # TypeScript type definitions
│   ├── prisma/
│   │   └── schema.prisma       # PostgreSQL schema (Prisma ORM)
│   └── Dockerfile              # Multi-stage production container
│
├── shared/
│   └── types.ts                # Shared TypeScript types (frontend + backend)
│
├── docs/
│   ├── architecture.md         # System architecture overview
│   ├── api.yaml                # OpenAPI 3.0.3 specification
│   ├── database.md             # Database schema & ER diagram
│   ├── security.md             # Security model documentation
│   ├── deployment.md           # Deployment guide (Netlify/Vercel/Docker)
│   └── migration.md            # Migration plan from static to full-stack
│
├── scripts/
│   ├── setup.sh                # One-command project setup
│   └── seed.ts                 # Database seed (demo users + transactions)
│
├── api/                        # Legacy Vercel Serverless Functions
│   ├── contact.js              # Contact form handler
│   ├── newsletter.js           # Newsletter signup
│   ├── stats.js                # Public stats endpoint
│   └── migrate.js              # DB migration runner
│
├── index.html                  # Public marketing homepage
├── business.html               # Business banking page
├── signin.html                 # Sign-in page
├── about.html                  # About page
├── contact.html                # Contact page
├── help.html                   # FAQ & Help Center
├── privacy.html                # Privacy Policy
├── security.html               # Security Policy
├── terms.html                  # Terms of Use
├── .env.example                # Environment variable template
├── netlify.toml                # Netlify deployment config
├── vercel.json                 # Vercel deployment config
└── README.md                   # This file
```

---

## Features

### Authentication System
- **JWT-based auth** — Access tokens (15 min) + refresh tokens (7 days)
- **Role system** — ADMIN, STAFF, CUSTOMER with route-level guards
- **Password security** — bcrypt (12 rounds), complexity enforcement
- **Account lockout** — Auto-lock after 5 failed attempts, admin unlock
- **2FA-ready** — TOTP-compatible structure via `speakeasy`
- **Session timeout** — Auto-logout after 15 minutes of inactivity

### Core Banking Simulation
- **Double-entry ledger** — Every transfer debits source and credits destination atomically
- **Transaction types** — INTERNAL_TRANSFER, EXTERNAL_TRANSFER, BILL_PAYMENT, DEPOSIT, WITHDRAWAL
- **Audit logging** — Every state-changing action recorded with user, IP, and timestamp
- **Account management** — Multiple accounts per user (CHECKING, SAVINGS, BUSINESS)

### Dashboards
- **Customer Dashboard** — Account balances, filterable transaction table, transfer form, session timeout
- **Admin Dashboard** — User management, freeze/unfreeze accounts, lock users, audit log viewer, balance adjustment

### Security Hardening
- **Helmet.js** — Secure HTTP headers (CSP, HSTS, X-Frame-Options, etc.)
- **CORS** — Configurable origin allowlist
- **Rate limiting** — 100 req/15min general, 10 req/15min on auth routes
- **Input validation** — Zod schemas on all API endpoints
- **SQL injection prevention** — Prisma parameterized queries throughout
- **XSS prevention** — `escHtml()` sanitizer on all dynamic DOM writes

### Frontend (Marketing Site)
- **Brand bar** — Personal / Business / Commercial segment switcher
- **Mega-menus** — Hover/click dropdowns for all product categories
- **Hero carousel** — Multi-slide with auto-rotate, touch swipe, keyboard nav, ARIA live region
- **FAQ Accordion** — Keyboard-accessible, ARIA-compliant
- **Sign-in modal** — Focus trap, ESC close, form validation
- **Español page** — Bilingual support with hreflang links
- **WCAG 2.1 AA** — Full keyboard navigation, semantic HTML, color contrast compliance

### Asset Strategy
- **Self-contained SVGs** — All illustrations and icons are custom vectors in `frontend/public/assets/`
- **No external image CDNs** — No Unsplash API, Shutterstock, or unlicensed packs
- **Gradient-based design** — Abstract fintech patterns using CSS and SVG gradients

---

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL (or [Neon](https://neon.tech) free tier)

### 1. Setup

```bash
# Run the setup script (installs deps, copies .env template, generates Prisma client)
chmod +x scripts/setup.sh
./scripts/setup.sh
```

### 2. Configure environment

```bash
# Edit backend/.env with your DATABASE_URL, JWT_SECRET, REFRESH_SECRET
cp .env.example backend/.env
```

### 3. Initialize the database

```bash
cd backend
npx prisma migrate dev --name init
npx ts-node ../scripts/seed.ts   # Creates demo users + sample data
```

### 4. Start the backend

```bash
cd backend
npm run dev
# API running at http://localhost:3001
```

### 5. Open the frontend

Open `index.html` directly in your browser, or serve it with any static file server:

```bash
npx serve .
```

Navigate to `frontend/dashboard.html` for the customer dashboard (demo mode works without a backend).

---

## Demo Credentials

After running the seed script:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@springbank.demo | Spring@2024! |
| Staff | staff@springbank.demo | Spring@2024! |
| Customer | customer@springbank.demo | Spring@2024! |

---

## API Endpoints

See [`docs/api.yaml`](docs/api.yaml) for the full OpenAPI 3.0.3 specification.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register new customer |
| POST | `/api/auth/login` | Authenticate user |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Logout |
| POST | `/api/auth/reset-password` | Request password reset |
| GET | `/api/accounts` | List user's accounts |
| GET | `/api/accounts/:id/transactions` | Paginated transaction history |
| POST | `/api/transactions/transfer` | Internal transfer |
| POST | `/api/transactions/external-transfer` | External wire transfer |
| POST | `/api/transactions/bill-payment` | Pay a bill |
| GET | `/api/admin/users` | Admin: list all users |
| GET | `/api/admin/audit-logs` | Admin: audit log viewer |

---

## Documentation

| Document | Description |
|----------|-------------|
| [`docs/architecture.md`](docs/architecture.md) | System architecture with ASCII diagrams |
| [`docs/api.yaml`](docs/api.yaml) | OpenAPI 3.0.3 spec for all 18 endpoints |
| [`docs/database.md`](docs/database.md) | Database schema, ER diagram, indexes |
| [`docs/security.md`](docs/security.md) | Full security model documentation |
| [`docs/deployment.md`](docs/deployment.md) | Deploy to Netlify, Vercel, Railway, Docker |
| [`docs/migration.md`](docs/migration.md) | 6-phase migration plan from static to full-stack |

---

## Deploy

### Frontend (Netlify)
```bash
netlify deploy --dir=. --prod
```

### Frontend (Vercel)
```bash
vercel --prod
```

### Backend (Docker)
```bash
cd backend
docker build -t springbank-api .
docker run -p 3001:3001 --env-file .env springbank-api
```

### Backend (Railway / Render / Fly.io)
See [`docs/deployment.md`](docs/deployment.md) for step-by-step guides.

---

## Customization

- **Colors:** Edit CSS variables in `styles.css` `:root` block
- **Analytics:** Replace `GA_MEASUREMENT_ID` with your Google Analytics 4 ID
- **Domain:** Update `springbank.com` in `sitemap.xml`, `robots.txt`, and canonical URLs
- **Logo:** Replace `frontend/public/assets/logo.svg` with your own SVG

---

## Browser Support
- Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- Responsive: 320px – 2560px

---

## License
This is a demonstration project. All Spring Bank branding and copy is fictional. All SVG assets are self-contained and created for this project. Do not use for commercial purposes without replacing all placeholder content.
