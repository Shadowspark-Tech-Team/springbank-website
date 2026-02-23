"use strict";
/**
 * @fileoverview Shared TypeScript types for Spring Bank.
 *
 * These types are the single source of truth consumed by both the Express
 * backend and the frontend dashboards.  Import from this file rather than
 * duplicating definitions in either layer.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LedgerEntryType = exports.TransactionStatus = exports.TransactionType = exports.AccountType = exports.UserRole = void 0;
// ─── Enums ───────────────────────────────────────────────────────────────────
/** Roles that can be assigned to a Spring Bank user. */
var UserRole;
(function (UserRole) {
    /** Full administrative access: manage users, view audit logs, adjust accounts. */
    UserRole["ADMIN"] = "ADMIN";
    /** Bank staff: can view all accounts and transactions, assist customers. */
    UserRole["STAFF"] = "STAFF";
    /** Regular bank customer: access limited to their own accounts. */
    UserRole["CUSTOMER"] = "CUSTOMER";
})(UserRole || (exports.UserRole = UserRole = {}));
/** Supported account categories. */
var AccountType;
(function (AccountType) {
    /** Standard day-to-day transactional account. */
    AccountType["CHECKING"] = "CHECKING";
    /** Interest-bearing savings account. */
    AccountType["SAVINGS"] = "SAVINGS";
    /** Business / commercial account. */
    AccountType["BUSINESS"] = "BUSINESS";
})(AccountType || (exports.AccountType = AccountType = {}));
/** The nature of a ledger transaction. */
var TransactionType;
(function (TransactionType) {
    /** Transfer between two accounts held at Spring Bank. */
    TransactionType["INTERNAL_TRANSFER"] = "INTERNAL_TRANSFER";
    /** Wire / ACH transfer to an external bank. */
    TransactionType["EXTERNAL_TRANSFER"] = "EXTERNAL_TRANSFER";
    /** Payment to a registered biller (utility, subscription, etc.). */
    TransactionType["BILL_PAYMENT"] = "BILL_PAYMENT";
    /** Cash or cheque deposit into an account. */
    TransactionType["DEPOSIT"] = "DEPOSIT";
    /** Cash withdrawal from an account. */
    TransactionType["WITHDRAWAL"] = "WITHDRAWAL";
    /** Administrative balance adjustment by bank staff. Recorded as a ledger entry. */
    TransactionType["ADJUSTMENT"] = "ADJUSTMENT";
})(TransactionType || (exports.TransactionType = TransactionType = {}));
/** Lifecycle state of a transaction. */
var TransactionStatus;
(function (TransactionStatus) {
    /** Transaction has been submitted but not yet processed. */
    TransactionStatus["PENDING"] = "PENDING";
    /** Transaction has been successfully settled. */
    TransactionStatus["COMPLETED"] = "COMPLETED";
    /** Transaction processing failed; funds were not moved. */
    TransactionStatus["FAILED"] = "FAILED";
    /** A completed transaction that was subsequently reversed. */
    TransactionStatus["REVERSED"] = "REVERSED";
})(TransactionStatus || (exports.TransactionStatus = TransactionStatus = {}));
/**
 * The direction of a double-entry ledger posting for a single account.
 * Every {@link LedgerEntry} is either a DEBIT (money out) or CREDIT (money in).
 */
var LedgerEntryType;
(function (LedgerEntryType) {
    /** Funds leaving the account (e.g. a transfer or withdrawal). */
    LedgerEntryType["DEBIT"] = "DEBIT";
    /** Funds entering the account (e.g. a deposit or incoming transfer). */
    LedgerEntryType["CREDIT"] = "CREDIT";
})(LedgerEntryType || (exports.LedgerEntryType = LedgerEntryType = {}));
