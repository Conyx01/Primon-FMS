import { LETHAL_THRESHOLD } from "@/lib/status";
import { ReadingStatus } from "@prisma/client";

export function deriveReadingStatus(
  airspacePpm: number,
  probeCasePpm: number
): ReadingStatus {
  if (airspacePpm < LETHAL_THRESHOLD || probeCasePpm < LETHAL_THRESHOLD) {
    return ReadingStatus.critical;
  }
  return ReadingStatus.compliant;
}

export function addCalendarDays(start: Date, days: number): Date {
  const next = new Date(start);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
