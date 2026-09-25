import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { Role } from "@prisma/client";

function isAllowed(role: Role) {
  return role === Role.ops_manager || role === Role.admin;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAllowed(session.dbUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const client = await prisma.householdClient.findUnique({
      where: { id },
      include: { reminders: { orderBy: { dueDate: "desc" } } },
    });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }
    return NextResponse.json({ client });
  } catch (error: unknown) {
    console.error("GET /api/household/clients/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch household client" },
      { status: 500 }
    );
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
  if (!isAllowed(session.dbUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = (await req.json()) as Record<string, unknown>;

    const existing = await prisma.householdClient.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const client = await prisma.householdClient.update({
      where: { id },
      data: {
        ...(typeof body.name === "string" && body.name.trim()
          ? { name: body.name.trim() }
          : {}),
        ...(typeof body.contactEmail === "string" && body.contactEmail.trim()
          ? { contactEmail: body.contactEmail.trim() }
          : {}),
        ...(typeof body.contactPhone === "string"
          ? { contactPhone: body.contactPhone.trim() || null }
          : {}),
        ...(typeof body.address === "string"
          ? { address: body.address.trim() || null }
          : {}),
        ...("lastServiceDate" in body
          ? {
              lastServiceDate: body.lastServiceDate
                ? new Date(body.lastServiceDate as string)
                : null,
            }
          : {}),
      },
    });

    return NextResponse.json({ client });
  } catch (error: unknown) {
    console.error("PATCH /api/household/clients/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update household client" },
      { status: 500 }
    );
  }
}
