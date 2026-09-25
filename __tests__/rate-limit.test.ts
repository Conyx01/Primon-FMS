import { describe, it, expect } from "vitest";
import { rateLimit } from "@/lib/rate-limit";

describe("rateLimit", () => {
  it("allows requests within the limit", () => {
    const key = `test-allow-${Date.now()}`;
    expect(rateLimit(key, 3, 60_000)).toBe(true);
    expect(rateLimit(key, 3, 60_000)).toBe(true);
    expect(rateLimit(key, 3, 60_000)).toBe(true);
  });

  it("blocks the request that exceeds the limit", () => {
    const key = `test-block-${Date.now()}`;
    rateLimit(key, 2, 60_000);
    rateLimit(key, 2, 60_000);
    expect(rateLimit(key, 2, 60_000)).toBe(false);
  });

  it("different keys do not share buckets", () => {
    const key1 = `test-key1-${Date.now()}`;
    const key2 = `test-key2-${Date.now()}`;
    rateLimit(key1, 1, 60_000);
    // key2 bucket is fresh — should be allowed
    expect(rateLimit(key2, 1, 60_000)).toBe(true);
  });

  it("expired hits are not counted", async () => {
    const key = `test-expire-${Date.now()}`;
    // Fill bucket with a 1 ms window
    rateLimit(key, 1, 1);
    // Wait for the window to expire
    await new Promise((r) => setTimeout(r, 10));
    // Bucket should be empty again
    expect(rateLimit(key, 1, 1)).toBe(true);
  });
});
