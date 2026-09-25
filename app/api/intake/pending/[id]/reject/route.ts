import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { Role } from "@prisma/client";

/**
 * POST /api/intake/pending/[id]/reject
 *
 * Body (all optional):
 *   reason            string  — free-text rejection note stored in payload
 *   mergeIntoWorkOrderId string — if supplied, stores a reference to an
 *                                 existing WO that covers this request
 *                                 (merge-as-duplicate). The row is NOT deleted.
 */
export async function POST(
  req: NextRequest,
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

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const reason =
    typeof body.reason === "string" ? body.reason.trim() : undefined;
  const mergeIntoWorkOrderId =
    typeof body.mergeIntoWorkOrderId === "string"
      ? body.mergeIntoWorkOrderId.trim()
      : undefined;

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

    // Verify merge target exists, if supplied
    if (mergeIntoWorkOrderId) {
      const wo = await prisma.workOrder.findUnique({
        where: { id: mergeIntoWorkOrderId },
      });
      if (!wo) {
        return NextResponse.json(
          { error: "Target work order not found" },
          { status: 404 }
        );
      }
    }

    const existingPayload =
      (submission.payload as Record<string, unknown>) ?? {};

    const updated = await prisma.pendingSubmission.update({
      where: { id },
      data: {
        status: "rejected",
        reviewedById: session.dbUser.id,
        payload: {
          ...existingPayload,
          ...(reason ? { rejectionReason: reason } : {}),
          ...(mergeIntoWorkOrderId
            ? { mergedInto: mergeIntoWorkOrderId }
            : {}),
        },
      },
    });

    return NextResponse.json({ submission: updated });
  } catch (error: unknown) {
    console.error("POST /api/intake/pending/[id]/reject error:", error);
    return NextResponse.json(
      { error: "Failed to reject submission" },
      { status: 500 }
    );
  }
}
