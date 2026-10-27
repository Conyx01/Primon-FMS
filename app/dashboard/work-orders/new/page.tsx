"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Info, Leaf, Wheat, Box, Layers } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/ui/stepper";
import { FormRow, Label, Select, TextInput } from "@/components/ui/input";
import { availableFormulations, FUMIGANTS } from "@/lib/fumigants";
import { cn } from "@/lib/utils";
import {
  CropType,
  FumigantName,
  FumigationType,
  ShippingInstructions,
  StockFormulation,
} from "@/lib/types";
import { resumeWizardStep } from "@/lib/si-complete";

function toFumigantName(name: string): FumigantName {
  return /magnesium/i.test(name) ? "Magnesium Phosphide" : "Aluminium Phosphide";
}

function toCropType(value: string): CropType | "both" {
  if (value === "grain" || value === "both" || value === "other") return value;
  return "tobacco";
}

const STEPS = ["Work order", "Shipping instructions", "Fumigation description", "Review"];

const emptySi: ShippingInstructions = {
  tobaccoSupplier: "",
  supplierAddress: "",
  consignee: "",
  consigneeAddress: "",
  cropYear: "",
  tobaccoType: "",
  productType: "",
  netWeight: "",
  grossWeight: "",
  quantity: "",
  polylined: "No",
  gradeName: "",
  caseNos: "",
  countryOfOrigin: "Malawi",
  location: "",
  warehouseSection: "",
  complete: false,
};

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Guess crop type from a free-text cropOrService string. */
function guessCropType(cropOrService: string): { cropType: CropType; customProduct?: string } {
  const lower = cropOrService.toLowerCase();
  if (
    lower.includes("grain") ||
    lower.includes("maize") ||
    lower.includes("sorghum") ||
    lower.includes("cereal") ||
    lower.includes("wheat")
  ) {
    return { cropType: "grain" };
  }
  if (lower.includes("tobacco")) {
    return { cropType: "tobacco" };
  }
  return { cropType: "other", customProduct: cropOrService };
}

/** Guess scale from a free-text cropOrService string. */
function guessScale(
  cropOrService: string
): "industrial" | "smallholder" | "household" {
  const lower = cropOrService.toLowerCase();
  if (
    lower.includes("household") ||
    lower.includes("residential") ||
    lower.includes("pest control") ||
    lower.includes("termite") ||
    lower.includes("rodent")
  ) {
    return "household";
  }
  return "industrial";
}

// ── Sub-components ───────────────────────────────────────────────────────────

function RadioCard({
  active,
  onClick,
  icon: Icon,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Leaf;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-start gap-3 rounded-xl border p-4 text-left transition-colors",
        active ? "border-primon-800 bg-primon-50" : "border-border bg-white hover:border-primon-200"
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          active ? "bg-primon-800 text-white" : "bg-primon-50 text-primon-700"
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <span>
        <span className="block text-sm font-medium text-primon-950">{title}</span>
        <span className="block text-xs text-muted">{desc}</span>
      </span>
    </button>
  );
}

// ── Main wizard (needs useSearchParams → wrapped in Suspense below) ──────────

function NewWorkOrderWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromSubmissionId = searchParams.get("fromSubmission");
  const resumeId = searchParams.get("id");

  const [step, setStep] = useState(0);
  const [workOrderId, setWorkOrderId] = useState<string | null>(null);
  const [fccId, setFccId] = useState<string | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [resumeLoading, setResumeLoading] = useState(Boolean(resumeId));

  // Step 0 fields
  const [clientId, setClientId] = useState("");
  const [clientOptions, setClientOptions] = useState<
    { id: string; name: string; email: string }[]
  >([]);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [cropType, setCropType] = useState<CropType>("tobacco");
  const [customProduct, setCustomProduct] = useState("");
  const [scale, setScale] = useState<"industrial" | "smallholder" | "household">("industrial");
  const [hasCode, setHasCode] = useState(false);
  const [suppliedCode, setSuppliedCode] = useState("");
  const [salesOrderNo, setSalesOrderNo] = useState("");
  const [shipmentNo, setShipmentNo] = useState("");
  const [deliveryNo, setDeliveryNo] = useState("");

  // Intake pre-fill banner
  const [intakeBannerText, setIntakeBannerText] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stock, setStock] = useState<StockFormulation[]>([]);
  const identityLocked = Boolean(workOrderId);

  // Load live stock
  useEffect(() => {
    async function loadLiveStock() {
      try {
        const res = await fetch("/api/stock");
        if (res.ok) {
          const data = await res.json();
          if (data.stockLevels && data.stockLevels.length > 0) {
            const mapped: StockFormulation[] = data.stockLevels.map(
              (s: {
                id: string;
                quantityOnHand: number;
                lowStockThreshold: number;
                formulation: {
                  name: string;
                  fumigant: { name: string };
                  cropType: string;
                  unit: string;
                };
              }) => ({
                id: s.id,
                formulation: s.formulation.name,
                fumigant: toFumigantName(s.formulation.fumigant.name),
                cropType: toCropType(s.formulation.cropType),
                unit: s.formulation.unit,
                quantityOnHand: s.quantityOnHand,
                lowStockThreshold: s.lowStockThreshold,
              })
            );
            setStock(mapped);
          }
        }
      } catch (err) {
        console.error("Failed to load live stock for wizard:", err);
      }
    }
    loadLiveStock();
  }, []);

  // Pre-fill from intake submission
  useEffect(() => {
    if (!fromSubmissionId) return;

    async function prefill() {
      try {
        const res = await fetch(`/api/intake/pending/${fromSubmissionId}`);
        if (!res.ok) return; // silently skip if not found / forbidden
        const data = await res.json();
        const p = data.submission?.payload;
        if (!p) return;

        if (p.name) setInviteName(p.name);
        if (p.email) setInviteEmail(p.email);
        if (p.cropOrService) {
          const guessed = guessCropType(p.cropOrService);
          setCropType(guessed.cropType);
          if (guessed.customProduct) setCustomProduct(guessed.customProduct);
          setScale(guessScale(p.cropOrService));
        }

        // Build a short banner to remind Ops which submission this came from
        setIntakeBannerText(
          `Pre-filled from website submission: "${p.name}"${p.cropOrService ? ` — ${p.cropOrService}` : ""}`
        );
      } catch {
        // Non-blocking — wizard is still usable without pre-fill
      }
    }

    prefill();
  }, [fromSubmissionId]);

  const autoCode = useMemo(
    () => `WO-2026-${String(Math.floor(Math.random() * 90000) + 10000)}`,
    []
  );

  const selectedClient = clientOptions.find((c) => c.id === clientId);
  const clientLabel = selectedClient
    ? `${selectedClient.name} (${selectedClient.email})`
    : "";

  // Load portal client users for attachment
  useEffect(() => {
    async function loadClients() {
      try {
        const res = await fetch("/api/users?role=client");
        const data = await res.json();
        if (res.ok) setClientOptions(data.users ?? []);
      } catch {
        // Wizard still usable; create will fail without a client
      }
    }
    loadClients();
  }, []);

  async function inviteClient() {
    if (!inviteName.trim() || !inviteEmail.trim()) return;
    setInviteBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: inviteName.trim(),
          email: inviteEmail.trim(),
          role: "client",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to invite client");
      const created = data.user as { id: string; name: string; email: string };
      setClientOptions((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
      );
      setClientId(created.id);
      setInviteUrl(data.inviteUrl ?? null);
      if (data.inviteUrl) {
        await navigator.clipboard.writeText(data.inviteUrl);
      }
      setInviteName("");
      setInviteEmail("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to invite client");
    } finally {
      setInviteBusy(false);
    }
  }

  const [si, setSi] = useState<ShippingInstructions>(emptySi);

  const [fumigationType, setFumigationType] = useState<FumigationType>("sheeted_stack");
  const [fumigantName, setFumigantName] = useState<FumigantName>(FUMIGANTS[0]);
  const [formulation, setFormulation] = useState("");
  const [dose, setDose] = useState(1.5);
  const [totalVolume, setTotalVolume] = useState(0);

  const formOptions = availableFormulations(fumigantName, cropType, stock);
  const totalFumigantUsed = Math.round(dose * totalVolume);
  const displayCode = createdCode || (hasCode && suppliedCode ? suppliedCode : autoCode);

  // Resume an existing draft from overview Continue (?id=)
  useEffect(() => {
    if (!resumeId) return;
    let cancelled = false;
    (async () => {
      setResumeLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/work-orders/${resumeId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load work order");
        if (cancelled) return;

        const wo = data.workOrder;
        const fcc = wo.fcc;
        if (!fcc) throw new Error("This work order has no FCC draft");

        const nextStep = resumeWizardStep({
          shippingInstructions: fcc.shippingInstructions,
          fumigationDescription: fcc.fumigationDescription,
        });
        if (nextStep === null) {
          router.replace(`/dashboard/monitor/${wo.id}`);
          return;
        }

        setWorkOrderId(wo.id);
        setFccId(fcc.id);
        setCreatedCode(wo.code);
        setClientId(wo.clientId || wo.client?.id || "");
        setCropType(wo.cropType);
        setCustomProduct(wo.customProduct || "");
        setScale(wo.scale || "industrial");
        setSalesOrderNo(wo.salesOrderNo || "");
        setShipmentNo(wo.shipmentNo || "");
        setDeliveryNo(wo.deliveryNo || "");
        setHasCode(wo.source === "client_supplied");
        if (wo.source === "client_supplied") setSuppliedCode(wo.code);

        const siRow = fcc.shippingInstructions;
        if (siRow) {
          setSi({
            tobaccoSupplier: siRow.tobaccoSupplier ?? "",
            supplierAddress: siRow.tobaccoSupplierAddress ?? "",
            consignee: siRow.consignee ?? "",
            consigneeAddress: siRow.consigneeAddress ?? "",
            fumigationContractor:
              siRow.fumigationContractor ?? "Primon Enterprises Limited",
            cropYear: siRow.cropYear ?? "",
            tobaccoType: siRow.tobaccoType ?? "",
            productType: siRow.productType ?? siRow.tobaccoType ?? "",
            netWeight: siRow.netWeight != null ? String(siRow.netWeight) : "",
            grossWeight: siRow.grossWeight != null ? String(siRow.grossWeight) : "",
            quantity: siRow.quantity != null ? String(siRow.quantity) : "",
            polylined: siRow.polylined ? "Yes" : "No",
            gradeName: siRow.gradeName ?? "",
            caseNos: siRow.caseNos ?? "",
            countryOfOrigin: siRow.countryOfOrigin ?? "Malawi",
            location: siRow.location ?? "",
            warehouseSection: siRow.warehouseSection ?? "",
            complete: Boolean(siRow.tobaccoSupplier && siRow.consignee),
          });
        }

        setStep(nextStep);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to resume work order");
        }
      } finally {
        if (!cancelled) setResumeLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resumeId, router]);

  async function ensureWorkOrderCreated(): Promise<{ woId: string; fccId: string }> {
    if (workOrderId && fccId) return { woId: workOrderId, fccId };

    if (!clientId) {
      throw new Error("Select or invite a client so they can see this job in the portal.");
    }

    if (cropType === "other" && !customProduct.trim()) {
      throw new Error("Please specify the commodity / product name.");
    }

    const res = await fetch("/api/work-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: hasCode && suppliedCode ? suppliedCode.trim() : undefined,
        source: fromSubmissionId
          ? "website"
          : hasCode
            ? "client_supplied"
            : "auto_generated",
        cropType,
        customProduct: cropType === "other" ? customProduct.trim() : undefined,
        scale,
        clientId,
        salesOrderNo: salesOrderNo.trim() || undefined,
        shipmentNo: shipmentNo.trim() || undefined,
        deliveryNo: deliveryNo.trim() || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to create work order");

    const woId = data.workOrder.id as string;
    const nextFccId = (data.workOrder.fcc?.id || data.workOrder.id) as string;
    setWorkOrderId(woId);
    setFccId(nextFccId);
    setCreatedCode(data.workOrder.code);

    if (fromSubmissionId) {
      fetch(`/api/intake/pending/${fromSubmissionId}/convert`, { method: "POST" }).catch(
        (e) => console.error("Failed to mark intake submission converted:", e)
      );
    }

    return { woId, fccId: nextFccId };
  }

  async function saveShippingInstructions(targetFccId: string) {
    if (
      !si.tobaccoSupplier &&
      !si.consignee &&
      !si.cropYear &&
      !si.tobaccoType &&
      !si.productType
    ) {
      return;
    }
    const res = await fetch(`/api/fccs/${targetFccId}/si`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...si,
        tobaccoType: si.productType || si.tobaccoType,
        productType: si.productType || si.tobaccoType,
        fumigationContractor: "Primon Enterprises Limited",
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to save shipping instructions");
  }

  async function saveFumigationDescription(targetFccId: string) {
    if (!formulation || totalVolume <= 0) {
      throw new Error(
        "Fumigation description is required: select a formulation and enter total volume so stock can be deducted."
      );
    }
    const descRes = await fetch(`/api/fccs/${targetFccId}/fumigation-description`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fumigationType,
        fumigantName,
        formulationName: formulation,
        doseGm3: dose,
        totalVolumeM3: totalVolume,
        totalFumigantUsedG: totalFumigantUsed,
      }),
    });
    if (!descRes.ok) {
      const descData = await descRes.json();
      throw new Error(descData.error || "Failed to save fumigation description");
    }
  }

  async function next() {
    setError(null);
    if (step === 0) {
      setSubmitting(true);
      try {
        await ensureWorkOrderCreated();
        setStep(1);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to create work order");
      } finally {
        setSubmitting(false);
      }
      return;
    }
    if (step === 1 && fccId) {
      setSubmitting(true);
      try {
        await saveShippingInstructions(fccId);
        setStep(2);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to save shipping instructions");
      } finally {
        setSubmitting(false);
      }
      return;
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  function back() {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  }

  async function finishWorkOrder() {
    setSubmitting(true);
    setError(null);
    try {
      const ids = await ensureWorkOrderCreated();
      await saveShippingInstructions(ids.fccId);
      await saveFumigationDescription(ids.fccId);
      router.push(`/dashboard/monitor/${ids.woId}`);
    } catch (err: unknown) {
      console.error("Error finishing work order:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save work order. Please check network or input parameters."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (resumeLoading) {
    return (
      <div>
        <Topbar title="Continue work order" description="Loading draft…" />
        <div className="mx-auto max-w-4xl px-6 py-8 lg:px-10">
          <p className="text-sm text-muted">Loading work order…</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Topbar
        title={workOrderId ? `Continue ${displayCode}` : "New work order"}
        description={
          workOrderId
            ? "Resume shipping instructions or fumigation description for this draft"
            : "Attach a client to create the draft, then complete SI and fumigation"
        }
      />

      <div className="mx-auto max-w-4xl px-6 py-8 lg:px-10">
        {/* Intake pre-fill banner */}
        {intakeBannerText && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-brass-300 bg-brass-100/60 p-4">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-brass-600" />
            <p className="text-xs leading-relaxed text-brass-700">
              {intakeBannerText}. Review the pre-filled fields below and adjust
              as needed before submitting.
            </p>
          </div>
        )}

        {workOrderId && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-primon-200 bg-primon-50 p-4">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primon-700" />
            <p className="text-xs leading-relaxed text-primon-800">
              Draft <span className="font-medium">{displayCode}</span> exists and is visible
              to the attached client in the portal. They can fill shipping instructions
              there, or you can complete SI and fumigation here.
            </p>
          </div>
        )}

        <Card className="p-6">
          <Stepper steps={STEPS} current={step} />
        </Card>

        {error && (
          <div className="mt-4 rounded-xl border border-status-critical/30 bg-status-criticalTint p-4 text-xs text-status-critical">
            {error}
          </div>
        )}

        <Card className="mt-6 p-7">
          {step === 0 && (
            <div className="space-y-6 animate-reveal-up">
              <div>
                <FormRow label="Client (portal login)" required>
                  <Select
                    value={clientId}
                    disabled={identityLocked}
                    onChange={(e) => setClientId(e.target.value)}
                  >
                    <option value="">Select a client…</option>
                    {clientOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} — {c.email}
                      </option>
                    ))}
                  </Select>
                </FormRow>
                <p className="mt-3 text-[11px] text-muted">
                  {identityLocked
                    ? "Client is locked on this draft. They can already see the job in /portal."
                    : clientId
                      ? "Invite is hidden because a client is already selected."
                      : "Select or invite a client. Creating the draft makes the job visible in their portal."}
                </p>
                {!clientId && !identityLocked && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <FormRow label="Invite name">
                      <TextInput
                        value={inviteName}
                        onChange={(e) => setInviteName(e.target.value)}
                        placeholder="Company or contact"
                      />
                    </FormRow>
                    <FormRow label="Invite email">
                      <TextInput
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="shipping@client.com"
                      />
                    </FormRow>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={inviteClient}
                        disabled={inviteBusy || !inviteName.trim() || !inviteEmail.trim()}
                      >
                        {inviteBusy ? "Inviting…" : "Invite & attach"}
                      </Button>
                    </div>
                  </div>
                )}
                {inviteUrl && (
                  <p className="mt-2 text-[11px] text-primon-800">
                    Client invited. Check that they received the email; the set-password link was
                    also copied as a backup.
                  </p>
                )}
              </div>

              <div>
                <Label>Crop / Commodity type</Label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <RadioCard
                    active={cropType === "tobacco"}
                    onClick={() => {
                      setCropType("tobacco");
                      setCustomProduct("");
                    }}
                    icon={Leaf}
                    title="Tobacco"
                    desc="Flue-cured, burley and related grades"
                  />
                  <RadioCard
                    active={cropType === "grain"}
                    onClick={() => {
                      setCropType("grain");
                      setCustomProduct("");
                    }}
                    icon={Wheat}
                    title="Grain"
                    desc="Maize, sorghum and post-harvest stock"
                  />
                  <RadioCard
                    active={cropType === "other"}
                    onClick={() => setCropType("other")}
                    icon={Box}
                    title="Specify"
                    desc="Empty sacks, packaging or other commodities"
                  />
                </div>
                {cropType === "other" && (
                  <div className="mt-3">
                    <FormRow label="Specify commodity / product" required>
                      <TextInput
                        placeholder="e.g. Empty Sacks, Packaging Material, Beans"
                        value={customProduct}
                        disabled={identityLocked}
                        onChange={(e) => {
                          setCustomProduct(e.target.value);
                          setSi((prev) => ({
                            ...prev,
                            productType: e.target.value,
                            tobaccoType: e.target.value,
                          }));
                        }}
                      />
                    </FormRow>
                  </div>
                )}
              </div>

              <div>
                <Label>Scale</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <RadioCard
                    active={scale === "industrial"}
                    onClick={() => setScale("industrial")}
                    icon={Layers}
                    title="Industrial"
                    desc="Warehouse or bonded shipment"
                  />
                  <RadioCard
                    active={scale === "smallholder"}
                    onClick={() => setScale("smallholder")}
                    icon={Box}
                    title="Smallholder"
                    desc="Local client, no existing code"
                  />
                  <RadioCard
                    active={scale === "household"}
                    onClick={() => setScale("household")}
                    icon={Box}
                    title="Household"
                    desc="Residential pest control"
                  />
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-3">
                <FormRow label="Sales Order No. (Optional)">
                  <TextInput
                    placeholder="e.g. SO-99120"
                    value={salesOrderNo}
                    onChange={(e) => setSalesOrderNo(e.target.value)}
                  />
                </FormRow>
                <FormRow label="Shipment No. (Optional)">
                  <TextInput
                    placeholder="e.g. SHP-48821"
                    value={shipmentNo}
                    onChange={(e) => setShipmentNo(e.target.value)}
                  />
                </FormRow>
                <FormRow label="Delivery No. (Optional)">
                  <TextInput
                    placeholder="e.g. DEL-1002"
                    value={deliveryNo}
                    onChange={(e) => setDeliveryNo(e.target.value)}
                  />
                </FormRow>
              </div>

              <div className="rounded-xl border border-border bg-primon-50/50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-primon-950">Work order code</p>
                    <p className="text-xs text-muted">
                      Use a code already issued by the client, or let the system generate one.
                    </p>
                  </div>
                  <div className="flex overflow-hidden rounded-lg border border-border">
                    <button
                      onClick={() => setHasCode(false)}
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium",
                        !hasCode ? "bg-primon-800 text-white" : "bg-white text-muted"
                      )}
                    >
                      Auto-generate
                    </button>
                    <button
                      onClick={() => setHasCode(true)}
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium",
                        hasCode ? "bg-primon-800 text-white" : "bg-white text-muted"
                      )}
                    >
                      I have a code
                    </button>
                  </div>
                </div>
                <div className="mt-3">
                  {hasCode ? (
                    <TextInput
                      placeholder="e.g. SHP-192716"
                      value={suppliedCode}
                      onChange={(e) => setSuppliedCode(e.target.value)}
                    />
                  ) : (
                    <p className="num rounded-lg bg-white px-3 py-2 text-sm text-primon-800 border border-border">
                      {autoCode}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6 animate-reveal-up">
              <div className="flex items-start gap-3 rounded-xl border border-brass-300 bg-brass-100/60 p-4">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-brass-600" />
                <p className="text-xs leading-relaxed text-brass-700">
                  Optional here if the client will fill consignor/consignee details in
                  their portal. If Primon is completing the full certificate, fill SI now
                  then continue to fumigation. You can update SI later until certification.
                </p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <FormRow label="Consignor / Supplier">
                  <TextInput value={si.tobaccoSupplier} onChange={(e) => setSi({ ...si, tobaccoSupplier: e.target.value })} />
                </FormRow>
                <FormRow label="Consignor address">
                  <TextInput value={si.supplierAddress} onChange={(e) => setSi({ ...si, supplierAddress: e.target.value })} />
                </FormRow>
                <FormRow label="Consignee">
                  <TextInput value={si.consignee} onChange={(e) => setSi({ ...si, consignee: e.target.value })} />
                </FormRow>
                <FormRow label="Consignee address">
                  <TextInput value={si.consigneeAddress} onChange={(e) => setSi({ ...si, consigneeAddress: e.target.value })} />
                </FormRow>
                <FormRow label="Crop year">
                  <TextInput placeholder="2026 Crop" value={si.cropYear} onChange={(e) => setSi({ ...si, cropYear: e.target.value })} />
                </FormRow>
                <FormRow label="Product type">
                  <TextInput
                    placeholder="e.g. Flue-cured, White Maize, Empty Sacks"
                    value={si.productType ?? si.tobaccoType}
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
                  <TextInput placeholder="e.g. 126,000 KGS" value={si.netWeight} onChange={(e) => setSi({ ...si, netWeight: e.target.value })} />
                </FormRow>
                <FormRow label="Gross weight">
                  <TextInput placeholder="e.g. 132,000 KGS" value={si.grossWeight} onChange={(e) => setSi({ ...si, grossWeight: e.target.value })} />
                </FormRow>
                <FormRow label="Quantity">
                  <TextInput placeholder="e.g. 630 Cartons" value={si.quantity} onChange={(e) => setSi({ ...si, quantity: e.target.value })} />
                </FormRow>
                <FormRow label="Grade name">
                  <TextInput value={si.gradeName} onChange={(e) => setSi({ ...si, gradeName: e.target.value })} />
                </FormRow>
                <FormRow label="Case Nos.">
                  <TextInput value={si.caseNos} onChange={(e) => setSi({ ...si, caseNos: e.target.value })} />
                </FormRow>
                <FormRow label="Country of origin">
                  <TextInput value={si.countryOfOrigin} onChange={(e) => setSi({ ...si, countryOfOrigin: e.target.value })} />
                </FormRow>
                <FormRow label="Polylined">
                  <Select value={si.polylined} onChange={(e) => setSi({ ...si, polylined: e.target.value as "Yes" | "No" })}>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </Select>
                </FormRow>
                <FormRow label="Location">
                  <TextInput value={si.location} onChange={(e) => setSi({ ...si, location: e.target.value })} />
                </FormRow>
                <FormRow label="Warehouse section">
                  <TextInput value={si.warehouseSection} onChange={(e) => setSi({ ...si, warehouseSection: e.target.value })} />
                </FormRow>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-reveal-up">
              <div className="flex items-start gap-3 rounded-xl border border-primon-200 bg-primon-50 p-4">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-primon-700" />
                <p className="text-xs leading-relaxed text-primon-800">
                  Required. Saving fumigation description deducts stock and is needed
                  before Date Fumigant Placed / certification.
                </p>
              </div>
              <div>
                <Label>Type of fumigation</Label>
                <div className="flex gap-3">
                  <RadioCard
                    active={fumigationType === "container"}
                    onClick={() => setFumigationType("container")}
                    icon={Box}
                    title="Container"
                    desc="Sealed shipping container"
                  />
                  <RadioCard
                    active={fumigationType === "sheeted_stack"}
                    onClick={() => setFumigationType("sheeted_stack")}
                    icon={Layers}
                    title="Sheeted stack"
                    desc="Warehouse stack under sheeting"
                  />
                </div>
              </div>

              <div>
                <Label>Fumigant</Label>
                <div className="flex gap-3">
                  {FUMIGANTS.map((f) => (
                    <button
                      key={f}
                      onClick={() => {
                        setFumigantName(f);
                        setFormulation("");
                      }}
                      className={cn(
                        "flex-1 rounded-xl border px-4 py-3.5 text-left text-sm font-medium transition-colors",
                        fumigantName === f
                          ? "border-primon-800 bg-primon-50 text-primon-950"
                          : "border-border bg-white text-ink hover:border-primon-200"
                      )}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <FormRow label="Formulation" required>
                <Select value={formulation} onChange={(e) => setFormulation(e.target.value)}>
                  <option value="">Select formulation in stock</option>
                  {formOptions.map((f) => (
                    <option key={f.id} value={f.formulation}>
                      {f.formulation} — {f.quantityOnHand} {f.unit} available
                    </option>
                  ))}
                </Select>
                {formOptions.length === 0 && (
                  <p className="mt-1.5 text-xs text-status-critical">
                    No formulation of {fumigantName} in stock for {cropType}.
                  </p>
                )}
              </FormRow>

              <div className="grid gap-5 sm:grid-cols-3">
                <FormRow label="Dose (g/m³)">
                  <TextInput
                    type="number"
                    step="0.1"
                    value={dose}
                    onChange={(e) => setDose(parseFloat(e.target.value) || 0)}
                  />
                </FormRow>
                <FormRow label="Total volume fumigated (m³)">
                  <TextInput
                    type="number"
                    value={totalVolume}
                    onChange={(e) => setTotalVolume(parseFloat(e.target.value) || 0)}
                  />
                </FormRow>
                <FormRow label="Total fumigant used (g)">
                  <p className="num flex h-10 items-center rounded-lg border border-border bg-primon-50 px-3 text-sm font-medium text-primon-800">
                    {totalFumigantUsed || "—"}
                  </p>
                </FormRow>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-reveal-up">
              <div>
                <p className="text-xs text-muted">Work order</p>
                <p className="mt-1 font-display text-lg text-primon-950">
                  {displayCode} · {clientLabel || "No client attached"}
                </p>
                <p className="mt-0.5 text-sm capitalize text-muted">
                  {cropType === "other" ? (customProduct || "Other") : cropType} · {scale}
                </p>
              </div>

              <div className="grid gap-5 border-t border-border pt-5 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium text-primon-800">Shipping instructions</p>
                  <p className="mt-1 text-sm text-muted">
                    {si.tobaccoSupplier
                      ? `${si.tobaccoSupplier} → ${si.consignee || "consignee pending"}`
                      : "Not yet provided — client can complete this from the portal."}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-primon-800">Fumigation description</p>
                  <p className="mt-1 text-sm text-muted capitalize">
                    {fumigationType.replace("_", " ")} · {fumigantName} ·{" "}
                    {formulation || "required — go back if missing"}
                  </p>
                  <p className="text-sm text-muted">
                    {dose}g/m³ dose · {totalVolume}m³ · {totalFumigantUsed}g total
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-primon-200 bg-primon-50 p-4">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-primon-700" />
                <p className="text-xs leading-relaxed text-primon-800">
                  Saving deducts {totalFumigantUsed || 0}g of{" "}
                  {formulation || "the selected formulation"} from stock and opens the
                  gas-reading monitor. Fumigation description is required.
                </p>
              </div>
            </div>
          )}

          <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
            <Button variant="ghost" onClick={back} disabled={step === 0 || submitting}>
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button
                onClick={next}
                disabled={
                  submitting ||
                  (step === 0 &&
                    (!clientId || (cropType === "other" && !customProduct.trim())))
                }
              >
                {submitting && step === 0
                  ? "Creating draft…"
                  : step === 0
                    ? "Create draft & continue"
                    : "Continue"}
              </Button>
            ) : (
              <Button
                variant="brass"
                onClick={finishWorkOrder}
                disabled={submitting || !formulation || totalVolume <= 0}
              >
                {submitting ? "Saving…" : "Save fumigation & open monitor"}
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── Export wrapped in Suspense (required for useSearchParams in Next.js) ─────

export default function NewWorkOrderPage() {
  return (
    <Suspense>
      <NewWorkOrderWizard />
    </Suspense>
  );
}
