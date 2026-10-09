"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, TriangleAlert, ShieldCheck, FileCheck2 } from "lucide-react";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { Topbar } from "@/components/topbar";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GasDayGauge } from "@/components/gas-day-gauge";
import { FccStatusPill } from "@/components/ui/status-pill";
import { FormRow, Label, TextInput, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/kpi";
import { GasReading, FccStatus } from "@/lib/types";
import { LETHAL_THRESHOLD, PRODUCT_TEMP_MINIMUM_C } from "@/lib/status";
import { formatDate } from "@/lib/utils";

type ApiReading = {
  id: string;
  dayNumber: number;
  readingDate: string;
  airspacePpm: number | null;
  probeCasePpm: number | null;
  ambientTempC: number | null;
  productTempC: number | null;
  relativeHumidityPct: number | null;
  status: GasReading["status"];
  correctiveAction?: {
    description: string;
    actionTakenAt: string;
    loggedBy?: { name: string };
  } | null;
};

type FccPayload = {
  id: string;
  status: FccStatus;
  workOrder: {
    id: string;
    code: string;
    client?: { id: string; name: string; email: string } | null;
  };
  fumigationDescription?: {
    fumigationType: string;
    fumigant?: { name: string };
    formulation?: { name: string };
  } | null;
  gasReadings: ApiReading[];
  closeout?: {
    datePlaced: string;
    aerationBegan: string | null;
    aerationCompleted: string | null;
    durationHours: number | null;
  } | null;
};

function mapReading(r: ApiReading): GasReading {
  return {
    day: r.dayNumber,
    date: r.readingDate,
    airspace: r.airspacePpm,
    probeCase: r.probeCasePpm,
    ambientTemp: r.ambientTempC,
    productTemp: r.productTempC,
    humidity: r.relativeHumidityPct,
    status: r.status,
    correctiveAction: r.correctiveAction
      ? {
          note: r.correctiveAction.description,
          loggedBy: r.correctiveAction.loggedBy?.name ?? "Staff",
          loggedAt: r.correctiveAction.actionTakenAt,
        }
      : undefined,
  };
}

function toLocalInput(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function MonitorDetailPage({ params }: { params: { id: string } }) {
  const { role } = useCurrentUser();
  const canIssueCert = role === "ops_manager" || role === "admin";
  const canAttachClient = role === "ops_manager" || role === "admin";
  const [fcc, setFcc] = useState<FccPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logging, setLogging] = useState<number | null>(null);
  const [loggingDay0, setLoggingDay0] = useState(false);
  const [form, setForm] = useState({
    airspace: "",
    probeCase: "",
    ambientTemp: "",
    productTemp: "",
    humidity: "",
  });
  const [day0Form, setDay0Form] = useState({ ambientTemp: "", productTemp: "" });
  const [actionDay, setActionDay] = useState<number | null>(null);
  const [actionNote, setActionNote] = useState("");
  const [datePlaced, setDatePlaced] = useState("");
  const [aerationBegan, setAerationBegan] = useState("");
  const [aerationCompleted, setAerationCompleted] = useState("");
  const [durationHours, setDurationHours] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [signers, setSigners] = useState({
    supervising_fumigator: "",
    supplier_rep: "",
    certifying_officer: "",
  });
  const [clientOptions, setClientOptions] = useState<
    { id: string; name: string; email: string }[]
  >([]);
  const [selectedClientId, setSelectedClientId] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/fccs/${params.id}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load FCC");
    setFcc(data.fcc);
    setSelectedClientId(data.fcc.workOrder?.client?.id ?? "");
    const closeout = data.fcc.closeout;
    if (closeout) {
      setDatePlaced(toLocalInput(closeout.datePlaced));
      setAerationBegan(toLocalInput(closeout.aerationBegan));
      setAerationCompleted(toLocalInput(closeout.aerationCompleted));
      setDurationHours(
        closeout.durationHours != null ? String(closeout.durationHours) : ""
      );
    }
  }, [params.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load FCC");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    if (!canAttachClient) return;
    if (fcc?.workOrder.client?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/users?role=client");
        const data = await res.json();
        if (!cancelled && res.ok) setClientOptions(data.users ?? []);
      } catch {
        // non-blocking
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canAttachClient, fcc?.workOrder.client?.id]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  }

  const readings = (fcc?.gasReadings ?? [])
    .slice()
    .sort((a, b) => a.dayNumber - b.dayNumber);
  const mapped = readings.map(mapReading);
  // Day 0 = pre-fumigation check; Days 1-6 = gas readings
  const day0Reading = mapped.find((r) => r.day === 0) ?? null;
  const mapped16 = mapped.filter((r) => r.day > 0);
  const nextPendingDay = mapped16.find((r) => r.status === "pending")?.day ?? null;
  const allResolved =
    mapped16.length === 6 &&
    mapped16.every((r) => r.status === "compliant" || r.status === "action_taken");
  const hasOpenCritical = mapped16.some((r) => r.status === "critical");
  const closeoutComplete = Boolean(
    fcc?.closeout?.aerationBegan && fcc?.closeout?.aerationCompleted
  );
  const canCertify = allResolved && closeoutComplete && fcc?.status !== "certified";
  const attachedClient = fcc?.workOrder.client ?? null;
  const day0Ready =
    day0Reading != null &&
    day0Reading.ambientTemp != null &&
    day0Reading.productTemp != null &&
    day0Reading.productTemp >= PRODUCT_TEMP_MINIMUM_C;
  const canUpdateDay0 = mapped16.every((r) => r.status === "pending");
  const canLogGasReading = day0Ready && nextPendingDay !== null;

  async function saveClientAttach() {
    if (!fcc || !selectedClientId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/work-orders/${fcc.workOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: selectedClientId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to attach client");
      await load();
      showToast("Client attached — they will see this job in the portal.");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to attach client");
    } finally {
      setSaving(false);
    }
  }

  async function recordDatePlaced() {
    if (!datePlaced) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/fccs/${params.id}/date-placed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datePlaced: new Date(datePlaced).toISOString() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record date");
      await load();
      showToast("Date fumigant placed recorded — 6-day window opened.");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to record date");
    } finally {
      setSaving(false);
    }
  }

  async function submitDay0Reading() {
    const row = readings.find((r) => r.dayNumber === 0);
    if (!row) return;
    if (!day0Form.ambientTemp || !day0Form.productTemp) return;
    setSaving(true);
    try {
      const res = await fetch("/api/readings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          readingId: row.id,
          ambientTempC: Number(day0Form.ambientTemp),
          productTempC: Number(day0Form.productTemp),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save Day 0 check");
      await load();
      const prod = Number(day0Form.productTemp);
      if (prod < PRODUCT_TEMP_MINIMUM_C) {
        showToast(
          `Day 0 recorded — product temp ${prod}°C is below ${PRODUCT_TEMP_MINIMUM_C}°C. Days 1–6 stay locked until it meets the minimum.`
        );
      } else {
        showToast("Day 0 pre-fumigation check recorded — product temp meets minimum.");
      }
      setLoggingDay0(false);
      setDay0Form({ ambientTemp: "", productTemp: "" });
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to save Day 0 check");
    } finally {
      setSaving(false);
    }
  }

  async function submitReading(day: number) {
    const row = readings.find((r) => r.dayNumber === day);
    if (!row) return;
    setSaving(true);
    try {
      const res = await fetch("/api/readings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          readingId: row.id,
          airspacePpm: Number(form.airspace),
          probeCasePpm: Number(form.probeCase),
          ambientTempC: form.ambientTemp || null,
          productTempC: form.productTemp || null,
          relativeHumidityPct: form.humidity || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save reading");
      await load();
      if (data.reading.status === "critical") {
        showToast(`Day ${day} flagged critical — Ops Manager/Admin notified in-app.`);
      } else {
        showToast(`Day ${day} reading saved — compliant.`);
      }
      setLogging(null);
      setForm({ airspace: "", probeCase: "", ambientTemp: "", productTemp: "", humidity: "" });
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to save reading");
    } finally {
      setSaving(false);
    }
  }

  async function submitCorrectiveAction(day: number) {
    const row = readings.find((r) => r.dayNumber === day);
    if (!row || !actionNote.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/readings/${row.id}/corrective-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: actionNote.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to log action");
      await load();
      showToast(`Corrective action logged for Day ${day}.`);
      setActionDay(null);
      setActionNote("");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to log action");
    } finally {
      setSaving(false);
    }
  }

  async function certifyFcc() {
    if (!canCertify || !canIssueCert) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/fccs/${params.id}/certify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signatures: [
            { role: "supervising_fumigator", signerName: signers.supervising_fumigator },
            { role: "supplier_rep", signerName: signers.supplier_rep },
            { role: "certifying_officer", signerName: signers.certifying_officer },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to certify");
      await load();
      showToast(`Certified ${data.fcc.certificateNumber}`);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to certify");
    } finally {
      setSaving(false);
    }
  }

  async function saveCloseout() {
    setSaving(true);
    try {
      const res = await fetch(`/api/fccs/${params.id}/closeout`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aerationBegan: aerationBegan ? new Date(aerationBegan).toISOString() : null,
          aerationCompleted: aerationCompleted
            ? new Date(aerationCompleted).toISOString()
            : null,
          durationHours: durationHours ? Number(durationHours) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save close-out");
      await load();
      showToast("Close-out saved.");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to save close-out");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div>
        <Topbar title="Gas-reading monitor" />
        <div className="px-6 py-8 lg:px-10">
          <p className="text-sm text-muted">Loading work order…</p>
        </div>
      </div>
    );
  }

  if (error || !fcc) {
    return (
      <div>
        <Topbar title="Gas-reading monitor" />
        <div className="px-6 py-8 lg:px-10">
          <EmptyState
            title="Work order not found"
            description={error ?? "It may have been removed."}
          />
        </div>
      </div>
    );
  }

  const fumigantLabel = fcc.fumigationDescription?.fumigant?.name?.replaceAll("_", " ") ?? "—";
  const formulationLabel =
    fcc.fumigationDescription?.formulation?.name?.replaceAll("_", " ") ?? "—";
  const typeLabel = fcc.fumigationDescription?.fumigationType?.replaceAll("_", " ") ?? "—";

  return (
    <div className="pb-16">
      <Topbar
        title={fcc.workOrder.code}
        description={fcc.workOrder.client?.name ?? "—"}
        action={<FccStatusPill status={fcc.status} />}
      />

      <div className="px-6 py-8 lg:px-10">
        <Link
          href="/dashboard/monitor"
          className="mb-6 inline-flex items-center gap-1.5 text-xs font-medium text-primon-700 hover:text-primon-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All monitored work orders
        </Link>

        {toast && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-primon-200 bg-white px-4 py-3 text-sm text-primon-900 shadow-card">
            <ShieldCheck className="h-4 w-4 text-brass-500" />
            {toast}
          </div>
        )}

        <Card className="mb-6 p-6">
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted">Fumigant</p>
              <p className="mt-1 text-sm font-medium capitalize text-ink">{fumigantLabel}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Formulation</p>
              <p className="mt-1 text-sm font-medium capitalize text-ink">{formulationLabel}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Type</p>
              <p className="mt-1 text-sm font-medium capitalize text-ink">{typeLabel}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Date fumigant placed</p>
              <p className="mt-1 text-sm font-medium text-ink">
                {fcc.closeout?.datePlaced ? formatDate(fcc.closeout.datePlaced) : "—"}
              </p>
            </div>
          </div>
          {canAttachClient && attachedClient && (
            <div className="mt-5 border-t border-border pt-5">
              <p className="text-xs text-muted">Portal client</p>
              <p className="mt-1 text-sm font-medium text-ink">
                {attachedClient.name} — {attachedClient.email}
              </p>
            </div>
          )}
          {canAttachClient && !attachedClient && (
            <div className="mt-5 flex flex-wrap items-end gap-3 border-t border-border pt-5">
              <div className="min-w-[220px] flex-1">
                <FormRow label="Portal client">
                  <Select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                  >
                    <option value="">Select a client…</option>
                    {clientOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} — {c.email}
                      </option>
                    ))}
                  </Select>
                </FormRow>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={saveClientAttach}
                disabled={saving || !selectedClientId}
              >
                Attach client
              </Button>
            </div>
          )}
        </Card>

        {!fcc.closeout && (
          <Card className="mb-6 p-6">
            <p className="mb-1 font-display text-lg text-primon-950">Date fumigant placed</p>
            <p className="mb-4 text-xs text-muted">
              Recording this date opens a 6-day monitoring window (Sundays skipped automatically;
              public holidays are adjusted manually by Ops). Day 0 pre-fumigation check is created
              on the placed date itself.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <FormRow label="Date & time placed" required>
                <TextInput
                  type="datetime-local"
                  value={datePlaced}
                  onChange={(e) => setDatePlaced(e.target.value)}
                />
              </FormRow>
              <Button onClick={recordDatePlaced} disabled={!datePlaced || saving}>
                Open 6-day window
              </Button>
            </div>
          </Card>
        )}

        {hasOpenCritical && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-status-critical/30 bg-status-criticalTint px-5 py-4">
            <TriangleAlert className="h-5 w-5 shrink-0 text-status-critical" />
            <p className="text-sm text-status-critical">
              A reading below {LETHAL_THRESHOLD}ppm is currently unresolved. Log a corrective action
              to continue toward certification.
            </p>
          </div>
        )}

        {/* Day 0 — pre-fumigation temperature check */}
        {day0Reading && (
          <Card className="mb-6">
            <CardHeader
              title="Day 0 — Pre-Fumigation Check"
              description={`Ambient and product temperature on the day fumigant is placed. Product temp must be ≥ ${PRODUCT_TEMP_MINIMUM_C}°C before Days 1–6 can be logged.`}
            />
            <div className="px-6 pb-6">
              {loggingDay0 ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2 max-w-sm">
                      <div>
                        <label className="block text-xs font-medium text-muted mb-1">
                          Ambient Temp (°C) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primon-500"
                          value={day0Form.ambientTemp}
                          autoFocus
                          onChange={(e) => setDay0Form({ ...day0Form, ambientTemp: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted mb-1">
                          Product Temp (°C) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primon-500"
                          value={day0Form.productTemp}
                          onChange={(e) => setDay0Form({ ...day0Form, productTemp: e.target.value })}
                        />
                        {day0Form.productTemp && Number(day0Form.productTemp) < PRODUCT_TEMP_MINIMUM_C && (
                          <p className="mt-1 text-[11px] text-amber-600">
                            Below {PRODUCT_TEMP_MINIMUM_C}°C — Days 1–6 stay locked until this meets the minimum.
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={() => setLoggingDay0(false)}>Cancel</Button>
                      <Button
                        onClick={submitDay0Reading}
                        disabled={!day0Form.ambientTemp || !day0Form.productTemp || saving}
                      >
                        Save pre-fumigation check
                      </Button>
                    </div>
                  </div>
              ) : day0Reading.status === "pending" ? (
                  <Button size="sm" variant="secondary" onClick={() => {
                    setDay0Form({
                      ambientTemp: day0Reading.ambientTemp != null ? String(day0Reading.ambientTemp) : "",
                      productTemp: day0Reading.productTemp != null ? String(day0Reading.productTemp) : "",
                    });
                    setLoggingDay0(true);
                  }}>
                    Record pre-fumigation temperatures
                  </Button>
              ) : (
                <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-8 text-sm">
                  <div>
                    <p className="text-xs text-muted">Ambient Temp</p>
                    <p className="mt-0.5 font-medium text-ink">
                      {day0Reading.ambientTemp != null ? `${day0Reading.ambientTemp}°C` : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Product Temp</p>
                    <p
                      className={`mt-0.5 font-medium ${
                        (day0Reading.productTemp ?? 0) < PRODUCT_TEMP_MINIMUM_C
                          ? "text-amber-600"
                          : "text-status-compliant"
                      }`}
                    >
                      {day0Reading.productTemp != null ? `${day0Reading.productTemp}°C` : "—"}
                      {day0Reading.productTemp != null && day0Reading.productTemp >= PRODUCT_TEMP_MINIMUM_C && (
                        <span className="ml-1 text-[10px]">✓ ≥ {PRODUCT_TEMP_MINIMUM_C}°C</span>
                      )}
                      {day0Reading.productTemp != null && day0Reading.productTemp < PRODUCT_TEMP_MINIMUM_C && (
                        <span className="ml-1 text-[10px]">⚠ below minimum</span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Date</p>
                    <p className="mt-0.5 font-medium text-ink">{formatDate(day0Reading.date)}</p>
                  </div>
                </div>
                {canUpdateDay0 && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setDay0Form({
                        ambientTemp: day0Reading.ambientTemp != null ? String(day0Reading.ambientTemp) : "",
                        productTemp: day0Reading.productTemp != null ? String(day0Reading.productTemp) : "",
                      });
                      setLoggingDay0(true);
                    }}
                  >
                    Update temperatures
                  </Button>
                )}
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Days 1-6 gauges */}
        {mapped16.length > 0 && (
          <Card>
            <CardHeader
              title="6-day monitoring window"
              description="Airspace and Probe/Case readings, checked against the 600ppm lethal threshold."
            />
            {!day0Ready && (
              <p className="px-6 text-xs text-amber-700">
                {day0Reading?.productTemp != null &&
                day0Reading.productTemp < PRODUCT_TEMP_MINIMUM_C
                  ? `Days 1–6 are locked until product temperature is at least ${PRODUCT_TEMP_MINIMUM_C}°C.`
                  : "Record Day 0 pre-fumigation temperatures before logging Days 1–6."}
              </p>
            )}
            <div className="grid grid-cols-2 gap-4 p-6 sm:grid-cols-3 lg:grid-cols-6">
              {mapped16.map((r) => (
                <div key={r.day} className="space-y-2">
                  <GasDayGauge reading={r} />
                  {canLogGasReading && r.status === "pending" && r.day === nextPendingDay && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full"
                      onClick={() => setLogging(r.day)}
                    >
                      Log reading
                    </Button>
                  )}
                  {r.status === "critical" && (
                    <Button
                      size="sm"
                      variant="danger"
                      className="w-full"
                      onClick={() => setActionDay(r.day)}
                    >
                      Log action
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {logging !== null && (
          <Card className="mt-6 p-6">
            <p className="mb-4 font-display text-lg text-primon-950">Log Day {logging} reading</p>
            <div className="grid gap-5 sm:grid-cols-5">
              <FormRow label="Airspace (ppm)" required>
                <TextInput
                  type="number"
                  autoFocus
                  value={form.airspace}
                  onChange={(e) => setForm({ ...form, airspace: e.target.value })}
                />
              </FormRow>
              <FormRow label="Probe/Case (ppm)" required>
                <TextInput
                  type="number"
                  value={form.probeCase}
                  onChange={(e) => setForm({ ...form, probeCase: e.target.value })}
                />
              </FormRow>
              <FormRow label="Ambient temp (°C)">
                <TextInput
                  type="number"
                  value={form.ambientTemp}
                  onChange={(e) => setForm({ ...form, ambientTemp: e.target.value })}
                />
              </FormRow>
              <FormRow label="Product temp (°C)">
                <TextInput
                  type="number"
                  value={form.productTemp}
                  onChange={(e) => setForm({ ...form, productTemp: e.target.value })}
                />
              </FormRow>
              <FormRow label="Relative humidity (%)">
                <TextInput
                  type="number"
                  value={form.humidity}
                  onChange={(e) => setForm({ ...form, humidity: e.target.value })}
                />
              </FormRow>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setLogging(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => submitReading(logging)}
                disabled={!form.airspace || !form.probeCase || saving}
              >
                Save reading
              </Button>
            </div>
          </Card>
        )}

        {actionDay !== null && (
          <Card className="mt-6 border-status-critical/30 p-6">
            <p className="mb-1 font-display text-lg text-primon-950">
              Corrective action — Day {actionDay}
            </p>
            <p className="mb-4 text-xs text-muted">
              Describe the action taken to restore gas concentration above {LETHAL_THRESHOLD}ppm.
            </p>
            <Label>Action taken</Label>
            <textarea
              className="h-24 w-full rounded-lg border border-border p-3 text-sm outline-none focus:border-primon-500"
              placeholder="e.g. Additional fumigant dosing applied; re-sealed and re-checked."
              value={actionNote}
              onChange={(e) => setActionNote(e.target.value)}
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setActionDay(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => submitCorrectiveAction(actionDay)}
                disabled={!actionNote.trim() || saving}
              >
                Confirm action
              </Button>
            </div>
          </Card>
        )}

        {fcc.closeout && (
          <Card className="mt-6 p-6">
            <p className="mb-1 font-display text-lg text-primon-950">Fumigation close-out</p>
            <p className="mb-4 text-xs text-muted">
              Aeration times are recorded here. They are not stamped automatically at certification.
            </p>
            <div className="grid gap-5 sm:grid-cols-3">
              <FormRow label="Aeration began">
                <TextInput
                  type="datetime-local"
                  value={aerationBegan}
                  onChange={(e) => setAerationBegan(e.target.value)}
                />
              </FormRow>
              <FormRow label="Aeration completed">
                <TextInput
                  type="datetime-local"
                  value={aerationCompleted}
                  onChange={(e) => setAerationCompleted(e.target.value)}
                />
              </FormRow>
              <FormRow label="Duration / total hours under gas">
                <TextInput
                  type="number"
                  value={durationHours}
                  onChange={(e) => setDurationHours(e.target.value)}
                  placeholder="Auto from aeration times if blank"
                />
              </FormRow>
            </div>
            <div className="mt-5 flex justify-end">
              <Button onClick={saveCloseout} disabled={saving}>
                Save close-out
              </Button>
            </div>
          </Card>
        )}

        {canIssueCert && fcc.status !== "certified" && (
          <Card className="mt-6 p-6">
            <p className="mb-1 font-display text-lg text-primon-950">Certification sign-off</p>
            <p className="mb-4 text-xs text-muted">
              Names and a system timestamp stand in for wet signatures. Certifying locks the record
              and issues the QR verification URL.
            </p>
            <div className="grid gap-5 sm:grid-cols-3">
              <FormRow label="Supervising Fumigator" required>
                <TextInput
                  value={signers.supervising_fumigator}
                  onChange={(e) =>
                    setSigners({ ...signers, supervising_fumigator: e.target.value })
                  }
                />
              </FormRow>
              <FormRow label="For the Supplier" required>
                <TextInput
                  value={signers.supplier_rep}
                  onChange={(e) => setSigners({ ...signers, supplier_rep: e.target.value })}
                />
              </FormRow>
              <FormRow label="Certifying Officer" required>
                <TextInput
                  value={signers.certifying_officer}
                  onChange={(e) =>
                    setSigners({ ...signers, certifying_officer: e.target.value })
                  }
                />
              </FormRow>
            </div>
          </Card>
        )}

        <div className="mt-8 flex items-center justify-between rounded-xl border border-border bg-white p-6 shadow-card">
          <div className="flex items-center gap-3">
            <FileCheck2 className="h-5 w-5 text-brass-600" />
            <div>
              <p className="text-sm font-medium text-primon-950">
                {fcc.status === "certified"
                  ? "Certified"
                  : canCertify
                    ? "Ready to certify"
                    : "Certification pending"}
              </p>
              <p className="text-xs text-muted">
                {fcc.status === "certified"
                  ? "This FCC is locked. Scan the QR on the certificate to open the public summary."
                  : canCertify
                    ? "All 6 gas-reading days resolved and close-out recorded. Enter the three signers, then certify."
                    : "Complete all 6 daily gas readings (Days 1-6), resolve critical flags, and record aeration close-out before certifying."}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href={`/certificate/${fcc.workOrder.id}`}>
              <Button variant="secondary">
                {fcc.status === "certified" ? "View certificate" : "Preview certificate"}
              </Button>
            </Link>
            <Button
              variant="brass"
              onClick={certifyFcc}
              disabled={
                !canCertify ||
                !canIssueCert ||
                saving ||
                fcc.status === "certified" ||
                !signers.supervising_fumigator.trim() ||
                !signers.supplier_rep.trim() ||
                !signers.certifying_officer.trim()
              }
            >
              {fcc.status === "certified" ? "Certified" : "Certify FCC"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
