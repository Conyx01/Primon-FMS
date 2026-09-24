import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const fcc = await prisma.fCC.findFirst({
      where: {
        OR: [
          { id },
          { workOrderId: id },
          { certificateNumber: id },
          { workOrder: { code: id } },
        ],
      },
      include: {
        workOrder: {
          include: {
            client: { select: { id: true, name: true, email: true } },
            createdBy: { select: { id: true, name: true, email: true } },
          },
        },
        shippingInstructions: true,
        fumigationDescription: {
          include: {
            fumigant: true,
            formulation: true,
          },
        },
        gasReadings: {
          include: { correctiveAction: true },
          orderBy: { dayNumber: "asc" },
        },
        closeout: true,
        signatures: true,
      },
    });

    if (!fcc) {
      return NextResponse.json({ error: "FCC record not found" }, { status: 404 });
    }

    // Role check for client scoping
    if (
      session.dbUser.role === "client" &&
      fcc.workOrder.clientId !== session.dbUser.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ fcc });
  } catch (error: any) {
    console.error("GET /api/fccs/[id] error:", error);
    return NextResponse.json({ error: "Failed to fetch FCC record" }, { status: 500 });
  }
}
