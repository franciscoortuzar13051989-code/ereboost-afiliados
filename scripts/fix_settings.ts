import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  await prisma.shopSettings.update({
    where: { id: "settings" },
    data: { freeShippingThreshold: 49990, avgShippingCost: 3000, ivaPct: 0.19, defaultBaseFee: 200000 },
  });
  console.log("ok");
}
main().finally(() => prisma.$disconnect());
