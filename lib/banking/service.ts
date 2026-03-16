import { AccountStatus, AuditAction, Prisma, Role, TransactionStatus, TransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma/client";

export const TRANSFER_APPROVAL_THRESHOLD = new Prisma.Decimal(10000);

export function maskAccountNumber(accountNumber: string): string {
  return `••••${accountNumber.slice(-4)}`;
}

export function formatCurrency(amount: Prisma.Decimal | number | string): string {
  const value = new Prisma.Decimal(amount).toNumber();
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export async function getDashboardData(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      accounts: { orderBy: { createdAt: "asc" } }
    }
  });

  if (!user) return null;

  const txns = await prisma.transaction.findMany({
    where: {
      OR: [{ initiatedById: userId }, { fromAccount: { userId } }, { toAccount: { userId } }]
    },
    include: {
      fromAccount: { select: { accountNumber: true, userId: true } },
      toAccount: { select: { accountNumber: true, userId: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 20
  });

  return { user, txns };
}

type TransferInput = {
  initiatedById: string;
  fromAccountId: string;
  destinationAccountNumber: string;
  amount: string;
  description?: string;
};

export async function createTransfer(input: TransferInput) {
  const amount = new Prisma.Decimal(input.amount || "0");
  if (amount.lte(0)) return { ok: false as const, error: "Amount must be greater than $0.00." };

  return prisma.$transaction(async (tx) => {
    const initiator = await tx.user.findUnique({ where: { id: input.initiatedById } });
    if (!initiator || initiator.role !== Role.CUSTOMER) return { ok: false as const, error: "Unable to create transfer." };

    const fromAccount = await tx.account.findUnique({ where: { id: input.fromAccountId } });
    const toAccount = await tx.account.findUnique({ where: { accountNumber: input.destinationAccountNumber } });

    if (!fromAccount || fromAccount.userId !== input.initiatedById) return { ok: false as const, error: "Invalid source account." };
    if (!toAccount) return { ok: false as const, error: "Destination account was not found." };
    if (fromAccount.id === toAccount.id) return { ok: false as const, error: "Choose a different destination account." };

    if (fromAccount.status !== AccountStatus.ACTIVE || toAccount.status !== AccountStatus.ACTIVE) {
      return { ok: false as const, error: "Transfers are blocked for frozen or closed accounts." };
    }

    if (fromAccount.balance.lt(amount)) {
      return { ok: false as const, error: "Insufficient funds for this transfer." };
    }

    const requiresApproval = amount.gte(TRANSFER_APPROVAL_THRESHOLD);
    const created = await tx.transaction.create({
      data: {
        reference: `TRF-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`,
        initiatedById: input.initiatedById,
        fromAccountId: fromAccount.id,
        toAccountId: toAccount.id,
        type: TransactionType.TRANSFER,
        status: requiresApproval ? TransactionStatus.PENDING : TransactionStatus.POSTED,
        amount,
        description: input.description?.trim() || `Transfer to ${maskAccountNumber(toAccount.accountNumber)}`
      }
    });

    if (!requiresApproval) {
      await tx.account.update({ where: { id: fromAccount.id }, data: { balance: fromAccount.balance.sub(amount) } });
      await tx.account.update({ where: { id: toAccount.id }, data: { balance: toAccount.balance.add(amount) } });
    }

    await tx.auditLog.create({
      data: {
        userId: input.initiatedById,
        action: AuditAction.TRANSACTION_CREATED,
        entityType: "Transaction",
        entityId: created.id,
        metadata: requiresApproval ? "Transfer pending admin approval" : "Transfer posted"
      }
    });

    return {
      ok: true as const,
      status: requiresApproval ? "pending" : "posted",
      message: requiresApproval
        ? "Transfer submitted for admin approval."
        : "Transfer posted successfully.",
      transactionId: created.id
    };
  });
}

export async function getAdminApprovalData() {
  const [pending, recent] = await Promise.all([
    prisma.transaction.findMany({
      where: { status: TransactionStatus.PENDING, type: TransactionType.TRANSFER },
      include: {
        initiatedBy: { select: { fullName: true, email: true } },
        fromAccount: { select: { accountNumber: true } },
        toAccount: { select: { accountNumber: true } }
      },
      orderBy: { createdAt: "asc" }
    }),
    prisma.transaction.findMany({
      where: { status: { in: [TransactionStatus.REJECTED, TransactionStatus.POSTED, TransactionStatus.APPROVED] } },
      include: {
        initiatedBy: { select: { fullName: true } },
        approvedBy: { select: { fullName: true } },
        fromAccount: { select: { accountNumber: true } },
        toAccount: { select: { accountNumber: true } }
      },
      orderBy: { updatedAt: "desc" },
      take: 25
    })
  ]);

  return { pending, recent };
}

export async function reviewPendingTransfer(params: {
  transactionId: string;
  adminUserId: string;
  decision: "approve" | "reject";
  note?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const admin = await tx.user.findUnique({ where: { id: params.adminUserId } });
    if (!admin || admin.role !== Role.ADMIN) return { ok: false as const, error: "Unauthorized." };

    const transfer = await tx.transaction.findUnique({ where: { id: params.transactionId } });
    if (!transfer || transfer.status !== TransactionStatus.PENDING) {
      return { ok: false as const, error: "Transfer no longer pending." };
    }

    if (params.decision === "reject") {
      await tx.transaction.update({
        where: { id: transfer.id },
        data: {
          status: TransactionStatus.REJECTED,
          approvedById: admin.id,
          approvedAt: new Date(),
          approvalNote: params.note?.trim() || "Rejected by admin"
        }
      });
      await tx.auditLog.create({
        data: {
          userId: admin.id,
          action: AuditAction.TRANSACTION_REJECTED,
          entityType: "Transaction",
          entityId: transfer.id,
          metadata: params.note?.trim() || null
        }
      });
      return { ok: true as const, message: "Transfer rejected." };
    }

    if (!transfer.fromAccountId || !transfer.toAccountId) {
      return { ok: false as const, error: "Pending transfer is missing account details." };
    }

    const fromAccount = await tx.account.findUnique({ where: { id: transfer.fromAccountId } });
    const toAccount = await tx.account.findUnique({ where: { id: transfer.toAccountId } });

    if (!fromAccount || !toAccount) return { ok: false as const, error: "Transfer accounts could not be found." };
    if (fromAccount.status !== AccountStatus.ACTIVE || toAccount.status !== AccountStatus.ACTIVE) {
      return { ok: false as const, error: "Cannot approve transfer with frozen or closed accounts." };
    }
    if (fromAccount.balance.lt(transfer.amount)) {
      return { ok: false as const, error: "Insufficient funds at approval time. Transfer must be rejected." };
    }

    await tx.account.update({ where: { id: fromAccount.id }, data: { balance: fromAccount.balance.sub(transfer.amount) } });
    await tx.account.update({ where: { id: toAccount.id }, data: { balance: toAccount.balance.add(transfer.amount) } });

    await tx.transaction.update({
      where: { id: transfer.id },
      data: {
        status: TransactionStatus.POSTED,
        approvedById: admin.id,
        approvedAt: new Date(),
        approvalNote: params.note?.trim() || "Approved and posted"
      }
    });

    await tx.auditLog.create({
      data: {
        userId: admin.id,
        action: AuditAction.TRANSACTION_APPROVED,
        entityType: "Transaction",
        entityId: transfer.id,
        metadata: params.note?.trim() || null
      }
    });

    return { ok: true as const, message: "Transfer approved and posted." };
  });
}
