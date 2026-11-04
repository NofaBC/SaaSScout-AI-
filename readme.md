# SaaSScout AI™ — NOFA Lean Pilot

This branch is the **Phase 1 checkpoint** of a lean, NOFA-only pilot. It is not the production application and it does not yet call Exa, an AI provider, or Gmail.

The original single-file prototype remains in [`index.html`](./index.html) and at <https://saasscout-ai.vercel.app/>. It has not been replaced.

## Current status

### Working

- Signed owner session with `httpOnly` cookie and server-side authorization.
- Single NOFA owner workspace (`nofa`) with a future-compatible workspace/member schema.
- Manual prospect intake with required source URL and evidence excerpt.
- Persistent prospects, notes, and pipeline stages in a local JSON store.
- Three product catalog entries, all marked **draft** pending owner verification.
- CSV export with formula-injection neutralization.
- Mock send service and API boundary with approval requirement, idempotency, 24-hour recipient cooldown, and duplicate blocking.
- Security headers and a restrictive CSP.
- Unit tests for session signing, persistence, dedupe, rate limits, CSV safety, validation, and mock send behavior.

### Not connected yet

- Exa live discovery (Phase 2).
- AI matching and drafting (Phase 3).
- Google OAuth and real Gmail sending (Phase 4).
- Firestore persistence and emulator-tested security rules.
- Vercel preview deployment. The local environment did not have usable Vercel CLI authentication.
- Team invitations, workspace switching, role screens, scheduled discovery, Hunter, follow-ups, and inbox monitoring.

## What “Phase 1” means

The application is structured so the later phases replace the mock boundaries rather than rewriting the workflow:

- `lib/store/` is the persistence boundary. The current driver is JSON; Firestore is the next driver.
- `lib/mailer.ts` is the mail boundary. `MockMailer` records results without contacting anyone. A Gmail implementation must be added in Phase 4.
- `lib/send-service.ts` enforces the approval, idempotency, and uncertain-send rules independent of the mail provider.
- `app/api/*` are the authenticated server routes. Provider keys and OAuth tokens must never enter the client.
- `firestore.rules` is the intended production rule set. It is included but not active because no Firebase project is configured.

## Run locally

Requirements: Node.js 22+, npm.

```powershell
npm install --ignore-scripts
```

Create `.env.local` from `.env.example` and set a random `SESSION_SECRET` of at least 32 characters and a pilot-only `MOCK_OWNER_CODE` of at least 8 characters. Do not commit `.env.local`.

```powershell
npm run dev
```

Open `http://localhost:3000/login`.

### Build and test

```powershell
npm run typecheck
npm test
npm run build
```

In this sandbox, Next's TypeScript build subprocess is blocked by the process sandbox. The verified local build command is:

```powershell
$env:SKIP_TYPECHECK_BUILD='1'
npm run build
```

That flag only skips the duplicate type-check subprocess; `npm run typecheck` remains the authoritative TypeScript check. Do not use the flag as a substitute for type checking in CI.

## Environment variables

See [`.env.example`](./.env.example). No secrets are committed. The current checkpoint uses:

- `OWNER_EMAIL` — `nofabusinessconsulting@gmail.com`.
- `AUTH_MODE=mock` — signed owner session. Firebase Auth is not configured.
- `SESSION_SECRET` — at least 32 random characters.
- `MOCK_OWNER_CODE` — pilot-only access code.
- `MAIL_MODE=mock` — no real sending.
- `STORE_DRIVER=json` and `DATA_FILE` — local persistence.

## Security model in this checkpoint

- Every workspace API route calls `requireOwner()` and validates the signed session.
- The owner email is checked against `OWNER_EMAIL`.
- All mutations go through server routes.
- Rate-limit buckets are stored in the local store; they are not yet distributed.
- The JSON store is local-only and not durable on serverless hosting. It must not be used for shared or production data.
- Firestore rules deny client writes and all access to `private` documents. They have not been executed against an emulator in this environment.
- `MockMailer` does not contact Google and has no Gmail token.
- No real prospect email has been sent.

## Known limitations

- Local JSON persistence is not production storage.
- Mock authentication is not production authentication.
- The product catalog has no verified product yet; live matching and sending are blocked by design.
- Gmail OAuth, real Gmail send, and Google verification are Phase 4.
- No reply, bounce, opt-out, or follow-up monitoring.
- No Vercel preview deployment was created in this checkpoint.
- Firestore rules are unexecuted because Java/Firebase Emulator is unavailable here.

## Next checkpoint

Phase 2: Exa on-demand discovery with strict limits, evidence capture, deduplication, honest empty/error states, and a go/no-go review of discovery quality and cost.

## Ownership

SaaSScout AI™ is a NOFA AI Factory™ concept by NOFA Business Consulting, LLC. No open-source license is granted.
