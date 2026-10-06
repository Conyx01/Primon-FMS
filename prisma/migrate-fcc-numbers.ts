/**
 * One-time migration: update certificate numbers from the old format
 * FCC-YYYY-XXXXXX  →  FCC-PE-YYYY-XXXXXX
 *
 * Also updates the verificationUrl stored on each FCC record.
 *
 * Run with:
 *   pnpm exec ts-node --project tsconfig.json prisma/migrate-fcc-numbers.ts
 *
 * Safe to run multiple times — already-migrated certificates are skipped.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Derive the verification URL the same way lib/verify-url.ts does */
function buildVerificationUrl(certNumber: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.VERCEL_URL ??
    "https://fms.primonenterprises.com";
  return `${base}/verify/${encodeURIComponent(certNumber)}`;
}

/** Returns true if the number follows the OLD format FCC-YYYY-XXXXXX */
function isOldFormat(cert: string): boolean {
  return /^FCC-\d{4}-\d{6}$/.test(cert);
}

/** Converts FCC-YYYY-XXXXXX → FCC-PE-YYYY-XXXXXX */
function toNewFormat(cert: string): string {
  // e.g. "FCC-2026-000001" → "FCC-PE-2026-000001"
  return cert.replace(/^FCC-(\d{4}-)/, "FCC-PE-$1");
}

async function main() {
  const fccs = await prisma.fCC.findMany({
    where: { certificateNumber: { not: null } },
    select: { id: true, certificateNumber: true, verificationUrl: true },
  });

  const toMigrate = fccs.filter(
    (f) => f.certificateNumber && isOldFormat(f.certificateNumber)
  );

  if (toMigrate.length === 0) {
    console.log("✅ No certificates in old format — nothing to migrate.");
    return;
  }

  console.log(`Found ${toMigrate.length} certificate(s) to migrate:\n`);

  for (const fcc of toMigrate) {
    const oldNumber = fcc.certificateNumber!;
    const newNumber = toNewFormat(oldNumber);
    const newUrl = buildVerificationUrl(newNumber);

    await prisma.fCC.update({
      where: { id: fcc.id },
      data: {
        certificateNumber: newNumber,
        verificationUrl: newUrl,
        qrCodeUrl: newUrl,
      },
    });

    console.log(`  ${oldNumber}  →  ${newNumber}`);
    console.log(`  Verification URL: ${newUrl}\n`);
  }

  console.log(`✅ Migrated ${toMigrate.length} certificate(s) to FCC-PE-YYYY-XXXXXX format.`);
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
