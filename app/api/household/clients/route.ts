import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { Role } from "@prisma/client";

function isAllowed(role: Role) {
  return role === Role.ops_manager || role === Role.admin;
}

export async function GET(_req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAllowed(session.dbUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const clients = await prisma.householdClient.findMany({
      orderBy: { name: "asc" },
      include: { reminders: { orderBy: { dueDate: "desc" }, take: 1 } },
    });
    return NextResponse.json({ clients });
  } catch (error: unknown) {
    console.error("GET /api/household/clients error:", error);
    return NextResponse.json(
      { error: "Failed to fetch household clients" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAllowed(session.dbUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { name, contactEmail, contactPhone, address, lastServiceDate } = body as Record<
      string,
      unknown
    >;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (
      !contactEmail ||
      typeof contactEmail !== "string" ||
      !contactEmail.trim()
    ) {
      return NextResponse.json(
        { error: "contactEmail is required" },
        { status: 400 }
      );
    }

    const client = await prisma.householdClient.create({
      data: {
        name: (name as string).trim(),
        contactEmail: (contactEmail as string).trim(),
        contactPhone:
          typeof contactPhone === "string" ? contactPhone.trim() || null : null,
        address:
          typeof address === "string" ? address.trim() || null : null,
        lastServiceDate: lastServiceDate ? new Date(lastServiceDate as string) : null,
      },
    });

    return NextResponse.json({ client }, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/household/clients error:", error);
    return NextResponse.json(
      { error: "Failed to create household client" },
      { status: 500 }
    );
  }
}
