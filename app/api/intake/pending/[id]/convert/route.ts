import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { Role } from "@prisma/client";

/**
 * POST /api/intake/pending/[id]/convert
 *
 * Called by the New Work Order wizard after a successful WO creation
 * to mark the originating submission as converted. The WO itself is
 * created through the existing POST /api/work-orders route.
 */
export async function POST(
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
    });

    if (!submission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 }
      );
    }
    if (submission.status !== "pending") {
      return NextResponse.json(
        { error: `Submission is already ${submission.status}` },
        { status: 409 }
      );
    }

    const updated = await prisma.pendingSubmission.update({
      where: { id },
      data: {
        status: "converted",
        reviewedById: session.dbUser.id,
      },
    });

    // Audit log — intake conversion is a compliance-relevant action
    await prisma.auditLog.create({
      data: {
        entityType: "PendingSubmission",
        entityId: id,
        action: "intake_converted",
        actorId: session.dbUser.id,
        diff: {
          previousStatus: "pending",
          status: "converted",
          sourceType: submission.sourceType,
        },
      },
    });

    return NextResponse.json({ submission: updated });
  } catch (error: unknown) {
    console.error("POST /api/intake/pending/[id]/convert error:", error);
    return NextResponse.json(
      { error: "Failed to mark submission as converted" },
      { status: 500 }
    );
  }
}
