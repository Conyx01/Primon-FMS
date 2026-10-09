"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Label, TextInput } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await fetch("/api/password/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <h1 className="font-display text-2xl text-primon-950">Reset your password</h1>
      {sent ? (
        <p className="mt-3 text-sm text-muted">
          If that email has an account, a reset link has been sent. Check your inbox, or ask an
          Admin to issue a new invite from Users.
        </p>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <Label>Email</Label>
            <TextInput
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={busy}>
            {busy ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
      <Link href="/login" className="mt-6 inline-block text-sm text-primon-700 hover:text-primon-950">
        Back to sign in
      </Link>
    </AuthShell>
  );
}
