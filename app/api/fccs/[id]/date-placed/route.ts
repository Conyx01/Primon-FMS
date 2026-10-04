import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { ReadingStatus } from "@prisma/client";
import { buildReadingDates } from "@/lib/readings";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.dbUser.role === "client") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const rawDate = body.datePlaced;
    const datePlaced = rawDate ? new Date(rawDate) : new Date();
    if (Number.isNaN(datePlaced.getTime())) {
      return NextResponse.json({ error: "Invalid datePlaced" }, { status: 400 });
    }

    const fcc = await prisma.fCC.findFirst({
      where: {
        OR: [{ id }, { workOrderId: id }, { workOrder: { code: id } }],
      },
      include: { closeout: true, gasReadings: true },
    });

    if (!fcc) {
      return NextResponse.json({ error: "FCC record not found" }, { status: 404 });
    }

    if (fcc.gasReadings.length > 0) {
      return NextResponse.json(
        { error: "Monitoring window already exists for this FCC" },
        { status: 409 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const closeout = await tx.fumigationCloseout.upsert({
        where: { fccId: fcc.id },
        create: { fccId: fcc.id, datePlaced },
        update: { datePlaced },
      });

      // Day 0 — pre-fumigation temperature check (placed on datePlaced itself)
      const day0 = await tx.gasReading.create({
        data: {
          fccId: fcc.id,
          dayNumber: 0,
          readingDate: datePlaced,
          status: ReadingStatus.pending,
          enteredById: session.dbUser.id,
        },
      });

      // Days 1-6 — gas monitoring, skipping Sundays (public holidays = manual Ops adjustment)
      const readingDates = buildReadingDates(datePlaced, 6);
      const readings = [];
      for (let i = 0; i < 6; i++) {
        const reading = await tx.gasReading.create({
          data: {
            fccId: fcc.id,
            dayNumber: i + 1,
            readingDate: readingDates[i],
            status: ReadingStatus.pending,
            enteredById: session.dbUser.id,
          },
        });
        readings.push(reading);
      }

      await tx.auditLog.create({
        data: {
          entityType: "FumigationCloseout",
          entityId: closeout.id,
          action: "record_date_fumigant_placed",
          actorId: session.dbUser.id,
          diff: {
            datePlaced: datePlaced.toISOString(),
            day0Date: day0.readingDate.toISOString(),
            readingDates: readings.map((r) => r.readingDate.toISOString()),
            weekendHolidayAssumption: "sundays_skipped",
          },
        },
      });

      return { closeout, day0, readings };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/fccs/[id]/date-placed error:", error);
    return NextResponse.json(
      { error: "Failed to record date fumigant placed" },
      { status: 500 }
    );
  }
}
