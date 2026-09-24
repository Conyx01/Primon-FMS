import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { StockMovementType } from "@prisma/client";

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Admin-only check
  if (session.dbUser.role !== "admin") {
    return NextResponse.json(
      { error: "Forbidden: Only Admin users can adjust stock" },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { formulationId, type = "adjustment", quantity, note } = body;

    if (!formulationId) {
      return NextResponse.json(
        { error: "Formulation ID is required" },
        { status: 400 }
      );
    }

    if (typeof quantity !== "number" || isNaN(quantity)) {
      return NextResponse.json(
        { error: "A valid numeric quantity is required" },
        { status: 400 }
      );
    }

    if (!note || !note.trim()) {
      return NextResponse.json(
        { error: "A note explaining the stock movement is required" },
        { status: 400 }
      );
    }

    // Find stock level
    const existingStockLevel = await prisma.stockLevel.findFirst({
      where: {
        OR: [{ formulationId }, { id: formulationId }],
      },
      include: { formulation: true },
    });

    if (!existingStockLevel) {
      return NextResponse.json(
        { error: "Stock level for specified formulation not found" },
        { status: 404 }
      );
    }

    const currentOnHand = existingStockLevel.quantityOnHand;
    let newOnHand = currentOnHand;
    let movementType: StockMovementType = StockMovementType.adjustment;

    if (type === "addition") {
      movementType = StockMovementType.addition;
      newOnHand = currentOnHand + Math.abs(quantity);
    } else if (type === "deduction") {
      movementType = StockMovementType.deduction;
      newOnHand = currentOnHand - Math.abs(quantity);
    } else {
      movementType = StockMovementType.adjustment;
      newOnHand = currentOnHand + quantity;
    }

    if (newOnHand < 0) {
      return NextResponse.json(
        { error: `Stock cannot be negative. Current stock is ${currentOnHand} ${existingStockLevel.formulation.unit}.` },
        { status: 400 }
      );
    }

    // Atomic transaction (now supported via PrismaNeon WebSocket Pool)
    const result = await prisma.$transaction(async (tx) => {
      const updatedStockLevel = await tx.stockLevel.update({
        where: { id: existingStockLevel.id },
        data: { quantityOnHand: newOnHand },
        include: {
          formulation: {
            include: { fumigant: true },
          },
        },
      });

      const movement = await tx.stockMovement.create({
        data: {
          formulationId: existingStockLevel.formulationId,
          type: movementType,
          quantity: Math.abs(quantity),
          note: note.trim(),
          performedById: session.dbUser.id,
        },
        include: {
          formulation: { include: { fumigant: true } },
          performedBy: { select: { id: true, name: true, email: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: "StockLevel",
          entityId: existingStockLevel.id,
          action: "stock_adjustment",
          actorId: session.dbUser.id,
          diff: {
            formulation: existingStockLevel.formulation.name,
            previousQuantity: currentOnHand,
            newQuantity: newOnHand,
            movementType,
            quantityChanged: Math.abs(quantity),
            note: note.trim(),
          },
        },
      });

      return { stockLevel: updatedStockLevel, movement };
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error("POST /api/stock/adjust error:", error);
    return NextResponse.json(
      { error: "Failed to perform stock adjustment" },
      { status: 500 }
    );
  }
}
