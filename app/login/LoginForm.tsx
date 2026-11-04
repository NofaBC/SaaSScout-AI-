"use client";

import { useState } from "react";

export default function LoginForm({
  defaultEmail,
  configured,
  mockMode,
}: {
  defaultEmail: string;
  configured: boolean;
  mockMode: boolean;
}) {
  const [email, setEmail] = useState(defaultEmail);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Sign-in failed.");
        return;
      }
      window.location.href = "/app";
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="login-form" onSubmit={submit}>
      <label htmlFor="email">Owner email</label>
      <input
        id="email"
        type="email"
        autoComplete="username"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
        maxLength={254}
      />
      <label htmlFor="code">Mock access code</label>
      <input
        id="code"
        type="password"
        autoComplete="current-password"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        required
        minLength={8}
        maxLength={200}
        disabled={!configured}
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="primary full" type="submit" disabled={busy || !configured}>
        {busy ? "Signing in…" : mockMode ? "Enter owner workspace (mock)" : "Enter workspace"}
      </button>
      <p className="small muted">
        The mock access code is a development credential. It must not be reused for production or
        shared outside the pilot owner.
      </p>
    </form>
  );
}
