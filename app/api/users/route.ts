import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { issueInvite } from "@/lib/invite";
import { sendInviteEmail } from "@/lib/email";

const STAFF_CAN_LIST_CLIENTS = new Set<Role>([Role.admin, Role.ops_manager]);

function isRole(value: unknown): value is Role {
  return typeof value === "string" && (Object.values(Role) as string[]).includes(value);
}

export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roleFilter = req.nextUrl.searchParams.get("role");
  const actor = session.dbUser.role;

  if (actor === Role.admin) {
    const where = isRole(roleFilter) ? { role: roleFilter } : {};
    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        _count: { select: { clientWorkOrders: true } },
      },
    });
    return NextResponse.json({ users });
  }

  if (STAFF_CAN_LIST_CLIENTS.has(actor) && roleFilter === Role.client) {
    const users = await prisma.user.findMany({
      where: { role: Role.client },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true },
    });
    return NextResponse.json({ users });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    email?: string;
    role?: string;
  };
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const role: Role = isRole(body.role) ? body.role : Role.client;

  if (!name || !email || !email.includes("@")) {
    return NextResponse.json({ error: "Name and a valid email are required" }, { status: 400 });
  }

  const actor = session.dbUser.role;
  if (actor === Role.ops_manager && role !== Role.client) {
    return NextResponse.json(
      { error: "Ops can only invite client users" },
      { status: 403 }
    );
  }
  if (actor !== Role.admin && actor !== Role.ops_manager) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "A user with that email already exists" }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      emailVerified: false,
      role,
    },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  const invite = await issueInvite(user.id, session.dbUser.id);
  const mail = await sendInviteEmail({
    to: user.email,
    name: user.name,
    inviteUrl: invite.inviteUrl,
  });

  await prisma.auditLog.create({
    data: {
      entityType: "User",
      entityId: user.id,
      action: "invite_user",
      actorId: session.dbUser.id,
      diff: { email: user.email, role: user.role, emailSent: mail.sent },
    },
  });

  return NextResponse.json(
    {
      user,
      inviteUrl: invite.inviteUrl,
      expiresAt: invite.expiresAt,
      emailSent: mail.sent,
    },
    { status: 201 }
  );
}
