import { describe, it, expect } from "vitest";
import {
  evaluateStreak,
  canCertifyGasReadings,
  certificateSuccessfulReadings,
  type GasDayFields,
} from "../lib/successful-days";
import { extensionSlotSpec } from "../lib/readings";

function gasDay(
  dayNumber: number,
  status: GasDayFields["status"],
  readingDate = "2026-10-01T08:00:00Z"
): GasDayFields {
  return { dayNumber, status, readingDate: new Date(readingDate) };
}

describe("consecutive lethal exposure streak (120-hour window)", () => {
  it("evaluates a standard 6-day compliant cycle as certifiable", () => {
    const readings = [
      gasDay(1, "compliant"),
      gasDay(2, "compliant"),
      gasDay(3, "compliant"),
      gasDay(4, "compliant"),
      gasDay(5, "compliant"),
      gasDay(6, "compliant"),
    ];
    const streak = evaluateStreak(readings);
    expect(streak.currentStreak).toBe(5);
    expect(streak.lethalWindowMet).toBe(true);
    expect(streak.sixthDayCompliant).toBe(true);
    expect(canCertifyGasReadings(readings)).toBe(true);
  });

  it("resets streak to 0 when a reading drops below 600 ppm", () => {
    const readings = [
      gasDay(1, "compliant"),
      gasDay(2, "critical"),
      gasDay(3, "pending"),
    ];
    const streak = evaluateStreak(readings);
    expect(streak.currentStreak).toBe(0);
    expect(streak.lethalWindowMet).toBe(false);
  });

  it("restarts streak counting from the next compliant day after a reset", () => {
    const readings = [
      gasDay(1, "compliant"),
      gasDay(2, "critical"),
      gasDay(3, "compliant"),
      gasDay(4, "compliant"),
      gasDay(5, "compliant"),
      gasDay(6, "compliant"),
      gasDay(7, "compliant"),
    ];
    const streak = evaluateStreak(readings);
    expect(streak.lethalWindowMet).toBe(true);
    expect(streak.streakDayNumbers).toEqual([3, 4, 5, 6, 7]);
    // Sixth day (144 hrs) not yet logged after the streak
    expect(streak.sixthDayCompliant).toBe(false);
  });

  it("appends day 7 after the last slot when streak was broken and slots are exhausted", () => {
    const readings = [
      gasDay(1, "compliant", "2026-10-02T08:00:00Z"),
      gasDay(2, "action_taken", "2026-10-03T08:00:00Z"),
      gasDay(3, "compliant", "2026-10-05T08:00:00Z"),
      gasDay(4, "compliant", "2026-10-06T08:00:00Z"),
      gasDay(5, "compliant", "2026-10-07T08:00:00Z"),
      gasDay(6, "compliant", "2026-10-08T08:00:00Z"),
    ];
    const spec = extensionSlotSpec(readings);
    expect(spec?.dayNumber).toBe(7);
    expect(spec?.readingDate.toISOString().startsWith("2026-10-09")).toBe(true);
  });

  it("appends consecutive calendar day for extension slot", () => {
    const readings = [
      gasDay(1, "compliant", "2026-10-05T08:00:00Z"),
      gasDay(2, "compliant", "2026-10-06T08:00:00Z"),
      gasDay(3, "compliant", "2026-10-07T08:00:00Z"),
      gasDay(4, "compliant", "2026-10-08T08:00:00Z"),
      gasDay(5, "compliant", "2026-10-09T08:00:00Z"),
      gasDay(6, "action_taken", "2026-10-10T08:00:00Z"), // Saturday
    ];
    const spec = extensionSlotSpec(readings);
    expect(spec?.dayNumber).toBe(7);
    expect(spec?.readingDate.toISOString().startsWith("2026-10-11")).toBe(true);
  });

  it("requires a 6th compliant day (Day 8) to certify after a restart", () => {
    const readings = [
      gasDay(1, "compliant", "2026-10-02T08:00:00Z"),
      gasDay(2, "action_taken", "2026-10-03T08:00:00Z"),
      gasDay(3, "compliant", "2026-10-05T08:00:00Z"),
      gasDay(4, "compliant", "2026-10-06T08:00:00Z"),
      gasDay(5, "compliant", "2026-10-07T08:00:00Z"),
      gasDay(6, "compliant", "2026-10-08T08:00:00Z"),
      gasDay(7, "compliant", "2026-10-09T08:00:00Z"), // 5-day lethal streak (Days 3-7)
    ];
    // Needs a compliant 6th day (144 hrs)
    expect(canCertifyGasReadings(readings)).toBe(false);
    const spec = extensionSlotSpec(readings);
    expect(spec?.dayNumber).toBe(8);

    // Once Day 8 is compliant, certification is allowed and no more slots are appended
    const withDay8 = [...readings, gasDay(8, "compliant", "2026-10-10T08:00:00Z")];
    expect(canCertifyGasReadings(withDay8)).toBe(true);
    expect(extensionSlotSpec(withDay8)).toBeNull();
  });

  it("maps the 5-day streak plus the 6th compliant day to certificate columns 1-6", () => {
    const cols = certificateSuccessfulReadings([
      { day: 0, status: "compliant", date: "2026-10-01" },
      { day: 1, status: "compliant", date: "2026-10-02" }, // cancelled prior to reset
      { day: 2, status: "action_taken", date: "2026-10-03" },
      { day: 3, status: "compliant", date: "2026-10-05" }, // Streak Day 1
      { day: 4, status: "compliant", date: "2026-10-06" }, // Streak Day 2
      { day: 5, status: "compliant", date: "2026-10-07" }, // Streak Day 3
      { day: 6, status: "compliant", date: "2026-10-08" }, // Streak Day 4
      { day: 7, status: "compliant", date: "2026-10-09" }, // Streak Day 5 (120 hrs)
      { day: 8, status: "compliant", date: "2026-10-10" }, // 6th compliant day
    ]);
    expect(cols.map((r) => r.day)).toEqual([3, 4, 5, 6, 7, 8]);
  });
});

describe("weekend-bridged cycles (e.g. Nyasa Tobacco)", () => {
  it("allows certification when Day 1 & Day 2 are SAT/SUN and Days 3–6 are compliant (Case A from photo)", () => {
    const readings = [
      gasDay(1, "not_monitored", "2026-10-24T08:00:00Z"), // SAT
      gasDay(2, "not_monitored", "2026-10-25T08:00:00Z"), // SUN
      gasDay(3, "compliant", "2026-10-26T08:00:00Z"),     // Mon (802 ppm)
      gasDay(4, "compliant", "2026-10-27T08:00:00Z"),     // Tue (791 ppm)
      gasDay(5, "compliant", "2026-10-28T08:00:00Z"),     // Wed (1142 ppm)
      gasDay(6, "compliant", "2026-10-29T08:00:00Z"),     // Thu (1871 ppm)
    ];
    const streak = evaluateStreak(readings);
    expect(streak.isWeekendBridged).toBe(true);
    expect(streak.compliantCount).toBe(4);
    expect(streak.nonMonitoredCount).toBe(2);
    expect(streak.lethalWindowMet).toBe(true);
    expect(streak.sixthDayCompliant).toBe(true);
    expect(canCertifyGasReadings(readings)).toBe(true);
    expect(extensionSlotSpec(readings)).toBeNull();
  });

  it("allows certification when Days 1–3 are compliant, Days 4–5 are SAT/SUN, and Day 6 is compliant (Case B)", () => {
    const readings = [
      gasDay(1, "compliant", "2026-10-21T08:00:00Z"),     // Wed
      gasDay(2, "compliant", "2026-10-22T08:00:00Z"),     // Thu
      gasDay(3, "compliant", "2026-10-23T08:00:00Z"),     // Fri
      gasDay(4, "not_monitored", "2026-10-24T08:00:00Z"), // SAT
      gasDay(5, "not_monitored", "2026-10-25T08:00:00Z"), // SUN
      gasDay(6, "compliant", "2026-10-26T08:00:00Z"),     // Mon
    ];
    const streak = evaluateStreak(readings);
    expect(streak.isWeekendBridged).toBe(true);
    expect(streak.compliantCount).toBe(4);
    expect(streak.lethalWindowMet).toBe(true);
    expect(streak.sixthDayCompliant).toBe(true);
    expect(canCertifyGasReadings(readings)).toBe(true);
    expect(extensionSlotSpec(readings)).toBeNull();
  });

  it("blocks certification if a monitored day drops below 600 ppm in a weekend-bridged cycle", () => {
    const readings = [
      gasDay(1, "not_monitored", "2026-10-24T08:00:00Z"), // SAT
      gasDay(2, "not_monitored", "2026-10-25T08:00:00Z"), // SUN
      gasDay(3, "compliant", "2026-10-26T08:00:00Z"),
      gasDay(4, "critical", "2026-10-27T08:00:00Z"),      // Low gas / leak
      gasDay(5, "compliant", "2026-10-28T08:00:00Z"),
      gasDay(6, "compliant", "2026-10-29T08:00:00Z"),
    ];
    expect(canCertifyGasReadings(readings)).toBe(false);
  });

  it("blocks certification if any cycle day is still pending", () => {
    const readings = [
      gasDay(1, "not_monitored", "2026-10-24T08:00:00Z"), // SAT
      gasDay(2, "not_monitored", "2026-10-25T08:00:00Z"), // SUN
      gasDay(3, "compliant", "2026-10-26T08:00:00Z"),
      gasDay(4, "compliant", "2026-10-27T08:00:00Z"),
      gasDay(5, "pending", "2026-10-28T08:00:00Z"),
      gasDay(6, "pending", "2026-10-29T08:00:00Z"),
    ];
    expect(canCertifyGasReadings(readings)).toBe(false);
  });
});
