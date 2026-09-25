"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CertificateView } from "@/components/certificate-view";
import { DownloadCertificateButton } from "@/components/download-certificate-button";
import { EmptyState } from "@/components/ui/kpi";
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
    return <EmptyState title="Not found" description={error} />;
  }
  if (!wo) {
    return <p className="text-sm text-muted">Loading…</p>;
  }

  return (
    <div>
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

      <CertificateView
        ref={sheetRef}
        workOrder={wo}
        editableSi={wo.status !== "certified"}
        onSaveSi={async (si) => {
          await fetch(`/api/fccs/${params.id}/si`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tobaccoSupplier: si.tobaccoSupplier,
              tobaccoSupplierAddress: si.supplierAddress,
              consignee: si.consignee,
              consigneeAddress: si.consigneeAddress,
              fumigationContractor: si.fumigationContractor,
              cropYear: si.cropYear,
              tobaccoType: si.tobaccoType,
              netWeight: si.netWeight,
              quantity: si.quantity,
              polylined: si.polylined === "Yes",
              gradeName: si.gradeName,
              caseNos: si.caseNos,
              countryOfOrigin: si.countryOfOrigin,
              location: si.location,
              warehouseSection: si.warehouseSection,
            }),
          });
          await load();
        }}
      />
    </div>
  );
}
