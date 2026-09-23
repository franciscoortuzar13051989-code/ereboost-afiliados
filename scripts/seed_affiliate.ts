import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Demo1234", 10);
  await prisma.affiliate.upsert({
    where: { email: "profejoaco@demo.cl" },
    update: {},
    create: {
      name: "Profe Joaco",
      email: "profejoaco@demo.cl",
      passwordHash,
      commissionPct: 0.05,
      notes: "Afiliado demo",
      codes: { create: [{ code: "PROFEJOAKO", discountPct: 0.05 }] },
    },
  });
  await prisma.affiliate.upsert({
    where: { email: "guillerivera@demo.cl" },
    update: {},
    create: {
      name: "Guille Rivera",
      email: "guillerivera@demo.cl",
      passwordHash,
      commissionPct: 0.05,
      notes: "Afiliado demo",
      codes: { create: [{ code: "GUILLERIVERA", discountPct: 0.05 }] },
    },
  });
  console.log("listo");
}
main().finally(() => prisma.$disconnect());
