"use client";

import { useState } from "react";
import Link from "next/link";
import { PrimonLogo } from "@/components/logo";
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
    <main className="flex min-h-screen items-center justify-center bg-canvas px-6 py-16">
      <div className="w-full max-w-sm">
        <PrimonLogo width={160} />
        <h1 className="mt-8 font-display text-2xl text-primon-950">Reset your password</h1>
        {sent ? (
          <p className="mt-3 text-sm text-muted">
            If that email has an account, an invite link was issued. Check email when Resend is
            connected, or ask an Admin to copy a new invite from Users.
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
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        )}
        <Link href="/login" className="mt-6 inline-block text-sm text-primon-700 hover:text-primon-950">
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
