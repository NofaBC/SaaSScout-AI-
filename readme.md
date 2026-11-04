# SaaSScout AI™ — NOFA Pilot

This branch contains the lean NOFA pilot: Firebase owner authentication, Firestore persistence, Exa discovery, evidence-backed product matching, editable outreach, and Gmail OAuth sending with per-email approval.

The original single-file prototype remains in [`index.html`](./index.html) and at <https://saasscout-ai.vercel.app/>. Production and `main` are unchanged.

**Live integration status:** the code is implemented, but no live Exa, Firebase, or Gmail check has been performed. Credentials are not configured in this environment. Do not describe the pilot as production-verified.

## Implemented

- Firebase Google sign-in with owner-email allowlist and HttpOnly session cookie.
- Firestore persistence for prospects, notes, stages, products, drafts, sends, activities, usage, rate limits, and duplicate-send cooldowns.
- Firestore rules: owner-only reads, all client writes denied, server-only collections private.
- Same-origin / Fetch Metadata protection on every state-changing route.
- Exa on-demand discovery with a 5-search/day and 10-result/search limit. No scheduled discovery and no demo fallback.
- Source evidence stored with each prospect: URL, retrieval date, source title, excerpt, summary, and claim type.
- Verified-product matching using deterministic catalog/evidence overlap. **No LLM is called**, so there is no unapproved AI spend. Matching returns `no_match` when no verified product or insufficient evidence exists.
- Editable subject/body outreach introducing NOFA Business Consulting and NOFA AI Factory™, with one verified product, showroom link, signature, and opt-out language.
- Gmail OAuth send-only connection for the authorized owner, encrypted refresh token, connected-account display, test/live send modes, approval-before-send, duplicate blocking, and send-result recording.
- UI for discovery, source review, product verification, draft editing, approval, sending, and connection status.
- 32 mock/unit tests.

## Deliberately excluded

- Automated follow-ups.
- Inbox monitoring, reply detection, and bounce detection.
- Gmail read/modify scopes.
- Subscriptions, Stripe, paid plans, checkout.
- Daily Top 10 AI Opportunities report.
- Hunter or other paid contact enrichment.
- Scheduled discovery.

---

## Exact environment checklist

### Firebase / application

```text
APP_URL=https://<stable-preview-host>
OWNER_EMAIL=nofabusinessconsulting@gmail.com
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=saasscout-ai-pilot.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=saasscout-ai-pilot
NEXT_PUBLIC_FIREBASE_APP_ID=...
FIREBASE_PROJECT_ID=saasscout-ai-pilot
FIREBASE_SERVICE_ACCOUNT_JSON=...
STORE_DRIVER=firestore
```

### Discovery

```text
EXA_API_KEY=...
```

### Gmail

```text
MAIL_MODE=gmail
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://<stable-preview-host>/api/gmail/callback
OAUTH_TOKEN_ENCRYPTION_KEY=...
GMAIL_SEND_MODE=test
GMAIL_TEST_RECIPIENT=<address you control>
```

Use `MAIL_MODE=mock` only when you intentionally want the mock transport. In mock mode the application records a mock send and transmits nothing.

`FIREBASE_SERVICE_ACCOUNT_JSON`, `GOOGLE_CLIENT_SECRET`, and `OAUTH_TOKEN_ENCRYPTION_KEY` are secrets. Set them directly in Vercel or a local `.env.local`; never paste them into chat or commit them.

Do not configure `MOCK_OWNER_CODE` or `SESSION_SECRET`.

---

## Setup

### 1. Firebase project

Use the dedicated **`saasscout-ai-pilot`** project on the Firebase **free/Spark** plan. Do not reuse Judy or another NOFA application’s credentials.

```powershell
firebase login --reauth
firebase projects:create saasscout-ai-pilot --display-name "SaaSScout AI Pilot"
```

In the Firebase Console:

1. Authentication → Sign-in method → enable **Google**.
2. Authentication → Settings → Authorized domains → add `localhost` and the exact preview hostname.
3. Firestore Database → Create database → Production mode → US region.
4. Project settings → General → add a Web app and copy the public config.
5. Project settings → Service accounts → generate a private key JSON.

Set the Firebase/application variables above, then:

```powershell
npm run seed:firestore
npm run firebase:deploy:rules
```

The first authorized owner sign-in creates the single `members/{uid}` record. The seed script creates the workspace and three **draft, unverified** products. It does not verify products.

### 2. Exa

Create an Exa API key and set `EXA_API_KEY`. The implementation uses Exa Search with `category: company`, `type: auto`, up to 10 results, and limited content/highlights. No scheduled searches. No Hunter.

The UI reports a clear setup message when `EXA_API_KEY` is missing. It never substitutes fictional prospects.

### 3. Gmail OAuth

Use the Google Cloud project associated with `saasscout-ai-pilot`.

1. Enable the **Gmail API**.
2. Configure the OAuth consent screen:
   - User type: **External**
   - App name: **SaaSScout AI**
   - Support email and developer contact
   - Authorized domain
   - Privacy-policy URL
3. Add `nofabusinessconsulting@gmail.com` as a test user while the app is in Testing.
4. Create an OAuth client of type **Web application**.
5. Add redirect URIs:
   - `http://localhost:3000/api/gmail/callback`
   - `https://<stable-preview-host>/api/gmail/callback`
6. Request only:
   - `openid`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
   - `https://www.googleapis.com/auth/gmail.send`

No `gmail.readonly` or `gmail.modify` scope is requested. Reply, bounce, and follow-up monitoring are therefore not available.

7. Generate a 32-byte encryption key locally and keep it out of chat:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

8. Set the Gmail variables above and redeploy.
9. Connect the owner account from the Data connections page.
10. Run the first send in `GMAIL_SEND_MODE=test` to `GMAIL_TEST_RECIPIENT` only.
11. After the test is reviewed, set `GMAIL_SEND_MODE=live` and redeploy. Every email still requires explicit **Approve** before **Send**.

If Google is in Testing mode, refresh-token lifetime is limited. For stable use, publish and verify the OAuth app. Send-only access does not require restricted-scope CASA, but standard sensitive-scope verification may still apply.

### 4. Vercel preview

Set the environment variables in the existing NOFA Vercel project under **Preview**. A new subscription or paid upgrade is not required. Redeploy after adding variables.

The preview is protected by Vercel Authentication. Sign in with the owner Vercel account to view it.

---

## Tests

```powershell
npm run typecheck
npm test
npm run build
```

`npm test` is the **mock/unit suite**. It covers authorization, origin checks, persistence logic, dedupe, rate limits, CSV safety, validation, mock send behavior, Exa mapping, verified-product matching, outreach content, Gmail MIME construction, and send-only scope selection.

It does **not** call Firebase, Firestore, Exa, Gmail, or Google. It is not proof that live integrations work.

In this sandbox, Next’s type-check subprocess is blocked; the local build command is:

```powershell
$env:SKIP_TYPECHECK_BUILD='1'
npm run build
```

`npm run typecheck` remains authoritative. Do not use the flag in CI as a substitute for type checking.

---

## Live checks still pending credentials

1. Owner Google sign-in succeeds; a different Google account is rejected.
2. Session cookie is `HttpOnly`, `Secure`, and `SameSite=Lax`.
3. Saved prospects and stages persist across sessions in Firestore.
4. Direct Firestore reads are denied to unauthorized users.
5. Direct Firestore writes to `prospects` are denied for the owner browser.
6. `private`, `rateLimits`, `recipientCooldowns`, `prospectDomains`, and `contactEmails` are unreadable from clients.
7. Cross-origin POST/PATCH returns **403**.
8. Live Exa search returns real companies with source URLs/dates, or an honest empty/error result.
9. Duplicate domains are rejected.
10. A verified product can be matched; an unverified product cannot.
11. A draft is editable; editing resets approval.
12. Gmail OAuth connects exactly `nofabusinessconsulting@gmail.com`.
13. Test-mode send reaches only the configured test recipient.
14. Duplicate send is blocked; uncertain results are not auto-retried.
15. No Gmail read scope is granted.

None of these have been marked passed.

---

## Current blockers

- Firebase CLI credentials are expired; project creation and rules deployment require owner re-auth.
- Vercel token on disk is invalid; preview environment variables must be set by the owner.
- No Firebase service account is available in this environment.
- No Exa or Google OAuth credentials are available.
- No Java runtime is available for the Firestore emulator, so rules have not been executed.
- The Vercel preview is protected and could not be opened without a Vercel session.
- No NOFA product has been verified yet; live matching and outreach therefore return `no_match`.

## Cost status

- No paid services were created.
- No Firebase upgrade was enabled.
- No Vercel upgrade was purchased.
- No AI provider is called by this implementation.
- Exa is optional and remains unconfigured; any future Exa usage is pay-as-you-go.
- Gmail API usage is free for this pilot, subject to Google quotas and policies.
