import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { NotificationChannel, PendingSubmissionSourceType, Role } from "@prisma/client";

const VALID_SOURCE_TYPES: PendingSubmissionSourceType[] = [
  PendingSubmissionSourceType.work_order,
  PendingSubmissionSourceType.rfq,
  PendingSubmissionSourceType.rfw,
];

export async function POST(req: NextRequest) {
  // Rate limit: stricter than internal APIs — 10 requests / 60 s per IP
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!rateLimit(`intake-website:${ip}`, 10, 60_000)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again later." },
      { status: 429 }
    );
  }

  // No API-key auth: the Primon website is static HTML/CSS with no server,
  // so a shared secret cannot be kept out of the browser. Rate limiting above
  // and the manual-review requirement (all submissions stay "pending" until an
  // Ops Manager converts or rejects them) are the mitigations.
  // If the site ever gains a backend, add Bearer-token auth here.

  try {
    const body = await req.json();
    const { sourceType, name, contact, cropOrService, message, idempotencyKey } =
      body as Record<string, unknown>;

    // --- Validation ---
    if (
      !sourceType ||
      !VALID_SOURCE_TYPES.includes(sourceType as PendingSubmissionSourceType)
    ) {
      return NextResponse.json(
        {
          error: `sourceType must be one of: ${VALID_SOURCE_TYPES.join(", ")}`,
        },
        { status: 400 }
      );
    }
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }
    if (!contact || typeof contact !== "string" || !contact.trim()) {
      return NextResponse.json(
        { error: "contact is required" },
        { status: 400 }
      );
    }
    if (
      !cropOrService ||
      typeof cropOrService !== "string" ||
      !cropOrService.trim()
    ) {
      return NextResponse.json(
        { error: "cropOrService is required" },
        { status: 400 }
      );
    }

    const idemKey =
      typeof idempotencyKey === "string" && idempotencyKey.trim()
        ? idempotencyKey.trim()
        : null;

    const normalizedPayload = {
      name: (name as string).trim(),
      contact: (contact as string).trim(),
      cropOrService: (cropOrService as string).trim(),
      message:
        typeof message === "string" ? (message as string).trim() : "",
      ...(idemKey ? { idempotencyKey: idemKey } : {}),
    };

    // --- Idempotency: if same key was submitted before, return existing row ---
    if (idemKey) {
      const existing = await prisma.pendingSubmission.findFirst({
        where: {
          payload: {
            path: ["idempotencyKey"],
            equals: idemKey,
          },
        },
      });
      if (existing) {
        return NextResponse.json(
          { submission: existing, duplicate: true },
          { status: 200 }
        );
      }
    }

    // --- Insert ---
    const submission = await prisma.pendingSubmission.create({
      data: {
        sourceType: sourceType as PendingSubmissionSourceType,
        payload: normalizedPayload,
        status: "pending",
      },
    });

    // --- Enqueue in-app notifications for Ops Manager + Admin ---
    try {
      const recipients = await prisma.user.findMany({
        where: { role: { in: [Role.ops_manager, Role.admin] } },
        select: { id: true },
      });
      if (recipients.length > 0) {
        await prisma.notification.createMany({
          data: recipients.map((u) => ({
            userId: u.id,
            type: "new_intake_submission",
            channel: NotificationChannel.in_app,
            payload: {
              submissionId: submission.id,
              sourceType,
              name: normalizedPayload.name,
            },
          })),
        });
      }
    } catch (notifyError) {
      console.error("intake notification enqueue failed:", notifyError);
    }

    return NextResponse.json({ submission }, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/intake/website error:", error);
    return NextResponse.json(
      { error: "Failed to process intake submission" },
      { status: 500 }
    );
  }
}
