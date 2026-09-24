"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, ClipboardCheck, PackageSearch, TriangleAlert, Search, Filter } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { KpiCard } from "@/components/ui/kpi";
import { Card, CardHeader } from "@/components/ui/card";
import { FccStatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { TextInput, Select } from "@/components/ui/input";
import { useDemo } from "@/lib/store";
import { formatDate } from "@/lib/utils";

export default function DashboardPage() {
  const { workOrders: demoWorkOrders, stock: demoStock } = useDemo();
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [stockLevels, setStockLevels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [cropFilter, setCropFilter] = useState("all");

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const [woRes, stockRes] = await Promise.all([
          fetch("/api/work-orders"),
          fetch("/api/stock"),
        ]);

        if (woRes.ok) {
          const woData = await woRes.json();
          if (isMounted && woData.workOrders) {
            setWorkOrders(woData.workOrders);
          }
        }
        if (stockRes.ok) {
          const stockData = await stockRes.json();
          if (isMounted && stockData.stockLevels) {
            setStockLevels(stockData.stockLevels);
          }
        }
      } catch (err) {
        console.error("Error loading dashboard API data:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Use API data (or empty array during load)
  const displayWorkOrders = workOrders;
  const displayStock = stockLevels.map((s) => ({
    id: s.id,
    formulation: s.formulation.name,
    fumigant: s.formulation.fumigant.name,
    quantityOnHand: s.quantityOnHand,
    lowStockThreshold: s.lowStockThreshold,
  }));

  // Filter logic
  const filteredWorkOrders = displayWorkOrders.filter((w) => {
    const status = w.fcc?.status ?? w.status;
    const clientName = typeof w.client === "string" ? w.client : w.client?.name ?? "";
    const codeStr = w.code ?? "";

    const matchesSearch =
      !searchQuery ||
      codeStr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      clientName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || status === statusFilter;
    const matchesCrop = cropFilter === "all" || w.cropType === cropFilter;

    return matchesSearch && matchesStatus && matchesCrop;
  });

  const active = displayWorkOrders.filter(
    (w) => (w.fcc?.status ?? w.status) !== "certified"
  );
  const flagged = displayWorkOrders.filter(
    (w) => (w.fcc?.status ?? w.status) === "flagged"
  );
  const certifiedThisMonth = displayWorkOrders.filter(
    (w) => (w.fcc?.status ?? w.status) === "certified"
  );
  const lowStock = displayStock.filter(
    (s) => s.quantityOnHand <= s.lowStockThreshold
  );

  return (
    <div>
      <Topbar
        title="Overview"
        description="Today's fumigation operations across tobacco and grain work orders"
        action={
          <div className="hidden sm:block">
            <Link href="/dashboard/work-orders/new">
              <Button size="sm">New work order</Button>
            </Link>
          </div>
        }
      />

      <div className="w-full min-w-0 px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
        <div className="mb-6 sm:hidden">
          <Link href="/dashboard/work-orders/new">
            <Button className="w-full">New work order</Button>
          </Link>
        </div>

        {/* 1. KPI Cards Section */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:grid-cols-4 min-w-0">
          <KpiCard
            label="Active work orders"
            value={String(active.length)}
            sub="In progress, review or draft"
            icon={Activity}
          />
          <KpiCard
            label="Certified this period"
            value={String(certifiedThisMonth.length)}
            sub="QR-verified certificates"
            icon={ClipboardCheck}
            tone="brass"
          />
          <KpiCard
            label="Action required"
            value={String(flagged.length)}
            sub={flagged.length ? "Sub-600ppm reading recorded" : "No critical readings"}
            icon={TriangleAlert}
            tone={flagged.length ? "critical" : "default"}
          />
          <KpiCard
            label="Stock alerts"
            value={String(lowStock.length)}
            sub="Formulations below threshold"
            icon={PackageSearch}
            tone={lowStock.length ? "critical" : "default"}
          />
        </section>

        {/* Dashboard Main Content Grid */}
        <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_340px] min-w-0 items-start">
          {/* 2. Active Work Orders Table Section */}
          <section className="min-w-0 max-w-full">
            <Card className="min-w-0 overflow-hidden">
              <CardHeader
                title="Active work orders"
                description="Every job currently moving through the certificate lifecycle"
                action={
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative w-48 sm:w-64">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted" />
                      <TextInput
                        placeholder="Search WO or Client..."
                        className="pl-8 text-xs py-1.5 h-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <Select
                      className="text-xs py-1.5 h-9 w-28"
                      value={cropFilter}
                      onChange={(e) => setCropFilter(e.target.value)}
                    >
                      <option value="all">All Crops</option>
                      <option value="tobacco">Tobacco</option>
                      <option value="grain">Grain</option>
                    </Select>
                    <Select
                      className="text-xs py-1.5 h-9 w-28"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="all">All Status</option>
                      <option value="draft">Draft</option>
                      <option value="in_progress">In Progress</option>
                      <option value="under_review">Under Review</option>
                      <option value="flagged">Flagged</option>
                      <option value="certified">Certified</option>
                    </Select>
                  </div>
                }
              />
              <div className="w-full overflow-x-auto touch-pan-x">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted">
                      <th className="px-4 sm:px-6 py-3 font-medium">Work order</th>
                      <th className="px-3 py-3 font-medium">Client</th>
                      <th className="px-3 py-3 font-medium">Crop</th>
                      <th className="px-3 py-3 font-medium">Created</th>
                      <th className="px-3 py-3 font-medium">Status</th>
                      <th className="px-4 sm:px-6 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredWorkOrders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-xs text-muted">
                          No work orders matching the selected filters.
                        </td>
                      </tr>
                    ) : (
                      filteredWorkOrders.map((w) => {
                        const status = w.fcc?.status ?? w.status;
                        const clientName = typeof w.client === "string" ? w.client : w.client?.name ?? "—";
                        return (
                          <tr key={w.id} className="border-b border-border last:border-0 hover:bg-primon-50/50">
                            <td className="px-4 sm:px-6 py-3.5 font-medium text-primon-900">{w.code}</td>
                            <td className="px-3 py-3.5 text-ink">{clientName}</td>
                            <td className="px-3 py-3.5 capitalize text-ink">{w.cropType}</td>
                            <td className="px-3 py-3.5 text-muted">{formatDate(w.createdAt)}</td>
                            <td className="px-3 py-3.5">
                              <FccStatusPill status={status} />
                            </td>
                            <td className="px-4 sm:px-6 py-3.5 text-right">
                              <Link
                                href={
                                  status === "draft"
                                    ? "/dashboard/work-orders/new"
                                    : `/dashboard/monitor/${w.id}`
                                }
                                className="text-xs font-medium text-primon-700 hover:text-primon-900"
                              >
                                {status === "draft" ? "Continue" : "Open"} →
                              </Link>
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

          {/* 3. Critical Readings & Stock Alerts Section */}
          <section className="space-y-6 min-w-0 max-w-full">
            <Card className="min-w-0">
              <CardHeader
                eyebrow={flagged.length ? "Needs attention" : undefined}
                title="Critical readings"
              />
              <div className="space-y-3 p-4">
                {flagged.length === 0 && (
                  <p className="px-2 py-6 text-center text-xs text-muted">
                    No work orders currently flagged.
                  </p>
                )}
                {flagged.map((w) => (
                  <Link
                    key={w.id}
                    href={`/dashboard/monitor/${w.id}`}
                    className="block rounded-lg border border-status-critical/30 bg-status-criticalTint px-3.5 py-3 transition-colors hover:border-status-critical/60"
                  >
                    <p className="text-sm font-medium text-primon-950">{w.code}</p>
                    <p className="mt-0.5 text-xs text-status-critical">
                      Reading below 600ppm — review corrective action
                    </p>
                  </Link>
                ))}
              </div>
            </Card>

            <Card className="min-w-0">
              <CardHeader title="Stock alerts" />
              <div className="space-y-3 p-4">
                {lowStock.length === 0 && (
                  <p className="px-2 py-6 text-center text-xs text-muted">
                    All formulations above threshold.
                  </p>
                )}
                {lowStock.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-lg border border-status-actionTint bg-status-actionTint/60 px-3.5 py-2.5">
                    <div>
                      <p className="text-xs font-medium text-primon-950">{s.formulation}</p>
                      <p className="text-[11px] text-muted">{s.fumigant}</p>
                    </div>
                    <span className="num text-xs font-semibold text-status-action">
                      {s.quantityOnHand} left
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}

