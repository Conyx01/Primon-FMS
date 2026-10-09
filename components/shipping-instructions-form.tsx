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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

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
          tobaccoType: si.tobaccoType,
          netWeight: si.netWeight,
          quantity: si.quantity,
          polylined: si.polylined,
          gradeName: si.gradeName,
          caseNos: si.caseNos,
          countryOfOrigin: si.countryOfOrigin,
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
          : "You can complete supplier, consignee and cargo details here. Fumigation does not wait on this section."}
      </p>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <FormRow label="Tobacco / grain supplier">
          <TextInput
            value={si.tobaccoSupplier}
            disabled={locked}
            onChange={(e) => setSi({ ...si, tobaccoSupplier: e.target.value })}
          />
        </FormRow>
        <FormRow label="Supplier address">
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
        <FormRow label="Tobacco / grain type">
          <TextInput
            value={si.tobaccoType}
            disabled={locked}
            onChange={(e) => setSi({ ...si, tobaccoType: e.target.value })}
          />
        </FormRow>
        <FormRow label="Net weight">
          <TextInput
            value={si.netWeight}
            disabled={locked}
            onChange={(e) => setSi({ ...si, netWeight: e.target.value })}
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
        <FormRow label="Location">
          <TextInput
            value={si.location}
            disabled={locked}
            onChange={(e) => setSi({ ...si, location: e.target.value })}
          />
        </FormRow>
        <FormRow label="Warehouse section">
          <TextInput
            value={si.warehouseSection}
            disabled={locked}
            onChange={(e) => setSi({ ...si, warehouseSection: e.target.value })}
          />
        </FormRow>
      </div>
      {error && <p className="mt-4 text-xs text-status-critical">{error}</p>}
      {saved && !error && (
        <p className="mt-4 text-xs text-status-compliant">Shipping instructions saved.</p>
      )}
      {!locked && (
        <div className="mt-5">
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save shipping instructions"}
          </Button>
        </div>
      )}
    </Card>
  );
}
