import { LETHAL_THRESHOLD, PRODUCT_TEMP_MINIMUM_C } from "@/lib/status";
import { ReadingStatus } from "@prisma/client";
import {
  hasPendingGasDay,
  successfulGasDayCount,
  REQUIRED_SUCCESSFUL_GAS_DAYS,
  type GasDayFields,
} from "@/lib/successful-days";

export {
  REQUIRED_SUCCESSFUL_GAS_DAYS,
  successfulGasDayCount,
  hasPendingGasDay,
  hasOpenCriticalGasDay,
  canCertifyGasReadings,
  certificateSuccessfulReadings,
} from "@/lib/successful-days";
export type { GasDayFields } from "@/lib/successful-days";

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

/**
 * When no pending gas slot remains and fewer than six days are compliant,
 * append one more working-day slot (Sunday skipped).
 */
export function extensionSlotSpec(
  readings: GasDayFields[]
): { dayNumber: number; readingDate: Date } | null {
  if (hasPendingGasDay(readings)) return null;
  if (successfulGasDayCount(readings) >= REQUIRED_SUCCESSFUL_GAS_DAYS) return null;
  const gas = readings.filter((r) => r.dayNumber > 0 && r.readingDate != null);
  if (gas.length === 0) return null;
  const lastDate = gas.reduce((latest, r) => {
    const d = new Date(r.readingDate as Date | string);
    return d.getTime() > latest.getTime() ? d : latest;
  }, new Date(gas[0].readingDate as Date | string));
  const nextNum = Math.max(...gas.map((r) => r.dayNumber)) + 1;
  return { dayNumber: nextNum, readingDate: buildReadingDates(lastDate, 1)[0] };
}
