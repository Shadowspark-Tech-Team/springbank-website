# Database Schema & ER Diagram

## Table of Contents

1. [Entity-Relationship Diagram](#entity-relationship-diagram)
2. [Table Descriptions](#table-descriptions)
   - [users](#users)
   - [accounts](#accounts)
   - [transactions](#transactions)
   - [audit_logs](#audit_logs)
   - [refresh_tokens](#refresh_tokens)
3. [Indexes & Performance](#indexes--performance)
4. [Migration Strategy](#migration-strategy)
5. [Data Retention Policy](#data-retention-policy)

---

## Entity-Relationship Diagram

```
┌──────────────────────────────────┐
│              users               │
├──────────────────────────────────┤
│ id             UUID  PK          │
│ email          TEXT  UNIQUE      │
│ name           TEXT              │
│ password_hash  TEXT              │
│ role           ENUM              │
│ is_frozen      BOOL  DEFAULT F   │
│ is_locked      BOOL  DEFAULT F   │
│ failed_logins  INT   DEFAULT 0   │
│ created_at     TIMESTAMPTZ       │
│ updated_at     TIMESTAMPTZ       │
└──────────────┬───────────────────┘
               │ 1
               │ has many
               │ N
┌──────────────▼───────────────────┐       ┌──────────────────────────────────┐
│            accounts              │       │           transactions            │
├──────────────────────────────────┤       ├──────────────────────────────────┤
│ id             UUID  PK          │       │ id             UUID  PK          │
│ account_number TEXT  UNIQUE      │  1    │ type           ENUM              │
│ type           ENUM              ├──────►│ status         ENUM              │
│ balance_cents  BIGINT DEFAULT 0  │  N    │ amount_cents   BIGINT            │
│ currency       CHAR(3) DEFAULT   │       │ currency       CHAR(3)           │
│                'USD'             │       │ from_account_id UUID FK NULLABLE │
│ user_id        UUID  FK → users  │  1    │ to_account_id   UUID FK NULLABLE │
│ created_at     TIMESTAMPTZ       ├──────►│ description    TEXT  NULLABLE    │
│ updated_at     TIMESTAMPTZ       │  N    │ reference      TEXT  NULLABLE    │
└──────────────────────────────────┘       │ initiated_by   UUID FK → users  │
                                           │ created_at     TIMESTAMPTZ       │
                                           │ updated_at     TIMESTAMPTZ       │
                                           └──────────────────────────────────┘

┌──────────────────────────────────┐       ┌──────────────────────────────────┐
│           audit_logs             │       │         refresh_tokens           │
├──────────────────────────────────┤       ├──────────────────────────────────┤
│ id          UUID  PK             │       │ id          UUID  PK             │
│ user_id     UUID  FK → users     │       │ user_id     UUID  FK → users     │
│ action      TEXT                 │       │ token_hash  TEXT  UNIQUE         │
│ metadata    JSONB NULLABLE       │       │ expires_at  TIMESTAMPTZ          │
│ ip_address  INET  NULLABLE       │       │ created_at  TIMESTAMPTZ          │
│ created_at  TIMESTAMPTZ          │       │ revoked_at  TIMESTAMPTZ NULLABLE │
└──────────────────────────────────┘       └──────────────────────────────────┘
```

### Relationship summary

| Relationship | Cardinality | FK column |
|---|---|---|
| User → Accounts | 1 : N | `accounts.user_id` |
| Account → Transactions (as source) | 1 : N | `transactions.from_account_id` |
| Account → Transactions (as destination) | 1 : N | `transactions.to_account_id` |
| User → Transactions (initiated) | 1 : N | `transactions.initiated_by` |
| User → AuditLogs | 1 : N | `audit_logs.user_id` |
| User → RefreshTokens | 1 : N | `refresh_tokens.user_id` |

---

## Table Descriptions

### `users`

Stores all registered user accounts.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `UUID` | PK, default `gen_random_uuid()` | Primary key |
| `email` | `TEXT` | NOT NULL, UNIQUE | Login credential; indexed |
| `name` | `TEXT` | NOT NULL | Display name |
| `password_hash` | `TEXT` | NOT NULL | bcrypt hash, cost factor 12 |
| `role` | `user_role` ENUM | NOT NULL, default `CUSTOMER` | `ADMIN \| STAFF \| CUSTOMER` |
| `is_frozen` | `BOOLEAN` | NOT NULL, default `false` | Admin-controlled freeze |
| `is_locked` | `BOOLEAN` | NOT NULL, default `false` | Auto-locked on 5 failed logins |
| `failed_logins` | `INTEGER` | NOT NULL, default `0` | Consecutive failed login counter |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `now()` | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | Auto-updated by Prisma |

**Prisma model:**
```prisma
model User {
  id            String    @id @default(uuid())
  email         String    @unique
  name          String
  passwordHash  String
  role          UserRole  @default(CUSTOMER)
  isFrozen      Boolean   @default(false)
  isLocked      Boolean   @default(false)
  failedLogins  Int       @default(0)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  accounts      Account[]
  transactions  Transaction[] @relation("InitiatedBy")
  auditLogs     AuditLog[]
  refreshTokens RefreshToken[]
}
```

---

### `accounts`

One user may hold multiple accounts of different types.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `UUID` | PK | Primary key |
| `account_number` | `TEXT` | NOT NULL, UNIQUE | Human-readable number (auto-generated) |
| `type` | `account_type` ENUM | NOT NULL | `CHECKING \| SAVINGS \| BUSINESS` |
| `balance_cents` | `BIGINT` | NOT NULL, default `0`, CHECK ≥ 0 | Balance in integer cents |
| `currency` | `CHAR(3)` | NOT NULL, default `'USD'` | ISO 4217 currency code |
| `user_id` | `UUID` | NOT NULL, FK → `users.id` | Account owner |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `now()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | |

> **Note:** `balance_cents` has a CHECK constraint (`balance_cents >= 0`) enforced at the DB level as a safety net in addition to application-level checks.

---

### `transactions`

Immutable ledger records.  Every movement of funds creates exactly one row.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `UUID` | PK | Primary key |
| `type` | `transaction_type` ENUM | NOT NULL | Nature of the transaction |
| `status` | `transaction_status` ENUM | NOT NULL, default `PENDING` | Lifecycle state |
| `amount_cents` | `BIGINT` | NOT NULL, CHECK > 0 | Amount moved (always positive) |
| `currency` | `CHAR(3)` | NOT NULL, default `'USD'` | |
| `from_account_id` | `UUID` | NULLABLE, FK → `accounts.id` | Source account (null for deposits) |
| `to_account_id` | `UUID` | NULLABLE, FK → `accounts.id` | Destination account (null for withdrawals) |
| `description` | `TEXT` | NULLABLE | User-supplied memo |
| `reference` | `TEXT` | NULLABLE | External reference / wire ID |
| `initiated_by` | `UUID` | NOT NULL, FK → `users.id` | User who submitted the request |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `now()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | |

> Transactions are created inside a **database transaction** that atomically updates both account balances, so the ledger is always consistent.

---

### `audit_logs`

Append-only compliance log.  Rows are **never** updated or deleted.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `UUID` | PK | Primary key |
| `user_id` | `UUID` | NOT NULL, FK → `users.id` | Actor (who performed the action) |
| `action` | `TEXT` | NOT NULL | Machine-readable code e.g. `USER_FROZEN` |
| `metadata` | `JSONB` | NULLABLE | Before/after state snapshot |
| `ip_address` | `INET` | NULLABLE | Requester IP for security investigations |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `now()` | |

**Documented action codes:**

| Code | Triggered by |
|------|-------------|
| `USER_REGISTERED` | New account created |
| `USER_LOGIN` | Successful login |
| `USER_LOGIN_FAILED` | Failed login attempt |
| `USER_FROZEN` | Admin froze an account |
| `USER_UNFROZEN` | Admin unfroze an account |
| `USER_LOCKED` | Account auto-locked after failures |
| `USER_UNLOCKED` | Admin unlocked an account |
| `TRANSFER_COMPLETED` | Internal transfer settled |
| `EXTERNAL_TRANSFER_INITIATED` | Wire/ACH submitted |
| `BILL_PAYMENT_COMPLETED` | Bill payment settled |
| `ACCOUNT_ADJUSTED` | Admin balance adjustment |
| `PASSWORD_RESET_REQUESTED` | Reset email sent |

---

### `refresh_tokens`

Stores hashed refresh tokens for rotation and revocation.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `UUID` | PK | Primary key |
| `user_id` | `UUID` | NOT NULL, FK → `users.id` | Token owner |
| `token_hash` | `TEXT` | NOT NULL, UNIQUE | SHA-256 hash of the raw token |
| `expires_at` | `TIMESTAMPTZ` | NOT NULL | Expiry (7 days from issuance) |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `now()` | |
| `revoked_at` | `TIMESTAMPTZ` | NULLABLE | Set when token is used or revoked |

---

## Indexes & Performance

```sql
-- Fast user lookup by email (authentication hot path)
CREATE UNIQUE INDEX idx_users_email ON users(email);

-- Account lookups by owner
CREATE INDEX idx_accounts_user_id ON accounts(user_id);

-- Transaction history, newest first (most common query)
CREATE INDEX idx_transactions_from_account ON transactions(from_account_id, created_at DESC);
CREATE INDEX idx_transactions_to_account   ON transactions(to_account_id,   created_at DESC);

-- Admin: transactions by initiator
CREATE INDEX idx_transactions_initiated_by ON transactions(initiated_by, created_at DESC);

-- Audit log lookups
CREATE INDEX idx_audit_logs_user_id    ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_action     ON audit_logs(action);

-- Refresh token revocation check (hot path during every API request)
CREATE UNIQUE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_user_id     ON refresh_tokens(user_id);
```

### Query patterns to watch

| Query | Expected plan | Mitigation if slow |
|-------|---------------|--------------------|
| Transaction list for account | Index scan on `from/to_account_id, created_at DESC` | Already indexed; add partial index for `status = 'PENDING'` if needed |
| Audit log by date range | Index scan + filter | Add BRIN index on `created_at` for large tables |
| User search (admin) | Seq scan on `name` / `email` | Add `pg_trgm` GIN index for ILIKE queries |

---

## Migration Strategy

Spring Bank uses **Prisma Migrate** for schema management.

### Development workflow

```bash
# Create a new migration after editing schema.prisma
npx prisma migrate dev --name describe_your_change

# Apply pending migrations to a staging / production database
npx prisma migrate deploy

# Reset the dev database (drops all data!)
npx prisma migrate reset
```

### CI/CD workflow

```
┌──────────────────────────────────────────────────────┐
│  GitHub Actions / Deployment pipeline                │
│                                                      │
│  1. npm ci                                           │
│  2. npx prisma generate          (generate client)  │
│  3. npx prisma migrate deploy    (apply migrations)  │
│  4. node dist/server.js          (start app)         │
└──────────────────────────────────────────────────────┘
```

### Rules

- **Never** edit a committed migration file; create a new one.
- Destructive operations (DROP COLUMN, DROP TABLE) require a multi-step migration: first deploy without the column (backward-compatible), then remove it.
- All migrations are reviewed and approved before merging to `main`.

---

## Data Retention Policy

| Table | Retention | Rationale |
|-------|-----------|-----------|
| `users` | Indefinite (soft-delete in future) | Regulatory requirement to retain customer records |
| `accounts` | Indefinite | Account history required for compliance |
| `transactions` | 7 years minimum | Standard financial record-keeping obligation |
| `audit_logs` | 7 years minimum | Security and compliance audit trail |
| `refresh_tokens` | Auto-purge expired > 30 days | No compliance need; prevents table bloat |

### Cleanup job (recommended)

Run a scheduled job weekly to remove expired, revoked refresh tokens:

```sql
DELETE FROM refresh_tokens
WHERE expires_at < NOW() - INTERVAL '30 days';
```

In production, implement this as a Prisma script or a `pg_cron` job on the database host.
