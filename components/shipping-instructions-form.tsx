"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormRow, Select, TextInput } from "@/components/ui/input";
import type { ShippingInstructions } from "@/lib/types";

type Props = {
  workOrderId: string;
  initial: ShippingInstructions;
  onSaved?: (next: ShippingInstructions) => void;
};

export function ShippingInstructionsForm({ workOrderId, initial, onSaved }: Props) {
  const locked = Boolean(initial.locked);
  const [si, setSi] = useState<ShippingInstructions>(initial);
  const [showAdditionalInfo, setShowAdditionalInfo] = useState(
    Boolean(initial.additionalInfo?.trim())
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const isPmi =
    si.certificateTemplate === "pmi" ||
    /philip\s*morris|pmi/i.test(si.consignee || "") ||
    /philip\s*morris|pmi/i.test(si.consigneeAddress || "");

  const hasExistingSi = Boolean(
    initial.tobaccoSupplier?.trim() || initial.consignee?.trim() || initial.complete
  );
  const saveLabel = hasExistingSi || saved ? "Update shipping instructions" : "Save shipping instructions";

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/fccs/${workOrderId}/si`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tobaccoSupplier: si.tobaccoSupplier,
          tobaccoSupplierAddress: si.supplierAddress,
          consignee: si.consignee,
          consigneeAddress: si.consigneeAddress,
          cropYear: si.cropYear,
          tobaccoType: si.productType || si.tobaccoType,
          productType: si.productType || si.tobaccoType,
          netWeight: si.netWeight,
          grossWeight: si.grossWeight,
          quantity: si.quantity,
          polylined: si.polylined,
          gradeName: si.gradeName,
          caseNos: si.caseNos,
          countryOfOrigin: si.countryOfOrigin,
          containerNo: si.containerNo,
          sealNo: si.sealNo,
          additionalInfo: si.additionalInfo,
          certificateTemplate: si.certificateTemplate || (isPmi ? "pmi" : "standard"),
          cigaretteBeetle: si.cigaretteBeetle || "N/A",
          tobaccoMoth: si.tobaccoMoth || "N/A",
          wetDeactivated: si.wetDeactivated !== false,
          location: si.location,
          warehouseSection: si.warehouseSection,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save shipping instructions");
      const next: ShippingInstructions = {
        ...si,
        complete: Boolean(si.tobaccoSupplier && si.consignee),
      };
      setSi(next);
      onSaved?.(next);
      setSaved(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save shipping instructions");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mb-8 p-6">
      <p className="font-display text-lg text-primon-950">Shipping instructions</p>
      <p className="mt-1 text-xs text-muted">
        {locked
          ? "These details are locked because the certificate is certified."
          : "Complete consignor (supplier) and consignee details here. Change any field and update to save again."}
      </p>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <FormRow label="Consignor / Supplier">
          <TextInput
            value={si.tobaccoSupplier}
            disabled={locked}
            onChange={(e) => setSi({ ...si, tobaccoSupplier: e.target.value })}
          />
        </FormRow>
        <FormRow label="Consignor address">
          <TextInput
            value={si.supplierAddress}
            disabled={locked}
            onChange={(e) => setSi({ ...si, supplierAddress: e.target.value })}
          />
        </FormRow>
        <FormRow label="Consignee">
          <TextInput
            value={si.consignee}
            disabled={locked}
            onChange={(e) => setSi({ ...si, consignee: e.target.value })}
          />
        </FormRow>
        <FormRow label="Consignee address">
          <TextInput
            value={si.consigneeAddress}
            disabled={locked}
            onChange={(e) => setSi({ ...si, consigneeAddress: e.target.value })}
          />
        </FormRow>
        <FormRow label="Crop year">
          <TextInput
            value={si.cropYear}
            disabled={locked}
            onChange={(e) => setSi({ ...si, cropYear: e.target.value })}
          />
        </FormRow>
        <FormRow label="Product type">
          <TextInput
            placeholder="e.g. Flue-cured, White Maize, Empty Sacks"
            value={si.productType ?? si.tobaccoType}
            disabled={locked}
            onChange={(e) =>
              setSi({
                ...si,
                productType: e.target.value,
                tobaccoType: e.target.value,
              })
            }
          />
        </FormRow>
        <FormRow label="Net weight">
          <TextInput
            placeholder="e.g. 126,000 KGS"
            value={si.netWeight}
            disabled={locked}
            onChange={(e) => setSi({ ...si, netWeight: e.target.value })}
          />
        </FormRow>
        <FormRow label="Gross weight">
          <TextInput
            placeholder="e.g. 132,000 KGS"
            value={si.grossWeight}
            disabled={locked}
            onChange={(e) => setSi({ ...si, grossWeight: e.target.value })}
          />
        </FormRow>
        <FormRow label="Quantity">
          <TextInput
            value={si.quantity}
            disabled={locked}
            onChange={(e) => setSi({ ...si, quantity: e.target.value })}
          />
        </FormRow>
        <FormRow label="Grade name">
          <TextInput
            value={si.gradeName}
            disabled={locked}
            onChange={(e) => setSi({ ...si, gradeName: e.target.value })}
          />
        </FormRow>
        <FormRow label="Case Nos.">
          <TextInput
            value={si.caseNos}
            disabled={locked}
            onChange={(e) => setSi({ ...si, caseNos: e.target.value })}
          />
        </FormRow>
        <FormRow label="Country of origin">
          <TextInput
            value={si.countryOfOrigin}
            disabled={locked}
            onChange={(e) => setSi({ ...si, countryOfOrigin: e.target.value })}
          />
        </FormRow>
        <FormRow label="Polylined">
          <Select
            value={si.polylined}
            disabled={locked}
            onChange={(e) => setSi({ ...si, polylined: e.target.value as "Yes" | "No" })}
          >
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </Select>
        </FormRow>
        <FormRow label="Container No.">
          <TextInput
            placeholder="e.g. MSKU-9182374"
            value={si.containerNo ?? ""}
            disabled={locked}
            onChange={(e) => setSi({ ...si, containerNo: e.target.value })}
          />
        </FormRow>
        <FormRow label="Seal No.">
          <TextInput
            placeholder="e.g. MLW-849204"
            value={si.sealNo ?? ""}
            disabled={locked}
            onChange={(e) => setSi({ ...si, sealNo: e.target.value })}
          />
        </FormRow>
      </div>

      {/* ── Additional Information (Collapsible) ── */}
      <div className="mt-5 border-t border-border pt-4">
        {!showAdditionalInfo ? (
          <button
            type="button"
            disabled={locked}
            onClick={() => setShowAdditionalInfo(true)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primon-700 hover:text-primon-900 disabled:opacity-50"
          >
            + Add additional information
          </button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-ink">
                Additional Information
              </label>
              {!locked && (
                <button
                  type="button"
                  onClick={() => {
                    setShowAdditionalInfo(false);
                    setSi({ ...si, additionalInfo: "" });
                  }}
                  className="text-xs text-muted hover:text-red-600"
                >
                  Remove
                </button>
              )}
            </div>
            <textarea
              className="h-24 w-full rounded-lg border border-border p-3 text-sm outline-none focus:border-primon-500 disabled:bg-slate-50"
              placeholder="e.g. Acid application specifications, chemical treatment notes, special export clauses..."
              value={si.additionalInfo ?? ""}
              disabled={locked}
              onChange={(e) => setSi({ ...si, additionalInfo: e.target.value })}
            />
          </div>
        )}
      </div>


      {/* ── PMI Compliance & Infestation Details (Only visible for PMI or when selected) ── */}
      {isPmi ? (
        <div className="mt-5 rounded-lg border border-brass-200 bg-primon-50/50 p-4 space-y-4 animate-reveal-up">
          <div className="flex items-center justify-between border-b border-brass-200 pb-2">
            <div>
              <p className="text-xs font-bold text-primon-950 uppercase tracking-wide">
                PMI Compliance & Infestation Declaration (PME Method #751)
              </p>
              <p className="text-[11px] text-muted">
                Required proprietary declaration for Philip Morris International destinations.
              </p>
            </div>
            <span className="rounded bg-brass-100 px-2 py-0.5 text-[10px] font-bold text-brass-800">
              PMI Method #751
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <FormRow label="Cigarette Beetle">
              <Select
                value={si.cigaretteBeetle ?? "N/A"}
                disabled={locked}
                onChange={(e) =>
                  setSi({ ...si, cigaretteBeetle: e.target.value as "Yes" | "No" | "N/A" })
                }
              >
                <option value="N/A">N/A (Standard / Uninfested)</option>
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </Select>
            </FormRow>

            <FormRow label="Tobacco Moth">
              <Select
                value={si.tobaccoMoth ?? "N/A"}
                disabled={locked}
                onChange={(e) =>
                  setSi({ ...si, tobaccoMoth: e.target.value as "Yes" | "No" | "N/A" })
                }
              >
                <option value="N/A">N/A (Standard / Uninfested)</option>
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </Select>
            </FormRow>

            <FormRow label="Fumigant Wet Deactivated">
              <Select
                value={si.wetDeactivated !== false ? "Yes" : "No"}
                disabled={locked}
                onChange={(e) =>
                  setSi({ ...si, wetDeactivated: e.target.value === "Yes" })
                }
              >
                <option value="Yes">Yes (Residue Deactivated)</option>
                <option value="No">No</option>
              </Select>
            </FormRow>
          </div>
        </div>
      ) : (
        !locked && (
          <div className="mt-4 border-t border-dashed border-border pt-3">
            <button
              type="button"
              onClick={() => setSi({ ...si, certificateTemplate: "pmi" })}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-brass-700 hover:text-brass-900"
            >
              + Designate as PMI Destined Tobacco (PME Method #751)
            </button>
          </div>
        )
      )}

      {error && <p className="mt-4 text-xs text-status-critical">{error}</p>}
      {saved && !error && (
        <p className="mt-4 text-xs text-status-compliant">Shipping instructions updated.</p>
      )}
      {!locked && (
        <div className="mt-5">
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : saveLabel}
          </Button>
        </div>
      )}
    </Card>
  );
}
