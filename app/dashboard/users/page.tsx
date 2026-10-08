"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreVertical, Plus, RefreshCw, Shield, Trash2, UserMinus, UserCheck } from "lucide-react";
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
  deactivatedAt: string | null;
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
  const { role, user: me } = useCurrentUser();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", role: "client" as AppRole });
  const [busy, setBusy] = useState(false);
  const [inviteBanner, setInviteBanner] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-user-menu-trigger]")) return;
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuId(null);
      }
    }
    function close() {
      setMenuId(null);
    }
    if (menuId) {
      document.addEventListener("mousedown", handleClick);
      window.addEventListener("scroll", close, true);
    }
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("scroll", close, true);
    };
  }, [menuId]);

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
      if (data.inviteUrl) await navigator.clipboard.writeText(data.inviteUrl);
      setInviteBanner(
        data.emailSent
          ? `Invite emailed to ${form.email}. The link was also copied (expires in 7 days).`
          : "Email did not send. Invite link copied — send it to the user so they can set a password."
      );
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
      if (data.inviteUrl) await navigator.clipboard.writeText(data.inviteUrl);
      setInviteBanner(
        data.emailSent
          ? "New invite emailed. The link was also copied (expires in 7 days)."
          : "Email did not send. New invite link copied — send it to the user so they can set a password."
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to issue invite");
    } finally {
      setBusy(false);
    }
  }

  async function setDeactivated(id: string, deactivated: boolean) {
    if (
      !window.confirm(
        deactivated
          ? "Deactivate this account? They will not be able to sign in. History is kept."
          : "Reactivate this account so they can sign in again?"
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deactivated }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update user");
      setInviteBanner(deactivated ? "Account deactivated." : "Account reactivated.");
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setBusy(false);
    }
  }

  async function removeUser(id: string) {
    if (
      !window.confirm(
        "Permanently delete this user? Only unused accounts (no work orders or readings) can be deleted."
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete user");
      setInviteBanner("User deleted.");
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete user");
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
                Create & invite
              </Button>
            </div>
          </form>
          <p className="mt-3 text-[11px] text-muted">
            An invite email is sent from noreply@mail.primonenterprises.com. The link is also copied
            as a backup. It expires in 7 days. No password is included in the email.
          </p>
        </Card>

        <Card className="min-w-0 overflow-hidden">
          {loading ? (
            <p className="p-6 text-sm text-muted">Loading users…</p>
          ) : users.length === 0 ? (
            <EmptyState title="No users" description="Create the first invite above." />
          ) : (
            <div className="w-full overflow-x-auto touch-pan-x">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted">
                    <th className="px-6 py-3">Name</th>
                    <th className="px-6 py-3">Email</th>
                    <th className="px-6 py-3">Role</th>
                    <th className="px-6 py-3">Added</th>
                    <th className="px-6 py-3">Status</th>
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
                      <td className="px-6 py-3">
                        {u.deactivatedAt ? (
                          <span className="text-[11px] text-status-critical">Deactivated</span>
                        ) : (
                          <span className="text-[11px] text-status-compliant">Active</span>
                        )}
                      </td>
                      <td className="sticky right-0 bg-white px-6 py-3 text-right">
                        <button
                          type="button"
                          data-user-menu-trigger
                          aria-label={`Actions for ${u.name}`}
                          disabled={busy}
                          onClick={(e) => {
                            if (menuId === u.id) {
                              setMenuId(null);
                              return;
                            }
                            const rect = e.currentTarget.getBoundingClientRect();
                            setMenuPos({
                              top: rect.bottom + 4,
                              right: window.innerWidth - rect.right,
                            });
                            setMenuId(u.id);
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-primon-700 hover:bg-primon-50 disabled:opacity-50"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
      {menuId &&
        menuPos &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-50 w-44 overflow-hidden rounded-lg border border-border bg-white py-1 text-left shadow-elevated"
            style={{ top: menuPos.top, right: menuPos.right }}
          >
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-ink hover:bg-primon-50"
              onClick={() => {
                const id = menuId;
                setMenuId(null);
                void reissue(id);
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              New invite
            </button>
            {me?.id !== menuId && (
              <>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-ink hover:bg-primon-50"
                  onClick={() => {
                    const row = users.find((x) => x.id === menuId);
                    const id = menuId;
                    setMenuId(null);
                    if (row) void setDeactivated(id, !row.deactivatedAt);
                  }}
                >
                  {users.find((x) => x.id === menuId)?.deactivatedAt ? (
                    <UserCheck className="h-3.5 w-3.5" />
                  ) : (
                    <UserMinus className="h-3.5 w-3.5" />
                  )}
                  {users.find((x) => x.id === menuId)?.deactivatedAt
                    ? "Reactivate"
                    : "Deactivate"}
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-status-critical hover:bg-status-criticalTint"
                  onClick={() => {
                    const id = menuId;
                    setMenuId(null);
                    void removeUser(id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
