"use client";

import { useState } from "react";
import {
  getIdToken,
  signInOwnerWithGoogle,
  signOutOwner,
} from "@/lib/firebase/client";

export default function LoginForm({ configured }: { configured: boolean }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured) return;
    setBusy(true);
    setError("");
    try {
      const user = await signInOwnerWithGoogle();
      const idToken = await getIdToken(user);
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
        credentials: "same-origin",
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        await signOutOwner();
        setError(data.error ?? "Sign-in failed.");
        return;
      }
      window.location.href = "/app";
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message.includes("popup")
          ? "Google sign-in was cancelled or blocked."
          : "Could not complete Google sign-in.",
      );
      try {
        await signOutOwner();
      } catch {
        // The popup may never have completed; nothing to sign out.
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="login-form" onSubmit={submit}>
      <button className="primary full" type="submit" disabled={busy || !configured}>
        {busy ? "Opening Google…" : "Continue with Google"}
      </button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <p className="small muted">
        Use `nofabusinessconsulting@gmail.com`. Any other Google account is rejected by the server
        and by Firestore rules.
      </p>
    </form>
  );
}
