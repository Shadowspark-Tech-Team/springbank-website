import { requireSession } from "@/lib/auth/session";
import { formatCurrency, getAdminApprovalData, maskAccountNumber } from "@/lib/banking/service";

type AdminPageProps = {
  searchParams?: Promise<{
    success?: string;
    error?: string;
  }>;
};

export default async function AdminPage({ searchParams }: { searchParams?: Promise<{ success?: string; error?: string }> }) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const session = await requireSession({ role: "ADMIN" });
  const data = await getAdminApprovalData();

  return (
    <main className="portal-shell portal-stack">
      <header className="portal-panel portal-header">
        <div>
          <p className="portal-kicker">SpringBank Risk & Operations</p>
          <h1>Approvals Console</h1>
          <p className="portal-muted">Review large-value transfers submitted by customers in this evaluation environment.</p>
        </div>
        <div>
          <p>Signed in as {session.email}</p>
          <form method="post" action="/api/auth/signout">
            <button type="submit" className="portal-secondary-btn">Sign out</button>
          </form>
        </div>
      </header>

      {resolvedSearchParams?.success && <div className="portal-alert portal-alert--success">{resolvedSearchParams.success}</div>}
      {resolvedSearchParams?.error && <div className="portal-alert portal-alert--error">{resolvedSearchParams.error}</div>}

      <section className="portal-panel">
        <h2>Pending approvals ({data.pending.length})</h2>
        {data.pending.length === 0 ? (
          <p className="portal-muted">No pending transfers right now.</p>
        ) : (
          <div className="approval-grid">
            {data.pending.map((txn) => (
              <article key={txn.id} className="approval-card">
                <p className="portal-kicker">{txn.reference}</p>
                <h3>{formatCurrency(txn.amount)}</h3>
                <p>{txn.initiatedBy.fullName} ({txn.initiatedBy.email})</p>
                <p>From {txn.fromAccount ? maskAccountNumber(txn.fromAccount.accountNumber) : "—"} to {txn.toAccount ? maskAccountNumber(txn.toAccount.accountNumber) : "—"}</p>
                <p className="portal-muted">Submitted {new Date(txn.createdAt).toLocaleString()}</p>
                <p className="portal-muted">{txn.description || "No customer note"}</p>
                <form method="post" action={`/api/admin/transactions/${txn.id}/decision`} className="portal-form-grid">
                  <label>
                    Admin note
                    <input name="note" placeholder="Optional review note" />
                  </label>
                  <div className="approval-actions">
                    <button type="submit" name="decision" value="approve">Approve & post</button>
                    <button type="submit" name="decision" value="reject" className="portal-danger-btn">Reject</button>
                  </div>
                </form>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="portal-panel">
        <h2>Recent decisions</h2>
        <div className="txn-table-wrap">
          <table className="txn-table">
            <thead>
              <tr>
                <th>Date</th><th>Ref</th><th>Customer</th><th>From</th><th>To</th><th>Status</th><th>Amount</th><th>Approved By</th>
              </tr>
            </thead>
            <tbody>
              {data.recent.map((txn) => (
                <tr key={txn.id}>
                  <td>{new Date(txn.updatedAt).toLocaleDateString()}</td>
                  <td>{txn.reference}</td>
                  <td>{txn.initiatedBy.fullName}</td>
                  <td>{txn.fromAccount ? maskAccountNumber(txn.fromAccount.accountNumber) : "—"}</td>
                  <td>{txn.toAccount ? maskAccountNumber(txn.toAccount.accountNumber) : "—"}</td>
                  <td>{txn.status}</td>
                  <td>{formatCurrency(txn.amount)}</td>
                  <td>{txn.approvedBy?.fullName || "System"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
