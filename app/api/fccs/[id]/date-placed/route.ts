import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { ReadingStatus } from "@prisma/client";
import { addCalendarDays } from "@/lib/readings";

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

      const readings = [];
      for (let dayNumber = 1; dayNumber <= 6; dayNumber++) {
        const reading = await tx.gasReading.create({
          data: {
            fccId: fcc.id,
            dayNumber,
            readingDate: addCalendarDays(datePlaced, dayNumber - 1),
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
            readingDates: readings.map((r) => r.readingDate.toISOString()),
            weekendHolidayAssumption: "consecutive_calendar_days",
          },
        },
      });

      return { closeout, readings };
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
