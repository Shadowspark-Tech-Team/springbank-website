import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { reviewPendingTransfer } from "@/lib/banking/service";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/signin", request.url));
  if (session.role !== "ADMIN") return NextResponse.redirect(new URL("/dashboard", request.url));

  const formData = await request.formData();
  const decisionValue = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "");

  if (decisionValue !== "approve" && decisionValue !== "reject") {
    const invalid = new URL("/admin", request.url);
    invalid.searchParams.set("error", "Invalid action.");
    return NextResponse.redirect(invalid);
  }

  const result = await reviewPendingTransfer({
    transactionId: params.id,
    adminUserId: session.userId,
    decision: decisionValue,
    note
  });

  const redirectUrl = new URL("/admin", request.url);
  if (!result.ok) {
    redirectUrl.searchParams.set("error", result.error);
  } else {
    redirectUrl.searchParams.set("success", result.message);
  }

  return NextResponse.redirect(redirectUrl);
}
