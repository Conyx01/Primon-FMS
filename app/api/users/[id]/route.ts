import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { countActiveAdmins, userHasOperationalHistory } from "@/lib/user-lifecycle";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session || session.dbUser.role !== Role.admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (id === session.dbUser.id) {
    return NextResponse.json({ error: "You cannot deactivate your own account" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as { deactivated?: boolean };
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, deactivatedAt: true, name: true, email: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (body.deactivated === true) {
    if (user.role === Role.admin) {
      const remaining = await countActiveAdmins(id);
      if (remaining < 1) {
        return NextResponse.json(
          { error: "Cannot deactivate the last active Admin" },
          { status: 400 }
        );
      }
    }
    const updated = await prisma.user.update({
      where: { id },
      data: { deactivatedAt: new Date() },
      select: { id: true, name: true, email: true, role: true, deactivatedAt: true },
    });
    await prisma.session.deleteMany({ where: { userId: id } });
    await prisma.auditLog.create({
      data: {
        entityType: "User",
        entityId: id,
        action: "deactivate_user",
        actorId: session.dbUser.id,
        diff: { email: user.email },
      },
    });
    return NextResponse.json({ user: updated });
  }

  if (body.deactivated === false) {
    const updated = await prisma.user.update({
      where: { id },
      data: { deactivatedAt: null },
      select: { id: true, name: true, email: true, role: true, deactivatedAt: true },
    });
    await prisma.auditLog.create({
      data: {
        entityType: "User",
        entityId: id,
        action: "reactivate_user",
        actorId: session.dbUser.id,
        diff: { email: user.email },
      },
    });
    return NextResponse.json({ user: updated });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session || session.dbUser.role !== Role.admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (id === session.dbUser.id) {
    return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, email: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.role === Role.admin) {
    const remaining = await countActiveAdmins(id);
    if (remaining < 1) {
      return NextResponse.json({ error: "Cannot delete the last active Admin" }, { status: 400 });
    }
  }

  if (await userHasOperationalHistory(id)) {
    return NextResponse.json(
      {
        error:
          "This user is linked to work orders or monitoring history. Deactivate them instead of deleting.",
      },
      { status: 409 }
    );
  }

  try {
    await prisma.user.delete({ where: { id } });
  } catch {
    return NextResponse.json(
      {
        error:
          "This user is still linked to records and cannot be deleted. Deactivate them instead.",
      },
      { status: 409 }
    );
  }

  await prisma.auditLog.create({
    data: {
      entityType: "User",
      entityId: id,
      action: "delete_user",
      actorId: session.dbUser.id,
      diff: { email: user.email },
    },
  });

  return NextResponse.json({ ok: true });
}
