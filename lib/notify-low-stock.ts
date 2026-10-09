import { NotificationChannel, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { emailLowStock } from "@/lib/notify-email";

export async function notifyLowStockIfCrossed(args: {
  previousQty: number;
  newQty: number;
  threshold: number;
  formulationName: string;
  formulationId: string;
}) {
  const crossed =
    (args.previousQty > args.threshold && args.newQty <= args.threshold) ||
    (args.previousQty > 0 && args.newQty === 0);
  if (!crossed) return;

  const admins = await prisma.user.findMany({
    where: { role: Role.admin },
    select: { id: true },
  });
  if (admins.length === 0) return;

  await prisma.notification.createMany({
    data: admins.map((u) => ({
      userId: u.id,
      type: "low_stock",
      channel: NotificationChannel.in_app,
      payload: {
        formulationId: args.formulationId,
        formulationName: args.formulationName,
        quantityOnHand: args.newQty,
        threshold: args.threshold,
      },
    })),
  });

  try {
    await emailLowStock({
      formulationName: args.formulationName,
      quantityOnHand: args.newQty,
      threshold: args.threshold,
    });
  } catch (emailError) {
    console.error("low stock email failed:", emailError);
  }
}
