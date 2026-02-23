#!/usr/bin/env ts-node
/**
 * @fileoverview Spring Bank – Idempotency Key Cleanup Script
 *
 * Nullifies idempotency fields on Transaction rows whose idempotency window
 * has expired (`idempotencyExpiresAt < now`).  Expired rows are safe to clean
 *
 *   - The idempotency window for the original request has already closed.
 *   - `checkIdempotency()` in ledgerService already treats them as non-existent.
 *   - Removing them prevents unbounded index and storage growth on the
 *     `idempotencyExpiresAt` column.
 *
 * The deletion uses the `@@index([idempotencyExpiresAt])` index on the
 * Transaction table for an efficient range scan instead of a full-table scan.
 *
 * IMPORTANT: only rows where `idempotencyKey IS NOT NULL` carry idempotency
 * data; rows without a key are never touched by this script.
 *
 * Usage:
 *   cd backend
 *   npx ts-node ../scripts/cleanup-idempotency.ts
 *
 * Recommended schedule: nightly cron (e.g. 02:00 UTC).
 *
 * Exit codes:
 *   0 – completed successfully (deleted N records, even if 0)
 *   1 – script error
 *
 * Environment:
 *   DATABASE_URL – PostgreSQL connection string (required)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const now = new Date();

  console.log('\n╔═════════════════════════════════════════════╗');
  console.log('║  Spring Bank – Idempotency Key Cleanup      ║');
  console.log('╚═════════════════════════════════════════════╝');
  console.log(`  Started : ${now.toISOString()}`);

  // Count before deletion so we can report the number of records cleaned up.
  // Both WHERE clauses use the index on idempotencyExpiresAt to avoid a
  // full-table scan.
  const expiredCount = await prisma.transaction.count({
    where: {
      idempotencyKey: { not: null },
      idempotencyExpiresAt: { lt: now },
    },
  });

  if (expiredCount === 0) {
    console.log('\n  ✅ No expired idempotency records found. Nothing to clean up.\n');
    return;
  }

  console.log(`\n  Found ${expiredCount} expired idempotency record(s). Deleting…`);

  // We only null-out the idempotency fields rather than deleting the Transaction
  // row itself, because the transaction record (amount, reference, audit trail)
  // is still needed for financial history and reconciliation.
  //
  // Nullifying the idempotency fields:
  //   - Frees the @unique index slot on idempotencyKey (allows key reuse after TTL)
  //   - Removes the idempotencyExpiresAt value so future range scans skip this row
  //   - Preserves the financial record (reference, amount, status, audit log link)
  const result = await prisma.transaction.updateMany({
    where: {
      idempotencyKey: { not: null },
      idempotencyExpiresAt: { lt: now },
    },
    data: {
      idempotencyKey: null,
      idempotencyPayloadHash: null,
      idempotencyExpiresAt: null,
    },
  });

  console.log(`  ✔ Cleared idempotency data from ${result.count} record(s).`);
  console.log(`  Finished: ${new Date().toISOString()}\n`);
}

main()
  .catch((err: unknown) => {
    console.error('\n❌ Idempotency cleanup error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
