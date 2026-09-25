import Link from "next/link";
import { headers } from "next/headers";
import { ShieldCheck, ShieldX } from "lucide-react";
import { PrimonLogo } from "@/components/logo";
import { loadCertifiedPublicSummary } from "@/lib/verify-fcc";
import { verificationHostLabel } from "@/lib/verify-url";
import { formatDate, formatDateTime } from "@/lib/utils";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  supervising_fumigator: "Supervising Fumigator",
  supplier_rep: "For the Supplier",
  certifying_officer: "Certifying Officer",
};

export default async function VerifyCertificatePage({
  params,
}: {
  params: { certificateId: string };
}) {
  const ip = headers().get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const allowed = rateLimit(`verify-page:${ip}`);
  const summary = allowed ? await loadCertifiedPublicSummary(params.certificateId) : null;

  return (
    <main className="min-h-screen bg-canvas">
      <header className="border-b border-border bg-white px-6 py-5">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <PrimonLogo width={160} />
          <p className="text-[11px] text-muted">Official verification</p>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-6 py-10">
        {!allowed ? (
          <div className="rounded-2xl border border-border bg-white p-8 shadow-card">
            <p className="font-display text-2xl text-primon-950">Too many requests</p>
            <p className="mt-2 text-sm text-muted">Wait a moment and scan again.</p>
          </div>
        ) : !summary ? (
          <div className="rounded-2xl border border-status-critical/30 bg-white p-8 shadow-card">
            <div className="flex items-center gap-3">
              <ShieldX className="h-8 w-8 text-status-critical" />
              <div>
                <p className="font-display text-2xl text-primon-950">Not a valid certificate</p>
                <p className="mt-1 text-sm text-muted">
                  This number is not a certified FCC in the Primon Fumigation Management System.
                </p>
              </div>
            </div>
            <p className="mt-6 text-xs text-muted">
              Confirm the address bar is this Primon host. If the QR opened a different site, do not
              trust that page.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-status-compliant/40 bg-white p-8 shadow-card">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-8 w-8 text-status-compliant" />
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-status-compliant">
                    Certified
                  </p>
                  <p className="font-display text-2xl text-primon-950">{summary.certificateNumber}</p>
                </div>
              </div>
            </div>

            <dl className="mt-8 grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-muted">Work order</dt>
                <dd className="mt-0.5 font-medium text-ink">{summary.workOrderCode}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-muted">Client</dt>
                <dd className="mt-0.5 font-medium text-ink">{summary.clientName ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-muted">Crop</dt>
                <dd className="mt-0.5 font-medium capitalize text-ink">{summary.cropType}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-muted">Fumigant placed</dt>
                <dd className="mt-0.5 font-medium text-ink">
                  {summary.datePlaced ? formatDate(summary.datePlaced) : "—"}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[11px] uppercase tracking-wide text-muted">Certified</dt>
                <dd className="mt-0.5 font-medium text-ink">
                  {summary.certifiedAt ? formatDateTime(summary.certifiedAt) : "—"}
                </dd>
              </div>
            </dl>

            <div className="mt-8 border-t border-border pt-6">
              <p className="text-[11px] uppercase tracking-wide text-muted">Signed by</p>
              <ul className="mt-3 space-y-2">
                {summary.signers.map((s) => (
                  <li key={s.role} className="flex items-baseline justify-between gap-4 text-sm">
                    <span className="text-muted">{ROLE_LABEL[s.role] ?? s.role}</span>
                    <span className="text-right font-medium text-ink">
                      {s.signerName}
                      <span className="block text-[11px] font-normal text-muted">
                        {formatDateTime(s.signedAt)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="mt-8 text-xs leading-relaxed text-muted">
              Issued by {summary.issuer} · Licensed commercial applicator, Malawi Pesticides Control
              Board. Match this FCC number and client to the paper in your hand. Trust this page
              only if the address is{" "}
              <span className="font-medium text-ink">
                {verificationHostLabel(summary.verificationUrl)}
              </span>
              .
            </p>
          </div>
        )}

        <p className="mt-8 text-center text-[11px] text-muted">
          <Link href="/" className="hover:text-primon-900">
            Primon FMS
          </Link>
        </p>
      </div>
    </main>
  );
}
