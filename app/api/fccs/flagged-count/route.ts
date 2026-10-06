import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { FccStatus } from "@prisma/client";

/** GET /api/fccs/flagged-count — live count of FCCs with unresolved critical readings. */
export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.dbUser.role === "client" || session.dbUser.role === "executive") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const count = await prisma.fCC.count({
      where: { status: FccStatus.flagged },
    });
    return NextResponse.json({ count });
  } catch (error: unknown) {
    console.error("GET /api/fccs/flagged-count error:", error);
    return NextResponse.json({ error: "Failed to count flagged FCCs" }, { status: 500 });
  }
}
