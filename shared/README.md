# shared/

This package contains **TypeScript types that are shared between the Spring Bank frontend and backend**. Keeping them here in one place ensures both layers stay in sync and eliminates type duplication.

## Contents

| File | Purpose |
|------|---------|
| `types.ts` | Enums, entity interfaces, API response wrappers, and request body types |

## Usage

### From the backend (TypeScript)

```ts
import { User, UserRole, ApiResponse } from "../shared/types";
```

### From the frontend

```ts
import type { Account, Transaction, AuthResponse } from "../../shared/types";
```

## Types at a glance

### Enums
- `UserRole` – `ADMIN | STAFF | CUSTOMER`
- `AccountType` – `CHECKING | SAVINGS | BUSINESS`
- `TransactionType` – `INTERNAL_TRANSFER | EXTERNAL_TRANSFER | BILL_PAYMENT | DEPOSIT | WITHDRAWAL`
- `TransactionStatus` – `PENDING | COMPLETED | FAILED | REVERSED`

### Entity interfaces
- `User` – public user profile (no password hash)
- `Account` – bank account with balance in cents
- `Transaction` – double-entry ledger record
- `AuditLog` – immutable compliance/security log entry

### API response types
- `ApiResponse<T>` – standard success/error envelope
- `PaginatedResponse<T>` – list response with pagination metadata
- `PaginationMeta` – page/limit/total fields
- `AuthResponse` – access token + refresh token + user

### Request body types
- `TransferRequest` – internal account-to-account transfer
- `ExternalTransferRequest` – wire/ACH to external bank
- `BillPaymentRequest` – payment to a registered biller

## Guidelines

- **Do not** add backend-only types here (e.g. Prisma models, raw DB rows).
- **Do not** add frontend-only types here (e.g. React component props).
- All monetary amounts use **integer cents** to avoid floating-point rounding errors.
- Timestamps are **ISO-8601 strings** so they serialise cleanly over JSON.
