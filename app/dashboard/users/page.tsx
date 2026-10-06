"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Plus, RefreshCw, Shield } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/kpi";
import { FormRow, Select, TextInput } from "@/components/ui/input";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { formatDate } from "@/lib/utils";

type AppRole = "admin" | "ops_manager" | "supervisor" | "client" | "executive";

interface AppUser {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  createdAt: string;
  _count?: { clientWorkOrders: number };
}

const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Admin",
  ops_manager: "Ops manager",
  supervisor: "Supervisor",
  client: "Client",
  executive: "Executive",
};

export default function UsersPage() {
  const { role } = useCurrentUser();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", role: "client" as AppRole });
  const [busy, setBusy] = useState(false);
  const [inviteBanner, setInviteBanner] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load users");
      setUsers(data.users ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    setInviteBanner("Invite link copied. Send it to the user — they set their own password.");
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create user");
      setForm({ name: "", email: "", role: "client" });
      if (data.inviteUrl) await copy(data.inviteUrl);
      else setInviteBanner("User created. Email send is pending Resend.");
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setBusy(false);
    }
  }

  async function reissue(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${id}/invite`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to issue invite");
      if (data.inviteUrl) await copy(data.inviteUrl);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to issue invite");
    } finally {
      setBusy(false);
    }
  }

  if (role && role !== "admin") {
    return (
      <div>
        <Topbar title="Users" description="Admin only" />
        <div className="px-6 py-8 lg:px-10">
          <EmptyState title="Restricted" description="Only an Admin can manage logins and invites." />
        </div>
      </div>
    );
  }

  return (
    <div>
      <Topbar
        title="Users"
        description="Invite staff and clients. They set their own password via the link — no password is emailed."
      />
      <div className="px-6 py-8 lg:px-10 space-y-6">
        {inviteBanner && (
          <div className="rounded-xl border border-primon-200 bg-white px-4 py-3 text-sm text-primon-900">
            {inviteBanner}
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-status-critical/30 bg-status-criticalTint px-4 py-3 text-sm text-status-critical">
            {error}
          </div>
        )}

        <Card className="p-6">
          <p className="mb-4 font-display text-lg text-primon-950">Invite a user</p>
          <form onSubmit={createUser} className="grid gap-4 sm:grid-cols-4">
            <FormRow label="Name" required>
              <TextInput
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </FormRow>
            <FormRow label="Email" required>
              <TextInput
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </FormRow>
            <FormRow label="Role" required>
              <Select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as AppRole })}
              >
                <option value="client">Client</option>
                <option value="supervisor">Supervisor</option>
                <option value="ops_manager">Ops manager</option>
                <option value="admin">Admin</option>
                <option value="executive">Executive</option>
              </Select>
            </FormRow>
            <div className="flex items-end">
              <Button type="submit" disabled={busy}>
                <Plus className="h-3.5 w-3.5" />
                Create & copy invite
              </Button>
            </div>
          </form>
          <p className="mt-3 text-[11px] text-muted">
            Until Resend is connected, copy the invite link and send it on WhatsApp or email yourself.
            The link expires in 7 days.
          </p>
        </Card>

        <Card>
          {loading ? (
            <p className="p-6 text-sm text-muted">Loading users…</p>
          ) : users.length === 0 ? (
            <EmptyState title="No users" description="Create the first invite above." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted">
                    <th className="px-6 py-3">Name</th>
                    <th className="px-6 py-3">Email</th>
                    <th className="px-6 py-3">Role</th>
                    <th className="px-6 py-3">Added</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-border last:border-0">
                      <td className="px-6 py-3 font-medium text-ink">{u.name}</td>
                      <td className="px-6 py-3 text-muted">{u.email}</td>
                      <td className="px-6 py-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-primon-50 px-2 py-0.5 text-[11px] text-primon-800">
                          <Shield className="h-3 w-3" />
                          {ROLE_LABEL[u.role]}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-muted">{formatDate(u.createdAt)}</td>
                      <td className="px-6 py-3 text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={busy}
                          onClick={() => reissue(u.id)}
                        >
                          <RefreshCw className="h-3 w-3" />
                          New invite
                          <Copy className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
