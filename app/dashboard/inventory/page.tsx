"use client";

import { useEffect, useState } from "react";
import { Boxes, Plus, Minus, History, ShieldAlert, ArrowUpRight, ArrowDownRight, RefreshCw, AlertTriangle } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TextInput, Select, FormRow } from "@/components/ui/input";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { formatDate, cn } from "@/lib/utils";

interface StockLevel {
  id: string;
  formulationId: string;
  quantityOnHand: number;
  lowStockThreshold: number;
  updatedAt: string;
  formulation: {
    id: string;
    name: string;
    unit: string;
    cropType: string;
    fumigant: {
      id: string;
      name: string;
    };
  };
}

interface StockMovement {
  id: string;
  formulationId: string;
  type: "addition" | "deduction" | "adjustment";
  quantity: number;
  note: string | null;
  performedAt: string;
  formulation: {
    name: string;
    unit: string;
    fumigant: { name: string };
  };
  performedBy: {
    name: string;
    email: string;
  };
  workOrder?: {
    code: string;
  };
}

export default function InventoryPage() {
  const { role } = useCurrentUser();
  const isAdmin = role === "admin";

  const [stockLevels, setStockLevels] = useState<StockLevel[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Adjustment Modal / Drawer State
  const [selectedStock, setSelectedStock] = useState<StockLevel | null>(null);
  const [adjustType, setAdjustType] = useState<"addition" | "deduction" | "adjustment">("addition");
  const [adjustQuantity, setAdjustQuantity] = useState<string>("");
  const [adjustNote, setAdjustNote] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  async function loadStockData() {
    setLoading(true);
    try {
      const res = await fetch("/api/stock");
      if (!res.ok) throw new Error("Failed to load inventory data");
      const data = await res.json();
      setStockLevels(data.stockLevels || []);
      setMovements(data.movements || []);
    } catch (err: any) {
      console.error("Error loading stock:", err);
      setError("Failed to fetch current inventory levels from the server.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStockData();
  }, []);

  function openAdjustModal(stock: StockLevel) {
    setSelectedStock(stock);
    setAdjustType("addition");
    setAdjustQuantity("");
    setAdjustNote("");
    setAdjustError(null);
  }

  function applyShortcut(amount: number) {
    if (amount >= 0) {
      setAdjustType("addition");
      setAdjustQuantity(String(amount));
    } else {
      setAdjustType("deduction");
      setAdjustQuantity(String(Math.abs(amount)));
    }
  }

  async function handleAdjustSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStock) return;

    const qtyNum = parseFloat(adjustQuantity);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      setAdjustError("Please enter a valid positive quantity.");
      return;
    }

    if (!adjustNote.trim()) {
      setAdjustError("A note explaining this adjustment is required for audit logs.");
      return;
    }

    setSubmitting(true);
    setAdjustError(null);

    try {
      const res = await fetch("/api/stock/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formulationId: selectedStock.formulationId,
          type: adjustType,
          quantity: qtyNum,
          note: adjustNote.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to adjust stock");
      }

      setToastMsg(`Successfully recorded ${adjustType} of ${qtyNum} ${selectedStock.formulation.unit}`);
      setTimeout(() => setToastMsg(null), 3500);
      setSelectedStock(null);
      await loadStockData();
    } catch (err: any) {
      console.error("Error adjusting stock:", err);
      setAdjustError(err.message || "Adjustment failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Topbar
        title="Fumigant Stock & Inventory"
        description="Monitor formulation stock levels and log audit-backed stock movements"
        action={
          <Button size="sm" variant="ghost" onClick={loadStockData} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-1.5", loading && "animate-spin")} />
            Refresh
          </Button>
        }
      />

      <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
        {toastMsg && (
          <div className="mb-6 rounded-xl border border-status-compliant/30 bg-status-compliantTint p-4 text-sm font-medium text-status-compliant animate-reveal-up">
            {toastMsg}
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-xl border border-status-critical/30 bg-status-criticalTint p-4 text-sm text-status-critical">
            {error}
          </div>
        )}

        {!isAdmin && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-border bg-primon-50/70 p-4 text-xs text-muted">
            <ShieldAlert className="h-4 w-4 text-primon-700 shrink-0" />
            <span>
              <strong>View-only mode:</strong> Stock levels can only be mutated by system Administrators. Supervisors and Operations Managers have read-only access.
            </span>
          </div>
        )}

        {/* 1. Stock Levels Grid */}
        <section className="mb-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
              Current Formulation Stock
            </h2>
          </div>

          {loading ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="p-6 animate-pulse">
                  <div className="h-10 w-10 bg-slate-200 rounded-lg mb-4" />
                  <div className="h-5 w-3/4 bg-slate-200 rounded mb-2" />
                  <div className="h-4 w-1/2 bg-slate-200 rounded mb-6" />
                  <div className="h-8 w-1/3 bg-slate-200 rounded" />
                </Card>
              ))}
            </div>
          ) : stockLevels.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted">
              No formulation stock levels found in database. Run database seed to initialize stock.
            </Card>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {stockLevels.map((s) => {
                const low = s.quantityOnHand <= s.lowStockThreshold;
                const pct = Math.min(100, Math.round((s.quantityOnHand / (s.lowStockThreshold * 2.5)) * 100));

                return (
                  <Card key={s.id} className="p-6 flex flex-col justify-between transition-shadow hover:shadow-elevated">
                    <div>
                      <div className="flex items-start justify-between">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primon-50 text-primon-700">
                          <Boxes className="h-5 w-5" strokeWidth={1.75} />
                        </span>
                        {low && (
                          <span className="flex items-center gap-1 rounded-full bg-status-actionTint px-2.5 py-1 text-[11px] font-semibold text-status-action">
                            <AlertTriangle className="h-3 w-3" />
                            Low Stock
                          </span>
                        )}
                      </div>

                      <p className="mt-4 font-display text-lg text-primon-950 capitalize">
                        {s.formulation.name.replace("_", " ")}
                      </p>
                      <p className="text-xs text-muted capitalize">
                        {s.formulation.fumigant.name.replace("_", " ")} · {s.formulation.cropType === "both" ? "Tobacco & Grain" : s.formulation.cropType}
                      </p>

                      <div className="mt-5">
                        <div className="flex items-baseline justify-between">
                          <span className="num font-display text-3xl text-primon-950">
                            {s.quantityOnHand.toLocaleString()}
                          </span>
                          <span className="text-xs font-medium text-muted">{s.formulation.unit} on hand</span>
                        </div>

                        <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={cn("h-full rounded-full transition-all duration-500", low ? "bg-status-action" : "bg-status-compliant")}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="mt-1.5 text-[11px] text-muted">Reorder threshold: {s.lowStockThreshold} {s.formulation.unit}</p>
                      </div>
                    </div>

                    {isAdmin && (
                      <div className="mt-6 pt-4 border-t border-border">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="w-full"
                          onClick={() => openAdjustModal(s)}
                        >
                          Adjust Stock
                        </Button>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* 2. Stock Adjustment Modal */}
        {selectedStock && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-reveal-up">
            <Card className="w-full max-w-md p-6 bg-white shadow-2xl">
              <h3 className="font-display text-lg text-primon-950">
                Adjust Stock — {selectedStock.formulation.name.replace("_", " ")}
              </h3>
              <p className="text-xs text-muted mb-4">
                Current On-Hand: <strong className="text-primon-900">{selectedStock.quantityOnHand} {selectedStock.formulation.unit}</strong>
              </p>

              {adjustError && (
                <div className="mb-4 rounded-lg border border-status-critical/30 bg-status-criticalTint p-3 text-xs text-status-critical">
                  {adjustError}
                </div>
              )}

              <form onSubmit={handleAdjustSubmit} className="space-y-4">
                <div>
                  <FormRow label="Movement Type" required>
                    <Select
                      value={adjustType}
                      onChange={(e) => setAdjustType(e.target.value as any)}
                    >
                      <option value="addition">Addition (+ Receive Stock)</option>
                      <option value="deduction">Deduction (- Issue / Waste)</option>
                      <option value="adjustment">Adjustment (+/- Audit Corrections)</option>
                    </Select>
                  </FormRow>
                </div>

                <div>
                  <FormRow label={`Quantity (${selectedStock.formulation.unit})`} required>
                    <TextInput
                      type="number"
                      step="any"
                      placeholder="e.g. 50"
                      value={adjustQuantity}
                      onChange={(e) => setAdjustQuantity(e.target.value)}
                    />
                  </FormRow>

                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => applyShortcut(10)}
                      className="rounded bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-200"
                    >
                      +10
                    </button>
                    <button
                      type="button"
                      onClick={() => applyShortcut(50)}
                      className="rounded bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-200"
                    >
                      +50
                    </button>
                    <button
                      type="button"
                      onClick={() => applyShortcut(100)}
                      className="rounded bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-200"
                    >
                      +100
                    </button>
                    <button
                      type="button"
                      onClick={() => applyShortcut(-10)}
                      className="rounded bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-200"
                    >
                      -10
                    </button>
                    <button
                      type="button"
                      onClick={() => applyShortcut(-50)}
                      className="rounded bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-200"
                    >
                      -50
                    </button>
                  </div>
                </div>

                <div>
                  <FormRow label="Reason / Audit Note" required>
                    <TextInput
                      placeholder="e.g. Warehouse receipt invoice #881"
                      value={adjustNote}
                      onChange={(e) => setAdjustNote(e.target.value)}
                    />
                  </FormRow>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-border">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedStock(null)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={submitting}>
                    {submitting ? "Saving..." : "Save Stock Movement"}
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {/* 3. Movement History Log */}
        <section>
          <Card className="min-w-0 overflow-hidden">
            <CardHeader
              title="Stock Movement Log"
              description="Append-only record of all receipts, job deductions, and manual adjustments"
              action={
                <div className="flex items-center gap-1.5 text-xs text-muted">
                  <History className="h-4 w-4" />
                  <span>Audit Trail</span>
                </div>
              }
            />

            <div className="w-full overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted bg-primon-50/50">
                    <th className="px-4 sm:px-6 py-3 font-medium">Date & Time</th>
                    <th className="px-3 py-3 font-medium">Formulation</th>
                    <th className="px-3 py-3 font-medium">Type</th>
                    <th className="px-3 py-3 font-medium">Quantity</th>
                    <th className="px-3 py-3 font-medium">Performed By</th>
                    <th className="px-4 sm:px-6 py-3 font-medium">Note / Work Order</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-xs text-muted">
                        No stock movements logged yet.
                      </td>
                    </tr>
                  ) : (
                    movements.map((m) => {
                      const isAdd = m.type === "addition";
                      const isDeduct = m.type === "deduction";

                      return (
                        <tr key={m.id} className="border-b border-border last:border-0 hover:bg-slate-50/50">
                          <td className="px-4 sm:px-6 py-3.5 text-xs text-muted whitespace-nowrap">
                            {formatDate(m.performedAt)}
                          </td>
                          <td className="px-3 py-3.5 font-medium text-primon-900 capitalize whitespace-nowrap">
                            {m.formulation.name.replace("_", " ")}
                          </td>
                          <td className="px-3 py-3.5 whitespace-nowrap">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize",
                                isAdd && "bg-status-compliantTint text-status-compliant",
                                isDeduct && "bg-status-criticalTint text-status-critical",
                                !isAdd && !isDeduct && "bg-slate-100 text-slate-700"
                              )}
                            >
                              {isAdd ? <ArrowUpRight className="h-3 w-3" /> : isDeduct ? <ArrowDownRight className="h-3 w-3" /> : null}
                              {m.type}
                            </span>
                          </td>
                          <td className="px-3 py-3.5 num font-semibold text-ink whitespace-nowrap">
                            {isAdd ? "+" : isDeduct ? "-" : ""}
                            {m.quantity} {m.formulation.unit}
                          </td>
                          <td className="px-3 py-3.5 text-xs text-ink whitespace-nowrap">
                            {m.performedBy.name || m.performedBy.email}
                          </td>
                          <td className="px-4 sm:px-6 py-3.5 text-xs text-muted">
                            {m.workOrder ? (
                              <span className="font-mono text-primon-800">[{m.workOrder.code}] </span>
                            ) : null}
                            {m.note || "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}
