import { PrismaClient, AccountStatus, AccountType, AuditAction, Role, TransactionStatus, TransactionType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function accountNumber(index: number): string {
  return `7000${String(index).padStart(8, "0")}`;
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

const descriptions = [
  "Payroll deposit",
  "Utilities transfer",
  "Mortgage allocation",
  "Family support transfer",
  "Tuition transfer",
  "Savings contribution",
  "Vendor reimbursement",
  "Travel reimbursement"
];

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("DemoBank!123", 10);

  const admins = await prisma.$transaction([
    prisma.user.create({
      data: {
        email: "admin1@springbank.demo",
        fullName: "Avery Brooks",
        role: Role.ADMIN,
        passwordHash,
        createdAt: new Date("2023-02-12T14:00:00Z")
      }
    }),
    prisma.user.create({
      data: {
        email: "admin2@springbank.demo",
        fullName: "Jordan Patel",
        role: Role.ADMIN,
        passwordHash,
        createdAt: new Date("2023-04-21T09:15:00Z")
      }
    })
  ]);

  const customers = await Promise.all(
    Array.from({ length: 10 }).map((_, i) =>
      prisma.user.create({
        data: {
          email: `customer${i + 1}@springbank.demo`,
          fullName: [
            "Maya Thompson",
            "Diego Alvarez",
            "Elena Kim",
            "Noah Bennett",
            "Priya Singh",
            "Luis Romero",
            "Alicia Flores",
            "Marcus Hall",
            "Fatima Ibrahim",
            "Owen Clarke"
          ][i],
          role: Role.CUSTOMER,
          passwordHash,
          createdAt: daysAgo(980 - i * 30)
        }
      })
    )
  );

  const accounts = [] as Awaited<ReturnType<typeof prisma.account.create>>[];
  let accIndex = 1;
  for (const [i, customer] of customers.entries()) {
    const openedChecking = daysAgo(930 - i * 25);
    const checking = await prisma.account.create({
      data: {
        userId: customer.id,
        accountNumber: accountNumber(accIndex++),
        type: AccountType.CHECKING,
        status: AccountStatus.ACTIVE,
        balance: (4600 + i * 710).toFixed(2),
        createdAt: openedChecking
      }
    });
    accounts.push(checking);

    if (i % 2 === 0) {
      const savings = await prisma.account.create({
        data: {
          userId: customer.id,
          accountNumber: accountNumber(accIndex++),
          type: AccountType.SAVINGS,
          status: i === 8 ? AccountStatus.FROZEN : AccountStatus.ACTIVE,
          balance: (12500 + i * 920).toFixed(2),
          createdAt: daysAgo(860 - i * 20)
        }
      });
      accounts.push(savings);
    }
  }

  const transactions = [];
  for (let i = 0; i < 120; i++) {
    const initiator = customers[i % customers.length];
    const from = accounts[i % accounts.length];
    const to = accounts[(i + 5) % accounts.length];
    const type = TransactionType.TRANSFER;
    const amount = (75 + (i % 9) * 130 + Math.floor(i / 7) * 10).toFixed(2);
    const status =
      i % 17 === 0
        ? TransactionStatus.REJECTED
        : i % 11 === 0
          ? TransactionStatus.PENDING
          : TransactionStatus.POSTED;

    const createdAt = daysAgo(1000 - i * 8);

    const created = await prisma.transaction.create({
      data: {
        reference: `TRX-${String(230000 + i)}`,
        initiatedById: initiator.id,
        fromAccountId: from.id,
        toAccountId: to.id,
        type,
        status,
        amount,
        description: descriptions[i % descriptions.length],
        approvalNote: status === TransactionStatus.REJECTED ? "Rejected during historical review" : null,
        approvedById: status === TransactionStatus.PENDING ? null : admins[i % admins.length].id,
        approvedAt: status === TransactionStatus.PENDING ? null : new Date(createdAt.getTime() + 2 * 3600000),
        createdAt
      }
    });
    transactions.push(created);
  }

  await prisma.auditLog.createMany({
    data: [
      ...admins.map((admin) => ({
        userId: admin.id,
        action: AuditAction.USER_CREATED,
        entityType: "User",
        entityId: admin.id,
        metadata: "Seeded admin account",
        createdAt: daysAgo(950)
      })),
      ...customers.map((customer, index) => ({
        userId: customer.id,
        action: AuditAction.ACCOUNT_CREATED,
        entityType: "Account",
        entityId: customer.id,
        metadata: "Seeded customer profile and default account",
        createdAt: daysAgo(930 - index * 10)
      })),
      ...transactions.slice(0, 20).map((txn, index) => ({
        userId: admins[index % admins.length].id,
        action: txn.status === TransactionStatus.REJECTED ? AuditAction.TRANSACTION_REJECTED : AuditAction.TRANSACTION_APPROVED,
        entityType: "Transaction",
        entityId: txn.id,
        metadata: `Historical seed status ${txn.status}`,
        createdAt: daysAgo(400 - index * 3)
      }))
    ]
  });

  console.log("Seed complete with 2 admins, 10 customers, accounts, and established history since 2023.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
