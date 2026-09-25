import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";

export async function PATCH(
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
    const fcc = await prisma.fCC.findFirst({
      where: {
        OR: [{ id }, { workOrderId: id }, { workOrder: { code: id } }],
      },
      include: { closeout: true },
    });
    if (!fcc) {
      return NextResponse.json({ error: "FCC record not found" }, { status: 404 });
    }
    if (!fcc.closeout) {
      return NextResponse.json(
        { error: "Record Date Fumigant Placed before close-out" },
        { status: 409 }
      );
    }

    const body = await req.json();
    const aerationBegan = body.aerationBegan ? new Date(body.aerationBegan) : null;
    const aerationCompleted = body.aerationCompleted ? new Date(body.aerationCompleted) : null;

    let durationHours =
      body.durationHours === "" || body.durationHours == null
        ? null
        : Number(body.durationHours);

    if (
      durationHours == null &&
      aerationBegan &&
      aerationCompleted &&
      !Number.isNaN(aerationBegan.getTime()) &&
      !Number.isNaN(aerationCompleted.getTime())
    ) {
      durationHours =
        (aerationCompleted.getTime() - aerationBegan.getTime()) / (1000 * 60 * 60);
    }

    const closeout = await prisma.$transaction(async (tx) => {
      const updated = await tx.fumigationCloseout.update({
        where: { id: fcc.closeout!.id },
        data: {
          aerationBegan,
          aerationCompleted,
          durationHours,
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: "FumigationCloseout",
          entityId: updated.id,
          action: "update_closeout",
          actorId: session.dbUser.id,
          diff: {
            aerationBegan: aerationBegan?.toISOString() ?? null,
            aerationCompleted: aerationCompleted?.toISOString() ?? null,
            durationHours,
          },
        },
      });

      return updated;
    });

    return NextResponse.json({ closeout }, { status: 200 });
  } catch (error: unknown) {
    console.error("PATCH /api/fccs/[id]/closeout error:", error);
    return NextResponse.json({ error: "Failed to save close-out" }, { status: 500 });
  }
}
