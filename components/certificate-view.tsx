"use client";

import { forwardRef, useState } from "react";
import { CheckCircle2, Lock, Pencil } from "lucide-react";
import { WorkOrder } from "@/lib/types";
import { Card, CardHeader } from "@/components/ui/card";
import { FccStatusPill, DayStatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { Label, TextInput, Select } from "@/components/ui/input";
import { formatDate, formatDateTime, cn } from "@/lib/utils";
import { CertificateQr } from "@/components/certificate-qr";

const SI_FIELDS = [
  ["tobaccoSupplier", "Tobacco / grain supplier"],
  ["supplierAddress", "Supplier address"],
  ["consignee", "Consignee"],
  ["consigneeAddress", "Consignee address"],
  ["cropYear", "Crop year"],
  ["tobaccoType", "Type"],
  ["netWeight", "Net weight"],
  ["quantity", "Quantity"],
  ["gradeName", "Grade name"],
  ["caseNos", "Case Nos."],
  ["countryOfOrigin", "Country of origin"],
  ["location", "Location"],
  ["warehouseSection", "Warehouse section"],
] as const;

function CompactField({
  label,
  value,
  className,
}: {
  label: string;
  value?: string | number;
  className?: string;
}) {
  const empty = value === undefined || value === null || value === "";
  return (
    <div className={className}>
      <dt className="text-[8.5px] font-medium uppercase tracking-[0.12em] text-muted">{label}</dt>
      <dd className={cn("mt-0.5 text-[11.5px] leading-snug", empty ? "italic text-muted/70" : "text-ink")}>
        {empty ? "—" : value}
      </dd>
    </div>
  );
}

function SectionLabel({ n, title }: { n: string; title: string }) {
  return (
    <div className="mb-2.5 flex items-baseline gap-2 border-b border-primon-800/12 pb-1.5">
      <span className="text-[9px] font-semibold text-brass-600">{n}</span>
      <h2 className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-primon-800">{title}</h2>
    </div>
  );
}

export const CertificateView = forwardRef<HTMLElement, {
  workOrder: WorkOrder;
  editableSi?: boolean;
  onSaveSi?: (si: WorkOrder["si"]) => void;
}>(function CertificateView({ workOrder, editableSi = false, onSaveSi }, ref) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(workOrder.si);
  const locked = workOrder.status === "certified";
  const si = editing ? draft : workOrder.si;
  const corrective = workOrder.readings.filter((r) => r.correctiveAction);

  function save() {
    onSaveSi?.(draft);
    setEditing(false);
  }

  return (
    <div className="space-y-4">
      {editableSi && !locked && (
        <div className="no-print">
          {editing ? (
            <Card>
              <CardHeader
                eyebrow="Edit"
                title="Shipping instructions"
                description="Changes update the certificate sheet live. Save before handing off."
                action={
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={save}>
                      Save
                    </Button>
                  </div>
                }
              />
              <div className="grid gap-5 p-6 sm:grid-cols-2">
                {SI_FIELDS.map(([key, label]) => (
                  <div key={key}>
                    <Label>{label}</Label>
                    <TextInput
                      value={draft[key] as string}
                      onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                    />
                  </div>
                ))}
                <div>
                  <Label>Polylined</Label>
                  <Select
                    value={draft.polylined}
                    onChange={(e) =>
                      setDraft({ ...draft, polylined: e.target.value as "Yes" | "No" })
                    }
                  >
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </Select>
                </div>
              </div>
            </Card>
          ) : (
            <div className="flex justify-end">
              <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" /> Edit shipping instructions
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-center overflow-x-auto">
        <article ref={ref} id="certificate-sheet" className="certificate-sheet">
          <div className="relative flex h-full flex-col gap-y-6 px-10 pb-14 pt-10">
            <div>
              <header className="flex items-start justify-between gap-4 border-b-2 border-primon-800 pb-4">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/logo.png"
                    alt="Primon Enterprises Ltd"
                    className="h-11 w-auto object-contain"
                  />
                </div>
                <div className="text-right">
                  <p className="font-display text-[17px] leading-tight text-primon-950">
                    Fumigation Conformance Certificate
                  </p>
                  <p className="num mt-0.5 text-[11px] text-muted">
                    {workOrder.certificateNumber ?? `Pending — ${workOrder.code}`}
                  </p>
                  <div className="mt-1.5 flex justify-end">
                    <FccStatusPill status={workOrder.status} />
                  </div>
                </div>
              </header>

              <dl className="mt-5 grid grid-cols-4 gap-x-4 gap-y-1.5">
                <CompactField label="Sales order no." value={workOrder.salesOrderNo ?? "N/A"} />
                <CompactField label="Shipment no." value={workOrder.shipmentNo} />
                <CompactField label="Delivery no." value={workOrder.deliveryNo} />
                <CompactField label="Work order code" value={workOrder.code} />
              </dl>
            </div>

            <section>
              <SectionLabel n="1" title="Shipping instructions — tobacco / grain description" />
              <dl className="grid grid-cols-4 gap-x-4 gap-y-2">
                <CompactField className="col-span-2" label="Fumigation contractor" value={si.fumigationContractor || "Primon Enterprises Limited"} />
                <CompactField className="col-span-2" label="Tobacco / grain supplier" value={si.tobaccoSupplier} />
                <CompactField className="col-span-2" label="Consignee" value={si.consignee} />
                <CompactField className="col-span-2" label="Supplier address" value={si.supplierAddress} />
                <CompactField className="col-span-2" label="Consignee address" value={si.consigneeAddress} />
                <CompactField label="Crop year" value={si.cropYear} />
                <CompactField label="Type" value={si.tobaccoType} />
                <CompactField label="Net weight" value={si.netWeight} />
                <CompactField label="Quantity" value={si.quantity} />
                <CompactField label="Grade name" value={si.gradeName} />
                <CompactField label="Polylined" value={si.polylined} />
                <CompactField label="Case Nos." value={si.caseNos} />
                <CompactField label="Country of origin" value={si.countryOfOrigin} />
                <CompactField label="Location" value={si.location} />
                <CompactField label="Warehouse section" value={si.warehouseSection} />
                <CompactField label="Client" value={workOrder.client} />
                <CompactField label="Crop" value={workOrder.cropType} />
              </dl>
            </section>

            <section>
              <SectionLabel n="2" title="Fumigation description" />
              <dl className="grid grid-cols-4 gap-x-4 gap-y-2">
                <CompactField
                  label="Type"
                  value={workOrder.fumigation.fumigationType.replace("_", " ")}
                />
                <CompactField label="Fumigant" value={workOrder.fumigation.fumigantName} />
                <CompactField label="Formulation" value={workOrder.fumigation.formulation} />
                <CompactField label="Dose (g/m³)" value={workOrder.fumigation.dose} />
                <CompactField label="Total volume (m³)" value={workOrder.fumigation.totalVolume} />
                <CompactField
                  label="Total fumigant used (g)"
                  value={workOrder.fumigation.totalFumigantUsed}
                />
              </dl>
            </section>

            <section>
              <SectionLabel n="3" title="Fumigation data — 6-day gas readings (lethal threshold 600ppm)" />
              <dl className="mb-2 grid grid-cols-4 gap-x-4 gap-y-1.5">
                <CompactField
                  label="Date fumigant placed"
                  value={workOrder.datePlaced ? formatDate(workOrder.datePlaced) : undefined}
                />
                <CompactField
                  label="Aeration began"
                  value={workOrder.aerationBegan ? formatDate(workOrder.aerationBegan) : undefined}
                />
                <CompactField
                  label="Aeration completed"
                  value={workOrder.aerationCompleted ? formatDate(workOrder.aerationCompleted) : undefined}
                />
                <CompactField
                  label="Duration under gas"
                  value={workOrder.durationHours ? `${workOrder.durationHours} hrs` : undefined}
                />
              </dl>
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-primon-50 text-[8.5px] uppercase tracking-wider text-muted">
                    <th className="px-2 py-1 font-medium">Day</th>
                    <th className="px-2 py-1 font-medium">Airspace (ppm)</th>
                    <th className="px-2 py-1 font-medium">Probe/Case (ppm)</th>
                    <th className="px-2 py-1 font-medium">Ambient °C</th>
                    <th className="px-2 py-1 font-medium">Product °C</th>
                    <th className="px-2 py-1 font-medium">RH %</th>
                    <th className="px-2 py-1 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {workOrder.readings.map((r: any) => {
                    const rh = r.humidity ?? r.relativeHumidityPct;
                    return (
                      <tr key={r.day} className="border-b border-border last:border-0">
                        <td className="px-2 py-1 text-[11px] font-medium text-primon-900">Day {r.day}</td>
                        <td className="num px-2 py-1 text-[11px]">{r.airspace ?? "—"}</td>
                        <td className="num px-2 py-1 text-[11px]">{r.probeCase ?? "—"}</td>
                        <td className="num px-2 py-1 text-[11px]">
                          {r.ambientTemp != null ? r.ambientTemp.toFixed(1) : "—"}
                        </td>
                        <td className="num px-2 py-1 text-[11px]">
                          {r.productTemp != null ? r.productTemp.toFixed(1) : "—"}
                        </td>
                        <td className="num px-2 py-1 text-[11px]">
                          {rh != null ? `${rh}%` : "—"}
                        </td>
                        <td className="px-2 py-1">
                          <DayStatusPill status={r.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {corrective.length > 0 && (
                <div className="mt-2 space-y-1">
                  {corrective.map((r) => (
                    <p key={r.day} className="rounded bg-status-actionTint/70 px-2 py-1 text-[10px] leading-snug text-status-action">
                      <span className="font-medium">Day {r.day} corrective action:</span>{" "}
                      {r.correctiveAction!.note}{" "}
                      <span className="text-muted">
                        — {r.correctiveAction!.loggedBy}, {formatDateTime(r.correctiveAction!.loggedAt)}
                      </span>
                    </p>
                  ))}
                </div>
              )}
            </section>

            <section>
              <SectionLabel n="4" title="Certification & verification" />
              {locked ? (
                <div className="flex items-center justify-between gap-8">
                  <div className="flex min-w-0 items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-status-compliant" />
                    <div>
                      <p className="text-[12.5px] leading-relaxed text-ink">
                        This certificate was generated and certified electronically by the
                        Primon Fumigation Management System. No physical stamp is required —
                        the QR code is the sole mark of authenticity.
                      </p>
                      <p className="mt-3 text-[11px] text-muted">
                        Certified on {workOrder.certifiedAt ? formatDateTime(workOrder.certifiedAt) : "—"}
                        {" · "}
                        {(workOrder.verificationUrl ?? "").replace(/^https?:\/\//, "")}
                      </p>
                      {workOrder.signatures && workOrder.signatures.length > 0 && (
                        <ul className="mt-2 space-y-0.5 text-[10px] text-ink">
                          {workOrder.signatures.map((s) => (
                            <li key={s.role}>
                              <span className="text-muted">{s.role.replaceAll("_", " ")}:</span>{" "}
                              {s.signerName}
                            </li>
                          ))}
                        </ul>
                      )}
                      <p className="mt-1.5 text-[10px] text-muted">
                        Primon Enterprises Limited · Licensed commercial applicator, Malawi Pesticides Control Board
                      </p>
                    </div>
                  </div>
                  {workOrder.verificationUrl && (
                    <CertificateQr
                      value={workOrder.verificationUrl}
                      size={132}
                    />
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-[11px] text-muted">
                  <Lock className="h-3.5 w-3.5" />
                  Preview only — this record is not yet certified. The QR mark is issued when the
                  Operations Manager certifies the FCC.
                </div>
              )}
            </section>
          </div>
        </article>
      </div>
    </div>
  );
});
