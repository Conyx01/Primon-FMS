import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  tone?: "default" | "critical" | "brass";
}) {
  const toneMap = {
    default: "bg-primon-50 text-primon-700",
    critical: "bg-status-criticalTint text-status-critical",
    brass: "bg-brass-100 text-brass-700",
  };
  return (
    <div className="rounded-xl border border-border bg-white p-4 sm:p-5 shadow-card flex flex-col justify-between">
      <div className="flex flex-col-reverse items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
        <p className="text-xs sm:text-sm text-muted leading-tight">{label}</p>
        <span className={cn("rounded-lg p-1.5 sm:p-2", toneMap[tone])}>
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </span>
      </div>
      <div>
        <p className="mt-2 sm:mt-3 font-display text-2xl sm:text-3xl text-primon-950 num">{value}</p>
        {sub && <p className="mt-1 text-[10px] sm:text-xs text-muted leading-tight">{sub}</p>}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-white/60 px-6 py-16 text-center">
      <h4 className="font-display text-lg text-primon-900">{title}</h4>
      <p className="mt-1.5 max-w-sm text-sm text-muted">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
