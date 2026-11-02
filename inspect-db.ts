import { prisma } from "./lib/prisma";

async function inspect() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, deactivatedAt: true },
    orderBy: { createdAt: "asc" },
  });

  const wos = await prisma.workOrder.findMany({
    select: {
      id: true,
      code: true,
      cropType: true,
      status: true,
      source: true,
      createdAt: true,
      client: { select: { name: true, email: true } },
      fcc: {
        select: {
          status: true,
          certificateNumber: true,
          certifiedAt: true,
          gasReadings: { select: { dayNumber: true, status: true } },
          closeout: { select: { datePlaced: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const stock = await prisma.stockLevel.findMany({
    include: { formulation: { include: { fumigant: true } } },
  });

  const movementCount = await prisma.stockMovement.count();
  const auditCount = await prisma.auditLog.count();
  const notifCount = await prisma.notification.count();
  const pendingCount = await prisma.pendingSubmission.count();
  const householdCount = await prisma.householdClient.count();

  console.log("=== USERS ===");
  users.forEach((u) =>
    console.log(`  [${u.role}] ${u.name} <${u.email}>${u.deactivatedAt ? " DEACTIVATED" : ""}`)
  );

  console.log("\n=== WORK ORDERS ===");
  wos.forEach((w) => {
    console.log(
      `  ${w.code} | crop=${w.cropType} | client=${w.client?.name ?? "(none)"} | fcc=${w.fcc?.status ?? "—"} | cert=${w.fcc?.certificateNumber ?? "—"} | placed=${w.fcc?.closeout?.datePlaced?.toISOString().split("T")[0] ?? "—"} | readings=${w.fcc?.gasReadings?.length ?? 0} | source=${w.source} | created=${w.createdAt.toISOString().split("T")[0]}`
    );
  });

  console.log("\n=== STOCK LEVELS ===");
  stock.forEach((s) =>
    console.log(`  ${s.formulation.fumigant.name} / ${s.formulation.name}: ${s.quantityOnHand} (threshold ${s.lowStockThreshold})`)
  );

  console.log(`\n=== COUNTS ===`);
  console.log(`  stock_movements: ${movementCount}`);
  console.log(`  audit_log: ${auditCount}`);
  console.log(`  notifications: ${notifCount}`);
  console.log(`  pending_submissions: ${pendingCount}`);
  console.log(`  household_clients: ${householdCount}`);
}

inspect()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

