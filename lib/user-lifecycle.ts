import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function userHasOperationalHistory(userId: string): Promise<boolean> {
  const [woClient, woCreated, certified, descriptions, stock, readings, actions, reviews, invited] =
    await Promise.all([
      prisma.workOrder.count({ where: { clientId: userId } }),
      prisma.workOrder.count({ where: { createdById: userId } }),
      prisma.fCC.count({ where: { certifiedById: userId } }),
      prisma.fumigationDescription.count({ where: { recordedById: userId } }),
      prisma.stockMovement.count({ where: { performedById: userId } }),
      prisma.gasReading.count({ where: { enteredById: userId } }),
      prisma.correctiveAction.count({ where: { loggedById: userId } }),
      prisma.pendingSubmission.count({ where: { reviewedById: userId } }),
      prisma.userInvite.count({ where: { createdById: userId, userId: { not: userId } } }),
    ]);

  return (
    woClient +
      woCreated +
      certified +
      descriptions +
      stock +
      readings +
      actions +
      reviews +
      invited >
    0
  );
}

export async function countActiveAdmins(excludeUserId?: string): Promise<number> {
  return prisma.user.count({
    where: {
      role: Role.admin,
      deactivatedAt: null,
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
  });
}
