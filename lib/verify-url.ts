/** Canonical production origin now that DNS is live. */
export const CANONICAL_PUBLIC_ORIGIN = "https://fms.primonenterprises.com";

/** Public origin of the FMS app. */
export function getPublicOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (explicit) return explicit;
  if (process.env.NODE_ENV === "production") return CANONICAL_PUBLIC_ORIGIN;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
}

/**
 * QR / printed verification URL for a certified FCC number.
 * Default: {origin}/verify/{FCC-PE-…} on fms.primonenterprises.com.
 * Set NEXT_PUBLIC_VERIFY_ORIGIN only if a dedicated verify host uses /fcc/{number}.
 */
export function verificationUrl(certificateNumber: string): string {
  const dedicated = process.env.NEXT_PUBLIC_VERIFY_ORIGIN?.trim().replace(/\/$/, "");
  if (dedicated) {
    return `${dedicated}/fcc/${certificateNumber}`;
  }
  return `${getPublicOrigin()}/verify/${certificateNumber}`;
}

export function verificationHostLabel(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}`;
  } catch {
    return url.replace(/^https?:\/\//, "");
  }
}
