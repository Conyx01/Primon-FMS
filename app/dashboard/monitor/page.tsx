"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  datePlaced: string | null;
  readings: { dayNumber: number; status: string }[];
};

export default function MonitorListPage() {
  const [rows, setRows] = useState<MonitorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div>
      <Topbar
        title="Gas-reading monitor"
        description="Every active 6-day monitoring window, at a glance"
      />
      <div className="px-6 py-8 lg:px-10">
        {loading ? (
          <p className="text-sm text-muted">Loading monitoring windows…</p>
        ) : error ? (
          <EmptyState title="Could not load monitor" description={error} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No fumigations in progress"
            description="Record Date Fumigant Placed on a work order to open its 6-day monitoring window."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((w) => {
              const critical = w.readings.some((r) => r.status === "critical");
              const daysLogged = w.readings.filter((r) => r.status !== "pending").length;
              return (
                <Link key={w.id} href={`/dashboard/monitor/${w.id}`}>
                  <Card className="h-full p-5 transition-shadow hover:shadow-elevated">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-display text-[17px] text-primon-950">{w.code}</p>
                        <p className="text-xs text-muted">{w.client}</p>
                      </div>
                      <FccStatusPill status={w.status} />
                    </div>
                    <div className="mt-5 flex items-end justify-between">
                      <div className="flex gap-1">
                        {w.readings
                          .slice()
                          .sort((a, b) => a.dayNumber - b.dayNumber)
                          .map((r) => (
                            <span
                              key={r.dayNumber}
                              className={
                                "h-6 w-2.5 rounded-full " +
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
                      <p className="text-xs text-muted">{daysLogged}/6 days logged</p>
                    </div>
                    {critical && (
                      <p className="mt-3 text-xs font-medium text-status-critical">
                        Critical reading recorded — review required
                      </p>
                    )}
                    <p className="mt-3 text-[11px] text-muted">
                      Placed {w.datePlaced ? formatDate(w.datePlaced) : "—"}
                    </p>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
