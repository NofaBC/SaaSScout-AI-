import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isMockAuth, mockOwnerCode, ownerEmail } from "@/lib/config";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/app");

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="brand login-brand">
          ◈ SaaSScout <b>AI</b>
        </div>
        <div className="tag">BY NOFA AI FACTORY™</div>
        <div className="eyebrow" style={{ marginTop: 34 }}>
          SECURED OWNER PILOT
        </div>
        <h1>One workspace. Real prospects. Controlled outreach.</h1>
        <p className="muted">
          This checkpoint uses a mock owner sign-in because Firebase credentials are not configured.
          The owner email and signed server session are enforced; this is not production authentication.
        </p>

        {!mockOwnerCode() && (
          <div className="warning" role="alert">
            Mock owner login is disabled until <span className="mono">MOCK_OWNER_CODE</span> is set
            to at least 8 characters in the server environment.
          </div>
        )}

        <LoginForm
          defaultEmail={ownerEmail()}
          configured={Boolean(mockOwnerCode())}
          mockMode={isMockAuth()}
        />
      </section>
      <aside className="login-aside">
        <div>
          <div className="eyebrow">PHASE 1 CHECKPOINT</div>
          <h2>What is real in this build</h2>
          <ul>
            <li>Signed owner session and server-side authorization.</li>
            <li>Persistent local prospect, note, stage, catalog, and CSV records.</li>
            <li>Mock send boundary with duplicate prevention.</li>
          </ul>
          <h2>What is intentionally not connected</h2>
          <ul>
            <li>Exa live discovery (Phase 2).</li>
            <li>AI matching and drafting (Phase 3).</li>
            <li>Google OAuth and real Gmail sending (Phase 4).</li>
          </ul>
        </div>
        <p className="caption">SaaSScout AI™ · A NOFA AI Factory™ concept · B2B only</p>
      </aside>
    </main>
  );
}
