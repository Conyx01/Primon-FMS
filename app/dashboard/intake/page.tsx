"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Inbox, Mail, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/kpi";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

type SubmissionStatus = "pending" | "converted" | "rejected";
type SourceType = "work_order" | "rfq" | "rfw";

interface SubmissionPayload {
  name: string;
  contact: string;
  cropOrService: string;
  message: string;
  rejectionReason?: string;
  mergedInto?: string;
  idempotencyKey?: string;
}

interface Submission {
  id: string;
  sourceType: SourceType;
  status: SubmissionStatus;
  receivedAt: string;
  payload: SubmissionPayload;
  reviewedBy?: { id: string; name: string; email: string } | null;
}

// ── Label maps ─────────────────────────────────────────────────────────────

const sourceLabel: Record<SourceType, string> = {
  work_order: "Work order request",
  rfq: "Request for quote",
  rfw: "Request for work",
};

const sourceTone: Record<SourceType, string> = {
  work_order: "bg-primon-100 text-primon-700",
  rfq: "bg-brass-100 text-brass-700",
  rfw: "bg-status-compliantTint text-status-compliant",
};

const TABS: { key: SubmissionStatus; label: string; icon: typeof Clock }[] = [
  { key: "pending", label: "Pending", icon: Clock },
  { key: "converted", label: "Converted", icon: CheckCircle2 },
  { key: "rejected", label: "Rejected", icon: XCircle },
];

// ── Reject dialog state ────────────────────────────────────────────────────

interface RejectState {
  id: string;
  reason: string;
  busy: boolean;
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function IntakePage() {
  const router = useRouter();

  const [tab, setTab] = useState<SubmissionStatus>("pending");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Convert busy tracker (per-row)
  const [converting, setConverting] = useState<string | null>(null);

  // Reject dialog
  const [rejectState, setRejectState] = useState<RejectState | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────

  const load = useCallback(async (status: SubmissionStatus) => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/intake/pending?status=${status}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch submissions");
      setSubmissions(data.submissions ?? []);
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : "Failed to load intake submissions");
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  // ── Convert ────────────────────────────────────────────────────────────
  // Redirect to the wizard pre-filled with this submission.
  // The submission is marked "converted" by the wizard after WO creation.

  function handleConvert(submission: Submission) {
    setConverting(submission.id);
    router.push(`/dashboard/work-orders/new?fromSubmission=${submission.id}`);
  }

  // ── Reject ─────────────────────────────────────────────────────────────

  async function handleReject() {
    if (!rejectState) return;
    setRejectState((s) => s && { ...s, busy: true });
    try {
      const res = await fetch(
        `/api/intake/pending/${rejectState.id}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: rejectState.reason }),
        }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to reject");
      }
      setRejectState(null);
      // Remove from pending list
      setSubmissions((prev) => prev.filter((s) => s.id !== rejectState.id));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Reject failed");
      setRejectState((s) => s && { ...s, busy: false });
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div>
      <Topbar
        title="Website intake"
        description="Work order, RFQ and RFW submissions from the public Primon website"
      />

      <div className="px-6 py-8 lg:px-10">
        {/* Tab bar */}
        <div className="mb-6 flex gap-1 rounded-xl border border-border bg-primon-50/60 p-1 w-fit">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors",
                tab === key
                  ? "bg-white text-primon-950 shadow-sm"
                  : "text-muted hover:text-ink"
              )}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-xl border border-border bg-primon-50/40"
              />
            ))}
          </div>
        ) : fetchError ? (
          <div className="rounded-xl border border-status-critical/30 bg-status-criticalTint p-4 text-sm text-status-critical">
            {fetchError}
          </div>
        ) : submissions.length === 0 ? (
          <EmptyState
            title={
              tab === "pending"
                ? "Inbox is clear"
                : tab === "converted"
                ? "No converted submissions"
                : "No rejected submissions"
            }
            description={
              tab === "pending"
                ? "New work order, RFQ and RFW submissions from primon.mw will appear here."
                : tab === "converted"
                ? "Submissions that have been converted to work orders will appear here."
                : "Dismissed or duplicate submissions will appear here."
            }
          />
        ) : (
          <div className="space-y-4">
            {submissions.map((s) => {
              const p = s.payload;
              return (
                <Card key={s.id} className={cn("p-5", s.status !== "pending" && "opacity-70")}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-3.5">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primon-50 text-primon-700">
                        <Inbox className="h-4.5 w-4.5" strokeWidth={1.75} />
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-primon-950">
                            {p.name}
                          </p>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-medium",
                              sourceTone[s.sourceType]
                            )}
                          >
                            {sourceLabel[s.sourceType]}
                          </span>
                        </div>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                          <Mail className="h-3 w-3" /> {p.contact}
                        </p>
                        <p className="mt-2 text-sm text-ink">{p.cropOrService}</p>
                        {p.message && (
                          <p className="mt-1 text-sm text-muted">{p.message}</p>
                        )}
                        <p className="mt-2 text-[11px] text-muted">
                          Received {formatDateTime(s.receivedAt)}
                        </p>
                        {s.status === "rejected" && p.rejectionReason && (
                          <p className="mt-1 text-[11px] text-status-critical">
                            Reason: {p.rejectionReason}
                          </p>
                        )}
                        {s.reviewedBy && s.status !== "pending" && (
                          <p className="mt-0.5 text-[11px] text-muted">
                            {s.status === "converted" ? "Converted" : "Reviewed"} by{" "}
                            {s.reviewedBy.name}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions — only shown on pending tab */}
                    {s.status === "pending" ? (
                      <div className="flex shrink-0 gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setRejectState({ id: s.id, reason: "", busy: false })
                          }
                        >
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleConvert(s)}
                          disabled={converting === s.id}
                        >
                          {converting === s.id
                            ? "Opening…"
                            : "Convert to work order"}
                        </Button>
                      </div>
                    ) : (
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium",
                          s.status === "converted"
                            ? "bg-status-compliantTint text-status-compliant"
                            : "bg-status-criticalTint text-status-critical"
                        )}
                      >
                        {s.status === "converted" ? "Converted" : "Rejected"}
                      </span>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Reject dialog */}
      {rejectState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <Card className="w-full max-w-md p-6">
            <h2 className="font-display text-base font-semibold text-primon-950">
              Reject submission
            </h2>
            <p className="mt-1 text-sm text-muted">
              The submission will be archived and no work order will be created.
            </p>

            <label className="mt-5 block">
              <span className="text-xs font-medium text-ink">
                Reason (optional)
              </span>
              <textarea
                className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primon-400"
                rows={3}
                placeholder="e.g. Duplicate of WO-2026-00123, or out-of-scope service"
                value={rejectState.reason}
                onChange={(e) =>
                  setRejectState((s) => s && { ...s, reason: e.target.value })
                }
              />
            </label>

            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRejectState(null)}
                disabled={rejectState.busy}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleReject}
                disabled={rejectState.busy}
              >
                {rejectState.busy ? "Rejecting…" : "Reject"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
