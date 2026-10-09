"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CertificateView } from "@/components/certificate-view";
import { ShippingInstructionsForm } from "@/components/shipping-instructions-form";
import { DownloadCertificateButton } from "@/components/download-certificate-button";
import { EmptyState } from "@/components/ui/kpi";
import { Card } from "@/components/ui/card";
import { FccStatusPill } from "@/components/ui/status-pill";
import { PortalReadingStrip, clientStatusSummary } from "@/components/portal-progress";
import { PortalTopbar } from "@/components/portal-topbar";
import { certificateFilename } from "@/lib/download-certificate";
import { mapFccToWorkOrder } from "@/lib/map-fcc";
import type { WorkOrder } from "@/lib/types";

export default function PortalWorkOrderPage({ params }: { params: { id: string } }) {
  const sheetRef = useRef<HTMLElement>(null);
  const [wo, setWo] = useState<WorkOrder | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/fccs/${params.id}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load certificate");
    setWo(mapFccToWorkOrder(data.fcc));
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load certificate");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  if (error) {
    return (
      <div>
        <PortalTopbar title="Shipment" />
        <div className="px-6 py-8 lg:px-10">
          <EmptyState title="Not found" description={error} />
        </div>
      </div>
    );
  }
  if (!wo) {
    return (
      <div>
        <PortalTopbar title="Shipment" />
        <div className="px-6 py-8 lg:px-10">
          <p className="text-sm text-muted">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PortalTopbar title={wo.code} description={wo.certificateNumber} />
      <div className="px-6 py-8 lg:px-10">
      <div className="no-print mb-6 flex items-center justify-between">
        <Link
          href="/portal"
          className="flex items-center gap-1.5 text-xs font-medium text-primon-700 hover:text-primon-950"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Your shipments
        </Link>
        {wo.status === "certified" && (
          <DownloadCertificateButton
            targetRef={sheetRef}
            filename={certificateFilename(wo.certificateNumber, wo.code)}
            label="Download certified FCC"
          />
        )}
      </div>

      <Card className="mb-8 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-display text-xl text-primon-950">{wo.code}</p>
            <p className="mt-1 max-w-xl text-sm text-muted">{clientStatusSummary(wo.status)}</p>
          </div>
          <FccStatusPill status={wo.status} />
        </div>
        <div className="mt-5">
          <PortalReadingStrip readings={wo.readings} />
        </div>
      </Card>

      <ShippingInstructionsForm
        workOrderId={wo.id}
        initial={wo.si}
        onSaved={(si) => setWo({ ...wo, si })}
      />

      <CertificateView ref={sheetRef} workOrder={wo} />
      </div>
    </div>
  );
}
