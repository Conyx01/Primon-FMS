"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/kpi";
import { Button } from "@/components/ui/button";
import { PortalTopbar } from "@/components/portal-topbar";
import { formatDate } from "@/lib/utils";

type CertRow = {
  id: string;
  code: string;
  createdAt: string;
  fcc?: {
    id: string;
    status: string;
    certificateNumber: string | null;
    certifiedAt: string | null;
  } | null;
};

export default function PortalCertificatesPage() {
  const [rows, setRows] = useState<CertRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/work-orders?status=certified");
        const data = await res.json();
        if (res.ok) setRows(data.workOrders ?? []);
      } catch {
        // empty list
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div>
      <PortalTopbar
        title="Certificates"
        description="Certified FCCs you can open and download"
      />
      <div className="px-6 py-8 lg:px-10">
        {loading ? (
          <Card className="animate-pulse p-8 text-center text-xs text-muted">
            Loading certificates…
          </Card>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No certificates yet"
            description="When Primon certifies a fumigation, the document will appear here."
          />
        ) : (
          <div className="space-y-3">
            {rows.map((w) => (
              <Card key={w.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="flex items-start gap-3">
                  <FileCheck className="mt-0.5 h-5 w-5 text-primon-700" strokeWidth={1.75} />
                  <div>
                    <p className="font-display text-lg text-primon-950">
                      {w.fcc?.certificateNumber ?? w.code}
                    </p>
                    <p className="text-xs text-muted">
                      {w.code}
                      {w.fcc?.certifiedAt
                        ? ` · Certified ${formatDate(w.fcc.certifiedAt)}`
                        : ""}
                    </p>
                  </div>
                </div>
                <Link href={`/portal/${w.id}`}>
                  <Button size="sm" variant="secondary">
                    View & download
                  </Button>
                </Link>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
