import { describe, it, expect } from "vitest";

/**
 * Tests for the sequential certificate / work-order number parsing logic.
 * The actual DB query lives in the route handlers, but the number-extraction
 * algorithm is a pure function we can validate here.
 */

function parseSequenceNumber(code: string, prefix: string): number {
  if (!code.startsWith(prefix)) return 0;
  const n = parseInt(code.slice(prefix.length), 10);
  return Number.isNaN(n) ? 0 : n;
}

function formatFccNumber(year: number, seq: number): string {
  return `FCC-${year}-${String(seq).padStart(6, "0")}`;
}

function formatWoNumber(year: number, seq: number): string {
  return `WO-${year}-${String(seq).padStart(5, "0")}`;
}

describe("FCC sequential number generation", () => {
  it("formats the first certificate correctly", () => {
    expect(formatFccNumber(2026, 1)).toBe("FCC-2026-000001");
  });

  it("formats high sequence numbers correctly", () => {
    expect(formatFccNumber(2026, 512)).toBe("FCC-2026-000512");
  });

  it("parses the sequence number back from a certificate number", () => {
    expect(parseSequenceNumber("FCC-2026-000512", "FCC-2026-")).toBe(512);
  });

  it("next sequence after FCC-2026-000512 is 513", () => {
    const last = "FCC-2026-000512";
    const seq = parseSequenceNumber(last, "FCC-2026-") + 1;
    expect(formatFccNumber(2026, seq)).toBe("FCC-2026-000513");
  });

  it("returns 0 for a non-matching prefix", () => {
    expect(parseSequenceNumber("FCC-2025-000100", "FCC-2026-")).toBe(0);
  });
});

describe("Work Order sequential number generation", () => {
  it("formats the first work order correctly", () => {
    expect(formatWoNumber(2026, 1)).toBe("WO-2026-00001");
  });

  it("next sequence from WO-2026-00042 is 43", () => {
    const last = "WO-2026-00042";
    const seq = parseSequenceNumber(last, "WO-2026-") + 1;
    expect(formatWoNumber(2026, seq)).toBe("WO-2026-00043");
  });
});
