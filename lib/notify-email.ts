import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendTransactionalEmail } from "@/lib/email";
import { getPublicOrigin } from "@/lib/verify-url";

type MailUser = { id: string; name: string; email: string; role: Role };

async function findActiveUsers(args: {
  roles?: Role[];
  extraIds?: string[];
}): Promise<MailUser[]> {
  const roles = args.roles ?? [];
  const extraIds = (args.extraIds ?? []).filter(Boolean);
  if (roles.length === 0 && extraIds.length === 0) return [];

  const users = await prisma.user.findMany({
    where: {
      deactivatedAt: null,
      OR: [
        ...(roles.length > 0 ? [{ role: { in: roles } }] : []),
        ...(extraIds.length > 0 ? [{ id: { in: extraIds } }] : []),
      ],
    },
    select: { id: true, name: true, email: true, role: true },
  });

  const seen = new Set<string>();
  return users.filter((u) => {
    if (!u.email || seen.has(u.email.toLowerCase())) return false;
    seen.add(u.email.toLowerCase());
    return true;
  });
}

async function sendToEach(
  users: MailUser[],
  build: (user: MailUser) => {
    subject: string;
    heading: string;
    body: string;
    ctaLabel: string;
    ctaUrl: string;
  }
) {
  for (const user of users) {
    try {
      const copy = build(user);
      await sendTransactionalEmail({
        to: user.email,
        name: user.name,
        ...copy,
      });
    } catch (error: unknown) {
      console.error("Operational email send failed:", error);
    }
  }
}

export async function emailCriticalReading(args: {
  workOrderId: string;
  workOrderCode: string;
  dayNumber: number;
  airspacePpm: number;
  probeCasePpm: number;
}) {
  const users = await findActiveUsers({
    roles: [Role.ops_manager, Role.admin],
  });
  const origin = getPublicOrigin();
  const ctaUrl = `${origin}/dashboard/monitor/${args.workOrderId}`;
  await sendToEach(users, () => ({
    subject: `Critical gas reading — ${args.workOrderCode}`,
    heading: "Critical gas reading",
    body: [
      `A gas reading on ${args.workOrderCode} is below the 600 ppm threshold.`,
      `Day ${args.dayNumber}: airspace ${args.airspacePpm} ppm, probe/case ${args.probeCasePpm} ppm.`,
      "Open the monitor to review the flagged FCC and log a corrective action.",
    ].join("\n"),
    ctaLabel: "Open gas-reading monitor",
    ctaUrl,
  }));
}

export async function emailFccCertified(args: {
  certificateNumber: string;
  verificationUrl: string;
  workOrderCode: string;
  clientId: string | null;
}) {
  const users = await findActiveUsers({
    roles: [Role.ops_manager],
    extraIds: args.clientId ? [args.clientId] : [],
  });
  await sendToEach(users, (user) => {
    const isClient = user.role === Role.client;
    return {
      subject: `${args.certificateNumber} is certified`,
      heading: "Certificate certified",
      body: isClient
        ? [
            `Fumigation certificate ${args.certificateNumber} for ${args.workOrderCode} has been certified.`,
            "You can verify the certificate and download the PDF from the public link or your client portal.",
          ].join("\n")
        : [
            `${args.certificateNumber} (${args.workOrderCode}) has been certified.`,
            "Shipping instructions are now locked. The client has been notified with the verification link.",
          ].join("\n"),
      ctaLabel: isClient ? "View certificate" : "Open verification page",
      ctaUrl: args.verificationUrl,
    };
  });
}

export async function emailNewIntake(args: {
  submissionName: string;
  sourceType: string;
  contact: string;
}) {
  const users = await findActiveUsers({
    roles: [Role.ops_manager, Role.admin],
  });
  const origin = getPublicOrigin();
  const sourceLabel = args.sourceType.replace(/_/g, " ");
  await sendToEach(users, () => ({
    subject: `New website submission — ${args.submissionName}`,
    heading: "New website submission",
    body: [
      `A ${sourceLabel} submission from ${args.submissionName} is waiting for review.`,
      args.contact ? `Contact: ${args.contact}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    ctaLabel: "Open website intake",
    ctaUrl: `${origin}/dashboard/intake`,
  }));
}

export async function emailLowStock(args: {
  formulationName: string;
  quantityOnHand: number;
  threshold: number;
}) {
  const users = await findActiveUsers({ roles: [Role.admin] });
  const origin = getPublicOrigin();
  const atZero = args.quantityOnHand === 0;
  await sendToEach(users, () => ({
    subject: `${atZero ? "Zero" : "Low"} stock — ${args.formulationName}`,
    heading: atZero ? "Stock is at zero" : "Stock is below threshold",
    body: [
      `${args.formulationName} is now at ${args.quantityOnHand} (threshold ${args.threshold}).`,
      "Review inventory and record an adjustment if stock has been replenished.",
    ].join("\n"),
    ctaLabel: "Open fumigant stock",
    ctaUrl: `${origin}/dashboard/inventory`,
  }));
}
