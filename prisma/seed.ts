import { config } from 'dotenv'
import { resolve } from 'path'

// Load .env.local before Prisma client initialises (tsx does not auto-load it)
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') }) // fallback

import { PrismaClient, CropType, Role, WorkOrderSource, Scale, FccStatus, FumigationType, ReadingStatus, SignatureRole } from '@prisma/client'
import { hashPassword } from 'better-auth/crypto'

const prisma = new PrismaClient()

// Default dev passwords — change these before any staging/production seed
const DEFAULT_PASSWORD = 'Primon@2026!'
const ADMIN_PASSWORD = 'Admin@Primon2026!'

async function main() {
  console.log('🌱 Starting Primon FMS database seeding...')

  // ─────────────────────────────────────────────
  // 1. Seed Reference Users (with better-auth Account records)
  // ─────────────────────────────────────────────

  const usersToSeed = [
    {
      id: 'seed-user-admin',
      name: 'System Admin',
      email: 'admin@primon.mw',
      role: Role.admin,
      password: ADMIN_PASSWORD,
    },
    {
      id: 'seed-user-ops',
      name: 'Grace Phiri',
      email: 'grace.phiri@primon.mw',
      role: Role.ops_manager,
      password: DEFAULT_PASSWORD,
    },
    {
      id: 'seed-user-supervisor',
      name: 'John Banda',
      email: 'john.banda@primon.mw',
      role: Role.supervisor,
      password: DEFAULT_PASSWORD,
    },
    {
      id: 'seed-user-client',
      name: 'Alliance One Tobacco Malawi',
      email: 'shipping@allianceone.mw',
      role: Role.client,
      password: DEFAULT_PASSWORD,
    },
  ]

  for (const u of usersToSeed) {
    const now = new Date()
    const hashedPw = await hashPassword(u.password)

    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, updatedAt: now },
      create: {
        id: u.id,
        name: u.name,
        email: u.email,
        emailVerified: true,
        role: u.role,
        createdAt: now,
        updatedAt: now,
      },
    })

    const existingAccount = await prisma.account.findFirst({
      where: { userId: user.id, providerId: 'credential' },
    })

    if (existingAccount) {
      await prisma.account.update({
        where: { id: existingAccount.id },
        data: {
          accountId: user.id,
          password: hashedPw,
          updatedAt: now,
        },
      })
    } else {
      await prisma.account.create({
        data: {
          accountId: user.id,
          providerId: 'credential',
          userId: user.id,
          password: hashedPw,
          createdAt: now,
          updatedAt: now,
        },
      })
    }

    console.log(`  ✔ ${u.role}: ${u.email}`)
  }

  console.log('✅ Seeded users with better-auth credential accounts')

  const opsManager = await prisma.user.findUniqueOrThrow({ where: { email: 'grace.phiri@primon.mw' } })
  const supervisor = await prisma.user.findUniqueOrThrow({ where: { email: 'john.banda@primon.mw' } })
  const clientUser = await prisma.user.findUniqueOrThrow({ where: { email: 'shipping@allianceone.mw' } })

  // ─────────────────────────────────────────────
  // 2. Seed Fumigants & Formulations
  // ─────────────────────────────────────────────

  const aluminiumPhosphide = await prisma.fumigant.upsert({
    where: { name: 'aluminium_phosphide' },
    update: {},
    create: { name: 'aluminium_phosphide' },
  })

  const magnesiumPhosphide = await prisma.fumigant.upsert({
    where: { name: 'magnesium_phosphide' },
    update: {},
    create: { name: 'magnesium_phosphide' },
  })

  const sachet11g = await prisma.formulation.upsert({
    where: { id: 'formulation-sachet-11g' },
    update: {},
    create: {
      id: 'formulation-sachet-11g',
      fumigantId: aluminiumPhosphide.id,
      cropType: CropType.tobacco,
      name: 'sachet_11g',
      unit: 'g',
    },
  })

  const tablet1g = await prisma.formulation.upsert({
    where: { id: 'formulation-tablet-1g' },
    update: {},
    create: {
      id: 'formulation-tablet-1g',
      fumigantId: aluminiumPhosphide.id,
      cropType: CropType.both,
      name: 'tablet_1g',
      unit: 'g',
    },
  })

  const plate33g = await prisma.formulation.upsert({
    where: { id: 'formulation-plate-33g' },
    update: {},
    create: {
      id: 'formulation-plate-33g',
      fumigantId: magnesiumPhosphide.id,
      cropType: CropType.both,
      name: 'plate_33g',
      unit: 'g',
    },
  })

  console.log('✅ Seeded fumigants and formulations')

  // ─────────────────────────────────────────────
  // 3. Seed Stock Levels
  // ─────────────────────────────────────────────

  await prisma.stockLevel.upsert({
    where: { formulationId: sachet11g.id },
    update: {},
    create: { formulationId: sachet11g.id, quantityOnHand: 5000, lowStockThreshold: 500 },
  })

  await prisma.stockLevel.upsert({
    where: { formulationId: tablet1g.id },
    update: {},
    create: { formulationId: tablet1g.id, quantityOnHand: 12000, lowStockThreshold: 1000 },
  })

  await prisma.stockLevel.upsert({
    where: { formulationId: plate33g.id },
    update: {},
    create: { formulationId: plate33g.id, quantityOnHand: 2500, lowStockThreshold: 300 },
  })

  console.log('✅ Seeded stock levels')

  // ─────────────────────────────────────────────
  // 4. Seed Dev Sample Work Order + FCC (Alliance One)
  // ─────────────────────────────────────────────

  const workOrder = await prisma.workOrder.upsert({
    where: { code: 'WO-2026-000512' },
    update: {},
    create: {
      code: 'WO-2026-000512',
      source: WorkOrderSource.client_supplied,
      cropType: CropType.tobacco,
      scale: Scale.industrial,
      status: 'in_progress',
      clientId: clientUser.id,
      salesOrderNo: 'SO-99214',
      shipmentNo: 'SH-44810',
      deliveryNo: 'DN-10294',
      createdById: opsManager.id,
    },
  })

  const fcc = await prisma.fCC.upsert({
    where: { workOrderId: workOrder.id },
    update: {},
    create: {
      workOrderId: workOrder.id,
      certificateNumber: 'FCC-2026-000512',
      status: FccStatus.in_progress,
      shippingInstructions: {
        create: {
          tobaccoSupplier: 'Alliance One Tobacco (Malawi) Ltd',
          tobaccoSupplierAddress: 'P.O. Box 505, Kanengo, Lilongwe',
          consignee: 'Universal Leaf Tobacco Company',
          consigneeAddress: 'Richmond, Virginia, USA',
          fumigationContractor: 'Primon Enterprises Limited',
          cropYear: '2026',
          tobaccoType: 'Flue-Cured Virginia',
          netWeight: 19800.5,
          quantity: 90,
          polylined: true,
          gradeName: 'FCV-B1',
          caseNos: 'C001-C090',
          countryOfOrigin: 'Malawi',
          location: 'Kanengo Industrial Area',
          warehouseSection: 'Bay 4B',
        },
      },
      fumigationDescription: {
        create: {
          fumigationType: FumigationType.sheeted_stack,
          fumigantId: aluminiumPhosphide.id,
          formulationId: sachet11g.id,
          doseGm3: 1.5,
          totalVolumeM3: 400.0,
          totalFumigantUsedG: 600.0,
          recordedById: opsManager.id,
        },
      },
      closeout: {
        create: {
          datePlaced: new Date('2026-09-01T08:00:00Z'),
        },
      },
      signatures: {
        createMany: {
          data: [
            {
              role: SignatureRole.supervising_fumigator,
              signerName: supervisor.name,
              signedAt: new Date('2026-09-01T08:30:00Z'),
            },
          ],
        },
      },
    },
  })

  // 6-day gas readings (idempotent — skip if already present)
  const existingReadings = await prisma.gasReading.count({ where: { fccId: fcc.id } })
  if (existingReadings === 0) {
    const sampleReadings = [
      { dayNumber: 1, airspacePpm: 950, probeCasePpm: 910, status: ReadingStatus.compliant },
      { dayNumber: 2, airspacePpm: 880, probeCasePpm: 860, status: ReadingStatus.compliant },
      { dayNumber: 3, airspacePpm: 810, probeCasePpm: 790, status: ReadingStatus.compliant },
      { dayNumber: 4, airspacePpm: 750, probeCasePpm: 720, status: ReadingStatus.compliant },
      { dayNumber: 5, airspacePpm: 680, probeCasePpm: 660, status: ReadingStatus.compliant },
      { dayNumber: 6, airspacePpm: 630, probeCasePpm: 610, status: ReadingStatus.compliant },
    ]

    for (const reading of sampleReadings) {
      const readingDate = new Date('2026-09-01T08:00:00Z')
      readingDate.setDate(readingDate.getDate() + (reading.dayNumber - 1))

      await prisma.gasReading.create({
        data: {
          fccId: fcc.id,
          dayNumber: reading.dayNumber,
          readingDate,
          airspacePpm: reading.airspacePpm,
          probeCasePpm: reading.probeCasePpm,
          status: reading.status,
          enteredById: supervisor.id,
        },
      })
    }
    console.log('✅ Seeded sample FCC-2026-000512 with 6-day gas readings')
  } else {
    console.log('ℹ️  Gas readings already exist for FCC-2026-000512, skipping')
  }

  console.log('')
  console.log('🎉 Seeding completed successfully!')
  console.log('')
  console.log('📋 Dev login credentials:')
  console.log(`   admin@primon.mw          → ${ADMIN_PASSWORD}`)
  console.log(`   grace.phiri@primon.mw    → ${DEFAULT_PASSWORD}`)
  console.log(`   john.banda@primon.mw     → ${DEFAULT_PASSWORD}`)
  console.log(`   shipping@allianceone.mw  → ${DEFAULT_PASSWORD}`)
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })