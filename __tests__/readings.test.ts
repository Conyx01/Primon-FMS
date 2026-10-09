import { describe, it, expect } from "vitest";
import { deriveReadingStatus, day0BlocksGasReadings } from "@/lib/readings";
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
