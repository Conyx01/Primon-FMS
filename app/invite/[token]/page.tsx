"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Label, TextInput } from "@/components/ui/input";

export default function InvitePage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const token = params.token;
  const [status, setStatus] = useState<"loading" | "valid" | "invalid">("loading");
  const [meta, setMeta] = useState({ name: "", email: "" });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/invite/${encodeURIComponent(token)}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.valid) {
          setStatus("invalid");
          return;
        }
        setMeta({ name: data.name, email: data.email });
        setStatus("valid");
      } catch {
        if (!cancelled) setStatus("invalid");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/invite/${encodeURIComponent(token)}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not set password");
      router.push("/login");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not set password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      {status === "loading" && <p className="text-sm text-muted">Checking invite…</p>}
      {status === "invalid" && (
        <div>
          <h1 className="font-display text-2xl text-primon-950">Invite not valid</h1>
          <p className="mt-2 text-sm text-muted">
            This link has expired or already been used. Ask Primon to send a new invite.
          </p>
        </div>
      )}
      {status === "valid" && (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm font-medium tracking-wide text-primon-600">
            Set your password
          </p>
          <h1 className="font-display text-2xl text-primon-950">Welcome, {meta.name}</h1>
          <p className="text-sm text-muted">{meta.email}</p>
          {error && <p className="text-sm text-status-critical">{error}</p>}
          <div>
            <Label>Password</Label>
            <TextInput
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          <div>
            <Label>Confirm password</Label>
            <TextInput
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          <Button type="submit" disabled={busy} className="w-full" size="lg">
            {busy ? "Saving…" : "Save password and continue"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
