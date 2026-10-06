import { config } from 'dotenv'
import { resolve } from 'path'

// Load .env.local before Prisma client initialises (tsx does not auto-load it)
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') }) // fallback

import { PrismaClient, CropType, Role, WorkOrderSource, Scale, FccStatus, FumigationType, ReadingStatus, SignatureRole } from '@prisma/client'
import { hashPassword } from 'better-auth/crypto'
import { buildReadingDates } from '../lib/readings'

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
    {
      id: 'seed-user-midascreed',
      name: 'MidasCreed',
      email: 'shipping@midascreed.com',
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
  const midasUser = await prisma.user.findUniqueOrThrow({ where: { email: 'shipping@midascreed.com' } })

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
    update: { certificateNumber: 'FCC-PE-2026-000512' },
    create: {
      workOrderId: workOrder.id,
      certificateNumber: 'FCC-PE-2026-000512',
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
    const placed512 = new Date('2026-09-01T08:00:00Z')
    await prisma.gasReading.create({
      data: {
        fccId: fcc.id,
        dayNumber: 0,
        readingDate: placed512,
        ambientTempC: 26,
        productTempC: 28.3,
        status: ReadingStatus.compliant,
        enteredById: supervisor.id,
      },
    })
    const dates512 = buildReadingDates(placed512, 6)
    const sampleReadings = [
      { dayNumber: 1, airspacePpm: 950, probeCasePpm: 910, ambientTempC: 27, status: ReadingStatus.compliant },
      { dayNumber: 2, airspacePpm: 880, probeCasePpm: 860, ambientTempC: 26, status: ReadingStatus.compliant },
      { dayNumber: 3, airspacePpm: 810, probeCasePpm: 790, ambientTempC: 25, status: ReadingStatus.compliant },
      { dayNumber: 4, airspacePpm: 750, probeCasePpm: 720, ambientTempC: 26, status: ReadingStatus.compliant },
      { dayNumber: 5, airspacePpm: 680, probeCasePpm: 660, ambientTempC: 24, status: ReadingStatus.compliant },
      { dayNumber: 6, airspacePpm: 630, probeCasePpm: 610, ambientTempC: 25, status: ReadingStatus.compliant },
    ]

    for (const reading of sampleReadings) {
      await prisma.gasReading.create({
        data: {
          fccId: fcc.id,
          dayNumber: reading.dayNumber,
          readingDate: dates512[reading.dayNumber - 1],
          airspacePpm: reading.airspacePpm,
          probeCasePpm: reading.probeCasePpm,
          ambientTempC: reading.ambientTempC,
          status: reading.status,
          enteredById: supervisor.id,
        },
      })
    }
    console.log('✅ Seeded sample FCC-PE-2026-000512 with Day 0 + 6-day gas readings')
  } else {
    const hasDay0 = await prisma.gasReading.findFirst({
      where: { fccId: fcc.id, dayNumber: 0 },
    })
    if (!hasDay0) {
      await prisma.gasReading.create({
        data: {
          fccId: fcc.id,
          dayNumber: 0,
          readingDate: new Date('2026-09-01T08:00:00Z'),
          ambientTempC: 26,
          productTempC: 28.3,
          status: ReadingStatus.compliant,
          enteredById: supervisor.id,
        },
      })
      console.log('✅ Backfilled Day 0 pre-check on FCC-PE-2026-000512')
    }
    await prisma.gasReading.updateMany({
      where: { fccId: fcc.id, dayNumber: { gt: 0 }, ambientTempC: null },
      data: { ambientTempC: 26 },
    })
    console.log('ℹ️  Gas readings already exist for FCC-PE-2026-000512; ambient temps filled if missing')
  }

  // ─────────────────────────────────────────────
  // 5. Certified showcase FCC — new certificate layout
  //    Placed Saturday so Days 1-6 skip Sunday
  // ─────────────────────────────────────────────

  const adminUser = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@primon.mw' } })
  const placed513 = new Date('2026-10-03T08:00:00Z') // Saturday
  const dates513 = buildReadingDates(placed513, 6)
  const aerationBegan = new Date('2026-10-10T08:00:00Z')
  const aerationCompleted = new Date('2026-10-10T16:00:00Z')
  const certifiedAt = new Date('2026-10-10T17:00:00Z')
  const cert513 = 'FCC-PE-2026-000513'
  // Temporary public origin until fms.primonenterprises.com DNS is live
  const publicOrigin = 'https://primon-fms.vercel.app'
  const verify513 = `${publicOrigin}/verify/${cert513}`

  const workOrder513 = await prisma.workOrder.upsert({
    where: { code: 'WO-2026-000513' },
    update: { clientId: midasUser.id, status: 'certified' },
    create: {
      code: 'WO-2026-000513',
      source: WorkOrderSource.auto_generated,
      cropType: CropType.tobacco,
      scale: Scale.industrial,
      status: 'certified',
      clientId: midasUser.id,
      salesOrderNo: 'SO-99301',
      shipmentNo: 'SH-44902',
      deliveryNo: 'DN-10380',
      createdById: opsManager.id,
    },
  })

  const existing513 = await prisma.fCC.findUnique({
    where: { workOrderId: workOrder513.id },
    include: { gasReadings: true, signatures: true, closeout: true },
  })

  if (!existing513) {
    const fcc513 = await prisma.fCC.create({
      data: {
        workOrderId: workOrder513.id,
        certificateNumber: cert513,
        status: FccStatus.certified,
        certifiedAt,
        certifiedById: adminUser.id,
        verificationUrl: verify513,
        qrCodeUrl: verify513,
        shippingInstructions: {
          create: {
            tobaccoSupplier: 'MidasCreed',
            tobaccoSupplierAddress: 'P.O. Box 36, Manda Street',
            consignee: 'MidasCreed',
            consigneeAddress: 'P.O. Box 36, Manda Street',
            fumigationContractor: 'Primon Enterprises Limited',
            cropYear: '2026',
            tobaccoType: 'Flue-Cured Virginia',
            netWeight: 22450,
            quantity: 102,
            polylined: true,
            gradeName: 'L1O',
            caseNos: 'C101-C202',
            countryOfOrigin: 'Malawi',
            location: 'Kanengo Industrial Area',
            warehouseSection: 'Bay 7A',
            lockedAt: certifiedAt,
          },
        },
        fumigationDescription: {
          create: {
            fumigationType: FumigationType.sheeted_stack,
            fumigantId: magnesiumPhosphide.id,
            formulationId: plate33g.id,
            doseGm3: 1.5,
            totalVolumeM3: 520,
            totalFumigantUsedG: 780,
            recordedById: opsManager.id,
          },
        },
        closeout: {
          create: {
            datePlaced: placed513,
            aerationBegan,
            aerationCompleted,
            durationHours: 168,
          },
        },
        signatures: {
          createMany: {
            data: [
              { role: SignatureRole.supervising_fumigator, signerName: 'Prince Chiwalo', signedAt: certifiedAt },
              { role: SignatureRole.supplier_rep, signerName: 'Hopeson Majiga', signedAt: certifiedAt },
              { role: SignatureRole.certifying_officer, signerName: opsManager.name, signedAt: certifiedAt },
            ],
          },
        },
      },
    })

    await prisma.gasReading.create({
      data: {
        fccId: fcc513.id,
        dayNumber: 0,
        readingDate: placed513,
        ambientTempC: 26,
        productTempC: 28.3,
        status: ReadingStatus.compliant,
        enteredById: supervisor.id,
      },
    })

    const ppm513 = [
      { airspacePpm: 980, probeCasePpm: 940, ambientTempC: 27 },
      { airspacePpm: 910, probeCasePpm: 880, ambientTempC: 26 },
      { airspacePpm: 840, probeCasePpm: 810, ambientTempC: 25 },
      { airspacePpm: 770, probeCasePpm: 740, ambientTempC: 26 },
      { airspacePpm: 700, probeCasePpm: 680, ambientTempC: 24 },
      { airspacePpm: 640, probeCasePpm: 620, ambientTempC: 25 },
    ]

    for (let i = 0; i < 6; i++) {
      await prisma.gasReading.create({
        data: {
          fccId: fcc513.id,
          dayNumber: i + 1,
          readingDate: dates513[i],
          airspacePpm: ppm513[i].airspacePpm,
          probeCasePpm: ppm513[i].probeCasePpm,
          ambientTempC: ppm513[i].ambientTempC,
          status: ReadingStatus.compliant,
          enteredById: supervisor.id,
        },
      })
    }

    console.log('✅ Seeded certified showcase FCC-PE-2026-000513 (MidasCreed, Day 0 + Sunday skip)')
  } else {
    await prisma.shippingInstructions.upsert({
      where: { fccId: existing513.id },
      update: {
        tobaccoSupplier: 'MidasCreed',
        tobaccoSupplierAddress: 'P.O. Box 36, Manda Street',
        consignee: 'MidasCreed',
        consigneeAddress: 'P.O. Box 36, Manda Street',
      },
      create: {
        fccId: existing513.id,
        tobaccoSupplier: 'MidasCreed',
        tobaccoSupplierAddress: 'P.O. Box 36, Manda Street',
        consignee: 'MidasCreed',
        consigneeAddress: 'P.O. Box 36, Manda Street',
        fumigationContractor: 'Primon Enterprises Limited',
      },
    })
    await prisma.signature.updateMany({
      where: { fccId: existing513.id, role: SignatureRole.supervising_fumigator },
      data: { signerName: 'Prince Chiwalo' },
    })
    await prisma.fCC.update({
      where: { id: existing513.id },
      data: { verificationUrl: verify513, qrCodeUrl: verify513 },
    })
    console.log('ℹ️  Showcase FCC-PE-2026-000513 already exists — verify URL set to primon-fms.vercel.app')
  }

  const staleVerify = await prisma.fCC.findMany({
    where: {
      certificateNumber: { not: null },
      OR: [
        { verificationUrl: { contains: 'localhost' } },
        { qrCodeUrl: { contains: 'localhost' } },
      ],
    },
    select: { id: true, certificateNumber: true },
  })
  for (const fcc of staleVerify) {
    const url = `${publicOrigin}/verify/${fcc.certificateNumber}`
    await prisma.fCC.update({
      where: { id: fcc.id },
      data: { verificationUrl: url, qrCodeUrl: url },
    })
    console.log(`  ↻ verify URL → ${url}`)
  }

  console.log('')
  console.log('🎉 Seeding completed successfully!')
  console.log('')
  console.log('📋 Dev login credentials:')
  console.log(`   admin@primon.mw          → ${ADMIN_PASSWORD}`)
  console.log(`   grace.phiri@primon.mw    → ${DEFAULT_PASSWORD}`)
  console.log(`   john.banda@primon.mw     → ${DEFAULT_PASSWORD}`)
  console.log(`   shipping@allianceone.mw  → ${DEFAULT_PASSWORD}`)
  console.log(`   shipping@midascreed.com  → ${DEFAULT_PASSWORD}`)
  console.log('')
  console.log('📄 Sample certificates:')
  console.log('   /certificate/WO-2026-000512  (Alliance One, in progress)')
  console.log('   /certificate/WO-2026-000513  (MidasCreed, certified showcase)')
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })