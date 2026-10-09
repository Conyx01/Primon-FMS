import { DayStatus, FccStatus } from "./types";

export const fccStatusMeta: Record<
  FccStatus,
  { label: string; dot: string; text: string; bg: string; border: string }
> = {
  draft: {
    label: "Draft",
    dot: "bg-muted",
    text: "text-muted",
    bg: "bg-slate-50",
    border: "border-border",
  },
  in_progress: {
    label: "In progress",
    dot: "bg-primon-500",
    text: "text-primon-700",
    bg: "bg-primon-50",
    border: "border-primon-200",
  },
  under_review: {
    label: "Under review",
    dot: "bg-brass-500",
    text: "text-brass-700",
    bg: "bg-brass-100",
    border: "border-brass-300",
  },
  flagged: {
    label: "Action required",
    dot: "bg-status-critical",
    text: "text-status-critical",
    bg: "bg-status-criticalTint",
    border: "border-status-critical/30",
  },
  certified: {
    label: "Certified",
    dot: "bg-status-compliant",
    text: "text-status-compliant",
    bg: "bg-status-compliantTint",
    border: "border-status-compliant/30",
  },
};

export const dayStatusMeta: Record<
  DayStatus,
  { label: string; text: string; bg: string; border: string; bar: string }
> = {
  pending: {
    label: "Pending",
    text: "text-muted",
    bg: "bg-slate-50",
    border: "border-border",
    bar: "bg-slate-200",
  },
  compliant: {
    label: "Compliant",
    text: "text-status-compliant",
    bg: "bg-status-compliantTint",
    border: "border-status-compliant/30",
    bar: "bg-status-compliant",
  },
  critical: {
    label: "Critical",
    text: "text-status-critical",
    bg: "bg-status-criticalTint",
    border: "border-status-critical/40",
    bar: "bg-status-critical",
  },
  action_taken: {
    label: "Action taken",
    text: "text-status-action",
    bg: "bg-status-actionTint",
    border: "border-status-action/40",
    bar: "bg-status-action",
  },
};

export const LETHAL_THRESHOLD = 600;

/** Product temperature must be at least this before Days 1–6 may be logged. */
export const PRODUCT_TEMP_MINIMUM_C = 16;
