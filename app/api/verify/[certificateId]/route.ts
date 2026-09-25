import { NextRequest, NextResponse } from "next/server";
import { loadCertifiedPublicSummary } from "@/lib/verify-fcc";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ certificateId: string }> }
) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!rateLimit(`verify:${ip}`)) {
    return NextResponse.json({ error: "Too many verification requests" }, { status: 429 });
  }

  const { certificateId } = await params;
  try {
    const summary = await loadCertifiedPublicSummary(certificateId);
    if (!summary) {
      return NextResponse.json({ valid: false }, { status: 404 });
    }
    return NextResponse.json(summary, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error: unknown) {
    console.error("GET /api/verify/[certificateId] error:", error);
    return NextResponse.json({ error: "Verification lookup failed" }, { status: 500 });
  }
}
