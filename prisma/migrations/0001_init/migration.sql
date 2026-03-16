-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CUSTOMER', 'ADMIN');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('CHECKING', 'SAVINGS');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'FROZEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'TRANSFER');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'POSTED', 'FAILED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM (
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'USER_CREATED',
  'ACCOUNT_CREATED',
  'TRANSACTION_CREATED',
  'TRANSACTION_APPROVED',
  'TRANSACTION_REJECTED',
  'ACCOUNT_FROZEN',
  'ACCOUNT_UNFROZEN'
);

-- CreateTable
CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'CUSTOMER',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "accountNumber" TEXT NOT NULL,
  "type" "AccountType" NOT NULL,
  "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "balance" DECIMAL(14,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
  "id" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "initiatedById" TEXT NOT NULL,
  "fromAccountId" TEXT,
  "toAccountId" TEXT,
  "type" "TransactionType" NOT NULL,
  "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
  "amount" DECIMAL(14,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "description" TEXT,
  "approvalNote" TEXT,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "action" "AuditAction" NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "metadata" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_accountNumber_key" ON "Account"("accountNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_reference_key" ON "Transaction"("reference");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
