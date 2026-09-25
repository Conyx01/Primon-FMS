import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";

/**
 * GET /api/notifications
 *
 * Returns the current user's recent notifications plus an unread count.
 * Query params:
 *   limit  number  max rows to return (default 20)
 */
export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 50);

  try {
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: session.dbUser.id },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.notification.count({
        where: { userId: session.dbUser.id, readAt: null },
      }),
    ]);

    return NextResponse.json({ notifications, unreadCount });
  } catch (error: unknown) {
    console.error("GET /api/notifications error:", error);
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}
