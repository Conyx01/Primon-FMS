import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { FccStatus, NotificationChannel, ReadingStatus, Role, SignatureRole } from "@prisma/client";
import { verificationUrl } from "@/lib/verify-url";

const REQUIRED_ROLES: SignatureRole[] = [
  SignatureRole.supervising_fumigator,
  SignatureRole.supplier_rep,
  SignatureRole.certifying_officer,
];

function parseSignerName(body: Record<string, unknown>, role: SignatureRole): string | null {
  const list = Array.isArray(body.signatures) ? body.signatures : [];
  const fromList = list.find((s) => s && typeof s === "object" && (s as { role?: string }).role === role);
  const nameFromList =
    fromList && typeof fromList === "object"
      ? String((fromList as { signerName?: string }).signerName ?? "").trim()
      : "";
  if (nameFromList) return nameFromList;
  const keyed = body[role];
  if (typeof keyed === "string" && keyed.trim()) return keyed.trim();
  return null;
}

async function nextCertificateNumber(year: number): Promise<string> {
  const prefix = `FCC-${year}-`;
  const last = await prisma.fCC.findFirst({
    where: { certificateNumber: { startsWith: prefix } },
    orderBy: { certificateNumber: "desc" },
    select: { certificateNumber: true },
  });
  let next = 1;
  if (last?.certificateNumber) {
    const n = parseInt(last.certificateNumber.slice(prefix.length), 10);
    if (!Number.isNaN(n)) next = n + 1;
  }
  return `${prefix}${String(next).padStart(6, "0")}`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.dbUser.role !== Role.ops_manager && session.dbUser.role !== Role.admin) {
    return NextResponse.json(
      { error: "Forbidden: only Ops Manager or Admin can certify" },
      { status: 403 }
    );
  }

  const { id } = await params;

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const signers = REQUIRED_ROLES.map((role) => ({
      role,
      signerName: parseSignerName(body, role),
    }));
    if (signers.some((s) => !s.signerName)) {
      return NextResponse.json(
        {
          error:
            "All three signers are required: Supervising Fumigator, For the Supplier, Certifying Officer",
        },
        { status: 400 }
      );
    }

    const fcc = await prisma.fCC.findFirst({
      where: {
        OR: [{ id }, { workOrderId: id }, { workOrder: { code: id } }],
      },
      include: {
        gasReadings: true,
        closeout: true,
        shippingInstructions: true,
        workOrder: true,
      },
    });

    if (!fcc) {
      return NextResponse.json({ error: "FCC record not found" }, { status: 404 });
    }
    if (fcc.status === FccStatus.certified) {
      return NextResponse.json({ error: "This FCC is already certified" }, { status: 409 });
    }

    const readings = fcc.gasReadings;
    const allResolved =
      readings.length === 6 &&
      readings.every(
        (r) => r.status === ReadingStatus.compliant || r.status === ReadingStatus.action_taken
      );
    if (!allResolved) {
      return NextResponse.json(
        { error: "All six days must be compliant or action_taken before certification" },
        { status: 409 }
      );
    }
    if (readings.some((r) => r.status === ReadingStatus.critical)) {
      return NextResponse.json(
        { error: "Unresolved critical readings block certification" },
        { status: 409 }
      );
    }
    if (!fcc.closeout?.aerationBegan || !fcc.closeout?.aerationCompleted) {
      return NextResponse.json(
        { error: "Record aeration began and completed before certification" },
        { status: 409 }
      );
    }

    const year = new Date().getFullYear();
    const certificateNumber = fcc.certificateNumber ?? (await nextCertificateNumber(year));
    const verifyUrl = verificationUrl(certificateNumber);
    const signedAt = new Date();

    const certified = await prisma.$transaction(async (tx) => {
      await tx.signature.deleteMany({
        where: { fccId: fcc.id, role: { in: REQUIRED_ROLES } },
      });
      await tx.signature.createMany({
        data: signers.map((s) => ({
          fccId: fcc.id,
          role: s.role,
          signerName: s.signerName!,
          signedAt,
        })),
      });

      if (fcc.shippingInstructions) {
        await tx.shippingInstructions.update({
          where: { id: fcc.shippingInstructions.id },
          data: { lockedAt: signedAt },
        });
      }

      const updated = await tx.fCC.update({
        where: { id: fcc.id },
        data: {
          status: FccStatus.certified,
          certificateNumber,
          certifiedAt: signedAt,
          certifiedById: session.dbUser.id,
          verificationUrl: verifyUrl,
          qrCodeUrl: verifyUrl,
        },
        include: {
          signatures: true,
          workOrder: { include: { client: { select: { id: true, name: true } } } },
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: "FCC",
          entityId: fcc.id,
          action: "certify",
          actorId: session.dbUser.id,
          diff: {
            certificateNumber,
            verificationUrl: verifyUrl,
            previousStatus: fcc.status,
            signers,
          },
        },
      });

      return updated;
    });

    try {
      const recipients = await prisma.user.findMany({
        where: {
          OR: [
            { role: { in: [Role.ops_manager, Role.admin] } },
            ...(fcc.workOrder.clientId ? [{ id: fcc.workOrder.clientId }] : []),
          ],
        },
        select: { id: true },
      });
      const unique = [...new Set(recipients.map((r) => r.id))];
      if (unique.length > 0) {
        await prisma.notification.createMany({
          data: unique.map((userId) => ({
            userId,
            type: "fcc_certified",
            channel: NotificationChannel.in_app,
            payload: {
              fccId: fcc.id,
              certificateNumber,
              verificationUrl: verifyUrl,
            },
          })),
        });
      }
    } catch (notifyError) {
      console.error("certify notification enqueue failed:", notifyError);
    }

    return NextResponse.json({ fcc: certified }, { status: 200 });
  } catch (error: unknown) {
    console.error("POST /api/fccs/[id]/certify error:", error);
    return NextResponse.json({ error: "Failed to certify FCC" }, { status: 500 });
  }
}
