import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";

/**
 * POST /api/notifications/mark-read
 *
 * Body (all optional):
 *   ids  string[]  specific notification ids to mark read.
 *                  If omitted, marks ALL unread notifications for the user.
 */
export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { ids?: string[] };
  const now = new Date();

  try {
    if (Array.isArray(body.ids) && body.ids.length > 0) {
      // Mark specific notifications as read (must belong to this user)
      await prisma.notification.updateMany({
        where: {
          id: { in: body.ids },
          userId: session.dbUser.id,
          readAt: null,
        },
        data: { readAt: now },
      });
    } else {
      // Mark all unread as read
      await prisma.notification.updateMany({
        where: { userId: session.dbUser.id, readAt: null },
        data: { readAt: now },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error("POST /api/notifications/mark-read error:", error);
    return NextResponse.json(
      { error: "Failed to mark notifications as read" },
      { status: 500 }
    );
  }
}
