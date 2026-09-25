import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { PendingSubmissionStatus, Role } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (
    session.dbUser.role !== Role.ops_manager &&
    session.dbUser.role !== Role.admin
  ) {
    return NextResponse.json(
      { error: "Forbidden: Ops Manager or Admin only" },
      { status: 403 }
    );
  }

  const { searchParams } = req.nextUrl;
  const statusParam = searchParams.get("status");
  const statusFilter =
    statusParam &&
    Object.values(PendingSubmissionStatus).includes(
      statusParam as PendingSubmissionStatus
    )
      ? (statusParam as PendingSubmissionStatus)
      : undefined;

  try {
    const submissions = await prisma.pendingSubmission.findMany({
      where: statusFilter ? { status: statusFilter } : undefined,
      orderBy: { receivedAt: "desc" },
      include: {
        reviewedBy: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ submissions });
  } catch (error: unknown) {
    console.error("GET /api/intake/pending error:", error);
    return NextResponse.json(
      { error: "Failed to fetch submissions" },
      { status: 500 }
    );
  }
}
