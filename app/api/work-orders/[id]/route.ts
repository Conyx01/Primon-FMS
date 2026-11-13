import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { CropType, Role, Scale, StockMovementType } from "@prisma/client";

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
      code,
      cropType,
      customProduct,
      scale,
      clientId,
      salesOrderNo,
      shipmentNo,
      deliveryNo,
    } = body;

    const existing = await prisma.workOrder.findFirst({
      where: { OR: [{ id }, { code: id }] },
      include: { fcc: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Work Order not found" }, { status: 404 });
    }

    if (existing.fcc?.status === "certified") {
      return NextResponse.json(
        { error: "Work orders cannot be modified once the certificate is certified." },
        { status: 409 }
      );
    }

    const nextCode = code !== undefined ? String(code).trim() : undefined;
    if (nextCode !== undefined) {
      if (!nextCode) {
        return NextResponse.json({ error: "Work order code cannot be empty" }, { status: 400 });
      }
      if (nextCode !== existing.code) {
        const conflict = await prisma.workOrder.findUnique({
          where: { code: nextCode },
        });
        if (conflict) {
          return NextResponse.json(
            { error: `Work order code "${nextCode}" is already in use.` },
            { status: 409 }
          );
        }
      }
    }

    if (clientId !== undefined) {
      const nextClientId = clientId ? String(clientId) : null;
      if (existing.clientId && existing.clientId !== nextClientId) {
        return NextResponse.json(
          {
            error:
              "A portal client is already attached to this work order and cannot be changed.",
          },
          { status: 409 }
        );
      }
    }

    if (clientId) {
      const client = await prisma.user.findUnique({
        where: { id: clientId },
        select: { id: true, role: true },
      });
      if (!client || client.role !== Role.client) {
        return NextResponse.json(
          { error: "Selected user is not a portal client" },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.workOrder.update({
      where: { id: existing.id },
      data: {
        ...(nextCode !== undefined && { code: nextCode }),
        ...(cropType && { cropType: cropType as CropType }),
        ...(customProduct !== undefined && { customProduct: customProduct?.trim() || null }),
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

    await prisma.auditLog.create({
      data: {
        entityType: "WorkOrder",
        entityId: updated.id,
        action: "edit_work_order",
        actorId: session.dbUser.id,
        diff: {
          previous: {
            code: existing.code,
            cropType: existing.cropType,
            customProduct: existing.customProduct,
            salesOrderNo: existing.salesOrderNo,
            shipmentNo: existing.shipmentNo,
            deliveryNo: existing.deliveryNo,
          },
          updated: {
            code: updated.code,
            cropType: updated.cropType,
            customProduct: updated.customProduct,
            salesOrderNo: updated.salesOrderNo,
            shipmentNo: updated.shipmentNo,
            deliveryNo: updated.deliveryNo,
          },
        },
      },
    });

    return NextResponse.json({ workOrder: updated });
  } catch (error: any) {
    console.error("PATCH /api/work-orders/[id] error:", error);
    return NextResponse.json({ error: "Failed to update work order" }, { status: 500 });
  }
}

export async function DELETE(
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
    const existing = await prisma.workOrder.findFirst({
      where: { OR: [{ id }, { code: id }] },
      include: {
        fcc: {
          include: {
            fumigationDescription: {
              include: {
                formulation: {
                  include: { stockLevel: true },
                },
              },
            },
          },
        },
        stockMovements: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Work Order not found" }, { status: 404 });
    }

    if (existing.fcc?.status === "certified") {
      return NextResponse.json(
        { error: "Certified work orders and certificates cannot be deleted." },
        { status: 409 }
      );
    }

    const formulation = existing.fcc?.fumigationDescription?.formulation;
    const stockLevel = formulation?.stockLevel;
    const fumigantUsed = existing.fcc?.fumigationDescription?.totalFumigantUsedG ?? 0;

    await prisma.$transaction(async (tx) => {
      // 1. If stock was previously deducted on this work order, refund it back to stockLevel
      if (stockLevel && fumigantUsed > 0) {
        await tx.stockLevel.update({
          where: { id: stockLevel.id },
          data: { quantityOnHand: { increment: fumigantUsed } },
        });

        await tx.stockMovement.create({
          data: {
            formulationId: formulation.id,
            type: StockMovementType.addition,
            quantity: fumigantUsed,
            note: `Stock restored on deletion of work order ${existing.code}`,
            performedById: session.dbUser.id,
          },
        });
      }

      // 2. Delete all stock movements referencing this work order
      await tx.stockMovement.deleteMany({
        where: { workOrderId: existing.id },
      });

      // 3. Delete the work order (Prisma cascades to FCC, gas readings, shipping instructions, etc.)
      await tx.workOrder.delete({
        where: { id: existing.id },
      });

      // 4. Log audit entry for tracking
      await tx.auditLog.create({
        data: {
          entityType: "WorkOrder",
          entityId: existing.id,
          action: "delete_work_order",
          actorId: session.dbUser.id,
          diff: {
            code: existing.code,
            cropType: existing.cropType,
            fccStatus: existing.fcc?.status,
            refundedStockG: fumigantUsed > 0 ? fumigantUsed : null,
          },
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: `Work order ${existing.code} successfully deleted.`,
    });
  } catch (error: any) {
    console.error("DELETE /api/work-orders/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete work order" }, { status: 500 });
  }
}
