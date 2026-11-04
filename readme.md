# SaaSScout AI™ — NOFA Foundation Checkpoint

This branch is the **Firebase foundation checkpoint** for the lean NOFA pilot. It is not the production application, and real discovery, AI matching, and Gmail sending remain disabled.

The original single-file prototype remains in [`index.html`](./index.html) and at <https://saasscout-ai.vercel.app/>. Production and `main` are unchanged.

## Implemented in this checkpoint

- **Firebase Authentication** with Google sign-in.
- Server-created **Firebase session cookie** (`__session`) using the Admin SDK.
- Owner-email allowlist for `nofabusinessconsulting@gmail.com`.
- **Firestore persistence** for prospects, notes, stages, products, drafts, sends, activities, usage, rate limits, and duplicate-send records.
- Firestore authorization rules with owner-only reads and **all client writes denied**.
- Explicit **same-origin / Fetch Metadata** protection on state-changing routes.
- Server-only Firebase Admin configuration; no service account in client code.
- CSV export with formula-injection neutralization.
- Mock mail boundary retained; no Gmail OAuth, token, or real send.
- Unit tests for authorization, origin checks, persistence logic, dedupe, rate limits, CSV, validation, and mock send behavior.

## Not yet verified or enabled

- No live Firebase project has been created from this environment.
- No production Firestore rules deployment has been performed.
- No live Firebase Auth login has been exercised against a real project.
- Firestore emulator/rules tests were not run because the environment has no Java runtime.
- Vercel CLI authentication is invalid, so preview environment variables were not set.
- The Vercel preview is protected by Vercel Authentication.
- Real Exa, AI, and Gmail integrations remain disabled.

## Local setup

Requirements: Node.js 24 (the Firebase web SDK engine requirement).

```powershell
npm install --ignore-scripts
```

Create `.env.local` from `.env.example`. Do not commit it and do not paste secrets into chat.

### Firebase project setup (owner)

Use the dedicated **`saasscout-ai-pilot`** project on the Firebase **free/Spark** plan. Do not reuse Judy or another NOFA application’s credentials.

1. Re-authenticate the Firebase CLI:
   ```powershell
   firebase login --reauth
   ```
2. Create the project if it does not exist:
   ```powershell
   firebase projects:create saasscout-ai-pilot --display-name "SaaSScout AI Pilot"
   ```
3. In the Firebase Console:
   - Authentication → Sign-in method → enable **Google**.
   - Authentication → Settings → Authorized domains: add `localhost` and the exact preview hostname.
   - Firestore Database → Create database → **Production mode** → choose a US region.
4. Project settings → General → add a **Web app** and copy the public config values.
5. Project settings → Service accounts → generate a private key JSON. Store it in a password manager or Vercel environment variable. Never paste it into chat or commit it.
6. Set `.env.local` values:
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
   - `FIREBASE_PROJECT_ID=saasscout-ai-pilot`
   - `FIREBASE_SERVICE_ACCOUNT_JSON` (single-line JSON or escaped newlines)
   - `OWNER_EMAIL=nofabusinessconsulting@gmail.com`
   - `APP_URL=http://localhost:3000`
   - `MAIL_MODE=mock`
   - `STORE_DRIVER=firestore`
7. Seed the workspace and draft catalog:
   ```powershell
   npm run seed:firestore
   ```
8. Deploy rules and indexes:
   ```powershell
   npm run firebase:deploy:rules
   ```
9. Start the app:
   ```powershell
   npm run dev
   ```
10. Sign in with `nofabusinessconsulting@gmail.com`. The first successful owner sign-in creates the only member record.

### Vercel preview environment

Set these in the existing NOFA Vercel project under the **Preview** environment. A new subscription or paid upgrade is not required.

- `APP_URL` — exact stable preview URL.
- `OWNER_EMAIL`
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_SERVICE_ACCOUNT_JSON` — secret; do not expose to the browser.
- `MAIL_MODE=mock`
- `STORE_DRIVER=firestore`

Do **not** configure `MOCK_OWNER_CODE` or `SESSION_SECRET`; the mock login path has been removed.

## Tests

```powershell
npm run typecheck
npm test
npm run build
```

`npm test` is the **mock/unit suite** and does not call Firebase, Firestore, Exa, an AI provider, Gmail, or Google. It must not be presented as proof that live integrations work.

In this sandbox, Next’s type-check subprocess is blocked, so the local build command is:

```powershell
$env:SKIP_TYPECHECK_BUILD='1'
npm run build
```

`npm run typecheck` remains authoritative. Do not set this flag in CI as a substitute for type checking.

## Live verification required after owner setup

These are the checks that still need a real Firebase project:

1. Sign in with the authorized owner Google account.
2. Confirm the session cookie is `HttpOnly`, `Secure`, and `SameSite=Lax`.
3. Save a prospect, reload, and confirm it persists in Firestore.
4. Sign in with a different Google account and confirm the server rejects it.
5. Read Firestore directly with an unauthorized account and confirm rules deny access.
6. Attempt a client-side write to `workspaces/nofa/prospects` and confirm it is denied.
7. Confirm `private`, `rateLimits`, `recipientCooldowns`, `prospectDomains`, and `contactEmails` are unreadable from the client.
8. Confirm a cross-origin POST/PATCH is rejected with **403**.
9. Confirm the preview has no real Gmail token and `MAIL_MODE=mock`.

## Current blockers

- Firebase CLI credentials are expired; project creation and rules deployment require `firebase login --reauth`.
- Vercel CLI credentials on disk are invalid; preview environment variables must be set through the Vercel dashboard or a valid project token.
- No Firebase service account is available in this environment.
- No Java runtime is available for the Firestore emulator.

## Security model

- Firebase Auth identity, owner-email check, and Firebase session cookie verification.
- Firestore rules deny all client writes and server-only collections.
- All mutations use authenticated server routes with same-origin checks.
- Secrets remain server-side; `NEXT_PUBLIC_*` contains only Firebase web configuration.
- Mock mail cannot contact Google.
- No production deployment, merge, paid upgrade, or shared credential change was made.

## Next checkpoint

Finish live Firebase verification with the owner-provided project/config, then proceed to Exa discovery with strict limits.
