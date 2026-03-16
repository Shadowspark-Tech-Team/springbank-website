import { requireSession } from "@/lib/auth/session";
import { formatCurrency, getDashboardData, maskAccountNumber } from "@/lib/banking/service";

const statusTone: Record<string, string> = {
  POSTED: "portal-pill portal-pill--success",
  PENDING: "portal-pill portal-pill--warning",
  REJECTED: "portal-pill portal-pill--danger",
  APPROVED: "portal-pill",
  FAILED: "portal-pill portal-pill--danger"
};

export default async function DashboardPage({
  searchParams
}: {
  searchParams?: Promise<{ success?: string; error?: string }>
}) {
  const session = await requireSession();
  const data = await getDashboardData(session.userId);
  const resolvedSearchParams = await searchParams;

  if (!data) {
    return <main className="portal-shell"><section className="portal-panel"><h1>Dashboard unavailable</h1></section></main>;
  }

  const totalBalance = data.user.accounts.reduce((acc, account) => acc + account.balance.toNumber(), 0);

  return (
    <main className="portal-shell portal-stack">
      <header className="portal-panel portal-header">
        <div>
          <p className="portal-kicker">SpringBank • Established customer profile since 2023</p>
          <h1>Welcome back, {data.user.fullName}</h1>
          <p className="portal-muted">Monitor balances, review your activity, and submit secure transfers.</p>
        </div>
        <div>
          <div className="balance-callout">{formatCurrency(totalBalance)}</div>
          <small>Total available balance</small>
          <form method="post" action="/api/auth/signout">
            <button type="submit" className="portal-secondary-btn">Sign out</button>
          </form>
        </div>
      </header>

      {resolvedSearchParams?.success && <div className="portal-alert portal-alert--success">{resolvedSearchParams.success}</div>}
      {resolvedSearchParams?.error && <div className="portal-alert portal-alert--error">{resolvedSearchParams.error}</div>}

      <section className="portal-grid-two">
        <article className="portal-panel">
          <h2>Your accounts</h2>
          <div className="account-cards">
            {data.user.accounts.map((account) => (
              <div key={account.id} className="account-card">
                <p className="portal-kicker">{account.type} • {account.status}</p>
                <h3>{maskAccountNumber(account.accountNumber)}</h3>
                <p className="balance-callout">{formatCurrency(account.balance)}</p>
                <p className="portal-muted">Opened {new Date(account.createdAt).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="portal-panel">
          <h2>Transfer funds</h2>
          <p className="portal-muted">Transfers of $10,000.00 or more are routed for admin approval.</p>
          <form method="post" action="/api/transfers" className="portal-form-grid">
            <label>
              From account
              <select name="fromAccountId" required>
                {data.user.accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.type} {maskAccountNumber(account.accountNumber)} ({formatCurrency(account.balance)})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Destination account number
              <input name="destinationAccountNumber" placeholder="700000000001" required />
            </label>
            <label>
              Amount
              <input name="amount" type="number" step="0.01" min="0.01" required />
            </label>
            <label>
              Description
              <input name="description" maxLength={140} placeholder="Rent payment" />
            </label>
            <button type="submit">Submit transfer</button>
          </form>
        </article>
      </section>

      <section className="portal-panel">
        <h2>Recent transaction activity</h2>
        {data.txns.length === 0 ? (
          <p className="portal-muted">No transactions yet. Use the transfer form above to create one.</p>
        ) : (
          <div className="txn-table-wrap">
            <table className="txn-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Reference</th>
                  <th>Description</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Status</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.txns.map((txn) => (
                  <tr key={txn.id}>
                    <td>{new Date(txn.createdAt).toLocaleDateString()}</td>
                    <td>{txn.reference}</td>
                    <td>{txn.description || txn.type}</td>
                    <td>{txn.fromAccount ? maskAccountNumber(txn.fromAccount.accountNumber) : "—"}</td>
                    <td>{txn.toAccount ? maskAccountNumber(txn.toAccount.accountNumber) : "—"}</td>
                    <td><span className={statusTone[txn.status] || "portal-pill"}>{txn.status}</span></td>
                    <td>{formatCurrency(txn.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
