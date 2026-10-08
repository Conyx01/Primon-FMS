import type { FccStatus, GasReading } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

const STATUS_COPY: Record<FccStatus, string> = {
  draft: "Primon is still setting up this job. Shipping details may be incomplete.",
  in_progress:
    "Monitoring is underway. Primon logs gas readings over six days (Sundays are skipped).",
  under_review: "Primon is reviewing this job before certification.",
  flagged: "A reading needs attention. Primon is handling the corrective action.",
  certified: "Fumigation is complete. You can download the certified certificate.",
};

function dayLabel(day: number) {
  return day === 0 ? "Pre-check" : `Day ${day}`;
}

export function clientStatusSummary(status: FccStatus): string {
  return STATUS_COPY[status];
}

export function PortalReadingStrip({ readings }: { readings: GasReading[] }) {
  const ordered = readings.slice().sort((a, b) => a.day - b.day);
  if (ordered.length === 0) {
    return (
      <p className="text-xs text-muted">
        The six-day monitoring window has not been opened yet.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
      {ordered.map((r) => {
        const logged = r.status !== "pending";
        return (
          <div
            key={r.day}
            className={cn(
              "rounded-lg border px-3 py-2",
              r.status === "critical" || r.status === "action_taken"
                ? "border-status-critical/30 bg-status-criticalTint"
                : logged
                  ? "border-status-compliant/30 bg-status-compliantTint"
                  : "border-border bg-white"
            )}
          >
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted">
              {dayLabel(r.day)}
            </p>
            <p className="mt-0.5 text-xs font-medium capitalize text-ink">
              {r.status.replaceAll("_", " ")}
            </p>
            <p className="mt-0.5 text-[10px] text-muted">{formatDate(r.date)}</p>
          </div>
        );
      })}
    </div>
  );
}
