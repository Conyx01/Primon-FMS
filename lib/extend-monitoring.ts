import { Prisma, ReadingStatus } from "@prisma/client";
import { extensionSlotSpec, canCertifyGasReadings, REQUIRED_SUCCESSFUL_GAS_DAYS } from "@/lib/readings";

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

/**
 * After an edit, remove any pending extension slots beyond the standard
 * 6-day cycle when the cycle now satisfies `canCertifyGasReadings`.
 *
 * This cleans up orphaned Day 7+ pending slots that were auto-created by a
 * previous `createExtensionSlotIfNeeded` call but are now stale because the
 * user corrected the original critical reading that triggered the extension.
 */
export async function cleanupOrphanedExtensionSlots(
  tx: Prisma.TransactionClient,
  args: { fccId: string; actorId: string }
) {
  const all = await tx.gasReading.findMany({ where: { fccId: args.fccId } });

  // Only clean up if the cycle can now be certified
  if (!canCertifyGasReadings(all)) return 0;

  // Delete any pending slots beyond the standard 6-day window
  const orphans = all.filter(
    (r) => r.dayNumber > REQUIRED_SUCCESSFUL_GAS_DAYS && r.status === ReadingStatus.pending
  );
  if (orphans.length === 0) return 0;

  await tx.gasReading.deleteMany({
    where: {
      fccId: args.fccId,
      dayNumber: { gt: REQUIRED_SUCCESSFUL_GAS_DAYS },
      status: ReadingStatus.pending,
    },
  });

  for (const orphan of orphans) {
    await tx.auditLog.create({
      data: {
        entityType: "GasReading",
        entityId: orphan.id,
        action: "remove_orphaned_extension_slot",
        actorId: args.actorId,
        diff: {
          dayNumber: orphan.dayNumber,
          reason: "cycle_now_certifiable_after_edit",
        },
      },
    });
  }

  return orphans.length;
}
