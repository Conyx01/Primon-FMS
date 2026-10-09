import { LETHAL_THRESHOLD, PRODUCT_TEMP_MINIMUM_C } from "@/lib/status";
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

export function day0BlocksGasReadings(day0: {
  ambientTempC: number | null;
  productTempC: number | null;
} | null): string | null {
  if (!day0 || day0.ambientTempC == null || day0.productTempC == null) {
    return "Record Day 0 pre-fumigation temperatures before logging gas readings.";
  }
  if (day0.productTempC < PRODUCT_TEMP_MINIMUM_C) {
    return `Product temperature must be at least ${PRODUCT_TEMP_MINIMUM_C}°C before gas readings can be logged.`;
  }
  return null;
}

export function addCalendarDays(start: Date, days: number): Date {
  const next = new Date(start);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/**
 * Starting from `start`, advance one calendar day at a time and collect
 * `count` dates, skipping any date that falls on a Sunday (getUTCDay() === 0).
 * Public holidays are handled manually by Ops.
 */
export function buildReadingDates(start: Date, count: number): Date[] {
  const dates: Date[] = [];
  let current = new Date(start);
  while (dates.length < count) {
    current = new Date(current);
    current.setUTCDate(current.getUTCDate() + 1);
    if (current.getUTCDay() !== 0) {
      dates.push(new Date(current));
    }
  }
  return dates;
}
