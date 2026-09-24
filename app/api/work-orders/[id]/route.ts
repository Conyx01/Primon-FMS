import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { CropType, Scale } from "@prisma/client";

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
    const workOrder = await prisma.workOrder.findFirst({
      where: {
        OR: [{ id }, { code: id }],
      },
      include: {
        client: {
          select: { id: true, name: true, email: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        fcc: {
          include: {
            shippingInstructions: true,
            fumigationDescription: {
              include: {
                fumigant: true,
                formulation: true,
              },
            },
            gasReadings: {
              include: {
                correctiveAction: true,
              },
              orderBy: { dayNumber: "asc" },
            },
            closeout: true,
            signatures: true,
          },
        },
        stockMovements: {
          include: {
            formulation: true,
            performedBy: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!workOrder) {
      return NextResponse.json({ error: "Work Order not found" }, { status: 404 });
    }

    // Role check for client
    if (
      session.dbUser.role === "client" &&
      workOrder.clientId !== session.dbUser.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ workOrder });
  } catch (error: any) {
    console.error("GET /api/work-orders/[id] error:", error);
    return NextResponse.json({ error: "Failed to fetch work order" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (
    session.dbUser.role !== "admin" &&
    session.dbUser.role !== "ops_manager"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const {
      cropType,
      scale,
      clientId,
      salesOrderNo,
      shipmentNo,
      deliveryNo,
    } = body;

    const existing = await prisma.workOrder.findFirst({
      where: { OR: [{ id }, { code: id }] },
    });

    if (!existing) {
      return NextResponse.json({ error: "Work Order not found" }, { status: 404 });
    }

    const updated = await prisma.workOrder.update({
      where: { id: existing.id },
      data: {
        ...(cropType && { cropType: cropType as CropType }),
        ...(scale && { scale: scale as Scale }),
        ...(clientId !== undefined && { clientId: clientId || null }),
        ...(salesOrderNo !== undefined && { salesOrderNo: salesOrderNo?.trim() || null }),
        ...(shipmentNo !== undefined && { shipmentNo: shipmentNo?.trim() || null }),
        ...(deliveryNo !== undefined && { deliveryNo: deliveryNo?.trim() || null }),
      },
      include: {
        client: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        fcc: true,
      },
    });

    return NextResponse.json({ workOrder: updated });
  } catch (error: any) {
    console.error("PATCH /api/work-orders/[id] error:", error);
    return NextResponse.json({ error: "Failed to update work order" }, { status: 500 });
  }
}
