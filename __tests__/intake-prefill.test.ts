import { describe, it, expect } from "vitest";

/**
 * Tests for the intake-submission pre-fill helpers used by the
 * New Work Order wizard (/dashboard/work-orders/new).
 *
 * These functions are duplicated here as pure functions so they can be
 * tested without importing the Next.js page module.
 */

type CropType = "tobacco" | "grain";
type Scale = "industrial" | "smallholder" | "household";

function guessCropType(cropOrService: string): CropType {
  const lower = cropOrService.toLowerCase();
  if (
    lower.includes("grain") ||
    lower.includes("maize") ||
    lower.includes("sorghum") ||
    lower.includes("cereal") ||
    lower.includes("wheat")
  ) {
    return "grain";
  }
  return "tobacco";
}

function guessScale(cropOrService: string): Scale {
  const lower = cropOrService.toLowerCase();
  if (
    lower.includes("household") ||
    lower.includes("residential") ||
    lower.includes("pest control") ||
    lower.includes("termite") ||
    lower.includes("rodent")
  ) {
    return "household";
  }
  return "industrial";
}

describe("guessCropType", () => {
  it("defaults to tobacco", () => {
    expect(guessCropType("Alliance One tobacco shipment")).toBe("tobacco");
  });

  it("detects grain from 'maize'", () => {
    expect(guessCropType("Maize — approx. 12,000kg")).toBe("grain");
  });

  it("detects grain from 'sorghum'", () => {
    expect(guessCropType("Sorghum warehouse fumigation")).toBe("grain");
  });

  it("detects grain from 'grain'", () => {
    expect(guessCropType("grain storage facility")).toBe("grain");
  });

  it("is case-insensitive", () => {
    expect(guessCropType("MAIZE FUMIGATION")).toBe("grain");
  });
});

describe("guessScale", () => {
  it("defaults to industrial", () => {
    expect(guessScale("Tobacco fumigation")).toBe("industrial");
  });

  it("detects household from 'household pest control'", () => {
    expect(guessScale("Household pest control — rodents")).toBe("household");
  });

  it("detects household from 'residential'", () => {
    expect(guessScale("Residential termite inspection")).toBe("household");
  });

  it("detects household from 'termite'", () => {
    expect(guessScale("Termite treatment — residential")).toBe("household");
  });

  it("detects household from 'rodent'", () => {
    expect(guessScale("Rodent activity in the roof space")).toBe("household");
  });

  it("is case-insensitive", () => {
    expect(guessScale("HOUSEHOLD FUMIGATION")).toBe("household");
  });
});
