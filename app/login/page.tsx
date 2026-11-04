import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { firebaseAdminConfigured } from "@/lib/firebase/admin";
import { firebaseClientConfigured } from "@/lib/firebase/public-config";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const ready = firebaseClientConfigured() && firebaseAdminConfigured();
  if (ready) {
    const session = await getSession();
    if (session) redirect("/app");
  }

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
          Continue with the authorized NOFA Google account. Firebase verifies the identity, and the
          server also verifies the owner email before creating an HttpOnly session.
        </p>

        {!ready && (
          <div className="warning" role="alert">
            Firebase is not configured for this deployment. Add the Firebase web configuration and
            Admin service account to the preview environment, then redeploy. No mock login is enabled.
          </div>
        )}

        <LoginForm configured={ready} />
      </section>
      <aside className="login-aside">
        <div>
          <div className="eyebrow">FOUNDATION CHECKPOINT</div>
          <h2>What is real in this build</h2>
          <ul>
            <li>Firebase Authentication with an owner-email allowlist.</li>
            <li>HttpOnly Firebase session cookie verified server-side.</li>
            <li>Firestore persistence and server-only write routes.</li>
            <li>Origin checks for state-changing requests.</li>
          </ul>
          <h2>Still intentionally disabled</h2>
          <ul>
            <li>Live Exa discovery.</li>
            <li>AI matching and drafting.</li>
            <li>Google Gmail OAuth and real sending.</li>
          </ul>
        </div>
        <p className="caption">SaaSScout AI™ · A NOFA AI Factory™ concept · B2B only</p>
      </aside>
    </main>
  );
}
