"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  LayoutGrid,
  List,
  Clock,
  ShieldCheck,
  ArrowRight,
  ArrowUpDown,
} from "lucide-react";
import { FccStatusPill } from "@/components/ui/status-pill";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/kpi";
import { PortalTopbar } from "@/components/portal-topbar";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { formatDate } from "@/lib/utils";
import type { FccStatus } from "@/lib/types";

type PortalRow = {
  id: string;
  code: string;
  cropType?: string;
  customProduct?: string;
  createdAt: string;
  status: FccStatus;
  certificateNumber: string | null;
  datePlaced: string | null;
  daysLogged: number;
  isCertified: boolean;
  isActive: boolean;
};

type TabType = "all" | "active" | "certified";
type SortOption = "newest" | "oldest" | "code";

export default function PortalHomePage() {
  const { user } = useCurrentUser();
  const [rows, setRows] = useState<PortalRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/work-orders");
        if (!res.ok) return;
        const data = await res.json();
        const mapped: PortalRow[] = (data.workOrders ?? []).map((w: any) => {
          const fcc = w.fcc;
          const status = (fcc?.status ?? w.status ?? "draft") as FccStatus;
          const readings: { dayNumber: number; status: string }[] =
            fcc?.gasReadings ?? [];
          const daysLogged = readings.filter(
            (r) => r.dayNumber > 0 && r.status !== "pending"
          ).length;
          return {
            id: w.id,
            code: w.code,
            cropType: w.cropType,
            customProduct: w.customProduct,
            createdAt: w.createdAt,
            status,
            certificateNumber: fcc?.certificateNumber ?? null,
            datePlaced: fcc?.closeout?.datePlaced ?? null,
            daysLogged,
            isCertified: status === "certified",
            isActive: status !== "certified",
          };
        });
        if (!cancelled) setRows(mapped);
      } catch {
        // silent — empty list shown
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(
    () => ({
      all: rows.length,
      active: rows.filter((r) => r.isActive).length,
      certified: rows.filter((r) => r.isCertified).length,
    }),
    [rows]
  );

  const filteredRows = useMemo(() => {
    return rows
      .filter((r) => {
        if (activeTab === "active" && !r.isActive) return false;
        if (activeTab === "certified" && !r.isCertified) return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchCode = r.code.toLowerCase().includes(q);
          const matchCert = (r.certificateNumber ?? "").toLowerCase().includes(q);
          if (!matchCode && !matchCert) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "newest") {
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        }
        if (sortBy === "oldest") {
          return (
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        }
        return a.code.localeCompare(b.code);
      });
  }, [rows, activeTab, searchQuery, sortBy]);

  const clientName = user?.name || "Client";

  const cropLabel = (r: PortalRow) =>
    r.cropType === "other" ? r.customProduct || "Other" : r.cropType ?? "";

  return (
    <div className="pb-16">
      <PortalTopbar
        title="Shipments"
        description={`Welcome back, ${clientName}`}
      />

      <div className="px-6 py-6 lg:px-10">
        {/* ── Status Tabs ── */}
        <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-border pb-4">
          {(
            [
              { key: "all", label: "All Shipments" },
              { key: "active", label: "Active", icon: <Clock className="h-3.5 w-3.5" /> },
              { key: "certified", label: "Certified", icon: <ShieldCheck className="h-3.5 w-3.5" /> },
            ] as { key: TabType; label: string; icon?: React.ReactNode }[]
          ).map(({ key, label, icon }) => {
            const isSelected = activeTab === key;
            const count = counts[key];
            const certStyle =
              key === "certified" && isSelected
                ? "bg-emerald-700 text-white shadow-sm"
                : key === "certified"
                ? "bg-white text-muted hover:bg-slate-100 hover:text-ink"
                : "";
            const defaultStyle =
              key !== "certified"
                ? isSelected
                  ? "bg-primon-900 text-white shadow-sm"
                  : "bg-white text-muted hover:bg-slate-100 hover:text-ink"
                : "";
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors ${certStyle || defaultStyle}`}
              >
                {icon}
                <span>{label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-muted"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Search, Sort & View Toggle ── */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="Search by code or certificate no…"
                className="w-full rounded-lg border border-border bg-white py-2 pl-9 pr-3 text-xs outline-none focus:border-primon-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Sort */}
            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="h-3.5 w-3.5 text-muted" />
              <select
                className="rounded-lg border border-border bg-white px-3 py-2 text-xs outline-none focus:border-primon-500"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="code">Work order code</option>
              </select>
            </div>
          </div>

          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-border bg-white p-1">
            <button
              onClick={() => setViewMode("grid")}
              title="Card view"
              className={`rounded p-1.5 transition-colors ${
                viewMode === "grid"
                  ? "bg-primon-100 text-primon-900"
                  : "text-muted hover:text-ink"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              title="Table view"
              className={`rounded p-1.5 transition-colors ${
                viewMode === "table"
                  ? "bg-primon-100 text-primon-900"
                  : "text-muted hover:text-ink"
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Content ── */}
        {loading ? (
          <Card className="animate-pulse p-8 text-center text-xs text-muted">
            Loading your shipments…
          </Card>
        ) : filteredRows.length === 0 ? (
          <EmptyState
            title={
              searchQuery || activeTab !== "all"
                ? "No shipments match your search"
                : "No shipments yet"
            }
            description={
              searchQuery || activeTab !== "all"
                ? "Try adjusting your search or switching tabs."
                : "Fumigation jobs will appear here once Primon attaches them to your account."
            }
          />
        ) : viewMode === "grid" ? (
          /* ── CARD GRID ── */
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredRows.map((w) => (
              <Card
                key={w.id}
                className="flex flex-col p-5 transition-shadow hover:shadow-elevated"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-[17px] text-primon-950">
                      {w.code}
                    </p>
                    <p className="mt-0.5 text-xs capitalize text-muted">
                      {cropLabel(w)}
                      {w.certificateNumber ? ` · ${w.certificateNumber}` : ""}
                    </p>
                  </div>
                  <FccStatusPill status={w.status} />
                </div>

                {/* Progress bar */}
                <div className="mt-5 flex items-center gap-3">
                  <div className="flex-1">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-primon-700 transition-all duration-300"
                        style={{ width: `${(w.daysLogged / 6) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-muted">
                    {w.daysLogged}/6 days monitored
                  </span>
                </div>

                {/* Footer: date + explicit Open button */}
                <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
                  <p className="text-[11px] text-muted">
                    {w.datePlaced
                      ? `Placed ${formatDate(w.datePlaced)}`
                      : `Created ${formatDate(w.createdAt)}`}
                  </p>
                  <Link
                    href={`/portal/${w.id}`}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-primon-700 hover:bg-slate-50 hover:text-primon-900"
                  >
                    Open <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          /* ── TABLE VIEW ── */
          <div className="overflow-hidden rounded-xl border border-border bg-white shadow-card">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-5 py-3.5">Work Order</th>
                  <th className="px-5 py-3.5">Product</th>
                  <th className="px-5 py-3.5">Date Placed</th>
                  <th className="px-5 py-3.5">Progress</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredRows.map((w) => (
                  <tr
                    key={w.id}
                    className="transition-colors hover:bg-slate-50/80"
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-primon-950">{w.code}</p>
                      {w.certificateNumber && (
                        <p className="mt-0.5 text-[10px] text-muted">
                          {w.certificateNumber}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 capitalize text-muted">
                      {cropLabel(w) || "—"}
                    </td>
                    <td className="px-5 py-3.5 text-muted">
                      {w.datePlaced ? formatDate(w.datePlaced) : "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-primon-700"
                            style={{ width: `${(w.daysLogged / 6) * 100}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-muted">
                          {w.daysLogged}/6
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <FccStatusPill status={w.status} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/portal/${w.id}`}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-primon-700 hover:bg-slate-100 hover:text-primon-900"
                      >
                        Open <ArrowRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
