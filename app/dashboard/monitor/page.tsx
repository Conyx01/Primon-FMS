"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  LayoutGrid,
  List,
  TriangleAlert,
  ShieldCheck,
  Clock,
  ArrowUpDown,
  ArrowRight,
  Filter,
} from "lucide-react";
import { Topbar } from "@/components/topbar";
import { Card } from "@/components/ui/card";
import { FccStatusPill } from "@/components/ui/status-pill";
import { EmptyState } from "@/components/ui/kpi";
import { formatDate } from "@/lib/utils";
import type { FccStatus } from "@/lib/types";

type MonitorRow = {
  id: string;
  code: string;
  client: string;
  status: FccStatus;
  cropType?: string;
  datePlaced: string | null;
  readings: {
    dayNumber: number;
    status: string;
    airspacePpm?: number | null;
    probeCasePpm?: number | null;
  }[];
};

type TabType = "all" | "active" | "critical" | "ready" | "certified";
type SortOption = "urgency" | "newest" | "oldest" | "code";

export default function MonitorListPage() {
  const [rows, setRows] = useState<MonitorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [sortBy, setSortBy] = useState<SortOption>("urgency");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/work-orders");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load work orders");
        const mapped: MonitorRow[] = (data.workOrders ?? [])
          .filter((wo: any) => (wo.fcc?.gasReadings?.length ?? 0) > 0)
          .map((wo: any) => ({
            id: wo.id,
            code: wo.code,
            client: wo.client?.name ?? "—",
            status: wo.fcc.status,
            cropType: wo.cropType,
            datePlaced: wo.fcc.closeout?.datePlaced ?? null,
            readings: wo.fcc.gasReadings ?? [],
          }));
        if (!cancelled) setRows(mapped);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load monitor list");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Helper row classifications
  const analyzedRows = useMemo(() => {
    return rows.map((r) => {
      const hasCritical =
        r.readings.some((g) => g.status === "critical") || r.status === "flagged";
      const daysLogged = r.readings.filter((g) => g.dayNumber > 0 && g.status !== "pending").length;
      const isCertified = r.status === "certified";
      const nonPendingGasDays = r.readings.filter((g) => g.dayNumber > 0 && g.status !== "pending");
      const isReadyToCertify =
        !isCertified &&
        !hasCritical &&
        daysLogged >= 6 &&
        nonPendingGasDays.length >= 6;
      const isActive = !isCertified && !isReadyToCertify && !hasCritical;

      // Urgency score: higher means needs attention first
      let urgencyScore = 1;
      if (hasCritical) urgencyScore = 5;
      else if (isActive) urgencyScore = 4;
      else if (isReadyToCertify) urgencyScore = 3;
      else if (isCertified) urgencyScore = 2;

      return {
        ...r,
        hasCritical,
        daysLogged,
        isCertified,
        isReadyToCertify,
        isActive,
        urgencyScore,
      };
    });
  }, [rows]);

  // Unique clients for filter dropdown
  const uniqueClients = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.client && r.client !== "—") set.add(r.client);
    });
    return Array.from(set).sort();
  }, [rows]);

  // Tab Counts
  const counts = useMemo(() => {
    return {
      all: analyzedRows.length,
      active: analyzedRows.filter((r) => r.isActive).length,
      critical: analyzedRows.filter((r) => r.hasCritical).length,
      ready: analyzedRows.filter((r) => r.isReadyToCertify).length,
      certified: analyzedRows.filter((r) => r.isCertified).length,
    };
  }, [analyzedRows]);

  // Filtered & Sorted Rows
  const filteredRows = useMemo(() => {
    return analyzedRows
      .filter((r) => {
        // Tab filter
        if (activeTab === "active" && !r.isActive) return false;
        if (activeTab === "critical" && !r.hasCritical) return false;
        if (activeTab === "ready" && !r.isReadyToCertify) return false;
        if (activeTab === "certified" && !r.isCertified) return false;

        // Client filter
        if (clientFilter !== "all" && r.client !== clientFilter) return false;

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchCode = r.code.toLowerCase().includes(q);
          const matchClient = r.client.toLowerCase().includes(q);
          if (!matchCode && !matchClient) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "urgency") {
          if (b.urgencyScore !== a.urgencyScore) {
            return b.urgencyScore - a.urgencyScore;
          }
          const dateA = a.datePlaced ? new Date(a.datePlaced).getTime() : 0;
          const dateB = b.datePlaced ? new Date(b.datePlaced).getTime() : 0;
          return dateB - dateA;
        }
        if (sortBy === "newest") {
          const dateA = a.datePlaced ? new Date(a.datePlaced).getTime() : 0;
          const dateB = b.datePlaced ? new Date(b.datePlaced).getTime() : 0;
          return dateB - dateA;
        }
        if (sortBy === "oldest") {
          const dateA = a.datePlaced ? new Date(a.datePlaced).getTime() : 0;
          const dateB = b.datePlaced ? new Date(b.datePlaced).getTime() : 0;
          return dateA - dateB;
        }
        if (sortBy === "code") {
          return a.code.localeCompare(b.code);
        }
        return 0;
      });
  }, [analyzedRows, activeTab, clientFilter, searchQuery, sortBy]);

  return (
    <div className="pb-16">
      <Topbar
        title="Gas-reading monitor"
        description="Every active 6-day monitoring window, grouped by operational status"
      />

      <div className="px-6 py-6 lg:px-10">
        {/* Status Category Tabs */}
        <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-border pb-4">
          <button
            onClick={() => setActiveTab("all")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors ${
              activeTab === "all"
                ? "bg-primon-900 text-white shadow-sm"
                : "bg-white text-muted hover:bg-slate-100 hover:text-ink"
            }`}
          >
            <span>All Monitoring</span>
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                activeTab === "all" ? "bg-white/20 text-white" : "bg-slate-100 text-muted"
              }`}
            >
              {counts.all}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("active")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors ${
              activeTab === "active"
                ? "bg-primon-900 text-white shadow-sm"
                : "bg-white text-muted hover:bg-slate-100 hover:text-ink"
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Active Cycle</span>
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                activeTab === "active" ? "bg-white/20 text-white" : "bg-slate-100 text-muted"
              }`}
            >
              {counts.active}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("critical")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors ${
              activeTab === "critical"
                ? "bg-red-600 text-white shadow-sm"
                : counts.critical > 0
                  ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                  : "bg-white text-muted hover:bg-slate-100 hover:text-ink"
            }`}
          >
            <TriangleAlert className="h-3.5 w-3.5" />
            <span>Action Required</span>
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                activeTab === "critical"
                  ? "bg-white/20 text-white"
                  : counts.critical > 0
                    ? "bg-red-200 text-red-800"
                    : "bg-slate-100 text-muted"
              }`}
            >
              {counts.critical}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("ready")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors ${
              activeTab === "ready"
                ? "bg-emerald-700 text-white shadow-sm"
                : "bg-white text-muted hover:bg-slate-100 hover:text-ink"
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Ready to Certify</span>
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                activeTab === "ready" ? "bg-white/20 text-white" : "bg-slate-100 text-muted"
              }`}
            >
              {counts.ready}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("certified")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors ${
              activeTab === "certified"
                ? "bg-primon-900 text-white shadow-sm"
                : "bg-white text-muted hover:bg-slate-100 hover:text-ink"
            }`}
          >
            <span>Certified Archive</span>
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                activeTab === "certified" ? "bg-white/20 text-white" : "bg-slate-100 text-muted"
              }`}
            >
              {counts.certified}
            </span>
          </button>
        </div>

        {/* Search, Filter & View Controls */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative min-w-[240px] flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="Search work order or client…"
                className="w-full rounded-lg border border-border bg-white py-2 pl-9 pr-3 text-xs outline-none focus:border-primon-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Client Filter */}
            {uniqueClients.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-muted" />
                <select
                  className="rounded-lg border border-border bg-white px-3 py-2 text-xs outline-none focus:border-primon-500"
                  value={clientFilter}
                  onChange={(e) => setClientFilter(e.target.value)}
                >
                  <option value="all">All Clients ({uniqueClients.length})</option>
                  {uniqueClients.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="h-3.5 w-3.5 text-muted" />
              <select
                className="rounded-lg border border-border bg-white px-3 py-2 text-xs outline-none focus:border-primon-500"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
              >
                <option value="urgency">Sort by Urgency (Critical first)</option>
                <option value="newest">Date Placed (Newest first)</option>
                <option value="oldest">Date Placed (Oldest first)</option>
                <option value="code">Work Order Code</option>
              </select>
            </div>
          </div>

          {/* View Mode Toggle: Grid vs Table */}
          <div className="flex items-center rounded-lg border border-border bg-white p-1">
            <button
              onClick={() => setViewMode("grid")}
              title="Card Grid View"
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
              title="Compact Table View"
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

        {/* Content Area */}
        {loading ? (
          <p className="text-sm text-muted">Loading monitoring windows…</p>
        ) : error ? (
          <EmptyState title="Could not load monitor" description={error} />
        ) : filteredRows.length === 0 ? (
          <EmptyState
            title="No work orders match your criteria"
            description={
              searchQuery || clientFilter !== "all" || activeTab !== "all"
                ? "Try adjusting your search terms or switching tabs."
                : "Record Date Fumigant Placed on a work order to open its 6-day monitoring window."
            }
          />
        ) : viewMode === "grid" ? (
          /* ── GRID VIEW ── */
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredRows.map((w) => {
              const gasReadingsSorted = w.readings
                .slice()
                .sort((a, b) => a.dayNumber - b.dayNumber);

              return (
                <Link key={w.id} href={`/dashboard/monitor/${w.id}`}>
                  <Card
                    className={`h-full p-5 transition-all hover:shadow-elevated ${
                      w.hasCritical
                        ? "border-red-300 bg-red-50/20"
                        : w.isReadyToCertify
                          ? "border-emerald-300 bg-emerald-50/20"
                          : ""
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-display text-[17px] text-primon-950">{w.code}</p>
                          {w.hasCritical && (
                            <span className="flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                              <TriangleAlert className="h-3 w-3" /> Action
                            </span>
                          )}
                          {w.isReadyToCertify && (
                            <span className="flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                              <ShieldCheck className="h-3 w-3" /> Ready
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted">{w.client}</p>
                      </div>
                      <FccStatusPill status={w.status} />
                    </div>

                    {/* 6-Day Dot Gauge */}
                    <div className="mt-5 flex items-end justify-between">
                      <div className="flex gap-1.5">
                        {gasReadingsSorted.map((r) => (
                          <div key={r.dayNumber} className="flex flex-col items-center gap-1">
                            <span
                              title={`Day ${r.dayNumber}: ${r.status}`}
                              className={
                                "h-6 w-2.5 rounded-full " +
                                (r.status === "pending"
                                  ? "bg-slate-200"
                                  : r.status === "critical"
                                    ? "bg-status-critical shadow-sm shadow-red-300"
                                    : r.status === "action_taken"
                                      ? "bg-status-action"
                                      : "bg-status-compliant")
                              }
                            />
                            <span className="text-[9px] font-medium text-slate-400">
                              {r.dayNumber === 0 ? "D0" : `D${r.dayNumber}`}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-semibold text-primon-950">
                          {w.daysLogged}/6 days
                        </p>
                        <p className="text-[10px] text-muted">gas monitored</p>
                      </div>
                    </div>

                    {w.hasCritical && (
                      <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-status-critical">
                        <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                        Gas below 600 ppm — corrective re-dose required
                      </p>
                    )}

                    <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3 text-[11px] text-muted">
                      <span>Placed {w.datePlaced ? formatDate(w.datePlaced) : "—"}</span>
                      <span className="flex items-center gap-0.5 font-medium text-primon-700 hover:text-primon-900">
                        View monitor <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        ) : (
          /* ── TABLE VIEW (Optimized for 50-100 work orders) ── */
          <div className="overflow-hidden rounded-xl border border-border bg-white shadow-card">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-5 py-3.5">Work Order</th>
                  <th className="px-5 py-3.5">Client</th>
                  <th className="px-5 py-3.5">Date Placed</th>
                  <th className="px-5 py-3.5">Monitoring Progress</th>
                  <th className="px-5 py-3.5">FCC Status</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredRows.map((w) => {
                  return (
                    <tr
                      key={w.id}
                      className={`transition-colors hover:bg-slate-50/80 ${
                        w.hasCritical
                          ? "bg-red-50/30"
                          : w.isReadyToCertify
                            ? "bg-emerald-50/20"
                            : ""
                      }`}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/dashboard/monitor/${w.id}`}
                            className="font-medium text-primon-950 hover:text-primon-600"
                          >
                            {w.code}
                          </Link>
                          {w.hasCritical && (
                            <span className="inline-flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                              <TriangleAlert className="h-3 w-3" /> Action
                            </span>
                          )}
                          {w.isReadyToCertify && (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                              <ShieldCheck className="h-3 w-3" /> Ready
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-muted">{w.client}</td>
                      <td className="px-5 py-3.5 text-muted">
                        {w.datePlaced ? formatDate(w.datePlaced) : "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            {w.readings
                              .slice()
                              .sort((a, b) => a.dayNumber - b.dayNumber)
                              .map((r) => (
                                <span
                                  key={r.dayNumber}
                                  title={`Day ${r.dayNumber}: ${r.status}`}
                                  className={
                                    "h-4 w-1.5 rounded-full " +
                                    (r.status === "pending"
                                      ? "bg-slate-200"
                                      : r.status === "critical"
                                        ? "bg-status-critical"
                                        : r.status === "action_taken"
                                          ? "bg-status-action"
                                          : "bg-status-compliant")
                                  }
                                />
                              ))}
                          </div>
                          <span className="text-[11px] text-muted">
                            {w.daysLogged}/6 days
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <FccStatusPill status={w.status} />
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link
                          href={`/dashboard/monitor/${w.id}`}
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-primon-700 hover:bg-slate-100 hover:text-primon-900"
                        >
                          Open <ArrowRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
