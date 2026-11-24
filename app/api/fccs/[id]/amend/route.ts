import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { CropType, SignatureRole } from "@prisma/client";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Strict Admin-only privilege
  if (session.dbUser.role !== "admin") {
    return NextResponse.json(
      { error: "Forbidden: Only administrators can amend certified certificates." },
      { status: 403 }
    );
  }

  const { id } = await params;

  try {
    const fcc = await prisma.fCC.findFirst({
      where: {
        OR: [
          { id },
          { workOrderId: id },
          { workOrder: { code: id } },
          { certificateNumber: id },
        ],
      },
      include: {
        workOrder: true,
        shippingInstructions: true,
        signatures: true,
      },
    });

    if (!fcc) {
      return NextResponse.json({ error: "FCC record not found" }, { status: 404 });
    }

    if (fcc.status !== "certified") {
      return NextResponse.json(
        { error: "Only certified certificates can be amended via this endpoint." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const {
      reason,
      // Work Order fields
      code,
      cropType,
      customProduct,
      salesOrderNo,
      shipmentNo,
      deliveryNo,
      // Shipping Instructions fields
      tobaccoSupplier,
      tobaccoSupplierAddress,
      supplierAddress,
      consignee,
      consigneeAddress,
      cropYear,
      tobaccoType,
      productType,
      netWeight,
      grossWeight,
      quantity,
      polylined,
      gradeName,
      caseNos,
      countryOfOrigin,
      containerNo,
      sealNo,
      additionalInfo,
      // Signatory names
      signers,
    } = body;

    const trimmedReason = typeof reason === "string" ? reason.trim() : "";
    if (!trimmedReason) {
      return NextResponse.json(
        { error: "A valid reason for amendment is strictly required." },
        { status: 400 }
      );
    }

    // Work Order code validation
    const nextCode = code !== undefined ? String(code).trim() : undefined;
    if (nextCode !== undefined) {
      if (!nextCode) {
        return NextResponse.json({ error: "Work order code cannot be empty" }, { status: 400 });
      }
      if (nextCode !== fcc.workOrder.code) {
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

    // Parse SI fields
    const resolvedSupplierAddress =
      tobaccoSupplierAddress !== undefined ? tobaccoSupplierAddress : supplierAddress;
    const resolvedProductType =
      productType !== undefined
        ? productType
        : tobaccoType !== undefined
        ? tobaccoType
        : undefined;

    const parsedNetWeight =
      netWeight !== undefined
        ? typeof netWeight === "number"
          ? netWeight
          : parseFloat(String(netWeight).replace(/[^0-9.]/g, "")) || null
        : undefined;

    const parsedGrossWeight =
      grossWeight !== undefined
        ? typeof grossWeight === "number"
          ? grossWeight
          : parseFloat(String(grossWeight).replace(/[^0-9.]/g, "")) || null
        : undefined;

    const parsedQuantity =
      quantity !== undefined
        ? typeof quantity === "number"
          ? quantity
          : parseInt(String(quantity).replace(/[^0-9]/g, ""), 10) || null
        : undefined;

    const parsedPolylined =
      polylined !== undefined
        ? typeof polylined === "boolean"
          ? polylined
          : String(polylined).toLowerCase() === "yes" || String(polylined).toLowerCase() === "true"
        : undefined;

    // Changes tracker for the audit log
    const changes: Record<string, { from: any; to: any }> = {};

    // Check Work Order changes
    const woUpdates: Record<string, any> = {};
    if (nextCode !== undefined && nextCode !== fcc.workOrder.code) {
      changes.workOrderCode = { from: fcc.workOrder.code, to: nextCode };
      woUpdates.code = nextCode;
    }
    if (cropType !== undefined && cropType !== fcc.workOrder.cropType) {
      changes.cropType = { from: fcc.workOrder.cropType, to: cropType };
      woUpdates.cropType = cropType as CropType;
    }
    const cleanCustomProduct = customProduct !== undefined ? customProduct?.trim() || null : undefined;
    if (cleanCustomProduct !== undefined && cleanCustomProduct !== fcc.workOrder.customProduct) {
      changes.customProduct = { from: fcc.workOrder.customProduct, to: cleanCustomProduct };
      woUpdates.customProduct = cleanCustomProduct;
    }
    const cleanSalesOrderNo = salesOrderNo !== undefined ? salesOrderNo?.trim() || null : undefined;
    if (cleanSalesOrderNo !== undefined && cleanSalesOrderNo !== fcc.workOrder.salesOrderNo) {
      changes.salesOrderNo = { from: fcc.workOrder.salesOrderNo, to: cleanSalesOrderNo };
      woUpdates.salesOrderNo = cleanSalesOrderNo;
    }
    const cleanShipmentNo = shipmentNo !== undefined ? shipmentNo?.trim() || null : undefined;
    if (cleanShipmentNo !== undefined && cleanShipmentNo !== fcc.workOrder.shipmentNo) {
      changes.shipmentNo = { from: fcc.workOrder.shipmentNo, to: cleanShipmentNo };
      woUpdates.shipmentNo = cleanShipmentNo;
    }
    const cleanDeliveryNo = deliveryNo !== undefined ? deliveryNo?.trim() || null : undefined;
    if (cleanDeliveryNo !== undefined && cleanDeliveryNo !== fcc.workOrder.deliveryNo) {
      changes.deliveryNo = { from: fcc.workOrder.deliveryNo, to: cleanDeliveryNo };
      woUpdates.deliveryNo = cleanDeliveryNo;
    }

    // Check Shipping Instructions changes
    const existingSi = fcc.shippingInstructions;
    const siUpdates: Record<string, any> = {};

    function checkSiField(field: string, existingVal: any, nextVal: any) {
      if (nextVal !== undefined) {
        const normalizedNext = nextVal === "" ? null : nextVal;
        const normalizedExisting = existingVal === "" ? null : existingVal;
        if (normalizedExisting !== normalizedNext) {
          changes[field] = { from: normalizedExisting, to: normalizedNext };
          siUpdates[field] = normalizedNext;
        }
      }
    }

    checkSiField("tobaccoSupplier", existingSi?.tobaccoSupplier, tobaccoSupplier?.trim());
    checkSiField("tobaccoSupplierAddress", existingSi?.tobaccoSupplierAddress, resolvedSupplierAddress?.trim());
    checkSiField("consignee", existingSi?.consignee, consignee?.trim());
    checkSiField("consigneeAddress", existingSi?.consigneeAddress, consigneeAddress?.trim());
    checkSiField("cropYear", existingSi?.cropYear, cropYear?.trim());
    checkSiField("productType", existingSi?.productType, resolvedProductType?.trim());
    checkSiField("netWeight", existingSi?.netWeight, parsedNetWeight);
    checkSiField("grossWeight", existingSi?.grossWeight, parsedGrossWeight);
    checkSiField("quantity", existingSi?.quantity, parsedQuantity);
    checkSiField("polylined", existingSi?.polylined, parsedPolylined);
    checkSiField("gradeName", existingSi?.gradeName, gradeName?.trim());
    checkSiField("caseNos", existingSi?.caseNos, caseNos?.trim());
    checkSiField("countryOfOrigin", existingSi?.countryOfOrigin, countryOfOrigin?.trim());
    checkSiField("containerNo", existingSi?.containerNo, containerNo?.trim());
    checkSiField("sealNo", existingSi?.sealNo, sealNo?.trim());
    checkSiField("additionalInfo", existingSi?.additionalInfo, additionalInfo !== undefined ? (additionalInfo?.trim() || null) : undefined);

    // Run transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update Work Order if changed
      if (Object.keys(woUpdates).length > 0) {
        await tx.workOrder.update({
          where: { id: fcc.workOrderId },
          data: woUpdates,
        });
      }

      // 2. Update or Upsert Shipping Instructions
      if (Object.keys(siUpdates).length > 0) {
        await tx.shippingInstructions.upsert({
          where: { fccId: fcc.id },
          create: {
            fccId: fcc.id,
            ...siUpdates,
            lockedAt: fcc.certifiedAt || new Date(),
          },
          update: siUpdates,
        });
      }

      // 3. Update Signatures if provided
      if (signers && typeof signers === "object") {
        const roles: SignatureRole[] = [
          "supervising_fumigator",
          "supplier_rep",
          "certifying_officer",
        ];
        for (const r of roles) {
          if (signers[r] !== undefined) {
            const newName = String(signers[r]).trim();
            const existingSig = fcc.signatures.find((s) => s.role === r);
            if (existingSig) {
              if (existingSig.signerName !== newName) {
                changes[`signer_${r}`] = { from: existingSig.signerName, to: newName };
                await tx.signature.update({
                  where: { id: existingSig.id },
                  data: { signerName: newName },
                });
              }
            } else if (newName) {
              changes[`signer_${r}`] = { from: null, to: newName };
              await tx.signature.create({
                data: {
                  fccId: fcc.id,
                  role: r,
                  signerName: newName,
                },
              });
            }
          }
        }
      }

      // 4. Record Audit Log
      await tx.auditLog.create({
        data: {
          entityType: "FCC",
          entityId: fcc.id,
          action: "amend_certified_fcc",
          actorId: session.dbUser.id,
          diff: {
            certificateNumber: fcc.certificateNumber,
            workOrderCode: nextCode || fcc.workOrder.code,
            reason: trimmedReason,
            changesCount: Object.keys(changes).length,
            changes,
          },
        },
      });

      // 5. Fetch and return fresh state
      return tx.fCC.findUnique({
        where: { id: fcc.id },
        include: {
          workOrder: {
            include: {
              client: { select: { id: true, name: true, email: true } },
              createdBy: { select: { id: true, name: true, email: true } },
            },
          },
          shippingInstructions: true,
          signatures: true,
          closeout: true,
        },
      });
    });

    return NextResponse.json({
      success: true,
      certificateNumber: fcc.certificateNumber,
      reason: trimmedReason,
      changesCount: Object.keys(changes).length,
      changes,
      fcc: result,
    });
  } catch (error: any) {
    console.error("POST /api/fccs/[id]/amend error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to amend certified FCC" },
      { status: 500 }
    );
  }
}
