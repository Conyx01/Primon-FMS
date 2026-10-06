import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { issueInvite } from "@/lib/invite";
import { sendInviteEmail } from "@/lib/email";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session || session.dbUser.role !== Role.admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

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
      action: "reissue_invite",
      actorId: session.dbUser.id,
      diff: { email: user.email, emailSent: mail.sent },
    },
  });

  return NextResponse.json({
    user,
    inviteUrl: invite.inviteUrl,
    expiresAt: invite.expiresAt,
    emailSent: mail.sent,
  });
}
