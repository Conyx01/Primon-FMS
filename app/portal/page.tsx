"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FccStatusPill } from "@/components/ui/status-pill";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/kpi";
import { PortalTopbar } from "@/components/portal-topbar";
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

  const clientName = user?.name || "Client";

  return (
    <div>
      <PortalTopbar
        title="Shipments"
        description={`Welcome back, ${clientName}`}
      />
      <div className="px-6 py-8 lg:px-10">
        <p className="max-w-xl text-sm text-muted">
          Track fumigation on your shipments. Open a job to see daily readings. Certified
          documents also live under Certificates.
        </p>

        <div className="mt-8 space-y-4">
          {loading ? (
            <Card className="animate-pulse p-8 text-center text-xs text-muted">
              Loading your shipments…
            </Card>
          ) : workOrders.length === 0 ? (
            <EmptyState
              title="No shipments yet"
              description="Fumigation jobs will appear here once Primon attaches them to your account."
            />
          ) : (
            workOrders.map((w) => {
              const fcc = w.fcc;
              const status = fcc?.status ?? w.status;
              const readings = fcc?.gasReadings || [];
              const daysLogged = readings.filter(
                (r: { dayNumber: number; status: string }) =>
                  r.dayNumber > 0 && r.status !== "pending"
              ).length;

              return (
                <Link key={w.id} href={`/portal/${w.id}`}>
                  <Card className="p-6 transition-shadow hover:shadow-elevated">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="font-display text-lg text-primon-950">{w.code}</p>
                        <p className="text-xs capitalize text-muted">
                          {w.cropType}
                          {fcc?.certificateNumber ? ` · ${fcc.certificateNumber}` : ""}
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
                      <span className="shrink-0 text-xs text-muted">
                        {daysLogged}/6 days monitored
                      </span>
                    </div>
                    <p className="mt-3 text-[11px] text-muted">Created {formatDate(w.createdAt)}</p>
                  </Card>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
