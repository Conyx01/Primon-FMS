import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { CropType, Scale, WorkOrderSource } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const status = searchParams.get("status");
  const cropType = searchParams.get("cropType");
  const scale = searchParams.get("scale");

  const where: any = {};

  // If user role is client, strictly scope to their work orders
  if (session.dbUser.role === "client") {
    where.clientId = session.dbUser.id;
  }

  if (q) {
    where.OR = [
      { code: { contains: q, mode: "insensitive" } },
      { salesOrderNo: { contains: q, mode: "insensitive" } },
      { shipmentNo: { contains: q, mode: "insensitive" } },
      { deliveryNo: { contains: q, mode: "insensitive" } },
      { client: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  if (cropType && cropType !== "all") {
    where.cropType = cropType as CropType;
  }

  if (scale && scale !== "all") {
    where.scale = scale as Scale;
  }

  if (status && status !== "all") {
    where.fcc = { status: status as any };
  }

  try {
    const workOrders = await prisma.workOrder.findMany({
      where,
      include: {
        client: {
          select: { id: true, name: true, email: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        fcc: {
          include: {
            gasReadings: true,
            closeout: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ workOrders });
  } catch (error: any) {
    console.error("GET /api/work-orders error:", error);
    return NextResponse.json({ error: "Failed to fetch work orders" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only staff can create work orders
  if (session.dbUser.role === "client") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      code: customCode,
      source: customSource,
      cropType = "tobacco",
      scale = "industrial",
      clientId,
      salesOrderNo,
      shipmentNo,
      deliveryNo,
    } = body;

    let finalCode = customCode?.trim();
    let source: WorkOrderSource = customSource ?? "auto_generated";

    if (!finalCode) {
      // Auto-generate code: WO-YYYY-#####
      const year = new Date().getFullYear();
      const prefix = `WO-${year}-`;

      const lastWo = await prisma.workOrder.findFirst({
        where: {
          code: { startsWith: prefix },
        },
        orderBy: { code: "desc" },
        select: { code: true },
      });

      let nextSeq = 1;
      if (lastWo?.code) {
        const parts = lastWo.code.split("-");
        const lastNum = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastNum)) {
          nextSeq = lastNum + 1;
        }
      }

      finalCode = `${prefix}${String(nextSeq).padStart(5, "0")}`;
      source = "auto_generated";
    } else {
      source = customSource ?? "client_supplied";
    }

    // Check code uniqueness
    const existing = await prisma.workOrder.findUnique({
      where: { code: finalCode },
    });
    if (existing) {
      return NextResponse.json(
        { error: `Work Order code "${finalCode}" already exists.` },
        { status: 409 }
      );
    }

    // Create WorkOrder & linked FCC draft
    const newWorkOrder = await prisma.workOrder.create({
      data: {
        code: finalCode,
        source,
        cropType: cropType as CropType,
        scale: scale as Scale,
        status: "draft",
        clientId: clientId || null,
        salesOrderNo: salesOrderNo?.trim() || null,
        shipmentNo: shipmentNo?.trim() || null,
        deliveryNo: deliveryNo?.trim() || null,
        createdById: session.dbUser.id,
        fcc: {
          create: {
            status: "draft",
          },
        },
      },
      include: {
        client: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        fcc: true,
      },
    });

    return NextResponse.json({ workOrder: newWorkOrder }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/work-orders error:", error);
    return NextResponse.json({ error: "Failed to create work order" }, { status: 500 });
  }
}
