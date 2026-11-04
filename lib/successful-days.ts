/**
 * lib/successful-days.ts
 *
 * Consecutive-streak fumigation logic (CORESTA / NPPO phosphine standard),
 * with support for facility closures and weekend non-monitoring bridging.
 *
 * STANDARD 6-DAY CYCLE:
 *   PHASE 1 — 120-hour lethal window (Days 1–5 equivalent):
 *     Gas readings must be ≥ 600 ppm for 5 CONSECUTIVE calendar days.
 *     Any sub-600 reading before the streak reaches 5 resets the clock to 0.
 *     The next ≥ 600 reading after a reset becomes the new "Effective Day 1".
 *   PHASE 2 — Post-120h monitoring (Day 6 / 144 hrs):
 *     Once 5 consecutive days are confirmed, the lethal window is met.
 *     A 6th compliant day (≥ 600 ppm) is required for certification.
 *
 * FLEXIBLE / WEEKEND-BRIDGED CYCLE (e.g. Nyasa Tobacco):
 *   Facility closed on Saturday and/or Sunday (or public holidays).
 *   Fumigant remains active under seal for the full 144-hour duration.
 *   Non-monitored days (marked "SAT", "SUN", "Closed") do NOT break the streak.
 *   Certification requires:
 *     1. At least MIN_COMPLIANT_GAS_DAYS (4) compliant readings (≥ 600 ppm).
 *     2. All scheduled cycle days (Days 1–6) accounted for (compliant or not_monitored).
 *     3. Zero open critical readings.
 *     4. Zero unaddressed pending readings.
 */

/** Six days total required: 5 consecutive lethal + 1 compliant 6th day. */
export const REQUIRED_CONSECUTIVE_LETHAL_DAYS = 5;
export const REQUIRED_SUCCESSFUL_GAS_DAYS = 6;
/** Minimum monitored compliant readings required for weekend-bridged cycles. */
export const MIN_COMPLIANT_GAS_DAYS = 4;

export const LETHAL_THRESHOLD_PPM = 600;

export type GasDayFields = {
  dayNumber: number;
  status: string; // "pending" | "compliant" | "critical" | "action_taken" | "not_monitored"
  readingDate?: Date | string;
  nonMonitoringReason?: string | null;
};

function isGasDay(r: GasDayFields): boolean {
  return r.dayNumber > 0;
}

// ─── Streak evaluation ────────────────────────────────────────────────────────

export interface StreakResult {
  /** True once 5-day exposure window (or weekend-bridged 4+ compliant days) is met. */
  lethalWindowMet: boolean;
  /** How many readings are in the current valid streak (0–5). */
  currentStreak: number;
  /**
   * The dayNumber values that form the valid streak.
   * Empty until lethalWindowMet is true.
   */
  streakDayNumbers: number[];
  /**
   * True if the 6th compliant day (or full 6-day cycle for weekend-bridged) exists.
   * Certification gate: lethalWindowMet && sixthDayCompliant.
   */
  sixthDayCompliant: boolean;
  /** Total number of compliant readings in the cycle. */
  compliantCount: number;
  /** Total number of declared non-monitored days (SAT/SUN/closed). */
  nonMonitoredCount: number;
  /** True if the cycle bridges over weekend/closed days. */
  isWeekendBridged: boolean;
}

/**
 * Walk through all gas readings (day > 0) in ascending dayNumber order
 * and evaluate the consecutive streak.
 */
export function evaluateStreak(readings: GasDayFields[]): StreakResult {
  const gasDays = readings
    .filter((r) => isGasDay(r))
    .sort((a, b) => a.dayNumber - b.dayNumber);

  const compliantCount = gasDays.filter((r) => r.status === "compliant").length;
  const nonMonitoredCount = gasDays.filter((r) => r.status === "not_monitored").length;
  const hasNonMonitored = nonMonitoredCount > 0;

  let currentStreak = 0;
  let streakBuffer: number[] = [];
  let streakDayNumbers: number[] = [];
  let lethalWindowMet = false;

  for (const r of gasDays) {
    if (lethalWindowMet) continue;

    if (r.status === "compliant") {
      currentStreak++;
      streakBuffer.push(r.dayNumber);
      if (currentStreak >= REQUIRED_CONSECUTIVE_LETHAL_DAYS) {
        lethalWindowMet = true;
        streakDayNumbers = [...streakBuffer];
      }
    } else if (r.status === "not_monitored") {
      // Non-monitored day bridges the streak — does not increment compliant count,
      // but preserves streak continuity across the weekend/closure.
      streakBuffer.push(r.dayNumber);
    } else if (r.status === "critical" || r.status === "action_taken") {
      // Sub-600 before streak is met → reset clock
      currentStreak = 0;
      streakBuffer = [];
    }
    // "pending" readings are ignored (not yet logged)
  }

  // ── Weekend / Closed bridge check ───────────────────────────────────────────
  // If there are non-monitored days and the standard 5-compliant streak wasn't met,
  // check if the bridged streak has at least 5 accounted calendar days with at least
  // MIN_COMPLIANT_GAS_DAYS (4) compliant readings and no active streak reset.
  if (hasNonMonitored && !lethalWindowMet) {
    const accountedInStreak = streakBuffer.length;
    const compliantInStreak = streakBuffer.filter((dayNum) => {
      const row = gasDays.find((g) => g.dayNumber === dayNum);
      return row?.status === "compliant";
    }).length;

    if (accountedInStreak >= 5 && compliantInStreak >= MIN_COMPLIANT_GAS_DAYS) {
      lethalWindowMet = true;
      streakDayNumbers = [...streakBuffer];
    }
  }

  // ── 6th day check ───────────────────────────────────────────────────────────
  let sixthDayCompliant = false;
  if (lethalWindowMet) {
    if (hasNonMonitored) {
      // In a weekend-bridged cycle, having all 6 scheduled days accounted for
      // (either compliant or declared closed) completes the 144-hour requirement.
      const first6Days = gasDays.filter((r) => r.dayNumber <= REQUIRED_SUCCESSFUL_GAS_DAYS);
      const all6Accounted =
        first6Days.length === REQUIRED_SUCCESSFUL_GAS_DAYS &&
        first6Days.every(
          (r) => r.status === "compliant" || r.status === "not_monitored"
        );
      sixthDayCompliant = all6Accounted;
    } else {
      // Standard cycle: first compliant reading AFTER the 5-day streak is complete
      const lastStreakDay = Math.max(...streakDayNumbers);
      sixthDayCompliant = gasDays.some(
        (r) => r.dayNumber > lastStreakDay && r.status === "compliant"
      );
    }
  }

  return {
    lethalWindowMet,
    currentStreak: lethalWindowMet ? REQUIRED_CONSECUTIVE_LETHAL_DAYS : currentStreak,
    streakDayNumbers,
    sixthDayCompliant,
    compliantCount,
    nonMonitoredCount,
    isWeekendBridged: hasNonMonitored,
  };
}

// ─── Derived helpers used across the app ─────────────────────────────────────

export function successfulGasDayCount(readings: GasDayFields[]): number {
  return readings.filter((r) => isGasDay(r) && r.status === "compliant").length;
}

export function hasPendingGasDay(readings: GasDayFields[]): boolean {
  return readings.some((r) => isGasDay(r) && r.status === "pending");
}

export function hasOpenCriticalGasDay(readings: GasDayFields[]): boolean {
  return readings.some((r) => isGasDay(r) && r.status === "critical");
}

/**
 * A fumigation can be certified when:
 *  1. The 5-day lethal window is met (either 5 consecutive compliant, or 4+ compliant bridged across weekend), AND
 *  2. A compliant 6th day (or all 6 cycle days accounted for) exists, AND
 *  3. No readings are still pending, AND
 *  4. No critical readings are still open (without corrective action).
 */
export function canCertifyGasReadings(readings: GasDayFields[]): boolean {
  const { lethalWindowMet, sixthDayCompliant } = evaluateStreak(readings);
  return (
    lethalWindowMet &&
    sixthDayCompliant &&
    !hasOpenCriticalGasDay(readings) &&
    !hasPendingGasDay(readings)
  );
}

/**
 * Is the current reading in Phase 2 (post-120h)?
 * Used by the API to decide whether a sub-600 ppm reading should be
 * treated as critical (Phase 1) or acceptable dissipation (Phase 2).
 */
export function isPostLethalWindow(
  readings: GasDayFields[],
  incomingDayNumber: number
): boolean {
  const { lethalWindowMet, streakDayNumbers } = evaluateStreak(readings);
  if (!lethalWindowMet) return false;
  const lastStreakDay = Math.max(...streakDayNumbers);
  return incomingDayNumber > lastStreakDay;
}

/**
 * Certificate columns 1–6: the 5 streak days (in date order) + the 6th
 * compliant day (or the 6 scheduled cycle days in order for weekend-bridged).
 * Used by the PDF certificate builder.
 */
export function certificateSuccessfulReadings<
  T extends { day: number; status: string; date: string },
>(readings: T[]): T[] {
  const gasDays = readings
    .filter((r) => r.day > 0)
    .sort((a, b) => a.day - b.day);

  const hasNonMonitored = gasDays.some((r) => r.status === "not_monitored");
  if (hasNonMonitored) {
    // For weekend-bridged cycles, return the 6 days of the cycle in order (Days 1–6)
    return gasDays.slice(0, REQUIRED_SUCCESSFUL_GAS_DAYS);
  }

  // Standard streak replay
  let currentStreak = 0;
  let streakBuffer: T[] = [];
  let streakReadings: T[] = [];
  let lethalWindowMet = false;

  for (const r of gasDays) {
    if (lethalWindowMet) break;
    if (r.status === "compliant") {
      currentStreak++;
      streakBuffer.push(r);
      if (currentStreak >= REQUIRED_CONSECUTIVE_LETHAL_DAYS) {
        lethalWindowMet = true;
        streakReadings = [...streakBuffer];
      }
    } else if (r.status === "critical" || r.status === "action_taken") {
      currentStreak = 0;
      streakBuffer = [];
    }
  }

  if (!lethalWindowMet) {
    // Fallback: return whatever compliant days exist (incomplete fumigation)
    return gasDays.filter((r) => r.status === "compliant").slice(0, REQUIRED_SUCCESSFUL_GAS_DAYS);
  }

  // 6th day = first compliant day after the streak
  const lastStreakDayNum = Math.max(...streakReadings.map((r) => r.day));
  const sixthDay = gasDays.find(
    (r) => r.day > lastStreakDayNum && r.status === "compliant"
  );

  return sixthDay ? [...streakReadings, sixthDay] : streakReadings;
}
