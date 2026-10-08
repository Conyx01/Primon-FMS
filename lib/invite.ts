import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { getPublicOrigin } from "@/lib/verify-url";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function inviteUrl(token: string): string {
  return `${getPublicOrigin()}/invite/${encodeURIComponent(token)}`;
}

export async function issueInvite(userId: string, createdById: string) {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashInviteToken(token);
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  await prisma.userInvite.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  await prisma.userInvite.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      createdById,
    },
  });

  return { token, expiresAt, inviteUrl: inviteUrl(token) };
}

export async function findValidInvite(token: string) {
  const tokenHash = hashInviteToken(token);
  const invite = await prisma.userInvite.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, name: true, email: true, role: true, deactivatedAt: true } } },
  });
  if (!invite || invite.usedAt) return null;
  if (invite.user.deactivatedAt) return null;
  if (invite.expiresAt.getTime() < Date.now()) return null;
  return invite;
}
