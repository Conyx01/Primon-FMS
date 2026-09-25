"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PrimonLogo } from "@/components/logo";
import { CertificateView } from "@/components/certificate-view";
import { DownloadCertificateButton } from "@/components/download-certificate-button";
import { EmptyState } from "@/components/ui/kpi";
import { certificateFilename } from "@/lib/download-certificate";
import { mapFccToWorkOrder } from "@/lib/map-fcc";
import type { WorkOrder } from "@/lib/types";

export default function CertificatePage({ params }: { params: { id: string } }) {
  const sheetRef = useRef<HTMLElement>(null);
  const [wo, setWo] = useState<WorkOrder | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/fccs/${params.id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load certificate");
        if (!cancelled) setWo(mapFccToWorkOrder(data.fcc));
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load certificate");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  return (
    <main className="min-h-screen bg-canvas pb-20">
      <header className="no-print flex items-center justify-between border-b border-border bg-white px-6 py-5 lg:px-10">
        <div className="flex items-center gap-6">
          <PrimonLogo width={150} />
          <Link
            href="/dashboard"
            className="hidden items-center gap-1.5 text-xs font-medium text-primon-700 hover:text-primon-900 sm:flex"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to platform
          </Link>
        </div>
        {wo?.status === "certified" && (
          <DownloadCertificateButton
            targetRef={sheetRef}
            filename={certificateFilename(wo.certificateNumber, wo.code)}
            label="Download certified FCC"
          />
        )}
      </header>

      <div className="mx-auto px-4 py-8 lg:px-8">
        {error ? (
          <EmptyState title="Certificate not found" description={error} />
        ) : !wo ? (
          <p className="text-sm text-muted">Loading certificate…</p>
        ) : (
          <CertificateView ref={sheetRef} workOrder={wo} />
        )}
      </div>
    </main>
  );
}
