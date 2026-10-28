import { describe, it, expect } from "vitest";
import { deriveReadingStatus, day0BlocksGasReadings, extensionSlotSpec } from "@/lib/readings";
import {
  canCertifyGasReadings,
  certificateSuccessfulReadings,
  successfulGasDayCount,
  evaluateStreak,
} from "@/lib/successful-days";
import { ReadingStatus } from "@prisma/client";

describe("deriveReadingStatus — 600 ppm threshold (SDD §M.1)", () => {
  it("returns compliant when both readings are exactly 600 ppm", () => {
    expect(deriveReadingStatus(600, 600)).toBe(ReadingStatus.compliant);
  });

  it("returns compliant when both readings are above 600 ppm", () => {
    expect(deriveReadingStatus(1200, 850)).toBe(ReadingStatus.compliant);
  });

  it("returns critical when airspace is below 600 ppm", () => {
    expect(deriveReadingStatus(599, 800)).toBe(ReadingStatus.critical);
  });

  it("returns critical when probe/case is below 600 ppm", () => {
    expect(deriveReadingStatus(900, 599)).toBe(ReadingStatus.critical);
  });

  it("returns critical when both readings are below 600 ppm", () => {
    expect(deriveReadingStatus(100, 200)).toBe(ReadingStatus.critical);
  });

  it("returns critical when either reading is zero", () => {
    expect(deriveReadingStatus(0, 700)).toBe(ReadingStatus.critical);
    expect(deriveReadingStatus(700, 0)).toBe(ReadingStatus.critical);
  });

  it("boundary: 599 ppm is critical, 600 ppm is compliant", () => {
    expect(deriveReadingStatus(599, 600)).toBe(ReadingStatus.critical);
    expect(deriveReadingStatus(600, 599)).toBe(ReadingStatus.critical);
    expect(deriveReadingStatus(600, 600)).toBe(ReadingStatus.compliant);
  });
});

describe("day0BlocksGasReadings — 16°C product-temp gate", () => {
  it("blocks when Day 0 has not been recorded", () => {
    expect(day0BlocksGasReadings(null)).toMatch(/Day 0/i);
    expect(
      day0BlocksGasReadings({ ambientTempC: null, productTempC: null })
    ).toMatch(/Day 0/i);
  });

  it("blocks when product temp is below 16°C", () => {
    expect(
      day0BlocksGasReadings({ ambientTempC: 22, productTempC: 15.9 })
    ).toMatch(/16/);
  });

  it("allows gas readings at exactly 16°C", () => {
    expect(
      day0BlocksGasReadings({ ambientTempC: 20, productTempC: 16 })
    ).toBeNull();
  });
});

function gasDay(
  dayNumber: number,
  status: string,
  readingDate: string
) {
  return { dayNumber, status, readingDate };
}

describe("consecutive lethal exposure streak (120-hour window)", () => {
  it("resets streak to 0 when a reading drops below 600 ppm", () => {
    const readings = [
      gasDay(1, "compliant", "2026-10-02"),
      gasDay(2, "action_taken", "2026-10-03"), // sub-600 ppm resets clock
    ];
    const streak = evaluateStreak(readings);
    expect(streak.currentStreak).toBe(0);
    expect(streak.lethalWindowMet).toBe(false);
  });

  it("restarts streak counting from the next compliant day after a reset", () => {
    const readings = [
      gasDay(1, "compliant", "2026-10-02"),
      gasDay(2, "action_taken", "2026-10-03"), // reset
      gasDay(3, "compliant", "2026-10-05"), // effective Day 1
      gasDay(4, "compliant", "2026-10-06"), // effective Day 2
      gasDay(5, "compliant", "2026-10-07"), // effective Day 3
      gasDay(6, "compliant", "2026-10-08"), // effective Day 4
      gasDay(7, "compliant", "2026-10-09"), // effective Day 5 -> 120 hrs met!
    ];
    const streak = evaluateStreak(readings);
    expect(streak.lethalWindowMet).toBe(true);
    expect(streak.streakDayNumbers).toEqual([3, 4, 5, 6, 7]);
    // 6th compliant day not yet recorded
    expect(streak.sixthDayCompliant).toBe(false);
    expect(canCertifyGasReadings(readings)).toBe(false);
  });

  it("does not add an extra slot while later generated days are still pending", () => {
    const readings = [
      gasDay(1, "compliant", "2026-10-02"),
      gasDay(2, "action_taken", "2026-10-03"),
      gasDay(3, "pending", "2026-10-05"),
      gasDay(4, "pending", "2026-10-06"),
      gasDay(5, "pending", "2026-10-07"),
      gasDay(6, "pending", "2026-10-08"),
    ];
    expect(extensionSlotSpec(readings)).toBeNull();
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

  it("skips Sunday when appending an extension slot", () => {
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
    expect(spec?.readingDate.getUTCDay()).toBe(1); // Monday
    expect(spec?.readingDate.toISOString().startsWith("2026-10-12")).toBe(true);
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
