import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { FumigationType, StockMovementType } from "@prisma/client";
import { notifyLowStockIfCrossed } from "@/lib/notify-low-stock";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleFumigationDescriptionSave(req, params);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleFumigationDescriptionSave(req, params);
}

async function handleFumigationDescriptionSave(
  req: NextRequest,
  paramsPromise: Promise<{ id: string }>
) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Staff only
  if (session.dbUser.role === "client") {
    return NextResponse.json(
      { error: "Forbidden: Clients cannot save fumigation descriptions" },
      { status: 403 }
    );
  }

  const { id } = await paramsPromise;

  try {
    const fcc = await prisma.fCC.findFirst({
      where: {
        OR: [{ id }, { workOrderId: id }, { workOrder: { code: id } }],
      },
      include: {
        workOrder: true,
        fumigationDescription: true,
      },
    });

    if (!fcc) {
      return NextResponse.json({ error: "FCC record not found" }, { status: 404 });
    }

    const body = await req.json();
    const {
      fumigationType = "sheeted_stack",
      fumigantId: inputFumigantId,
      fumigantName,
      formulationId: inputFormulationId,
      formulationName,
      doseGm3,
      totalVolumeM3,
      totalFumigantUsedG: customFumigantUsed,
    } = body;

    // Resolve Fumigant
    let fumigant = null;
    if (inputFumigantId) {
      fumigant = await prisma.fumigant.findUnique({ where: { id: inputFumigantId } });
    } else if (fumigantName) {
      const nameKey = String(fumigantName).toLowerCase().replace(/\s+/g, "_");
      fumigant = await prisma.fumigant.findFirst({
        where: { OR: [{ name: nameKey }, { name: fumigantName }] },
      });
    }

    if (!fumigant) {
      fumigant = await prisma.fumigant.findFirst();
    }

    if (!fumigant) {
      return NextResponse.json({ error: "Fumigant not found in database" }, { status: 400 });
    }

    // Resolve Formulation
    let formulation = null;
    if (inputFormulationId) {
      formulation = await prisma.formulation.findUnique({
        where: { id: inputFormulationId },
        include: { stockLevel: true },
      });
    } else if (formulationName) {
      const formKey = String(formulationName).toLowerCase().replace(/\s+/g, "_");
      formulation = await prisma.formulation.findFirst({
        where: {
          fumigantId: fumigant.id,
          OR: [{ name: formKey }, { name: formulationName }],
        },
        include: { stockLevel: true },
      });
    }

    if (!formulation) {
      formulation = await prisma.formulation.findFirst({
        where: { fumigantId: fumigant.id },
        include: { stockLevel: true },
      });
    }

    if (!formulation) {
      return NextResponse.json(
        { error: "Formulation not found for specified fumigant" },
        { status: 400 }
      );
    }

    const dose = parseFloat(String(doseGm3)) || 1.5;
    const volume = parseFloat(String(totalVolumeM3)) || 0;
    const totalUsedG =
      typeof customFumigantUsed === "number" && customFumigantUsed > 0
        ? customFumigantUsed
        : Math.round(dose * volume);

    const existingDesc = fcc.fumigationDescription;
    const stockLevel = formulation.stockLevel;

    if (!stockLevel) {
      return NextResponse.json(
        { error: `No stock level record found for formulation ${formulation.name}` },
        { status: 400 }
      );
    }

    const switchedFormulation = Boolean(
      existingDesc && existingDesc.formulationId !== formulation.id
    );
    let oldFormulation: {
      id: string;
      name: string;
      unit: string;
      stockLevel: { id: string; quantityOnHand: number; lowStockThreshold: number } | null;
    } | null = null;
    if (switchedFormulation && existingDesc) {
      oldFormulation = await prisma.formulation.findUnique({
        where: { id: existingDesc.formulationId },
        include: { stockLevel: true },
      });
    }

    // Atomic transaction for description save, stock deduction, and status update
    const result = await prisma.$transaction(async (tx) => {
      if (switchedFormulation && existingDesc) {
        const refund = existingDesc.totalFumigantUsedG;
        if (oldFormulation?.stockLevel && refund > 0) {
          await tx.stockLevel.update({
            where: { id: oldFormulation.stockLevel.id },
            data: { quantityOnHand: { increment: refund } },
          });
          await tx.stockMovement.create({
            data: {
              formulationId: oldFormulation.id,
              workOrderId: fcc.workOrderId,
              type: StockMovementType.addition,
              quantity: refund,
              note: `Stock returned on formulation change (FCC ${fcc.id})`,
              performedById: session.dbUser.id,
            },
          });
        }
        if (totalUsedG > 0) {
          if (stockLevel.quantityOnHand < totalUsedG) {
            throw new Error(
              `Insufficient stock for formulation ${formulation.name}. Required: ${totalUsedG}${formulation.unit}, Available: ${stockLevel.quantityOnHand}${formulation.unit}`
            );
          }
          await tx.stockLevel.update({
            where: { id: stockLevel.id },
            data: { quantityOnHand: { decrement: totalUsedG } },
          });
          await tx.stockMovement.create({
            data: {
              formulationId: formulation.id,
              workOrderId: fcc.workOrderId,
              type: StockMovementType.deduction,
              quantity: totalUsedG,
              note: `Stock deducted on formulation change (FCC ${fcc.id})`,
              performedById: session.dbUser.id,
            },
          });
        }
      } else {
        let deltaDeduction = totalUsedG;
        if (existingDesc) {
          deltaDeduction = totalUsedG - existingDesc.totalFumigantUsedG;
        }

        if (deltaDeduction > 0) {
          if (stockLevel.quantityOnHand < deltaDeduction) {
            throw new Error(
              `Insufficient stock for formulation ${formulation.name}. Required: ${deltaDeduction}${formulation.unit}, Available: ${stockLevel.quantityOnHand}${formulation.unit}`
            );
          }
          await tx.stockLevel.update({
            where: { id: stockLevel.id },
            data: { quantityOnHand: { decrement: deltaDeduction } },
          });
          await tx.stockMovement.create({
            data: {
              formulationId: formulation.id,
              workOrderId: fcc.workOrderId,
              type: StockMovementType.deduction,
              quantity: deltaDeduction,
              note: `Stock deducted on fumigation description save (FCC ${fcc.id})`,
              performedById: session.dbUser.id,
            },
          });
        } else if (deltaDeduction < 0) {
          const refundAmount = Math.abs(deltaDeduction);
          await tx.stockLevel.update({
            where: { id: stockLevel.id },
            data: { quantityOnHand: { increment: refundAmount } },
          });
          await tx.stockMovement.create({
            data: {
              formulationId: formulation.id,
              workOrderId: fcc.workOrderId,
              type: StockMovementType.addition,
              quantity: refundAmount,
              note: `Stock adjusted on fumigation description update (FCC ${fcc.id})`,
              performedById: session.dbUser.id,
            },
          });
        }
      }

      // Upsert Fumigation Description
      const descType: FumigationType =
        String(fumigationType).toLowerCase() === "container"
          ? FumigationType.container
          : FumigationType.sheeted_stack;

      const desc = await tx.fumigationDescription.upsert({
        where: { fccId: fcc.id },
        update: {
          fumigationType: descType,
          fumigantId: fumigant.id,
          formulationId: formulation.id,
          doseGm3: dose,
          totalVolumeM3: volume,
          totalFumigantUsedG: totalUsedG,
          recordedById: session.dbUser.id,
        },
        create: {
          fccId: fcc.id,
          fumigationType: descType,
          fumigantId: fumigant.id,
          formulationId: formulation.id,
          doseGm3: dose,
          totalVolumeM3: volume,
          totalFumigantUsedG: totalUsedG,
          recordedById: session.dbUser.id,
        },
        include: {
          fumigant: true,
          formulation: true,
        },
      });

      // Update FCC status to in_progress if currently draft
      let updatedFcc = fcc;
      if (fcc.status === "draft") {
        updatedFcc = await tx.fCC.update({
          where: { id: fcc.id },
          data: { status: "in_progress" },
          include: {
            workOrder: true,
            fumigationDescription: true,
          },
        });
      }

      // Audit Log
      await tx.auditLog.create({
        data: {
          entityType: "FumigationDescription",
          entityId: desc.id,
          action: existingDesc ? "update_fumigation_description" : "create_fumigation_description",
          actorId: session.dbUser.id,
          diff: {
            fumigationType: descType,
            fumigant: fumigant.name,
            formulation: formulation.name,
            doseGm3: dose,
            totalVolumeM3: volume,
            totalFumigantUsedG: totalUsedG,
            formulationChanged: switchedFormulation,
          },
        },
      });

      return { fumigationDescription: desc, fcc: updatedFcc };
    });

    const refreshed = await prisma.stockLevel.findUnique({
      where: { id: stockLevel.id },
      include: { formulation: true },
    });
    if (refreshed) {
      await notifyLowStockIfCrossed({
        previousQty: stockLevel.quantityOnHand,
        newQty: refreshed.quantityOnHand,
        threshold: refreshed.lowStockThreshold,
        formulationName: refreshed.formulation.name,
        formulationId: refreshed.formulationId,
      });
    }

    if (oldFormulation?.stockLevel) {
      const oldRefreshed = await prisma.stockLevel.findUnique({
        where: { id: oldFormulation.stockLevel.id },
        include: { formulation: true },
      });
      if (oldRefreshed) {
        await notifyLowStockIfCrossed({
          previousQty: oldFormulation.stockLevel.quantityOnHand,
          newQty: oldRefreshed.quantityOnHand,
          threshold: oldRefreshed.lowStockThreshold,
          formulationName: oldRefreshed.formulation.name,
          formulationId: oldRefreshed.formulationId,
        });
      }
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error("POST/PATCH /api/fccs/[id]/fumigation-description error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save fumigation description" },
      { status: 400 }
    );
  }
}
