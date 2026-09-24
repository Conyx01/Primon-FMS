"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FccStatusPill } from "@/components/ui/status-pill";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/kpi";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { formatDate } from "@/lib/utils";

export default function PortalHomePage() {
  const { user } = useCurrentUser();
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadClientWorkOrders() {
      try {
        const res = await fetch("/api/work-orders");
        if (res.ok) {
          const data = await res.json();
          setWorkOrders(data.workOrders || []);
        }
      } catch (err) {
        console.error("Error loading client portal work orders:", err);
      } finally {
        setLoading(false);
      }
    }
    loadClientWorkOrders();
  }, []);

  const clientName = user?.name || "Client Portal";

  return (
    <div>
      <p className="text-sm text-brass-600">Welcome back</p>
      <h1 className="mt-1 font-display text-3xl text-primon-950">
        {clientName}
      </h1>
      <p className="mt-2 max-w-xl text-sm text-muted">
        Track fumigation progress on your shipments and complete shipping
        instructions at any stage before certification.
      </p>

      <div className="mt-8 space-y-4">
        {loading ? (
          <Card className="p-8 text-center text-xs text-muted animate-pulse">
            Loading your active shipments...
          </Card>
        ) : workOrders.length === 0 ? (
          <EmptyState
            title="No shipments yet"
            description="Fumigation requests will appear here once logged by Primon."
          />
        ) : (
          workOrders.map((w) => {
            const fcc = w.fcc;
            const status = fcc?.status ?? w.status;
            const readings = fcc?.gasReadings || [];
            const daysLogged = readings.filter((r: any) => r.status !== "pending").length;
            const si = fcc?.shippingInstructions || {};

            return (
              <Link key={w.id} href={`/portal/${w.id}`}>
                <Card className="p-6 transition-shadow hover:shadow-elevated">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-display text-lg text-primon-950">{w.code}</p>
                      <p className="text-xs text-muted capitalize">
                        {si.tobaccoType || w.cropType} · {si.quantity ? `${si.quantity} Cartons/Units` : "quantity pending"}
                      </p>
                    </div>
                    <FccStatusPill status={status} />
                  </div>

                  <div className="mt-5 flex items-center gap-3">
                    <div className="flex-1">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-primon-700 transition-all duration-300"
                          style={{ width: `${(daysLogged / 6) * 100}%` }}
                        />
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-muted">{daysLogged}/6 days monitored</span>
                  </div>
                  <p className="mt-3 text-[11px] text-muted">Created {formatDate(w.createdAt)}</p>
                </Card>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
