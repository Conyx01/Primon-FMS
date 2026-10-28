import { LETHAL_THRESHOLD, PRODUCT_TEMP_MINIMUM_C } from "@/lib/status";
import { ReadingStatus } from "@prisma/client";
import {
  hasPendingGasDay,
  successfulGasDayCount,
  REQUIRED_SUCCESSFUL_GAS_DAYS,
  evaluateStreak,
  canCertifyGasReadings,
  type GasDayFields,
} from "@/lib/successful-days";

export {
  REQUIRED_SUCCESSFUL_GAS_DAYS,
  successfulGasDayCount,
  hasPendingGasDay,
  hasOpenCriticalGasDay,
  canCertifyGasReadings,
  certificateSuccessfulReadings,
  evaluateStreak,
} from "@/lib/successful-days";
export type { GasDayFields, StreakResult } from "@/lib/successful-days";

/**
 * Derive a reading status for a gas day.
 *
 * Phase 1 (before 120-consecutive-hour window is met):
 *   Any reading below 600 ppm → critical (streak reset required).
 *
 * Phase 2 (after 120h window is met — incoming day is the 6th / 144h check):
 *   Sub-600 ppm is acceptable dissipation → does NOT flag critical.
 *   The reading is still stored as "critical" internally so the UI can show
 *   it happened, but the caller (API route) uses `isPhase2` to skip alerting.
 *
 * `existingReadings` should include all previously-saved gas days (NOT the
 * one currently being saved) so the streak can be evaluated correctly.
 */
export function deriveReadingStatus(
  airspacePpm: number,
  probeCasePpm: number
): ReadingStatus {
  if (airspacePpm < LETHAL_THRESHOLD || probeCasePpm < LETHAL_THRESHOLD) {
    return ReadingStatus.critical;
  }
  return ReadingStatus.compliant;
}

/**
 * Given the existing sibling readings (already saved) and the dayNumber being
 * submitted now, return true when this reading falls into Phase 2 (post-120h).
 */
export function readingIsPhase2(
  existingReadings: GasDayFields[],
  incomingDayNumber: number
): boolean {
  const { lethalWindowMet, streakDayNumbers } = evaluateStreak(existingReadings);
  if (!lethalWindowMet || streakDayNumbers.length === 0) return false;
  const lastStreakDay = Math.max(...streakDayNumbers);
  return incomingDayNumber > lastStreakDay;
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
 * Append a new working-day gas-reading slot when needed.
 *
 * Rules:
 *  - No slot is added while any pending slot exists (wait for it to be filled).
 *  - No slot is added once certification criteria are met.
 *  - In Phase 1: an extension is needed if the streak was broken AND we have
 *    no more pending slots.  The next slot continues the calendar sequence so
 *    the fumigator can restart their 5-day count.
 *  - In Phase 2: an extension is needed when the 120h window is met but no
 *    compliant 6th day exists yet (a sub-600 6th day was recorded → we need
 *    another chance).
 */
export function extensionSlotSpec(
  readings: GasDayFields[]
): { dayNumber: number; readingDate: Date } | null {
  if (hasPendingGasDay(readings)) return null;
  if (canCertifyGasReadings(readings)) return null;

  const gas = readings.filter((r) => r.dayNumber > 0 && r.readingDate != null);
  if (gas.length === 0) return null;

  const lastDate = gas.reduce((latest, r) => {
    const d = new Date(r.readingDate as Date | string);
    return d.getTime() > latest.getTime() ? d : latest;
  }, new Date(gas[0].readingDate as Date | string));

  const nextNum = Math.max(...gas.map((r) => r.dayNumber)) + 1;
  return { dayNumber: nextNum, readingDate: buildReadingDates(lastDate, 1)[0] };
}
