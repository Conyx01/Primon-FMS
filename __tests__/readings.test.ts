import { describe, it, expect } from "vitest";
import { deriveReadingStatus } from "@/lib/readings";
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
