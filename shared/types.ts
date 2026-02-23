/**
 * @fileoverview Shared TypeScript types for Spring Bank.
 *
 * These types are the single source of truth consumed by both the Express
 * backend and the frontend dashboards.  Import from this file rather than
 * duplicating definitions in either layer.
 */

// ─── Enums ───────────────────────────────────────────────────────────────────

/** Roles that can be assigned to a Spring Bank user. */
export enum UserRole {
  /** Full administrative access: manage users, view audit logs, adjust accounts. */
  ADMIN = "ADMIN",
  /** Bank staff: can view all accounts and transactions, assist customers. */
  STAFF = "STAFF",
  /** Regular bank customer: access limited to their own accounts. */
  CUSTOMER = "CUSTOMER",
}

/** Supported account categories. */
export enum AccountType {
  /** Standard day-to-day transactional account. */
  CHECKING = "CHECKING",
  /** Interest-bearing savings account. */
  SAVINGS = "SAVINGS",
  /** Business / commercial account. */
  BUSINESS = "BUSINESS",
}

/** The nature of a ledger transaction. */
export enum TransactionType {
  /** Transfer between two accounts held at Spring Bank. */
  INTERNAL_TRANSFER = "INTERNAL_TRANSFER",
  /** Wire / ACH transfer to an external bank. */
  EXTERNAL_TRANSFER = "EXTERNAL_TRANSFER",
  /** Payment to a registered biller (utility, subscription, etc.). */
  BILL_PAYMENT = "BILL_PAYMENT",
  /** Cash or cheque deposit into an account. */
  DEPOSIT = "DEPOSIT",
  /** Cash withdrawal from an account. */
  WITHDRAWAL = "WITHDRAWAL",
  /** Administrative balance adjustment by bank staff. Recorded as a ledger entry. */
  ADJUSTMENT = "ADJUSTMENT",
}

/** Lifecycle state of a transaction. */
export enum TransactionStatus {
  /** Transaction has been submitted but not yet processed. */
  PENDING = "PENDING",
  /** Transaction has been successfully settled. */
  COMPLETED = "COMPLETED",
  /** Transaction processing failed; funds were not moved. */
  FAILED = "FAILED",
  /** A completed transaction that was subsequently reversed. */
  REVERSED = "REVERSED",
}

/**
 * The direction of a double-entry ledger posting for a single account.
 * Every {@link LedgerEntry} is either a DEBIT (money out) or CREDIT (money in).
 */
export enum LedgerEntryType {
  /** Funds leaving the account (e.g. a transfer or withdrawal). */
  DEBIT = "DEBIT",
  /** Funds entering the account (e.g. a deposit or incoming transfer). */
  CREDIT = "CREDIT",
}

// ─── Core entity interfaces ───────────────────────────────────────────────────

/**
 * Represents a Spring Bank user account.
 * Sensitive fields (passwordHash, etc.) are intentionally excluded from
 * this shared type – they never leave the backend.
 */
export interface User {
  /** UUID primary key. */
  id: string;
  /** Unique email address used as login credential. */
  email: string;
  /** Display name shown in the UI. */
  name: string;
  /** Role governing what the user may access. */
  role: UserRole;
  /** Whether the account has been frozen by an admin (no login or transactions). */
  isFrozen: boolean;
  /** Whether the account has been locked due to too many failed login attempts. */
  isLocked: boolean;
  /** ISO-8601 timestamp of account creation. */
  createdAt: string;
  /** ISO-8601 timestamp of last profile update. */
  updatedAt: string;
}

/**
 * A bank account belonging to a {@link User}.
 */
export interface Account {
  /** UUID primary key. */
  id: string;
  /** Human-readable account number (e.g. "0012-3456-7890"). */
  accountNumber: string;
  /** Category of the account. */
  type: AccountType;
  /** Current balance in the account's minor currency units (cents). */
  balanceCents: number;
  /** ISO 4217 currency code, e.g. "USD". */
  currency: string;
  /** Owner of this account. */
  userId: string;
  /** ISO-8601 timestamp of account opening. */
  createdAt: string;
  /** ISO-8601 timestamp of last balance update. */
  updatedAt: string;
}

/**
 * A double-entry ledger transaction.
 * Every movement of funds creates exactly one Transaction record.
 */
export interface Transaction {
  /** UUID primary key. */
  id: string;
  /** Nature of the transaction. */
  type: TransactionType;
  /** Current lifecycle state. */
  status: TransactionStatus;
  /** Amount moved, in minor currency units (cents). Always positive. */
  amountCents: number;
  /** ISO 4217 currency code. */
  currency: string;
  /** Source account ID (null for inbound deposits). */
  fromAccountId: string | null;
  /** Destination account ID (null for outbound withdrawals/external transfers). */
  toAccountId: string | null;
  /** Human-readable note added by the initiator. */
  description: string | null;
  /** External reference number, biller code, or wire reference. */
  reference: string | null;
  /** ID of the user who initiated the transaction. */
  initiatedBy: string;
  /** ISO-8601 timestamp when the transaction was created. */
  createdAt: string;
  /** ISO-8601 timestamp of the last status update. */
  updatedAt: string;
}

/**
 * A single-account posting in the double-entry ledger.
 * Each {@link Transaction} generates one or two LedgerEntry records:
 * - INTERNAL_TRANSFER → one DEBIT (source) + one CREDIT (destination)
 * - All others → one entry (DEBIT for outflows, CREDIT for inflows)
 */
export interface LedgerEntry {
  /** UUID primary key. */
  id: string;
  /** The transaction that generated this posting. */
  transactionId: string;
  /** The account whose balance was affected. */
  accountId: string;
  /** Direction of the posting. */
  entryType: LedgerEntryType;
  /** Absolute amount posted, in major currency units. Always positive. */
  amount: number;
  /** Account balance immediately after this posting was applied. */
  balanceAfter: number;
  /** ISO-8601 timestamp of the posting. */
  createdAt: string;
}

/**
 * An immutable record of a security- or compliance-relevant action.
 * Created automatically by the backend for all state-changing operations.
 */
export interface AuditLog {
  /** UUID primary key. */
  id: string;
  /** The user who performed the action. */
  userId: string;
  /** Short machine-readable action identifier, e.g. "USER_FROZEN". */
  action: string;
  /** JSON snapshot of relevant before/after state for audit purposes. */
  metadata: Record<string, unknown> | null;
  /** IP address of the request, recorded for security investigations. */
  ipAddress: string | null;
  /** ISO-8601 timestamp of when the action occurred. */
  createdAt: string;
}

// ─── API response wrappers ────────────────────────────────────────────────────

/**
 * Standard envelope for every API response.
 *
 * @template T - The shape of the `data` payload on success.
 *
 * @example
 * // Success
 * { success: true, data: { id: "abc", ... } }
 *
 * // Failure
 * { success: false, error: "Invalid credentials", code: "AUTH_INVALID" }
 */
export interface ApiResponse<T> {
  /** `true` when the request succeeded; `false` on any error. */
  success: boolean;
  /** The response payload. Present only when `success` is `true`. */
  data?: T;
  /** Human-readable error message. Present only when `success` is `false`. */
  error?: string;
  /** Machine-readable error code for programmatic handling. */
  code?: string;
}

/**
 * Pagination metadata returned alongside list endpoints.
 */
export interface PaginationMeta {
  /** Current page number (1-based). */
  page: number;
  /** Maximum items per page. */
  limit: number;
  /** Total number of items across all pages. */
  total: number;
  /** Total number of pages. */
  totalPages: number;
  /** Whether a next page exists. */
  hasNextPage: boolean;
  /** Whether a previous page exists. */
  hasPrevPage: boolean;
}

/**
 * Paginated list response extending {@link ApiResponse}.
 *
 * @template T - The shape of each item in the `data` array.
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  /** Pagination metadata. */
  pagination?: PaginationMeta;
}

/**
 * Payload returned by successful authentication endpoints
 * (`/api/auth/login`, `/api/auth/register`, `/api/auth/refresh`).
 */
export interface AuthResponse {
  /** Short-lived JWT for authenticating API requests (15 min). */
  accessToken: string;
  /** Long-lived opaque token used to obtain a new access token (7 days). */
  refreshToken: string;
  /** The authenticated user's public profile. */
  user: User;
}

// ─── Request body types ───────────────────────────────────────────────────────

/**
 * Request body for `POST /api/transactions/transfer`.
 * Moves funds between two Spring Bank accounts.
 */
export interface TransferRequest {
  /** Source account ID owned by the authenticated user. */
  fromAccountId: string;
  /** Destination account ID (may belong to any user). */
  toAccountId: string;
  /** Amount to transfer in minor currency units (cents). Must be > 0. */
  amountCents: number;
  /** Optional memo visible to both parties. */
  description?: string;
}

/**
 * Request body for `POST /api/transactions/external-transfer`.
 * Initiates a wire or ACH transfer to an external bank.
 */
export interface ExternalTransferRequest {
  /** Source account ID owned by the authenticated user. */
  fromAccountId: string;
  /** Amount in minor currency units (cents). Must be > 0. */
  amountCents: number;
  /** Name of the recipient as it appears at their bank. */
  recipientName: string;
  /** Destination bank routing number. */
  routingNumber: string;
  /** Destination bank account number. */
  externalAccountNumber: string;
  /** Optional note / wire reference. */
  description?: string;
}

/**
 * Request body for `POST /api/transactions/bill-payment`.
 * Pays a registered biller from a customer account.
 */
export interface BillPaymentRequest {
  /** Source account ID owned by the authenticated user. */
  fromAccountId: string;
  /** Unique biller identifier registered in the system. */
  billerId: string;
  /** Customer's account number at the biller (e.g. utility account number). */
  billerAccountNumber: string;
  /** Amount to pay in minor currency units (cents). */
  amountCents: number;
  /** Optional memo. */
  description?: string;
}
