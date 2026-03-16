import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createTransfer } from "@/lib/banking/service";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/signin", request.url));

  const formData = await request.formData();
  const fromAccountId = String(formData.get("fromAccountId") ?? "");
  const destinationAccountNumber = String(formData.get("destinationAccountNumber") ?? "").trim();
  const amount = String(formData.get("amount") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  const result = await createTransfer({
    initiatedById: session.userId,
    fromAccountId,
    destinationAccountNumber,
    amount,
    description
  });

  const redirectUrl = new URL("/dashboard", request.url);
  if (!result.ok) {
    redirectUrl.searchParams.set("error", result.error);
  } else {
    redirectUrl.searchParams.set("success", result.message);
  }

  return NextResponse.redirect(redirectUrl);
}
