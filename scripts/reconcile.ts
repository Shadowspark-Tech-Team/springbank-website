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
 *   npx ts-node ../scripts/reconcile.ts          # detect only
 *   npx ts-node ../scripts/reconcile.ts --repair  # detect + repair
 *
 * Exit codes:
 *   0 – all accounts balanced (or all repaired successfully in --repair mode)
 *   1 – one or more discrepancies found (or script error)
 *
 * Environment:
 *   DATABASE_URL – PostgreSQL connection string (required)
 */

import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

// ─── CLI flags ────────────────────────────────────────────────────────────────

const REPAIR_MODE = process.argv.includes('--repair');

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
    }
  }

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

// ─── Repair mode ─────────────────────────────────────────────────────────────

/**
 * Idempotently repairs each discrepant account by setting its stored balance
 * to the value derived from the ledger.  Each repair runs inside its own
 * Prisma transaction with an optimistic-lock check (version field) so
 * concurrent writes don't silently corrupt the repair.
 *
 * A `reconciliation_repair` AuditLog entry is written for every repaired
 * account so the correction is fully traceable.
 */
async function repairDiscrepancies(discrepancies: ReconciliationResult[]): Promise<number> {
  let repaired = 0;

  for (const d of discrepancies) {
    try {
      await prisma.$transaction(async (tx) => {
        // Re-read the account inside the transaction to get the current version.
        const account = await tx.account.findUniqueOrThrow({ where: { id: d.accountId } });

        // If the balance has already been corrected (e.g. by a concurrent repair
        // run), skip this account to keep the operation idempotent.
        if (account.balance.equals(d.computedBalance)) {
          console.log(`  ⏭  ${d.accountNumber} already balanced – skipping`);
          return;
        }

        // Optimistic lock: only update if version hasn't changed since we read it.
        const result = await tx.account.updateMany({
          where: { id: d.accountId, version: account.version },
          data: {
            balance: d.computedBalance,
            version: { increment: 1 },
          },
        });

        if (result.count === 0) {
          throw new Error(
            `Optimistic lock conflict on ${d.accountNumber} – re-run reconcile to verify`,
          );
        }

        // Immutable audit trail for the repair.
        await tx.auditLog.create({
          data: {
            userId: null,
            action: 'reconciliation_repair',
            resource: 'account',
            resourceId: d.accountId,
            details: {
              accountNumber: d.accountNumber,
              previousBalance: d.storedBalance.toFixed(2),
              correctedBalance: d.computedBalance.toFixed(2),
              discrepancy: d.discrepancy.toFixed(2),
              repairedAt: new Date().toISOString(),
            },
          },
        });
      });

      console.log(
        `  ✔ Repaired ${d.accountNumber}: ${fmt(d.storedBalance)} → ${fmt(d.computedBalance)}`,
      );
      repaired++;
    } catch (err) {
      console.error(`  ✖ Failed to repair ${d.accountNumber}: ${String(err)}`);
    }
  }

  return repaired;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log(`║   Spring Bank – Ledger Reconciliation    ║`);
  console.log('╚══════════════════════════════════════════╝');
  console.log(`  Mode    : ${REPAIR_MODE ? '⚠  REPAIR (will modify balances)' : 'detect only'}`);
  console.log(`  Started : ${new Date().toISOString()}`);

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

    if (REPAIR_MODE) {
      section('Repairing discrepancies');
      const repaired = await repairDiscrepancies(discrepancies);
      console.log(`\n  ✅ Repaired ${repaired} / ${discrepancies.length} account(s).\n`);
      if (repaired < discrepancies.length) {
        console.error('  ❌ Some accounts could not be repaired – re-run to verify.\n');
        process.exitCode = 1;
      }
    } else {
      // Persist discrepancies to the audit log for compliance visibility.
      section('Writing audit log entries');
      await writeAuditEntries(discrepancies);
      console.log(`  ✔ Wrote ${discrepancies.length} audit log entry(ies).`);

      console.error('\n  ❌ Reconciliation FAILED – run with --repair to correct.\n');
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error('\n❌ Reconciliation script error:', err);
  prisma.$disconnect().finally(() => process.exit(1));
});
