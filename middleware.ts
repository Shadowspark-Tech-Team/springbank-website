import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";

function buildContentSecurityPolicy(nonce: string) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://www.googletagmanager.com https://www.google-analytics.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' https: data:",
    "connect-src 'self' https://www.google-analytics.com https://www.googletagmanager.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ].join("; ");
}

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

function withSecurityHeaders(response: NextResponse, nonce: string, csp: string) {
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("x-nonce", nonce);
  return response;
}

export function middleware(request: NextRequest) {
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const csp = buildContentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);

  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const path = request.nextUrl.pathname;
  const role = decodeRole(request.cookies.get(SESSION_COOKIE)?.value);

  if (path.startsWith("/dashboard") && !role) {
    return withSecurityHeaders(NextResponse.redirect(new URL("/signin", request.url)), nonce, csp);
  }

  if (path.startsWith("/admin")) {
    if (!role) return withSecurityHeaders(NextResponse.redirect(new URL("/signin", request.url)), nonce, csp);
    if (role !== "ADMIN") return withSecurityHeaders(NextResponse.redirect(new URL("/dashboard", request.url)), nonce, csp);
  }

  return withSecurityHeaders(
    NextResponse.next({
      request: {
        headers: requestHeaders
      }
    }),
    nonce,
    csp
  );
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:css|js|map|txt|xml|ico|png|jpg|jpeg|gif|webp|svg)$).*)"]
};
