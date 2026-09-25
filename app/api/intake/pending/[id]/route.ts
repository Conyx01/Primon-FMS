import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { Role } from "@prisma/client";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (
    session.dbUser.role !== Role.ops_manager &&
    session.dbUser.role !== Role.admin
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const submission = await prisma.pendingSubmission.findUnique({
      where: { id },
      include: {
        reviewedBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!submission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ submission });
  } catch (error: unknown) {
    console.error("GET /api/intake/pending/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch submission" },
      { status: 500 }
    );
  }
}
