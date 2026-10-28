import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { FccStatus, NotificationChannel, ReadingStatus, Role } from "@prisma/client";
import { deriveReadingStatus, day0BlocksGasReadings, readingIsPhase2 } from "@/lib/readings";
import { createExtensionSlotIfNeeded } from "@/lib/extend-monitoring";
import { emailCriticalReading } from "@/lib/notify-email";

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.dbUser.role === "client") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { readingId, airspacePpm, probeCasePpm, ambientTempC, productTempC, relativeHumidityPct } =
      body;

    if (!readingId) {
      return NextResponse.json({ error: "readingId is required" }, { status: 400 });
    }

    const existing = await prisma.gasReading.findUnique({
      where: { id: readingId },
      include: {
        fcc: { include: { workOrder: { select: { id: true, code: true } } } },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Reading not found" }, { status: 404 });
    }

    const siblingReadings = await prisma.gasReading.findMany({
      where: { fccId: existing.fccId },
      select: {
        dayNumber: true,
        status: true,
        ambientTempC: true,
        productTempC: true,
        readingDate: true,
      },
    });

    // ── Day 0: pre-fumigation temperature check only (no ppm required) ──────
    if (existing.dayNumber === 0) {
      const laterLogged = siblingReadings.some(
        (r) => r.dayNumber > 0 && r.status !== ReadingStatus.pending
      );
      if (laterLogged) {
        return NextResponse.json(
          {
            error:
              "Day 0 temperatures are locked after a Day 1–6 reading has been logged.",
          },
          { status: 409 }
        );
      }

      const ambTempNum =
        ambientTempC === "" || ambientTempC == null ? null : Number(ambientTempC);
      const prodTempNum =
        productTempC === "" || productTempC == null ? null : Number(productTempC);

      if (ambTempNum === null || prodTempNum === null) {
        return NextResponse.json(
          { error: "Ambient temperature and Product temperature are required for Day 0" },
          { status: 400 }
        );
      }

      const reading = await prisma.gasReading.update({
        where: { id: readingId },
        data: {
          ambientTempC: ambTempNum,
          productTempC: prodTempNum,
          status: ReadingStatus.compliant,
          enteredById: session.dbUser.id,
          enteredAt: new Date(),
        },
        include: {
          enteredBy: { select: { id: true, name: true, email: true } },
          correctiveAction: true,
        },
      });

      await prisma.auditLog.create({
        data: {
          entityType: "GasReading",
          entityId: reading.id,
          action: "record_day0_precheck",
          actorId: session.dbUser.id,
          diff: {
            dayNumber: 0,
            ambientTempC: ambTempNum,
            productTempC: prodTempNum,
            productTempMeetsMinimum: prodTempNum >= 16,
          },
        },
      });

      return NextResponse.json({ reading, fcc: existing.fcc }, { status: 200 });
    }

    // ── Days 1+: full gas reading with ppm ────────────────────────────────────
    const day0 = siblingReadings.find((r) => r.dayNumber === 0) ?? null;
    const day0Block = day0BlocksGasReadings(day0);
    if (day0Block) {
      return NextResponse.json({ error: day0Block }, { status: 409 });
    }

    const airspace = Number(airspacePpm);
    const probe = Number(probeCasePpm);
    if (!Number.isFinite(airspace) || !Number.isFinite(probe)) {
      return NextResponse.json(
        { error: "Airspace and Probe/Case must be numeric ppm values" },
        { status: 400 }
      );
    }

    const status = deriveReadingStatus(airspace, probe);

    // Determine if this reading is in Phase 2 (post-120h window).
    // Siblings NOT including the current row (it's still pending) are passed in.
    const siblingsExcludingCurrent = siblingReadings.filter(
      (r) => r.dayNumber !== existing.dayNumber
    );
    const phase2 = readingIsPhase2(siblingsExcludingCurrent, existing.dayNumber);

    const previousFccStatus = existing.fcc.status;

    const result = await prisma.$transaction(async (tx) => {
      const reading = await tx.gasReading.update({
        where: { id: readingId },
        data: {
          airspacePpm: airspace,
          probeCasePpm: probe,
          ambientTempC:
            ambientTempC === "" || ambientTempC == null ? null : Number(ambientTempC),
          productTempC:
            productTempC === "" || productTempC == null ? null : Number(productTempC),
          relativeHumidityPct:
            relativeHumidityPct === "" || relativeHumidityPct == null
              ? null
              : Number(relativeHumidityPct),
          status,
          enteredById: session.dbUser.id,
          enteredAt: new Date(),
        },
        include: {
          enteredBy: { select: { id: true, name: true, email: true } },
          correctiveAction: true,
        },
      });

      let fcc = existing.fcc;

      // Only flag the FCC as critical when:
      //   - Reading is critical (sub-600 ppm), AND
      //   - We are NOT in Phase 2 (post-120h dissipation is acceptable).
      if (status === ReadingStatus.critical && !phase2 && fcc.status !== FccStatus.flagged) {
        await tx.fCC.update({
          where: { id: fcc.id },
          data: { status: FccStatus.flagged },
        });
        fcc = { ...fcc, status: FccStatus.flagged };

        const recipients = await tx.user.findMany({
          where: { role: { in: [Role.ops_manager, Role.admin] } },
          select: { id: true },
        });
        if (recipients.length > 0) {
          await tx.notification.createMany({
            data: recipients.map((u) => ({
              userId: u.id,
              type: "critical_gas_reading",
              channel: NotificationChannel.in_app,
              payload: {
                fccId: fcc.id,
                workOrderId: fcc.workOrderId,
                readingId: reading.id,
                dayNumber: reading.dayNumber,
                airspacePpm: airspace,
                probeCasePpm: probe,
              },
            })),
          });
        }
      }

      await tx.auditLog.create({
        data: {
          entityType: "GasReading",
          entityId: reading.id,
          action: "record_gas_reading",
          actorId: session.dbUser.id,
          diff: {
            dayNumber: reading.dayNumber,
            airspacePpm: airspace,
            probeCasePpm: probe,
            status,
            phase2,
            previousFccStatus,
            fccStatus: fcc.status,
          },
        },
      });

      const extendedReading = await createExtensionSlotIfNeeded(tx, {
        fccId: existing.fccId,
        actorId: session.dbUser.id,
      });

      return { reading, fcc, extendedReading, phase2 };
    });

    // Only email alert for Phase 1 critical readings
    if (
      status === ReadingStatus.critical &&
      !phase2 &&
      previousFccStatus !== FccStatus.flagged
    ) {
      try {
        await emailCriticalReading({
          workOrderId: existing.fcc.workOrderId,
          workOrderCode: existing.fcc.workOrder.code,
          dayNumber: result.reading.dayNumber,
          airspacePpm: airspace,
          probeCasePpm: probe,
        });
      } catch (emailError) {
        console.error("critical reading email failed:", emailError);
      }
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    console.error("POST /api/readings error:", error);
    return NextResponse.json({ error: "Failed to save reading" }, { status: 500 });
  }
}
