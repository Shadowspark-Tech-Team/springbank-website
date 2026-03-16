import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const SESSION_COOKIE = "springbank_demo_session";

type SessionPayload = {
  userId: string;
  role: "ADMIN" | "CUSTOMER";
  email: string;
};

function toToken(payload: SessionPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function fromToken(token: string): SessionPayload | null {
  try {
    const data = Buffer.from(token, "base64url").toString("utf8");
    return JSON.parse(data) as SessionPayload;
  } catch {
    return null;
  }
}

export async function createSession(payload: SessionPayload) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, toToken(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  return fromToken(raw);
}

export async function requireSession(options?: { role?: "ADMIN" | "CUSTOMER" }) {
  const session = await getSession();
  if (!session) redirect("/signin");
  if (options?.role && session.role !== options.role) redirect("/dashboard");
  return session;
}
