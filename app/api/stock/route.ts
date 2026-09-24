import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";

export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const stockLevels = await prisma.stockLevel.findMany({
      include: {
        formulation: {
          include: {
            fumigant: true,
          },
        },
      },
      orderBy: {
        formulation: {
          name: "asc",
        },
      },
    });

    const movements = await prisma.stockMovement.findMany({
      take: 30,
      orderBy: { performedAt: "desc" },
      include: {
        formulation: {
          include: { fumigant: true },
        },
        performedBy: {
          select: { id: true, name: true, email: true },
        },
        workOrder: {
          select: { id: true, code: true },
        },
      },
    });

    return NextResponse.json({ stockLevels, movements });
  } catch (error: any) {
    console.error("GET /api/stock error:", error);
    return NextResponse.json({ error: "Failed to fetch stock levels" }, { status: 500 });
  }
}
