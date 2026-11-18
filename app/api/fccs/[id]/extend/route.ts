import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { Role, ReadingStatus } from "@prisma/client";
import { canCertifyGasReadings } from "@/lib/successful-days";
import { buildReadingDates } from "@/lib/readings";

/**
 * POST /api/fccs/[id]/extend
 *
 * Manually appends the next pending reading slot to an FCC's monitoring window.
 * Used when all existing slots are filled (no pending) and the ops team wants to
 * continue monitoring beyond the initial 6-day cycle — e.g. Alliance One
 * requesting readings after a weekend-bridged cycle.
 *
 * Rules:
 *  - FCC must not be certified.
 *  - Only ops_manager or admin can extend.
 *  - There must be no existing pending slots (wait for them to be filled first).
 *  - The cycle must currently satisfy canCertifyGasReadings (i.e. it's already
 *    "done" but ops wants to continue). This prevents accidentally extending a
 *    cycle that is mid-progress.
 *  - A hard cap of 14 total reading days prevents runaway extension.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (
    session.dbUser.role !== Role.ops_manager &&
    session.dbUser.role !== Role.admin
  ) {
    return NextResponse.json(
      { error: "Forbidden: only Ops Manager or Admin can extend monitoring" },
      { status: 403 }
    );
  }

  const { id } = await params;

  try {
    const fcc = await prisma.fCC.findFirst({
      where: {
        OR: [{ id }, { workOrderId: id }, { workOrder: { code: id } }],
      },
      include: { gasReadings: true },
    });

    if (!fcc) {
      return NextResponse.json({ error: "FCC not found" }, { status: 404 });
    }
    if (fcc.status === "certified") {
      return NextResponse.json(
        { error: "Cannot extend a certified FCC" },
        { status: 409 }
      );
    }

    const gasReadings = fcc.gasReadings;
    const gasDays = gasReadings.filter((r) => r.dayNumber > 0);

    // Must have no pending slots first
    const hasPending = gasDays.some((r) => r.status === ReadingStatus.pending);
    if (hasPending) {
      return NextResponse.json(
        {
          error:
            "There is already a pending reading slot. Log it before extending further.",
        },
        { status: 409 }
      );
    }

    // Must be in a certifiable state to manually extend (otherwise use normal flow)
    if (!canCertifyGasReadings(gasReadings)) {
      return NextResponse.json(
        {
          error:
            "The cycle is not yet complete — the system will auto-extend as needed. Use this only after all slots are filled.",
        },
        { status: 409 }
      );
    }

    // Hard cap: max 14 reading days total
    const MAX_DAYS = 14;
    const maxExisting = Math.max(...gasDays.map((r) => r.dayNumber));
    if (maxExisting >= MAX_DAYS) {
      return NextResponse.json(
        { error: `Maximum of ${MAX_DAYS} monitoring days reached.` },
        { status: 409 }
      );
    }

    // Find the date of the last reading slot to place the new one the next calendar day
    const lastReading = gasDays.reduce(
      (latest, r) => {
        const d = new Date(r.readingDate);
        return !latest || d.getTime() > new Date(latest.readingDate).getTime()
          ? r
          : latest;
      },
      null as (typeof gasDays)[0] | null
    );

    if (!lastReading) {
      return NextResponse.json(
        { error: "No existing reading days found" },
        { status: 409 }
      );
    }

    const nextDayNumber = maxExisting + 1;
    const nextDate = buildReadingDates(new Date(lastReading.readingDate), 1)[0];

    const newSlot = await prisma.$transaction(async (tx) => {
      const slot = await tx.gasReading.create({
        data: {
          fccId: fcc.id,
          dayNumber: nextDayNumber,
          readingDate: nextDate,
          status: ReadingStatus.pending,
          enteredById: session.dbUser.id,
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: "GasReading",
          entityId: slot.id,
          action: "manual_extend_monitoring",
          actorId: session.dbUser.id,
          diff: {
            dayNumber: nextDayNumber,
            readingDate: nextDate.toISOString(),
            reason: "ops_manual_extension",
          },
        },
      });

      return slot;
    });

    return NextResponse.json(
      {
        reading: newSlot,
        dayNumber: nextDayNumber,
        message: `Day ${nextDayNumber} monitoring slot added.`,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("POST /api/fccs/[id]/extend error:", error);
    return NextResponse.json(
      { error: "Failed to extend monitoring window" },
      { status: 500 }
    );
  }
}
