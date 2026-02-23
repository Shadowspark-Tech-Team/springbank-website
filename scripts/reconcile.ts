#!/usr/bin/env ts-node
/**
 * @fileoverview Spring Bank – Ledger Reconciliation Script
 *
 * Verifies that every account's stored balance matches the sum of its
 * COMPLETED transactions in the ledger.  Discrepancies indicate either a
 * code bug (balance updated without a transaction) or data corruption.
 *
 * Usage:
 *   cd backend
 *   npx ts-node ../scripts/reconcile.ts
 *
 * Exit codes:
 *   0 – all accounts balanced
 *   1 – one or more discrepancies found (or script error)
 *
 * Environment:
 *   DATABASE_URL – PostgreSQL connection string (required)
 */

import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(d: Decimal): string {
  return `$${d.toFixed(2)}`;
}

function section(title: string): void {
  console.log(`\n── ${title} ${'─'.repeat(50 - title.length)}`);
}

// ─── Core reconciliation ─────────────────────────────────────────────────────

interface ReconciliationResult {
  accountId: string;
  accountNumber: string;
  storedBalance: Decimal;
  computedBalance: Decimal;
  discrepancy: Decimal;
  /** Timestamp when the discrepancy was detected, captured before DB write. */
  detectedAt: Date;
}

async function reconcileAccounts(): Promise<ReconciliationResult[]> {
  const accounts = await prisma.account.findMany({
    orderBy: { accountNumber: 'asc' },
  });

  const discrepancies: ReconciliationResult[] = [];

  for (const account of accounts) {
    // Sum of credits: COMPLETED transactions that deposited into this account.
    const creditAgg = await prisma.transaction.aggregate({
      where: { toAccountId: account.id, status: 'COMPLETED' },
      _sum: { amount: true },
    });

    // Sum of debits: COMPLETED transactions that withdrew from this account.
    const debitAgg = await prisma.transaction.aggregate({
      where: { fromAccountId: account.id, status: 'COMPLETED' },
      _sum: { amount: true },
    });

    const credits = creditAgg._sum.amount ?? new Decimal(0);
    const debits = debitAgg._sum.amount ?? new Decimal(0);

    // Expected balance assuming accounts start at 0 and every balance
    // movement is recorded as a COMPLETED transaction in the ledger.
    // ⚠ Assumption: no out-of-band balance adjustments have occurred and
    // no accounts have non-zero opening balances set outside the ledger.
    // Admin balance adjustments (PATCH /admin/accounts/:id/adjust) are
    // NOT yet recorded as transactions, so they will appear as discrepancies.
    // If legacy or out-of-band data exists, expected discrepancies must be
    // allowlisted before using this script as a hard CI gate.
    const computedBalance = credits.minus(debits);
    const storedBalance = account.balance;
    const discrepancy = storedBalance.minus(computedBalance);

    if (!discrepancy.equals(0)) {
      discrepancies.push({
        accountId: account.id,
        accountNumber: account.accountNumber,
        storedBalance,
        computedBalance,
        discrepancy,
        detectedAt: new Date(), // captured now, before any DB write
      });
    }  }

  return discrepancies;
}

// ─── Audit log persistence ────────────────────────────────────────────────────

async function writeAuditEntries(discrepancies: ReconciliationResult[]): Promise<void> {
  for (const d of discrepancies) {
    await prisma.auditLog.create({
      data: {
        userId: null,
        action: 'reconciliation_discrepancy',
        resource: 'account',
        resourceId: d.accountId,
        details: {
          accountNumber: d.accountNumber,
          storedBalance: d.storedBalance.toFixed(2),
          computedBalance: d.computedBalance.toFixed(2),
          discrepancy: d.discrepancy.toFixed(2),
          detectedAt: d.detectedAt.toISOString(),
        },
      },
    });
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║   Spring Bank – Ledger Reconciliation    ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`  Started at: ${new Date().toISOString()}`);

  try {
    section('Scanning accounts');
    const discrepancies = await reconcileAccounts();

    if (discrepancies.length === 0) {
      console.log('\n  ✅ All accounts balanced – no discrepancies found.\n');
      return;
    }

    section('Discrepancies detected');
    console.log('');
    console.error(`  ⚠  ${discrepancies.length} account(s) have balance discrepancies:\n`);

    for (const d of discrepancies) {
      console.error(`  Account : ${d.accountNumber} (${d.accountId})`);
      console.error(`    Stored   : ${fmt(d.storedBalance)}`);
      console.error(`    Computed : ${fmt(d.computedBalance)}`);
      console.error(`    Delta    : ${fmt(d.discrepancy)}`);
      console.error('');
    }

    // Persist discrepancies to the audit log for compliance visibility.
    section('Writing audit log entries');
    await writeAuditEntries(discrepancies);
    console.log(`  ✔ Wrote ${discrepancies.length} audit log entry(ies).`);

    console.error('\n  ❌ Reconciliation FAILED – see discrepancies above.\n');
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error('\n❌ Reconciliation script error:', err);
  prisma.$disconnect().finally(() => process.exit(1));
});
