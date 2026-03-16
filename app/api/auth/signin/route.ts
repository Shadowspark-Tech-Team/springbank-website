import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma/client";
import { createSession } from "@/lib/auth/session";
import { AuditAction } from "@prisma/client";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const password = String(formData.get("password") ?? "");

  const user = await prisma.user.findUnique({ where: { email } });
  const invalidUrl = new URL("/signin?error=1", request.url);

  if (!user || !user.isActive) {
    await prisma.auditLog.create({
      data: {
        action: AuditAction.LOGIN_FAILED,
        entityType: "User",
        metadata: `Failed sign-in for ${email || "unknown"}`
      }
    });
    return NextResponse.redirect(invalidUrl);
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: AuditAction.LOGIN_FAILED,
        entityType: "User",
        entityId: user.id,
        metadata: "Password mismatch"
      }
    });
    return NextResponse.redirect(invalidUrl);
  }

  await createSession({ userId: user.id, role: user.role, email: user.email });
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: AuditAction.LOGIN_SUCCESS,
      entityType: "User",
      entityId: user.id
    }
  });

  const destination = user.role === "ADMIN" ? "/admin" : "/dashboard";
  return NextResponse.redirect(new URL(destination, request.url));
}
