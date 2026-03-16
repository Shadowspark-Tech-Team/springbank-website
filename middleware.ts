import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";

function decodeRole(value: string | undefined): "ADMIN" | "CUSTOMER" | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as {
      role?: "ADMIN" | "CUSTOMER";
    };
    return parsed.role ?? null;
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const role = decodeRole(request.cookies.get(SESSION_COOKIE)?.value);

  if (path.startsWith("/dashboard") && !role) {
    return NextResponse.redirect(new URL("/signin", request.url));
  }

  if (path.startsWith("/admin")) {
    if (!role) return NextResponse.redirect(new URL("/signin", request.url));
    if (role !== "ADMIN") return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"]
};
