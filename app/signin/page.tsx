import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

export default async function SignInPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const session = await getSession();
  if (session) redirect(session.role === "ADMIN" ? "/admin" : "/dashboard");

  const hasError = Boolean(resolvedSearchParams?.error);

  return (
    <main className="portal-shell">
      <section className="portal-panel auth-panel">
        <p className="portal-kicker">SpringBank Online Access</p>
        <h1>Sign in securely</h1>
        <p className="portal-muted">Access your SpringBank dashboard and transaction tools in this evaluation environment.</p>
        {hasError && <div className="portal-alert portal-alert--error">Unable to sign in with those credentials.</div>}
        <form method="post" action="/api/auth/signin" className="portal-form-grid" aria-label="Sign in form">
          <label>
            Email
            <input name="email" type="email" required autoComplete="email" />
          </label>
          <label>
            Password
            <input name="password" type="password" required autoComplete="current-password" />
          </label>
          <button type="submit">Sign in</button>
        </form>
      </section>
      <aside className="portal-panel auth-side-panel" aria-label="Demo credential panel">
        <h2>Demo credentials</h2>
        <p>Use seeded users to test customer and admin flows.</p>
        <ul>
          <li><strong>Admin:</strong> admin1@springbank.demo</li>
          <li><strong>Customer:</strong> customer1@springbank.demo</li>
          <li><strong>Password:</strong> DemoBank!123</li>
        </ul>
      </aside>
    </main>
  );
}
