import { Prisma, ReadingStatus } from "@prisma/client";
import { extensionSlotSpec } from "@/lib/readings";

export async function createExtensionSlotIfNeeded(
  tx: Prisma.TransactionClient,
  args: { fccId: string; actorId: string }
) {
  const all = await tx.gasReading.findMany({ where: { fccId: args.fccId } });
  const spec = extensionSlotSpec(all);
  if (!spec) return null;

  const extra = await tx.gasReading.create({
    data: {
      fccId: args.fccId,
      dayNumber: spec.dayNumber,
      readingDate: spec.readingDate,
      status: ReadingStatus.pending,
      enteredById: args.actorId,
    },
  });

  await tx.auditLog.create({
    data: {
      entityType: "GasReading",
      entityId: extra.id,
      action: "extend_monitoring_window",
      actorId: args.actorId,
      diff: {
        dayNumber: extra.dayNumber,
        readingDate: extra.readingDate.toISOString(),
        reason: "fewer_than_six_successful_days",
      },
    },
  });

  return extra;
}
