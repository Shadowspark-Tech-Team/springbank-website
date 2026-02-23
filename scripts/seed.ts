/**
 * @fileoverview Spring Bank – Database Seed Script
 *
 * Creates deterministic demo data for local development and staging environments.
 * Safe to run multiple times: uses upsert/findFirst guards for idempotency.
 *
 * Usage:
 *   cd backend
 *   npx ts-node ../scripts/seed.ts
 *
 * Demo credentials (all share the same password):
 *   admin@springbank.demo    / Spring@2024!  (ADMIN)
 *   staff@springbank.demo    / Spring@2024!  (STAFF)
 *   customer@springbank.demo / Spring@2024!  (CUSTOMER)
 */

import { PrismaClient, UserRole, AccountType, TransactionType, TransactionStatus } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

// ─── Constants ────────────────────────────────────────────────────────────────

const DEMO_PASSWORD = "Spring@2024!";
const BCRYPT_ROUNDS = 12;

const DEMO_USERS = [
  {
    email: "admin@springbank.demo",
    name: "Alice Admin",
    role: UserRole.ADMIN,
  },
  {
    email: "staff@springbank.demo",
    name: "Sam Staff",
    role: UserRole.STAFF,
  },
  {
    email: "customer@springbank.demo",
    name: "Charlie Customer",
    role: UserRole.CUSTOMER,
  },
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(msg: string): void {
  console.log(`  ${msg}`);
}

function section(title: string): void {
  console.log(`\n── ${title} ${"─".repeat(50 - title.length)}`);
}

/** Generate a deterministic-looking account number. */
function generateAccountNumber(seed: number): string {
  const base = String(seed).padStart(10, "0");
  return `${base.slice(0, 4)}-${base.slice(4, 8)}-${base.slice(8)}`;
}

// ─── Seed functions ───────────────────────────────────────────────────────────

async function seedUsers(): Promise<Record<string, { id: string; email: string }>> {
  section("Users");

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_ROUNDS);
  log(`Hashed demo password (bcrypt rounds: ${BCRYPT_ROUNDS})`);

  const createdUsers: Record<string, { id: string; email: string }> = {};

  for (const userData of DEMO_USERS) {
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {
        name: userData.name,
        role: userData.role,
      },
      create: {
        email: userData.email,
        name: userData.name,
        passwordHash,
        role: userData.role,
        isFrozen: false,
        isLocked: false,
        failedLogins: 0,
      },
    });

    createdUsers[userData.role] = { id: user.id, email: user.email };
    log(`✔ ${userData.role}: ${user.email} (id: ${user.id})`);
  }

  return createdUsers;
}

async function seedAccounts(
  customerId: string
): Promise<{ checkingId: string; savingsId: string }> {
  section("Accounts");

  // Use a deterministic seed based on the customer's ID to generate account numbers
  const idNumeric = parseInt(customerId.replace(/-/g, "").slice(0, 10), 16) % 1_000_000_000;

  const checkingAccount = await prisma.account.upsert({
    where: { accountNumber: generateAccountNumber(idNumeric) },
    update: { balanceCents: 2_487_300 }, // $24,873.00 – reset to demo balance
    create: {
      accountNumber: generateAccountNumber(idNumeric),
      type: AccountType.CHECKING,
      balanceCents: 2_487_300, // $24,873.00
      currency: "USD",
      userId: customerId,
    },
  });
  log(`✔ CHECKING  ${checkingAccount.accountNumber}  $${(checkingAccount.balanceCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`);

  const savingsAccount = await prisma.account.upsert({
    where: { accountNumber: generateAccountNumber(idNumeric + 1) },
    update: { balanceCents: 1_520_050 }, // $15,200.50 – reset to demo balance
    create: {
      accountNumber: generateAccountNumber(idNumeric + 1),
      type: AccountType.SAVINGS,
      balanceCents: 1_520_050, // $15,200.50
      currency: "USD",
      userId: customerId,
    },
  });
  log(`✔ SAVINGS   ${savingsAccount.accountNumber}  $${(savingsAccount.balanceCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`);

  return { checkingId: checkingAccount.id, savingsId: savingsAccount.id };
}

async function seedTransactions(
  customerId: string,
  checkingId: string,
  savingsId: string,
  staffId: string
): Promise<void> {
  section("Transactions");

  const now = new Date();

  // Only seed transactions if none exist for this account
  const existingCount = await prisma.transaction.count({
    where: {
      OR: [{ fromAccountId: checkingId }, { toAccountId: checkingId }],
    },
  });

  if (existingCount >= 10) {
    log(`⏭  Transactions already seeded (${existingCount} found) – skipping`);
    return;
  }

  const daysAgo = (d: number): Date => new Date(now.getTime() - d * 86_400_000);

  const transactions = [
    {
      type: TransactionType.DEPOSIT,
      status: TransactionStatus.COMPLETED,
      amountCents: 500_000, // $5,000
      fromAccountId: null,
      toAccountId: checkingId,
      description: "Payroll deposit – Acme Corp",
      initiatedBy: staffId,
      createdAt: daysAgo(30),
    },
    {
      type: TransactionType.INTERNAL_TRANSFER,
      status: TransactionStatus.COMPLETED,
      amountCents: 200_000, // $2,000
      fromAccountId: checkingId,
      toAccountId: savingsId,
      description: "Monthly savings transfer",
      initiatedBy: customerId,
      createdAt: daysAgo(28),
    },
    {
      type: TransactionType.BILL_PAYMENT,
      status: TransactionStatus.COMPLETED,
      amountCents: 12_500, // $125.00
      fromAccountId: checkingId,
      toAccountId: null,
      description: "Electricity bill – City Power",
      reference: "EL-20240115-98765",
      initiatedBy: customerId,
      createdAt: daysAgo(20),
    },
    {
      type: TransactionType.BILL_PAYMENT,
      status: TransactionStatus.COMPLETED,
      amountCents: 8_999, // $89.99
      fromAccountId: checkingId,
      toAccountId: null,
      description: "Internet – FastFiber",
      reference: "FF-INV-2024-0234",
      initiatedBy: customerId,
      createdAt: daysAgo(18),
    },
    {
      type: TransactionType.WITHDRAWAL,
      status: TransactionStatus.COMPLETED,
      amountCents: 30_000, // $300
      fromAccountId: checkingId,
      toAccountId: null,
      description: "ATM withdrawal – Main St Branch",
      initiatedBy: customerId,
      createdAt: daysAgo(15),
    },
    {
      type: TransactionType.EXTERNAL_TRANSFER,
      status: TransactionStatus.COMPLETED,
      amountCents: 150_000, // $1,500
      fromAccountId: checkingId,
      toAccountId: null,
      description: "Rent payment to landlord",
      reference: "ACH-2024-RENT-0042",
      initiatedBy: customerId,
      createdAt: daysAgo(12),
    },
    {
      type: TransactionType.DEPOSIT,
      status: TransactionStatus.COMPLETED,
      amountCents: 50_000, // $500
      fromAccountId: null,
      toAccountId: savingsId,
      description: "Birthday gift deposit",
      initiatedBy: staffId,
      createdAt: daysAgo(10),
    },
    {
      type: TransactionType.INTERNAL_TRANSFER,
      status: TransactionStatus.COMPLETED,
      amountCents: 100_000, // $1,000
      fromAccountId: savingsId,
      toAccountId: checkingId,
      description: "Transfer for car repair",
      initiatedBy: customerId,
      createdAt: daysAgo(7),
    },
    {
      type: TransactionType.BILL_PAYMENT,
      status: TransactionStatus.PENDING,
      amountCents: 25_000, // $250
      fromAccountId: checkingId,
      toAccountId: null,
      description: "Credit card minimum payment",
      reference: "CC-MIN-2024-0556",
      initiatedBy: customerId,
      createdAt: daysAgo(2),
    },
    {
      type: TransactionType.EXTERNAL_TRANSFER,
      status: TransactionStatus.FAILED,
      amountCents: 500_000, // $5,000 – failed (insufficient funds at time)
      fromAccountId: checkingId,
      toAccountId: null,
      description: "Down payment attempt",
      reference: "WIRE-FAILED-0009",
      initiatedBy: customerId,
      createdAt: daysAgo(1),
    },
  ];

  for (const [index, txData] of transactions.entries()) {
    const tx = await prisma.transaction.create({
      data: {
        ...txData,
        currency: "USD",
        reference: txData.reference ?? null,
      },
    });
    log(
      `✔ [${String(index + 1).padStart(2, " ")}] ${tx.type.padEnd(22)} ` +
        `$${(tx.amountCents / 100).toFixed(2).padStart(10)} ` +
        `${tx.status}`
    );
  }
}

async function seedAuditLogs(
  adminId: string,
  customerId: string,
  staffId: string
): Promise<void> {
  section("Audit Logs");

  const existing = await prisma.auditLog.count({
    where: { userId: adminId },
  });

  if (existing > 0) {
    log(`⏭  Audit logs already seeded (${existing} found for admin) – skipping`);
    return;
  }

  const now = new Date();
  const daysAgo = (d: number): Date => new Date(now.getTime() - d * 86_400_000);

  const entries = [
    {
      userId: adminId,
      action: "USER_REGISTERED",
      metadata: { email: "admin@springbank.demo", role: "ADMIN" },
      ipAddress: "127.0.0.1",
      createdAt: daysAgo(60),
    },
    {
      userId: staffId,
      action: "USER_REGISTERED",
      metadata: { email: "staff@springbank.demo", role: "STAFF" },
      ipAddress: "127.0.0.1",
      createdAt: daysAgo(59),
    },
    {
      userId: customerId,
      action: "USER_REGISTERED",
      metadata: { email: "customer@springbank.demo", role: "CUSTOMER" },
      ipAddress: "203.0.113.42",
      createdAt: daysAgo(45),
    },
    {
      userId: customerId,
      action: "USER_LOGIN",
      metadata: { success: true },
      ipAddress: "203.0.113.42",
      createdAt: daysAgo(30),
    },
    {
      userId: customerId,
      action: "USER_LOGIN_FAILED",
      metadata: { reason: "Invalid password", attemptNumber: 1 },
      ipAddress: "198.51.100.7",
      createdAt: daysAgo(14),
    },
    {
      userId: adminId,
      action: "USER_FROZEN",
      metadata: {
        targetUserId: customerId,
        reason: "Suspicious login activity detected",
        previousState: { isFrozen: false },
      },
      ipAddress: "10.0.0.1",
      createdAt: daysAgo(13),
    },
    {
      userId: adminId,
      action: "USER_UNFROZEN",
      metadata: {
        targetUserId: customerId,
        reason: "Identity verified by customer support",
        previousState: { isFrozen: true },
      },
      ipAddress: "10.0.0.1",
      createdAt: daysAgo(12),
    },
    {
      userId: customerId,
      action: "TRANSFER_COMPLETED",
      metadata: { amountCents: 200_000, currency: "USD", type: "INTERNAL_TRANSFER" },
      ipAddress: "203.0.113.42",
      createdAt: daysAgo(7),
    },
  ];

  for (const entry of entries) {
    await prisma.auditLog.create({ data: entry });
    log(`✔ ${entry.action.padEnd(28)} (user: ${entry.userId.slice(0, 8)}...)`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║       Spring Bank – Seed Script          ║");
  console.log("╚══════════════════════════════════════════╝");

  try {
    // 1. Users
    const users = await seedUsers();
    const adminId = users[UserRole.ADMIN].id;
    const staffId = users[UserRole.STAFF].id;
    const customerId = users[UserRole.CUSTOMER].id;

    // 2. Accounts (for customer only)
    const { checkingId, savingsId } = await seedAccounts(customerId);

    // 3. Transactions
    await seedTransactions(customerId, checkingId, savingsId, staffId);

    // 4. Audit logs
    await seedAuditLogs(adminId, customerId, staffId);

    // ── Summary ─────────────────────────────────────────────────────────────
    section("Summary");
    console.log("");
    console.log("  Demo credentials (all passwords: Spring@2024!)");
    console.log("  ─────────────────────────────────────────────────────");
    console.log("  Role      Email");
    console.log("  ADMIN     admin@springbank.demo");
    console.log("  STAFF     staff@springbank.demo");
    console.log("  CUSTOMER  customer@springbank.demo");
    console.log("");
    console.log("  ✅ Seed complete!\n");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("\n❌ Seed failed:", err);
  prisma.$disconnect().finally(() => process.exit(1));
});
