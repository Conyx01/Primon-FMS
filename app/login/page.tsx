"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PrimonLogo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Label, TextInput } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: signInError } = await authClient.signIn.email({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message || "Invalid credentials");
        setLoading(false);
        return;
      }

      const session = await authClient.getSession();
      const role = session?.data?.user?.role;

      if (role === "client") {
        router.push("/portal");
      } else if (role === "supervisor") {
        router.push("/dashboard/monitor");
      } else {
        router.push("/dashboard");
      }

    } catch (err) {
      setError("An unexpected error occurred");
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between bg-primon-950 p-12 text-primon-100 lg:flex">
        <PrimonLogo width={190} />
        <div className="max-w-sm">
          <p className="font-display text-[26px] leading-snug text-white">
            "The gas has to reach a lethal dose above 600, consistently, for six days.
            That's what makes a fumigation successful."
          </p>
          <p className="mt-4 text-sm text-primon-400">— Operations standard, Primon Enterprises</p>
        </div>
        <p className="text-xs text-primon-500">
          Setting standard in pest management services since 2010.
        </p>
      </section>

      <section className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="mb-10 lg:hidden">
            <PrimonLogo width={170} />
          </div>
          <p className="text-sm text-brass-600">Welcome to Primon FMS</p>
          <h1 className="mt-1 font-display text-3xl text-primon-950">
            Sign in to your account
          </h1>
          <p className="mt-2 text-sm text-muted">
            Enter your email and password to access the system.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {error && (
              <div className="rounded-lg bg-status-critical/10 p-3 text-sm text-status-critical">
                {error}
              </div>
            )}
            
            <div>
              <Label htmlFor="email">Email address</Label>
              <TextInput
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <TextInput
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button size="lg" className="mt-6 w-full" type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign in
            </Button>
          </form>
        </div>
      </section>
    </main>
  );
}
