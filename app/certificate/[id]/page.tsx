"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PrimonLogo } from "@/components/logo";
import { CertificateView } from "@/components/certificate-view";
import { PmiCertificateView } from "@/components/pmi-certificate-view";
import { DownloadCertificateButton } from "@/components/download-certificate-button";
import { EmptyState } from "@/components/ui/kpi";
import { certificateFilename } from "@/lib/download-certificate";
import { mapFccToWorkOrder } from "@/lib/map-fcc";
import type { WorkOrder } from "@/lib/types";

export default function CertificatePage({ params }: { params: { id: string } }) {
  const sheetRef = useRef<HTMLElement>(null);
  const [wo, setWo] = useState<WorkOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<"pmi_crest" | "primon_logo" | "standard">("standard");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/fccs/${params.id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load certificate");
        if (!cancelled) {
          const mapped = mapFccToWorkOrder(data.fcc);
          setWo(mapped);
          const isPmi =
            mapped.si.certificateTemplate === "pmi" ||
            /philip\s*morris|pmi/i.test(mapped.si.consignee || "") ||
            /philip\s*morris|pmi/i.test(mapped.si.consigneeAddress || "");
          if (isPmi) {
            setSelectedTemplate("pmi_crest");
          }
        }
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

  const isPmiJob = Boolean(
    wo &&
      (wo.si.certificateTemplate === "pmi" ||
        /philip\s*morris|pmi/i.test(wo.si.consignee || "") ||
        /philip\s*morris|pmi/i.test(wo.si.consigneeAddress || ""))
  );

  return (
    <main className="min-h-screen bg-canvas pb-20">
      <header className="no-print flex flex-wrap items-center justify-between gap-4 border-b border-border bg-white px-6 py-4 lg:px-10">
        <div className="flex items-center gap-6">
          <PrimonLogo width={150} />
          <Link
            href={wo && wo.status !== "certified" ? `/dashboard/monitor/${wo.id}` : "/dashboard"}
            className="hidden items-center gap-1.5 text-xs font-medium text-primon-700 hover:text-primon-900 sm:flex"
          >
            <ArrowLeft className="h-3.5 w-3.5" />{" "}
            {wo && wo.status !== "certified" ? "Edit job details" : "Back to platform"}
          </Link>
        </div>

        {/* Template Switcher Tabs */}
        {wo && isPmiJob && (
          <div className="flex items-center rounded-lg border border-border bg-slate-100 p-1 text-xs">
            <button
              type="button"
              onClick={() => setSelectedTemplate("pmi_crest")}
              className={`rounded-md px-3 py-1 font-semibold transition-all ${
                selectedTemplate === "pmi_crest"
                  ? "bg-white text-primon-950 shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
            >
              PMI (PMI Crest)
            </button>
            <button
              type="button"
              onClick={() => setSelectedTemplate("primon_logo")}
              className={`rounded-md px-3 py-1 font-semibold transition-all ${
                selectedTemplate === "primon_logo"
                  ? "bg-white text-primon-950 shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
            >
              PMI (Primon Logo)
            </button>
            <button
              type="button"
              onClick={() => setSelectedTemplate("standard")}
              className={`rounded-md px-3 py-1 font-semibold transition-all ${
                selectedTemplate === "standard"
                  ? "bg-white text-primon-950 shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
            >
              Standard FCC
            </button>
          </div>
        )}

        {wo?.status === "certified" && (() => {
          const missingAmbient = wo.readings
            .filter((r) => r.day > 0 && r.status !== "not_monitored")
            .some((r) => r.ambientTemp === null || r.ambientTemp === undefined);
          return missingAmbient ? (
            <span className="rounded bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-800">
              ⚠ Record ambient temperatures for all monitored days before downloading
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <DownloadCertificateButton
                targetRef={sheetRef}
                filename={certificateFilename(wo.certificateNumber, wo.code, selectedTemplate)}
                label={
                  selectedTemplate === "pmi_crest"
                    ? "Download PMI (PMI Crest) PDF"
                    : selectedTemplate === "primon_logo"
                    ? "Download PMI (Primon Logo) PDF"
                    : "Download Certified FCC"
                }
              />
            </div>
          );
        })()}
      </header>

      <div className="mx-auto px-4 py-8 lg:px-8">
        {error ? (
          <EmptyState title="Certificate not found" description={error} />
        ) : !wo ? (
          <p className="text-sm text-muted">Loading certificate…</p>
        ) : selectedTemplate === "pmi_crest" ? (
          <PmiCertificateView ref={sheetRef} workOrder={wo} variant="pmi_crest" />
        ) : selectedTemplate === "primon_logo" ? (
          <PmiCertificateView ref={sheetRef} workOrder={wo} variant="primon_logo" />
        ) : (
          <CertificateView ref={sheetRef} workOrder={wo} />
        )}
      </div>
    </main>
  );
}
