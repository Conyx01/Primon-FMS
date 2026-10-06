import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "@/lib/prisma";
import { findValidInvite } from "@/lib/invite";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const invite = await findValidInvite(decodeURIComponent(token));
  if (!invite) {
    return NextResponse.json(
      { error: "This invite link is invalid or has expired" },
      { status: 400 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { password?: string };
  const password = String(body.password ?? "");
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  const hashed = await hashPassword(password);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const existing = await tx.account.findFirst({
      where: { userId: invite.userId, providerId: "credential" },
    });
    if (existing) {
      await tx.account.update({
        where: { id: existing.id },
        data: { password: hashed, updatedAt: now },
      });
    } else {
      await tx.account.create({
        data: {
          accountId: invite.userId,
          providerId: "credential",
          userId: invite.userId,
          password: hashed,
          createdAt: now,
          updatedAt: now,
        },
      });
    }

    await tx.user.update({
      where: { id: invite.userId },
      data: { emailVerified: true },
    });

    await tx.userInvite.update({
      where: { id: invite.id },
      data: { usedAt: now },
    });
  });

  return NextResponse.json({ ok: true });
}
