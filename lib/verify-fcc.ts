import { prisma } from "@/lib/prisma";
import { FccStatus } from "@prisma/client";
import { verificationUrl } from "@/lib/verify-url";

export type PublicVerifyPayload = {
  valid: true;
  certificateNumber: string;
  workOrderCode: string;
  clientName: string | null;
  cropType: string;
  datePlaced: string | null;
  certifiedAt: string | null;
  signers: {
    role: string;
    signerName: string;
    signedAt: string;
  }[];
  verificationUrl: string;
  issuer: string;
};

export async function loadCertifiedPublicSummary(
  certificateId: string
): Promise<PublicVerifyPayload | null> {
  const id = decodeURIComponent(certificateId).trim();
  const fcc = await prisma.fCC.findFirst({
    where: {
      status: FccStatus.certified,
      OR: [{ certificateNumber: id }, { id }],
    },
    include: {
      workOrder: {
        include: { client: { select: { name: true } } },
      },
      closeout: true,
      signatures: { orderBy: { signedAt: "asc" } },
    },
  });

  if (!fcc?.certificateNumber) return null;

  const url = fcc.verificationUrl || verificationUrl(fcc.certificateNumber);

  return {
    valid: true,
    certificateNumber: fcc.certificateNumber,
    workOrderCode: fcc.workOrder.code,
    clientName: fcc.workOrder.client?.name ?? null,
    cropType: fcc.workOrder.cropType,
    datePlaced: fcc.closeout?.datePlaced?.toISOString() ?? null,
    certifiedAt: fcc.certifiedAt?.toISOString() ?? null,
    signers: fcc.signatures.map((s) => ({
      role: s.role,
      signerName: s.signerName,
      signedAt: s.signedAt.toISOString(),
    })),
    verificationUrl: url,
    issuer: "Primon Enterprises Limited",
  };
}
