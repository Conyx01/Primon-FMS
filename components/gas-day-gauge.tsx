"use client";

import { GasReading } from "@/lib/types";
import { dayStatusMeta, LETHAL_THRESHOLD } from "@/lib/status";
import { cn } from "@/lib/utils";
import { CalendarX } from "lucide-react";

const SCALE_MAX = 1100;

function Bar({
  value,
  label,
  color,
}: {
  value: number | null;
  label: string;
  color: string;
}) {
  const pct = value === null ? 0 : Math.min(100, (value / SCALE_MAX) * 100);
  const thresholdPct = (LETHAL_THRESHOLD / SCALE_MAX) * 100;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative h-32 w-3.5 overflow-visible rounded-full bg-slate-100">
        <div
          className="pointer-events-none absolute left-[-6px] right-[-6px] border-t border-dashed border-brass-500/70"
          style={{ bottom: `${thresholdPct}%` }}
        />
        <div className="absolute inset-0 flex items-end overflow-hidden rounded-full">
          {value !== null && (
            <div
              style={{ "--fill-to": `${pct}%` } as React.CSSProperties}
              className={cn("w-full animate-fill-bar rounded-full", color)}
            />
          )}
        </div>
      </div>
      <span className="text-[10px] uppercase tracking-wide text-muted">{label}</span>
      <span className="num text-xs font-medium text-ink">
        {value === null ? "—" : `${value}`}
      </span>
    </div>
  );
}

export function GasDayGauge({ reading }: { reading: GasReading }) {
  const meta = dayStatusMeta[reading.status];
  const isNotMonitored = reading.status === "not_monitored";

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border bg-white p-4 transition-shadow",
        meta.border
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium text-primon-900">Day {reading.day}</span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-medium",
            meta.bg,
            meta.text
          )}
        >
          {meta.label}
        </span>
      </div>

      {isNotMonitored ? (
        <div className="flex h-32 flex-col items-center justify-center rounded-lg border border-dashed border-amber-200 bg-amber-50/70 p-2 text-center">
          <CalendarX className="mb-1.5 h-6 w-6 text-amber-600" />
          <span className="font-display text-sm font-semibold text-amber-900">
            {reading.nonMonitoringReason?.split(" - ")[0] || "Facility Closed"}
          </span>
          <span className="mt-1 line-clamp-2 text-[10px] text-amber-800/80">
            {reading.nonMonitoringReason || "Weekend / closure — sealed under gas"}
          </span>
        </div>
      ) : (
        <div className="flex justify-center gap-5 border-b border-border pb-3">
          <Bar value={reading.airspace} label="Airspace" color={meta.bar} />
          <Bar value={reading.probeCase} label="Probe" color={meta.bar} />
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-muted">
        {isNotMonitored ? (
          <span className="col-span-2 text-center text-[10px] text-amber-700 italic">
            Continuous exposure under seal
          </span>
        ) : (
          <>
            <span>Ambient {reading.ambientTemp ?? "—"}°C</span>
            <span>Product {reading.productTemp ?? "—"}°C</span>
            <span className="col-span-2">Humidity {reading.humidity ?? "—"}%</span>
          </>
        )}
      </div>
    </div>
  );
}
