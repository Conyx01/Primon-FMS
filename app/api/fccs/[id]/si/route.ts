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

  const { id } = await params;

  try {
    const fcc = await prisma.fCC.findFirst({
      where: {
        OR: [
          { id },
          { workOrderId: id },
          { workOrder: { code: id } },
        ],
      },
      include: {
        workOrder: true,
        shippingInstructions: true,
      },
    });

    if (!fcc) {
      return NextResponse.json({ error: "FCC record not found" }, { status: 404 });
    }

    // Role check: Client (own FCC), Ops Manager, Admin
    const isClient = session.dbUser.role === "client";
    const isStaffAuthorized =
      session.dbUser.role === "ops_manager" || session.dbUser.role === "admin";

    if (isClient) {
      if (fcc.workOrder.clientId !== session.dbUser.id) {
        return NextResponse.json({ error: "Forbidden: Not your FCC record" }, { status: 403 });
      }
    } else if (!isStaffAuthorized) {
      return NextResponse.json({ error: "Forbidden: Superivsors cannot edit SI" }, { status: 403 });
    }

    // Check if SI locked
    if (fcc.shippingInstructions?.lockedAt) {
      return NextResponse.json(
        { error: "Shipping instructions are locked post-certification and cannot be modified" },
        { status: 409 }
      );
    }

    const body = await req.json();
    const {
      tobaccoSupplier,
      tobaccoSupplierAddress,
      supplierAddress,
      consignee,
      consigneeAddress,
      fumigationContractor = "Primon Enterprises Limited",
      cropYear,
      tobaccoType,
      netWeight,
      quantity,
      polylined,
      gradeName,
      caseNos,
      countryOfOrigin = "Malawi",
      location,
      warehouseSection,
    } = body;

    const parsedNetWeight =
      typeof netWeight === "number"
        ? netWeight
        : parseFloat(String(netWeight).replace(/[^0-9.]/g, "")) || null;

    const parsedQuantity =
      typeof quantity === "number"
        ? quantity
        : parseInt(String(quantity).replace(/[^0-9]/g, ""), 10) || null;

    const parsedPolylined =
      typeof polylined === "boolean"
        ? polylined
        : String(polylined).toLowerCase() === "yes" || String(polylined).toLowerCase() === "true";

    const updateData = {
      ...(tobaccoSupplier !== undefined && { tobaccoSupplier: tobaccoSupplier?.trim() || null }),
      ...((tobaccoSupplierAddress !== undefined || supplierAddress !== undefined) && {
        tobaccoSupplierAddress: (tobaccoSupplierAddress || supplierAddress)?.trim() || null,
      }),
      ...(consignee !== undefined && { consignee: consignee?.trim() || null }),
      ...(consigneeAddress !== undefined && { consigneeAddress: consigneeAddress?.trim() || null }),
      ...(fumigationContractor !== undefined && {
        fumigationContractor: fumigationContractor?.trim() || "Primon Enterprises Limited",
      }),
      ...(cropYear !== undefined && { cropYear: cropYear?.trim() || null }),
      ...(tobaccoType !== undefined && { tobaccoType: tobaccoType?.trim() || null }),
      ...(netWeight !== undefined && { netWeight: parsedNetWeight }),
      ...(quantity !== undefined && { quantity: parsedQuantity }),
      ...(polylined !== undefined && { polylined: parsedPolylined }),
      ...(gradeName !== undefined && { gradeName: gradeName?.trim() || null }),
      ...(caseNos !== undefined && { caseNos: caseNos?.trim() || null }),
      ...(countryOfOrigin !== undefined && { countryOfOrigin: countryOfOrigin?.trim() || "Malawi" }),
      ...(location !== undefined && { location: location?.trim() || null }),
      ...(warehouseSection !== undefined && { warehouseSection: warehouseSection?.trim() || null }),
    };

    const si = await prisma.shippingInstructions.upsert({
      where: { fccId: fcc.id },
      update: updateData,
      create: {
        fccId: fcc.id,
        fumigationContractor: "Primon Enterprises Limited",
        countryOfOrigin: "Malawi",
        ...updateData,
      },
    });

    await prisma.auditLog.create({
      data: {
        entityType: "ShippingInstructions",
        entityId: si.id,
        action: "update_shipping_instructions",
        actorId: session.dbUser.id,
        diff: updateData,
      },
    });

    return NextResponse.json({ shippingInstructions: si }, { status: 200 });
  } catch (error: any) {
    console.error("PATCH /api/fccs/[id]/si error:", error);
    return NextResponse.json({ error: "Failed to update shipping instructions" }, { status: 500 });
  }
}
