import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { issueInvite } from "@/lib/invite";
import { sendInviteEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Always returns 200 so we do not leak whether the email exists.
 * Reuses the invite set-password link.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`password-forgot:${ip}`, 8, 15 * 60_000)) {
    return NextResponse.json({ ok: true });
  }

  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const email = String(body.email ?? "").trim().toLowerCase();

  if (email.includes("@")) {
    try {
      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, name: true, email: true },
      });
      if (user) {
        const invite = await issueInvite(user.id, user.id);
        await sendInviteEmail({
          to: user.email,
          name: user.name,
          inviteUrl: invite.inviteUrl,
        });
      }
    } catch (error: unknown) {
      console.error("POST /api/password/forgot error:", error);
    }
  }

  return NextResponse.json({ ok: true });
}
