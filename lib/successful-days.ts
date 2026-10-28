/**
 * lib/successful-days.ts
 *
 * Consecutive-streak fumigation logic (CORESTA / NPPO phosphine standard).
 *
 * PHASE 1 — 120-hour lethal window (Days 1–5 equivalent):
 *   Gas readings must be ≥ 600 ppm for 5 CONSECUTIVE calendar days.
 *   Any sub-600 reading before the streak reaches 5 resets the clock to 0.
 *   The next ≥ 600 reading after a reset becomes the new "Effective Day 1".
 *
 * PHASE 2 — Post-120h monitoring (Day 6 / 144 hrs):
 *   Once 5 consecutive days are confirmed, the lethal window is met.
 *   A 6th compliant day (≥ 600 ppm) is still required for certification.
 *   A sub-600 reading in Phase 2 does NOT restart the streak and does NOT
 *   flag the FCC as critical — it simply means an extra slot is appended
 *   to capture a compliant 6th day.
 */

/** Six days total required: 5 consecutive lethal + 1 compliant 6th day. */
export const REQUIRED_CONSECUTIVE_LETHAL_DAYS = 5;
export const REQUIRED_SUCCESSFUL_GAS_DAYS = 6; // kept for backwards compat display

export const LETHAL_THRESHOLD_PPM = 600;

export type GasDayFields = {
  dayNumber: number;
  status: string;
  readingDate?: Date | string;
};

function isGasDay(r: GasDayFields): boolean {
  return r.dayNumber > 0;
}

// ─── Streak evaluation ────────────────────────────────────────────────────────

export interface StreakResult {
  /** True once 5 consecutive compliant readings exist. */
  lethalWindowMet: boolean;
  /** How many readings are in the current valid streak (0–5). */
  currentStreak: number;
  /**
   * The dayNumber values that form the valid 5-day streak.
   * Empty until lethalWindowMet is true.
   */
  streakDayNumbers: number[];
  /**
   * True if the 6th compliant day (post-120h) exists.
   * Certification gate: lethalWindowMet && sixthDayCompliant.
   */
  sixthDayCompliant: boolean;
}

/**
 * Walk through all gas readings (day > 0) in ascending dayNumber order
 * and evaluate the consecutive streak.
 */
export function evaluateStreak(readings: GasDayFields[]): StreakResult {
  const gasDays = readings
    .filter((r) => isGasDay(r))
    .sort((a, b) => a.dayNumber - b.dayNumber);

  let currentStreak = 0;
  let streakBuffer: number[] = [];
  let streakDayNumbers: number[] = [];
  let lethalWindowMet = false;

  for (const r of gasDays) {
    // Once the 120h window is met we switch to Phase 2 counting.
    if (lethalWindowMet) continue;

    if (r.status === "compliant") {
      currentStreak++;
      streakBuffer.push(r.dayNumber);
      if (currentStreak >= REQUIRED_CONSECUTIVE_LETHAL_DAYS) {
        lethalWindowMet = true;
        streakDayNumbers = [...streakBuffer];
      }
    } else if (r.status === "critical" || r.status === "action_taken") {
      // Sub-600 before streak is met → reset clock
      currentStreak = 0;
      streakBuffer = [];
    }
    // "pending" readings are ignored (not yet logged)
  }

  // 6th day: first compliant reading AFTER the streak is complete
  let sixthDayCompliant = false;
  if (lethalWindowMet) {
    const lastStreakDay = Math.max(...streakDayNumbers);
    sixthDayCompliant = gasDays.some(
      (r) => r.dayNumber > lastStreakDay && r.status === "compliant"
    );
  }

  return {
    lethalWindowMet,
    currentStreak: lethalWindowMet ? REQUIRED_CONSECUTIVE_LETHAL_DAYS : currentStreak,
    streakDayNumbers,
    sixthDayCompliant,
  };
}

// ─── Derived helpers used across the app ─────────────────────────────────────

export function successfulGasDayCount(readings: GasDayFields[]): number {
  // Legacy helper: total compliant gas days (used for display only)
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
 *  1. The 5-day consecutive lethal window is met (≥ 600 ppm each day), AND
 *  2. A compliant 6th day (144 hrs) exists, AND
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
 * compliant day. Used by the PDF certificate builder.
 */
export function certificateSuccessfulReadings<
  T extends { day: number; status: string; date: string },
>(readings: T[]): T[] {
  const gasDays = readings
    .filter((r) => r.day > 0)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Replay streak logic on the typed readings
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
