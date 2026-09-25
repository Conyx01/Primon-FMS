"use client";

import { useCallback, useEffect, useState } from "react";
import { Users, Plus, Pencil, Phone, Mail, CalendarCheck } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/kpi";
import { FormRow, TextInput } from "@/components/ui/input";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

interface HouseholdClient {
  id: string;
  name: string;
  contactEmail: string;
  contactPhone: string | null;
  address: string | null;
  lastServiceDate: string | null;
  createdAt: string;
}

const emptyForm = {
  name: "",
  contactEmail: "",
  contactPhone: "",
  address: "",
  lastServiceDate: "",
};

// ── Page ───────────────────────────────────────────────────────────────────

export default function HouseholdPage() {
  const [clients, setClients] = useState<HouseholdClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Modal state
  const [modal, setModal] = useState<{
    mode: "create" | "edit";
    client?: HouseholdClient;
    form: typeof emptyForm;
    busy: boolean;
    error: string | null;
  } | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch("/api/household/clients");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setClients(data.clients ?? []);
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : "Failed to load clients");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Open modals ────────────────────────────────────────────────────────

  function openCreate() {
    setModal({ mode: "create", form: { ...emptyForm }, busy: false, error: null });
  }

  function openEdit(c: HouseholdClient) {
    setModal({
      mode: "edit",
      client: c,
      form: {
        name: c.name,
        contactEmail: c.contactEmail,
        contactPhone: c.contactPhone ?? "",
        address: c.address ?? "",
        lastServiceDate: c.lastServiceDate
          ? new Date(c.lastServiceDate).toISOString().split("T")[0]
          : "",
      },
      busy: false,
      error: null,
    });
  }

  // ── Submit ─────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!modal) return;
    setModal((m) => m && { ...m, busy: true, error: null });

    const { form, mode, client } = modal;
    const url =
      mode === "create"
        ? "/api/household/clients"
        : `/api/household/clients/${client!.id}`;
    const method = mode === "create" ? "POST" : "PATCH";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          contactEmail: form.contactEmail,
          contactPhone: form.contactPhone || null,
          address: form.address || null,
          lastServiceDate: form.lastServiceDate || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");

      setModal(null);
      await load();
    } catch (err: unknown) {
      setModal((m) =>
        m && { ...m, busy: false, error: err instanceof Error ? err.message : "Save failed" }
      );
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div>
      <Topbar
        title="Household clients"
        description="Residential pest control clients eligible for 6-month service reminders"
        action={
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
            Add client
          </Button>
        }
      />

      <div className="px-6 py-8 lg:px-10">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl border border-border bg-primon-50/40" />
            ))}
          </div>
        ) : fetchError ? (
          <div className="rounded-xl border border-status-critical/30 bg-status-criticalTint p-4 text-sm text-status-critical">
            {fetchError}
          </div>
        ) : clients.length === 0 ? (
          <EmptyState
            title="No household clients yet"
            description="Add a residential pest control client to track their service history and receive 6-month reminders."
          />
        ) : (
          <div className="space-y-3">
            {clients.map((c) => {
              const monthsSince = c.lastServiceDate
                ? Math.floor(
                    (Date.now() - new Date(c.lastServiceDate).getTime()) /
                      (1000 * 60 * 60 * 24 * 30)
                  )
                : null;
              const isDue = monthsSince !== null && monthsSince >= 6;

              return (
                <Card key={c.id} className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-3.5">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primon-50 text-primon-700">
                        <Users className="h-4.5 w-4.5" strokeWidth={1.75} />
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-primon-950">{c.name}</p>
                          {isDue && (
                            <span className="rounded-full bg-brass-100 px-2 py-0.5 text-[10px] font-medium text-brass-700">
                              Reminder due
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                          <Mail className="h-3 w-3" />
                          {c.contactEmail}
                          {c.contactPhone && (
                            <>
                              <span className="mx-1 text-border">·</span>
                              <Phone className="h-3 w-3" />
                              {c.contactPhone}
                            </>
                          )}
                        </p>
                        {c.address && (
                          <p className="mt-1 text-xs text-muted">{c.address}</p>
                        )}
                        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted">
                          <CalendarCheck className="h-3 w-3" />
                          {c.lastServiceDate
                            ? `Last serviced ${formatDateTime(c.lastServiceDate)}${monthsSince !== null ? ` (${monthsSince} month${monthsSince !== 1 ? "s" : ""} ago)` : ""}`
                            : "No service date recorded"}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEdit(c)}
                    >
                      <Pencil className="mr-1 h-3 w-3" strokeWidth={1.75} />
                      Edit
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <Card className="w-full max-w-md p-6">
            <h2 className="font-display text-base font-semibold text-primon-950">
              {modal.mode === "create" ? "Add household client" : "Edit household client"}
            </h2>

            {modal.error && (
              <p className="mt-3 text-xs text-status-critical">{modal.error}</p>
            )}

            <div className="mt-5 space-y-4">
              <FormRow label="Full name / organisation" required>
                <TextInput
                  placeholder="e.g. Chisomo Banda"
                  value={modal.form.name}
                  onChange={(e) =>
                    setModal((m) => m && { ...m, form: { ...m.form, name: e.target.value } })
                  }
                />
              </FormRow>
              <FormRow label="Email" required>
                <TextInput
                  type="email"
                  placeholder="e.g. chisomo@example.com"
                  value={modal.form.contactEmail}
                  onChange={(e) =>
                    setModal((m) =>
                      m && { ...m, form: { ...m.form, contactEmail: e.target.value } }
                    )
                  }
                />
              </FormRow>
              <FormRow label="Phone (optional)">
                <TextInput
                  placeholder="e.g. 0991 234 567"
                  value={modal.form.contactPhone}
                  onChange={(e) =>
                    setModal((m) =>
                      m && { ...m, form: { ...m.form, contactPhone: e.target.value } }
                    )
                  }
                />
              </FormRow>
              <FormRow label="Address (optional)">
                <TextInput
                  placeholder="e.g. Area 47, Lilongwe"
                  value={modal.form.address}
                  onChange={(e) =>
                    setModal((m) =>
                      m && { ...m, form: { ...m.form, address: e.target.value } }
                    )
                  }
                />
              </FormRow>
              <FormRow label="Last service date (optional)">
                <TextInput
                  type="date"
                  value={modal.form.lastServiceDate}
                  onChange={(e) =>
                    setModal((m) =>
                      m && { ...m, form: { ...m.form, lastServiceDate: e.target.value } }
                    )
                  }
                />
              </FormRow>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setModal(null)}
                disabled={modal.busy}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={modal.busy || !modal.form.name || !modal.form.contactEmail}
              >
                {modal.busy
                  ? modal.mode === "create"
                    ? "Adding…"
                    : "Saving…"
                  : modal.mode === "create"
                  ? "Add client"
                  : "Save changes"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
