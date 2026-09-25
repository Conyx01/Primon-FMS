import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { FccStatus, ReadingStatus } from "@prisma/client";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.dbUser.role === "client") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const description = String(body.description ?? "").trim();
    if (!description) {
      return NextResponse.json({ error: "Corrective action description is required" }, { status: 400 });
    }

    const reading = await prisma.gasReading.findUnique({
      where: { id },
      include: { fcc: { include: { gasReadings: true } }, correctiveAction: true },
    });
    if (!reading) {
      return NextResponse.json({ error: "Reading not found" }, { status: 404 });
    }
    if (reading.status !== ReadingStatus.critical) {
      return NextResponse.json(
        { error: "Corrective action can only be logged on a critical reading" },
        { status: 409 }
      );
    }

    const previousFccStatus = reading.fcc.status;

    const result = await prisma.$transaction(async (tx) => {
      const action = await tx.correctiveAction.upsert({
        where: { gasReadingId: reading.id },
        create: {
          gasReadingId: reading.id,
          description,
          loggedById: session.dbUser.id,
        },
        update: {
          description,
          loggedById: session.dbUser.id,
          actionTakenAt: new Date(),
        },
        include: {
          loggedBy: { select: { id: true, name: true, email: true } },
        },
      });

      await tx.gasReading.update({
        where: { id: reading.id },
        data: { status: ReadingStatus.action_taken },
      });

      const siblings = await tx.gasReading.findMany({ where: { fccId: reading.fccId } });
      const stillCritical = siblings.some(
        (r) => r.id !== reading.id && r.status === ReadingStatus.critical
      );
      const allResolved = siblings.every((r) =>
        r.id === reading.id
          ? true
          : r.status === ReadingStatus.compliant || r.status === ReadingStatus.action_taken
      );

      let nextStatus = reading.fcc.status;
      if (stillCritical) {
        nextStatus = FccStatus.flagged;
      } else if (allResolved) {
        nextStatus = FccStatus.under_review;
      } else {
        nextStatus = FccStatus.in_progress;
      }

      const fcc = await tx.fCC.update({
        where: { id: reading.fccId },
        data: { status: nextStatus },
      });

      await tx.auditLog.create({
        data: {
          entityType: "CorrectiveAction",
          entityId: action.id,
          action: "log_corrective_action",
          actorId: session.dbUser.id,
          diff: {
            gasReadingId: reading.id,
            dayNumber: reading.dayNumber,
            description,
            previousFccStatus,
            fccStatus: nextStatus,
          },
        },
      });

      return { correctiveAction: action, fcc };
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    console.error("POST /api/readings/[id]/corrective-action error:", error);
    return NextResponse.json({ error: "Failed to log corrective action" }, { status: 500 });
  }
}
