"use client";

import { useMemo, useState } from "react";
import type {
  ClaimType,
  Product,
  Prospect,
  Stage,
  StoreSnapshot,
} from "@/lib/types";
import { STAGES } from "@/lib/types";

type Tab = "discover" | "pipeline" | "products" | "connections";

const CLAIM_LABELS: Record<ClaimType, string> = {
  explicit_request: "Explicit request",
  inferred_need: "Inferred need",
  company_fit: "Company fit only",
};

const EMPTY_FORM = {
  name: "",
  website: "",
  industry: "",
  location: "",
  employeeCount: "",
  buyerRole: "",
  contactName: "",
  contactEmail: "",
  contactSource: "",
  claimType: "company_fit" as ClaimType,
  sourceUrl: "",
  sourceTitle: "",
  excerpt: "",
  summary: "",
  notes: "",
};

export default function PilotDashboard({
  initial,
  ownerEmail,
  authMode,
  mailMode,
}: {
  initial: StoreSnapshot;
  ownerEmail: string;
  authMode: "mock" | "firebase";
  mailMode: "mock" | "gmail";
}) {
  const [tab, setTab] = useState<Tab>("discover");
  const [prospects, setProspects] = useState(initial.prospects);
  const [products] = useState(initial.products);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(initial.prospects.map((p) => [p.id, p.notes])),
  );

  const explicitCount = useMemo(
    () => prospects.filter((p) => p.evidence[0]?.claimType === "explicit_request").length,
    [prospects],
  );
  const verifiedProducts = useMemo(
    () => products.filter((p) => p.status === "verified").length,
    [products],
  );

  function flash(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3500);
  }

  function updateForm<K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function addProspect(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          employeeCount: form.employeeCount ? Number(form.employeeCount) : null,
          buyerRole: form.buyerRole || null,
          contactName: form.contactName || null,
          contactEmail: form.contactEmail || null,
          contactSource: form.contactSource || null,
          sourceTitle: form.sourceTitle || undefined,
        }),
      });
      const data = (await response.json()) as { prospect?: Prospect; error?: string };
      if (!response.ok || !data.prospect) {
        setError(data.error ?? "Could not add prospect.");
        return;
      }
      setProspects((current) => [data.prospect!, ...current]);
      setNoteDrafts((current) => ({ ...current, [data.prospect!.id]: data.prospect!.notes }));
      setForm(EMPTY_FORM);
      setTab("pipeline");
      flash("Prospect saved. Add notes or move the pipeline stage.");
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function patchProspect(id: string, patch: { stage?: Stage; notes?: string }) {
    const response = await fetch(`/api/prospects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = (await response.json()) as { prospect?: Prospect; error?: string };
    if (!response.ok || !data.prospect) {
      flash(data.error ?? "Could not update prospect.");
      return;
    }
    setProspects((current) => current.map((p) => (p.id === id ? data.prospect! : p)));
    flash(patch.notes !== undefined ? "Notes saved." : "Pipeline stage updated.");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className="app-shell">
      <aside>
        <div className="brand">
          ◈ SaaSScout <b>AI</b>
        </div>
        <div className="tag">BY NOFA AI FACTORY™</div>
        <nav className="nav" aria-label="Workspace">
          {(
            [
              ["discover", "⌕  Discover prospects"],
              ["pipeline", "▤  My pipeline"],
              ["products", "◇  Product catalog"],
              ["connections", "⇄  Data connections"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={tab === key ? "active" : ""}
              aria-current={tab === key ? "page" : undefined}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebottom">
          <p>NOFA owner workspace</p>
          <p>{ownerEmail}</p>
          <p className="tiny">
            {authMode === "mock" ? "MOCK AUTH" : "FIREBASE AUTH"} · {mailMode.toUpperCase()} MAIL
          </p>
        </div>
      </aside>

      <main>
        <header>
          <span>
            <strong>NOFA pilot workspace</strong>{" "}
            <span className="muted"> / Prospect intelligence</span>
          </span>
          <span className="pill">● PHASE 1 CHECKPOINT</span>
        </header>

        <div className="notice">
          Phase 1 checkpoint · Manual prospect intake, persistent pipeline, catalog, and CSV are
          active. Live discovery, AI matching, and real Gmail are not connected yet. Do not enter
          sensitive personal data.
        </div>

        <div className="hero compact">
          <div>
            <div className="eyebrow">FIND THE NEED. START THE RIGHT CONVERSATION.</div>
            <h1>Match the business. Introduce the solution.</h1>
            <p className="muted">
              Keep evidence attached to every prospect. Nothing is inferred as buying intent.
            </p>
          </div>
          <div className="button-row">
            <button type="button" onClick={() => window.location.assign("/api/export")}>
              ↓ Export CSV
            </button>
            <button type="button" onClick={logout}>
              Sign out
            </button>
          </div>
        </div>

        <div className="stats">
          <div className="stat">
            <span>Prospects</span>
            <strong>{prospects.length}</strong>
          </div>
          <div className="stat">
            <span>Explicit requests</span>
            <strong>{explicitCount}</strong>
          </div>
          <div className="stat">
            <span>In pipeline</span>
            <strong>{prospects.filter((p) => p.stage !== "Won").length}</strong>
          </div>
          <div className="stat">
            <span>Verified products</span>
            <strong>{verifiedProducts}</strong>
          </div>
        </div>

        {error && (
          <div className="warning" role="alert">
            {error}
          </div>
        )}

        {tab === "discover" && (
          <section>
            <div className="section-heading">
              <div>
                <div className="eyebrow">PHASE 1 · MANUAL INTAKE</div>
                <h2>Add a prospect with evidence</h2>
                <p className="muted small">
                  This form is the temporary intake path until Exa discovery is connected. A source
                  URL and excerpt are required. Claims are recorded as explicit, inferred, or
                  company-fit-only.
                </p>
              </div>
            </div>

            <form className="panel intake-form" onSubmit={addProspect}>
              <div className="form-grid">
                <div>
                  <label htmlFor="name">Business name</label>
                  <input
                    id="name"
                    value={form.name}
                    onChange={(e) => updateForm("name", e.target.value)}
                    required
                    maxLength={140}
                  />
                </div>
                <div>
                  <label htmlFor="website">Website</label>
                  <input
                    id="website"
                    type="url"
                    placeholder="https://example.com"
                    value={form.website}
                    onChange={(e) => updateForm("website", e.target.value)}
                    required
                    maxLength={500}
                  />
                </div>
                <div>
                  <label htmlFor="industry">Industry</label>
                  <input
                    id="industry"
                    value={form.industry}
                    onChange={(e) => updateForm("industry", e.target.value)}
                    required
                    maxLength={80}
                  />
                </div>
                <div>
                  <label htmlFor="location">Location</label>
                  <input
                    id="location"
                    placeholder="City, state"
                    value={form.location}
                    onChange={(e) => updateForm("location", e.target.value)}
                    required
                    maxLength={140}
                  />
                </div>
                <div>
                  <label htmlFor="employees">Employees (optional)</label>
                  <input
                    id="employees"
                    type="number"
                    min="0"
                    max="1000000"
                    value={form.employeeCount}
                    onChange={(e) => updateForm("employeeCount", e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="role">Buyer role (optional)</label>
                  <input
                    id="role"
                    value={form.buyerRole}
                    onChange={(e) => updateForm("buyerRole", e.target.value)}
                    maxLength={120}
                  />
                </div>
                <div>
                  <label htmlFor="contactName">Contact name (optional)</label>
                  <input
                    id="contactName"
                    value={form.contactName}
                    onChange={(e) => updateForm("contactName", e.target.value)}
                    maxLength={120}
                  />
                </div>
                <div>
                  <label htmlFor="contactEmail">Public business email (optional)</label>
                  <input
                    id="contactEmail"
                    type="email"
                    value={form.contactEmail}
                    onChange={(e) => updateForm("contactEmail", e.target.value)}
                    maxLength={254}
                  />
                </div>
                <div>
                  <label htmlFor="contactSource">Email source URL (optional)</label>
                  <input
                    id="contactSource"
                    type="url"
                    placeholder="https://example.com/contact"
                    value={form.contactSource}
                    onChange={(e) => updateForm("contactSource", e.target.value)}
                    maxLength={500}
                  />
                </div>
                <div>
                  <label htmlFor="claimType">Evidence claim</label>
                  <select
                    id="claimType"
                    value={form.claimType}
                    onChange={(e) => updateForm("claimType", e.target.value as ClaimType)}
                  >
                    <option value="company_fit">Company fit only</option>
                    <option value="inferred_need">Inferred need</option>
                    <option value="explicit_request">Explicit request</option>
                  </select>
                </div>
              </div>

              <div className="form-grid evidence-grid">
                <div>
                  <label htmlFor="sourceUrl">Source URL</label>
                  <input
                    id="sourceUrl"
                    type="url"
                    placeholder="https://example.com/about"
                    value={form.sourceUrl}
                    onChange={(e) => updateForm("sourceUrl", e.target.value)}
                    required
                    maxLength={500}
                  />
                </div>
                <div>
                  <label htmlFor="sourceTitle">Source title (optional)</label>
                  <input
                    id="sourceTitle"
                    value={form.sourceTitle}
                    onChange={(e) => updateForm("sourceTitle", e.target.value)}
                    maxLength={200}
                  />
                </div>
              </div>

              <label htmlFor="excerpt">Supporting excerpt</label>
              <textarea
                id="excerpt"
                value={form.excerpt}
                onChange={(e) => updateForm("excerpt", e.target.value)}
                required
                minLength={20}
                maxLength={1500}
                placeholder="Quote or closely paraphrase the public evidence. Do not paste private information."
              />
              <label htmlFor="summary">Factual summary</label>
              <textarea
                id="summary"
                value={form.summary}
                onChange={(e) => updateForm("summary", e.target.value)}
                required
                minLength={10}
                maxLength={1000}
              />
              <label htmlFor="notes">Internal notes (optional)</label>
              <textarea
                id="notes"
                value={form.notes}
                onChange={(e) => updateForm("notes", e.target.value)}
                maxLength={5000}
              />
              <button className="primary" type="submit" disabled={busy}>
                {busy ? "Saving…" : "+ Save prospect with evidence"}
              </button>
            </form>

            <div className="section-heading">
              <div>
                <div className="eyebrow">OPPORTUNITY FEED</div>
                <h2>Saved prospects</h2>
              </div>
            </div>
            {prospects.length === 0 ? (
              <div className="empty">
                <h3>No prospects yet</h3>
                <p className="muted">
                  Add a real business with a public source. Live discovery will replace this manual
                  intake in Phase 2.
                </p>
              </div>
            ) : (
              <div className="cards">
                {prospects.map((prospect) => (
                  <ProspectCard key={prospect.id} prospect={prospect} />
                ))}
              </div>
            )}
          </section>
        )}

        {tab === "pipeline" && (
          <section>
            <div className="section-heading">
              <div>
                <div className="eyebrow">FROM DISCOVERY TO CONVERSATION</div>
                <h2>My pipeline</h2>
                <p className="muted small">
                  Stages and notes persist for the owner workspace. Sending is not enabled here.
                </p>
              </div>
            </div>
            <div className="flow">
              {STAGES.map((stage) => {
                const stageProspects = prospects.filter((p) => p.stage === stage);
                return (
                  <section key={stage} className="pipeline-column">
                    <div className="row">
                      <strong>{stage}</strong>
                      <span className="pill">{stageProspects.length}</span>
                    </div>
                    {stageProspects.length === 0 && (
                      <p className="muted small">No prospects in this stage.</p>
                    )}
                    {stageProspects.map((prospect) => (
                      <article className="card pipeline-card" key={prospect.id}>
                        <h3>{prospect.name}</h3>
                        <p className="small muted">
                          {prospect.industry} · {prospect.location}
                        </p>
                        <label htmlFor={`stage-${prospect.id}`}>Stage</label>
                        <select
                          id={`stage-${prospect.id}`}
                          value={prospect.stage}
                          onChange={(e) =>
                            patchProspect(prospect.id, { stage: e.target.value as Stage })
                          }
                        >
                          {STAGES.map((option) => (
                            <option key={option}>{option}</option>
                          ))}
                        </select>
                        <label htmlFor={`notes-${prospect.id}`}>Notes</label>
                        <textarea
                          id={`notes-${prospect.id}`}
                          value={noteDrafts[prospect.id] ?? ""}
                          onChange={(e) =>
                            setNoteDrafts((current) => ({
                              ...current,
                              [prospect.id]: e.target.value,
                            }))
                          }
                          maxLength={5000}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            patchProspect(prospect.id, {
                              notes: noteDrafts[prospect.id] ?? "",
                            })
                          }
                        >
                          Save notes
                        </button>
                      </article>
                    ))}
                  </section>
                );
              })}
            </div>
          </section>
        )}

        {tab === "products" && (
          <section>
            <div className="section-heading">
              <div>
                <div className="eyebrow">VERIFIED BEFORE OUTREACH</div>
                <h2>Product catalog</h2>
                <p className="muted small">
                  All three products are drafts pending owner verification. Matching and live email
                  are blocked until at least one product is verified.
                </p>
              </div>
            </div>
            <div className="cards">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
            <div className="notice">
              Verification requires owner-approved capabilities, intended customers, limitations, and
              a source URL. No product claims, pricing, images, or product-page URLs have been invented.
            </div>
          </section>
        )}

        {tab === "connections" && (
          <section>
            <div className="section-heading">
              <div>
                <div className="eyebrow">BUILT TO VALIDATE THE WORKFLOW</div>
                <h2>Data connections</h2>
                <p className="muted small">
                  Credentials are not configured in this checkpoint. The application does not call
                  external providers.
                </p>
              </div>
            </div>
            <div className="integration">
              <div className="row">
                <h3>Exa · Company discovery</h3>
                <span className="pill muted-pill">NOT CONNECTED</span>
              </div>
              <p className="muted">Phase 2. On-demand only, with a 5-search/day and 10-result cap.</p>
            </div>
            <div className="integration">
              <div className="row">
                <h3>AI provider · Matching and drafting</h3>
                <span className="pill muted-pill">NOT APPROVED</span>
              </div>
              <p className="muted">
                Phase 3. Proposed model: <span className="mono">claude-sonnet-5-5</span>. No calls
                are made until Farhad approves the provider and budget.
              </p>
            </div>
            <div className="integration">
              <div className="row">
                <h3>Gmail · Owner sending</h3>
                <span className="pill muted-pill">MOCK ONLY</span>
              </div>
              <p className="muted">
                Phase 4. No OAuth client, token, or real message exists yet. The mock send service
                records attempts and blocks duplicates; it does not contact Google.
              </p>
            </div>
            <div className="integration">
              <div className="row">
                <h3>Persistence</h3>
                <span className="pill muted-pill">LOCAL JSON</span>
              </div>
              <p className="muted">
                This checkpoint stores data in a local JSON file for development. It is not durable
                on serverless preview. Firestore and rules are the next infrastructure step before
                shared or production use.
              </p>
            </div>
          </section>
        )}

        <p className="caption">
          SaaSScout AI™ · A NOFA AI Factory™ concept · B2B only · Phase 1 checkpoint
        </p>
      </main>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

function ProspectCard({ prospect }: { prospect: Prospect }) {
  const evidence = prospect.evidence[0];
  return (
    <article className="card">
      <div className="row">
        <div className="company">
          <div className="avatar">{prospect.name.slice(0, 1).toUpperCase()}</div>
          <div>
            <h3>{prospect.name}</h3>
            <div className="muted small">
              {prospect.industry} · {prospect.location}
            </div>
          </div>
        </div>
        <span className={`signal ${evidence?.claimType ?? "company_fit"}`}>
          {evidence ? CLAIM_LABELS[evidence.claimType] : "No evidence"}
        </span>
      </div>
      <div className="evidence">
        <p>{evidence?.excerpt ?? "No supporting excerpt recorded."}</p>
        <p className="small muted">
          {prospect.employeeCount != null
            ? `${prospect.employeeCount} employees`
            : "Size not available"}
          {prospect.contactEmail ? ` · ${prospect.contactEmail}` : " · No contact email"}
        </p>
        {evidence && (
          <a href={evidence.sourceUrl} target="_blank" rel="noopener noreferrer">
            Open source ↗
          </a>
        )}
      </div>
      <div className="detailblock">
        <div className="eyebrow">PIPELINE</div>
        <div className="row">
          <strong>{prospect.stage}</strong>
          <span className="small muted">Manual evidence</span>
        </div>
      </div>
    </article>
  );
}

function ProductCard({ product }: { product: Product }) {
  return (
    <article className="card">
      <div className="row">
        <h3>{product.name}</h3>
        <span className={`pill ${product.status === "verified" ? "" : "muted-pill"}`}>
          {product.status.toUpperCase()}
        </span>
      </div>
      <p className="muted">{product.description}</p>
      <div className="detailblock">
        <p className="small">
          <strong>Capabilities:</strong>{" "}
          {product.capabilities.length ? product.capabilities.join(", ") : "Not verified"}
        </p>
        <p className="small">
          <strong>Intended customers:</strong> {product.intendedCustomers || "Not verified"}
        </p>
        <p className="small">
          <strong>Limitations:</strong> {product.limitations || "Not verified"}
        </p>
        <p className="small">
          <strong>Source:</strong>{" "}
          {product.sourceUrl ? (
            <a href={product.sourceUrl} target="_blank" rel="noopener noreferrer">
              Verification source ↗
            </a>
          ) : (
            "Not provided"
          )}
        </p>
      </div>
      <a href={product.showroomUrl} target="_blank" rel="noopener noreferrer">
        Open NOFA showroom ↗
      </a>
    </article>
  );
}
