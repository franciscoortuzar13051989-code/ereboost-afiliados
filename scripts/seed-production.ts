// Siembra idempotente para la base de datos de producción (Postgres en
// Vercel). Corre como parte del build (ver package.json), y usa upserts para
// que sea seguro correrlo en cada deploy sin duplicar datos. Copia los datos
// reales (mismas contraseñas ya hasheadas) de la base local de Kiko.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.adminUser.upsert({
    where: { email: "ereboost" },
    update: {},
    create: {
      email: "ereboost",
      passwordHash:
        "$2b$10$Bg/epFdFaS6FtTZFPp0qMO7DdHDRnh5TtPsEorIHn15osWYctBd7.",
      name: "Ereboost",
    },
  });

  const joaco = await prisma.affiliate.upsert({
    where: { email: "profejoako" },
    update: {},
    create: {
      name: "joaquin ansaldi",
      email: "profejoako",
      passwordHash:
        "$2b$10$i6t708S6.7j/bMwKvGnx5uki35T4djzskBOecIcUrcSQbNiLtCag2",
      commissionPct: 0.05,
      baseFee: 300000,
      active: true,
    },
  });

  const guille = await prisma.affiliate.upsert({
    where: { email: "guillerivera" },
    update: {},
    create: {
      name: "guille rivera",
      email: "guillerivera",
      passwordHash:
        "$2b$10$kCC/jvpoNNMsN.LiSdIkv.ZOBj5QnmcQ2BKjrqVgsbcsKm9PniFda",
      commissionPct: 0.05,
      baseFee: 300000,
      active: true,
    },
  });

  const codes = [
    { code: "ESCUELADEMUTACION", affiliateId: joaco.id, discountPct: 0.1 },
    { code: "JOAKOANSALDI", affiliateId: joaco.id, discountPct: 0.05 },
    { code: "ADICTOALFRIO", affiliateId: guille.id, discountPct: 0.1 },
    { code: "GUILLE", affiliateId: guille.id, discountPct: 0.05 },
  ];

  for (const c of codes) {
    await prisma.discountCode.upsert({
      where: { code: c.code },
      update: {},
      create: { code: c.code, affiliateId: c.affiliateId, discountPct: c.discountPct, active: true },
    });
  }

  await prisma.shopSettings.upsert({
    where: { id: "settings" },
    update: {},
    create: {
      id: "settings",
      shopDomain: "ereboost.cl",
      freeShippingThreshold: 49990,
      avgShippingCost: 3000,
      defaultCommissionPct: 0.05,
      ivaPct: 0.19,
      defaultBaseFee: 300000,
    },
  });

  console.log("Seed de producción completo.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
