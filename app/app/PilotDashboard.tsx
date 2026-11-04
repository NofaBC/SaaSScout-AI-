"use client";

import { useEffect, useMemo, useState } from "react";
import { signOutOwner } from "@/lib/firebase/client";
import type { MatchResult } from "@/lib/matching";
import type {
  ClaimType,
  Draft,
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

const EMPTY_DISCOVERY = {
  industry: "",
  location: "",
  keywords: "",
  buyerRole: "",
  maxResults: "10",
};

interface GmailStatus {
  configured: boolean;
  connected: boolean;
  email: string | null;
  scopes: string[];
  connectedAt: string | null;
  sendMode: "test" | "live";
  testRecipient: string | null;
  setupMessage: string | null;
}

interface DraftReview {
  draft: Draft;
  product: Product;
  match: MatchResult;
  recipient: string;
  dirty: boolean;
  result: string;
}

export default function PilotDashboard({
  initial,
  ownerEmail,
  mailMode,
}: {
  initial: StoreSnapshot;
  ownerEmail: string;
  mailMode: "mock" | "gmail";
}) {
  const [tab, setTab] = useState<Tab>("discover");
  const [prospects, setProspects] = useState(initial.prospects);
  const [products, setProducts] = useState(initial.products);
  const [form, setForm] = useState(EMPTY_FORM);
  const [discoveryForm, setDiscoveryForm] = useState(EMPTY_DISCOVERY);
  const [busy, setBusy] = useState(false);
  const [discoveryBusy, setDiscoveryBusy] = useState(false);
  const [error, setError] = useState("");
  const [discoveryMessage, setDiscoveryMessage] = useState("");
  const [toast, setToast] = useState("");
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(initial.prospects.map((p) => [p.id, p.notes])),
  );
  const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null);
  const [gmailError, setGmailError] = useState("");
  const [draftReview, setDraftReview] = useState<DraftReview | null>(null);
  const [draftBusy, setDraftBusy] = useState(false);

  const explicitCount = useMemo(
    () => prospects.filter((p) => p.evidence[0]?.claimType === "explicit_request").length,
    [prospects],
  );
  const verifiedProducts = useMemo(
    () => products.filter((p) => p.status === "verified").length,
    [products],
  );

  useEffect(() => {
    let active = true;
    fetch("/api/gmail/status")
      .then(async (response) => {
        const data = (await response.json()) as GmailStatus & { error?: string };
        if (!response.ok) {
          if (active) setGmailError(data.error ?? "Gmail status is unavailable.");
          return;
        }
        if (active) setGmailStatus(data);
      })
      .catch(() => {
        if (active) setGmailError("Could not reach the Gmail status endpoint.");
      });
    return () => {
      active = false;
    };
  }, []);

  function flash(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 4000);
  }

  function updateForm<K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateDiscovery<K extends keyof typeof EMPTY_DISCOVERY>(
    key: K,
    value: (typeof EMPTY_DISCOVERY)[K],
  ) {
    setDiscoveryForm((current) => ({ ...current, [key]: value }));
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

  async function discover(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDiscoveryBusy(true);
    setDiscoveryMessage("");
    try {
      const response = await fetch("/api/discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...discoveryForm,
          maxResults: Number(discoveryForm.maxResults),
        }),
      });
      const data = (await response.json()) as {
        created?: Prospect[];
        skipped?: number;
        message?: string;
        error?: string;
        code?: string;
      };
      if (!response.ok) {
        setDiscoveryMessage(data.error ?? "Discovery failed.");
        return;
      }
      const created = data.created ?? [];
      setProspects((current) => [...created, ...current]);
      setNoteDrafts((current) => ({
        ...current,
        ...Object.fromEntries(created.map((prospect) => [prospect.id, prospect.notes])),
      }));
      setDiscoveryMessage(
        created.length
          ? `${created.length} live prospects added${data.skipped ? `; ${data.skipped} duplicate(s) skipped` : ""}.`
          : data.message ?? "No supported discoveries were found. No demo data was substituted.",
      );
    } catch {
      setDiscoveryMessage("Could not reach the discovery endpoint.");
    } finally {
      setDiscoveryBusy(false);
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

  async function openMatch(prospect: Prospect) {
    setDraftBusy(true);
    setDraftReview(null);
    try {
      const response = await fetch(`/api/prospects/${prospect.id}/match`, { method: "POST" });
      const data = (await response.json()) as {
        match?: MatchResult;
        draft?: Draft;
        product?: Product;
        error?: string;
      };
      if (!response.ok || !data.match) {
        flash(data.error ?? "Matching failed.");
        return;
      }
      if (data.match.status !== "match" || !data.draft || !data.product) {
        flash(data.match.rationale);
        return;
      }
      setDraftReview({
        draft: data.draft,
        product: data.product,
        match: data.match,
        recipient: prospect.contactEmail ?? "",
        dirty: false,
        result: "",
      });
    } catch {
      flash("Could not reach the matching endpoint.");
    } finally {
      setDraftBusy(false);
    }
  }

  function updateDraftField(field: "recipient" | "subject" | "body", value: string) {
    setDraftReview((current) => {
      if (!current) return current;
      if (field === "recipient") return { ...current, recipient: value };
      return {
        ...current,
        dirty: true,
        draft: { ...current.draft, [field]: value },
      };
    });
  }

  async function saveDraft(): Promise<Draft | null> {
    if (!draftReview) return null;
    setDraftBusy(true);
    try {
      const response = await fetch(`/api/drafts/${draftReview.draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: draftReview.draft.subject,
          body: draftReview.draft.body,
        }),
      });
      const data = (await response.json()) as { draft?: Draft; error?: string };
      if (!response.ok || !data.draft) {
        flash(data.error ?? "Could not save the draft.");
        return null;
      }
      setDraftReview((current) =>
        current ? { ...current, draft: data.draft!, dirty: false } : current,
      );
      flash("Draft saved. Approval is required again.");
      return data.draft;
    } catch {
      flash("Could not reach the draft endpoint.");
      return null;
    } finally {
      setDraftBusy(false);
    }
  }

  async function approveDraft() {
    if (!draftReview) return;
    let draft = draftReview.draft;
    if (draftReview.dirty) {
      const saved = await saveDraft();
      if (!saved) return;
      draft = saved;
    }
    setDraftBusy(true);
    try {
      const response = await fetch(`/api/drafts/${draft.id}/approve`, { method: "POST" });
      const data = (await response.json()) as { draft?: Draft; error?: string };
      if (!response.ok || !data.draft) {
        flash(data.error ?? "Could not approve the draft.");
        return;
      }
      setDraftReview((current) => (current ? { ...current, draft: data.draft!, dirty: false } : current));
      flash("Draft approved. You may now send this version.");
    } catch {
      flash("Could not reach the approval endpoint.");
    } finally {
      setDraftBusy(false);
    }
  }

  async function sendDraft() {
    if (!draftReview) return;
    if (!draftReview.recipient) {
      flash("Enter a recipient email before sending.");
      return;
    }
    setDraftBusy(true);
    try {
      const response = await fetch(`/api/drafts/${draftReview.draft.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: draftReview.recipient }),
      });
      const data = (await response.json()) as {
        send?: { status: string; provider: string; providerMessageId?: string };
        message?: string;
        warning?: string;
        error?: string;
      };
      const status = data.send?.status;
      if (status === "sent") {
        setDraftReview((current) =>
          current
            ? {
                ...current,
                draft: { ...current.draft, status: "sent" },
                result:
                  data.send?.provider === "mock"
                    ? "Mock send recorded. No email was transmitted."
                    : "Gmail accepted the message. Delivery is not confirmed.",
              }
            : current,
        );
        setProspects((current) =>
          current.map((prospect) =>
            prospect.id === draftReview.draft.prospectId && prospect.stage === "Saved"
              ? { ...prospect, stage: "Contacted" }
              : prospect,
          ),
        );
      } else if (status === "uncertain") {
        setDraftReview((current) =>
          current
            ? {
                ...current,
                draft: { ...current.draft, status: "uncertain" },
                result: "Send result uncertain. Check Gmail Sent; do not resend.",
              }
            : current,
        );
      } else {
        setDraftReview((current) =>
          current
            ? {
                ...current,
                draft: { ...current.draft, status: "failed" },
                result: data.error ?? "Send failed.",
              }
            : current,
        );
      }
    } catch {
      flash("Could not reach the send endpoint.");
    } finally {
      setDraftBusy(false);
    }
  }

  async function disconnectGmail() {
    const response = await fetch("/api/gmail/disconnect", { method: "POST" });
    if (response.ok) {
      setGmailStatus((current) =>
        current
          ? { ...current, connected: false, email: null, scopes: [], connectedAt: null }
          : current,
      );
      flash("Gmail disconnected.");
    } else {
      flash("Could not disconnect Gmail.");
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    try {
      await signOutOwner();
    } catch {
      // The server session is already cleared.
    }
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
          <p className="tiny">FIREBASE AUTH · {mailMode.toUpperCase()} MAIL</p>
        </div>
      </aside>

      <main>
        <header>
          <span>
            <strong>NOFA pilot workspace</strong>{" "}
            <span className="muted"> / Prospect intelligence</span>
          </span>
          <span className="pill">● PILOT</span>
        </header>

        <div className="notice">
          Live discovery uses Exa only when configured. No demo data is substituted for failed
          searches. Gmail requires the owner account, and every email needs explicit approval before
          sending.
        </div>

        <div className="hero compact">
          <div>
            <div className="eyebrow">FIND THE NEED. START THE RIGHT CONVERSATION.</div>
            <h1>Match the business. Introduce the solution.</h1>
            <p className="muted">
              Evidence stays attached to every prospect. A match is not proof of buying intent.
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
                <div className="eyebrow">ON-DEMAND · STRICT LIMITS</div>
                <h2>Find real prospects</h2>
                <p className="muted small">
                  Exa search only. Five searches per day, ten results per search. No scheduled
                  discovery and no mock fallback.
                </p>
              </div>
            </div>

            <form className="panel discovery-panel" onSubmit={discover}>
              <div className="form-grid">
                <div>
                  <label htmlFor="discoveryIndustry">Target industry</label>
                  <input
                    id="discoveryIndustry"
                    value={discoveryForm.industry}
                    onChange={(e) => updateDiscovery("industry", e.target.value)}
                    placeholder="Hospitality"
                    maxLength={80}
                  />
                </div>
                <div>
                  <label htmlFor="discoveryLocation">Location</label>
                  <input
                    id="discoveryLocation"
                    value={discoveryForm.location}
                    onChange={(e) => updateDiscovery("location", e.target.value)}
                    placeholder="Maryland"
                    maxLength={140}
                  />
                </div>
                <div>
                  <label htmlFor="discoveryKeywords">Search keywords</label>
                  <input
                    id="discoveryKeywords"
                    value={discoveryForm.keywords}
                    onChange={(e) => updateDiscovery("keywords", e.target.value)}
                    placeholder="guest messaging, support operations"
                    maxLength={300}
                  />
                </div>
                <div>
                  <label htmlFor="discoveryRole">Buyer role</label>
                  <input
                    id="discoveryRole"
                    value={discoveryForm.buyerRole}
                    onChange={(e) => updateDiscovery("buyerRole", e.target.value)}
                    placeholder="General Manager"
                    maxLength={120}
                  />
                </div>
                <div>
                  <label htmlFor="discoveryMax">Results</label>
                  <select
                    id="discoveryMax"
                    value={discoveryForm.maxResults}
                    onChange={(e) => updateDiscovery("maxResults", e.target.value)}
                  >
                    <option value="5">5</option>
                    <option value="10">10</option>
                  </select>
                </div>
              </div>
              <button className="primary" type="submit" disabled={discoveryBusy}>
                {discoveryBusy ? "Searching…" : "Search Exa for real prospects"}
              </button>
              {discoveryMessage && (
                <p className="small discovery-message" role="status">
                  {discoveryMessage}
                </p>
              )}
              <p className="small muted">
                If Exa is not configured, this returns a setup message. It never returns fictional
                prospects.
              </p>
            </form>

            <div className="section-heading">
              <div>
                <div className="eyebrow">MANUAL INTAKE · PHASE 1 FALLBACK</div>
                <h2>Add a prospect with evidence</h2>
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
                  Run a live Exa search or add a real business with a public source.
                </p>
              </div>
            ) : (
              <div className="cards">
                {prospects.map((prospect) => (
                  <ProspectCard
                    key={prospect.id}
                    prospect={prospect}
                    onMatch={() => openMatch(prospect)}
                    matching={draftBusy}
                  />
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
                  Stages and notes persist for the owner workspace. Sending always requires approval.
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
                  Only verified products can be matched or used in an email. Verification requires
                  owner-supplied facts and a source URL.
                </p>
              </div>
            </div>
            <div className="cards">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onUpdated={(updated) =>
                    setProducts((current) =>
                      current.map((entry) => (entry.id === updated.id ? updated : entry)),
                    )
                  }
                />
              ))}
            </div>
            <div className="notice">
              No product capabilities, pricing, images, customer results, or product-page URLs are
              invented here. The showroom link is the only verified product destination until the
              owner adds more.
            </div>
          </section>
        )}

        {tab === "connections" && (
          <section>
            <div className="section-heading">
              <div>
                <div className="eyebrow">CONFIGURATION STATUS</div>
                <h2>Data connections</h2>
                <p className="muted small">
                  Missing configuration is reported here and in the relevant action. It never falls
                  back to fictional results.
                </p>
              </div>
            </div>
            <div className="integration">
              <div className="row">
                <h3>Exa · Company discovery</h3>
                <span className="pill muted-pill">ON-DEMAND</span>
              </div>
              <p className="muted">
                Requires <span className="mono">EXA_API_KEY</span>. Limits: 5 searches/day and 10
                results/search. No scheduled discovery.
              </p>
            </div>
            <div className="integration">
              <div className="row">
                <h3>Gmail · Owner sender</h3>
                <span className={`pill ${gmailStatus?.connected ? "" : "muted-pill"}`}>
                  {gmailStatus?.connected ? "CONNECTED" : "NOT CONNECTED"}
                </span>
              </div>
              {gmailError && <p className="form-error">{gmailError}</p>}
              {gmailStatus ? (
                <>
                  <p className="muted">
                    {gmailStatus.connected
                      ? `Connected as ${gmailStatus.email}. Send mode: ${gmailStatus.sendMode}.`
                      : gmailStatus.setupMessage ?? "Connect the owner Google account."}
                  </p>
                  {gmailStatus.sendMode === "test" && gmailStatus.testRecipient && (
                    <p className="small muted">
                      Test mode only permits <span className="mono">{gmailStatus.testRecipient}</span>.
                    </p>
                  )}
                  <div className="button-row">
                    {!gmailStatus.connected ? (
                      <button
                        type="button"
                        onClick={() => window.location.assign("/api/gmail/connect")}
                        disabled={!gmailStatus.configured}
                      >
                        Connect nofabusinessconsulting@gmail.com
                      </button>
                    ) : (
                      <button type="button" onClick={disconnectGmail}>
                        Disconnect Gmail
                      </button>
                    )}
                  </div>
                  {!gmailStatus.configured && (
                    <p className="small muted">
                      Set <span className="mono">GOOGLE_CLIENT_ID</span>,{" "}
                      <span className="mono">GOOGLE_CLIENT_SECRET</span>,{" "}
                      <span className="mono">GOOGLE_REDIRECT_URI</span>, and{" "}
                      <span className="mono">OAUTH_TOKEN_ENCRYPTION_KEY</span>.
                    </p>
                  )}
                </>
              ) : (
                <p className="muted">Checking Gmail status…</p>
              )}
            </div>
            <div className="integration">
              <div className="row">
                <h3>Mail transport</h3>
                <span className="pill muted-pill">{mailMode.toUpperCase()}</span>
              </div>
              <p className="muted">
                {mailMode === "mock"
                  ? "Mock transport is active. Sending records a mock result and transmits nothing."
                  : "Gmail transport is selected. Real sending still requires a connected owner account and per-email approval."}
              </p>
            </div>
          </section>
        )}

        <p className="caption">
          SaaSScout AI™ · A NOFA AI Factory™ concept · B2B only · Pilot foundation
        </p>
      </main>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}

      {draftReview && (
        <div className="modal-backdrop" role="presentation">
          <div className="review-modal" role="dialog" aria-modal="true" aria-labelledby="review-title">
            <div className="row">
              <div>
                <div className="eyebrow">REVIEW BEFORE SENDING</div>
                <h2 id="review-title">Outreach draft</h2>
              </div>
              <button type="button" onClick={() => setDraftReview(null)} aria-label="Close review">
                ✕
              </button>
            </div>

            <div className="review-meta">
              <p>
                <strong>Matched product:</strong> {draftReview.product.name}
              </p>
              <p className="small muted">{draftReview.match.rationale}</p>
              <p className="small">
                <strong>From:</strong>{" "}
                {gmailStatus?.connected
                  ? gmailStatus.email
                  : "Gmail not connected — sending will be blocked"}
              </p>
              <p className="small">
                <strong>Status:</strong> {draftReview.draft.status.toUpperCase()}
              </p>
            </div>

            <label htmlFor="draftRecipient">Recipient email</label>
            <input
              id="draftRecipient"
              type="email"
              value={draftReview.recipient}
              onChange={(e) => updateDraftField("recipient", e.target.value)}
              placeholder="recipient@example.com"
              maxLength={254}
            />
            <label htmlFor="draftSubject">Subject</label>
            <input
              id="draftSubject"
              value={draftReview.draft.subject}
              onChange={(e) => updateDraftField("subject", e.target.value)}
              maxLength={200}
            />
            <label htmlFor="draftBody">Email body</label>
            <textarea
              id="draftBody"
              className="review-body"
              value={draftReview.draft.body}
              onChange={(e) => updateDraftField("body", e.target.value)}
              maxLength={20_000}
            />

            {draftReview.result && (
              <p className={draftReview.draft.status === "sent" ? "send-success" : "form-error"}>
                {draftReview.result}
              </p>
            )}

            <div className="modal-actions">
              <button type="button" onClick={saveDraft} disabled={draftBusy}>
                Save draft
              </button>
              <button
                type="button"
                onClick={approveDraft}
                disabled={draftBusy || draftReview.draft.status === "sent"}
              >
                Approve this version
              </button>
              <button
                className="primary"
                type="button"
                onClick={sendDraft}
                disabled={
                  draftBusy ||
                  draftReview.dirty ||
                  draftReview.draft.status !== "approved" ||
                  !draftReview.recipient
                }
              >
                {mailMode === "mock" ? "Record mock send" : "Send with Gmail"}
              </button>
              <button type="button" onClick={() => setDraftReview(null)}>
                Close
              </button>
            </div>
            <p className="small muted">
              Editing after approval resets the approval. Gmail acceptance is not proof of delivery.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function ProspectCard({
  prospect,
  onMatch,
  matching,
}: {
  prospect: Prospect;
  onMatch: () => void;
  matching: boolean;
}) {
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
          <span className="small muted">Evidence attached</span>
        </div>
      </div>
      <button type="button" className="primary" onClick={onMatch} disabled={matching}>
        Match verified product & draft
      </button>
    </article>
  );
}

function ProductCard({
  product,
  onUpdated,
}: {
  product: Product;
  onUpdated: (product: Product) => void;
}) {
  const [sourceUrl, setSourceUrl] = useState(product.sourceUrl ?? "");
  const [capabilities, setCapabilities] = useState(product.capabilities.join(", "));
  const [intendedCustomers, setIntendedCustomers] = useState(product.intendedCustomers);
  const [limitations, setLimitations] = useState(product.limitations);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "verified",
          sourceUrl,
          capabilities: capabilities
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          intendedCustomers,
          limitations,
        }),
      });
      const data = (await response.json()) as { product?: Product; error?: string };
      if (!response.ok || !data.product) {
        setMessage(data.error ?? "Could not verify product.");
        return;
      }
      onUpdated(data.product);
      setMessage("Product verified.");
    } catch {
      setMessage("Could not reach the product endpoint.");
    } finally {
      setBusy(false);
    }
  }

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

      {product.status !== "verified" && (
        <form onSubmit={verify} className="verify-form">
          <label htmlFor={`source-${product.id}`}>Verification source URL</label>
          <input
            id={`source-${product.id}`}
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            required
            maxLength={500}
          />
          <label htmlFor={`capabilities-${product.id}`}>Capabilities (comma-separated)</label>
          <input
            id={`capabilities-${product.id}`}
            value={capabilities}
            onChange={(e) => setCapabilities(e.target.value)}
            required
            maxLength={1000}
          />
          <label htmlFor={`customers-${product.id}`}>Intended customers</label>
          <input
            id={`customers-${product.id}`}
            value={intendedCustomers}
            onChange={(e) => setIntendedCustomers(e.target.value)}
            required
            maxLength={500}
          />
          <label htmlFor={`limitations-${product.id}`}>Limitations</label>
          <input
            id={`limitations-${product.id}`}
            value={limitations}
            onChange={(e) => setLimitations(e.target.value)}
            required
            maxLength={500}
          />
          <button type="submit" className="primary" disabled={busy}>
            {busy ? "Verifying…" : "Mark product verified"}
          </button>
          {message && <p className="small form-error">{message}</p>}
        </form>
      )}
      <a href={product.showroomUrl} target="_blank" rel="noopener noreferrer">
        Open NOFA showroom ↗
      </a>
    </article>
  );
}
