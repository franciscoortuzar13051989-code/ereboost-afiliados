/**
 * Crea o actualiza el usuario administrador del panel.
 *
 * Uso:
 *   npx tsx scripts/create-admin.ts tu@email.com "tu-contraseña" "Tu Nombre"
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const [, , email, password, name] = process.argv;

  if (!email || !password) {
    console.error(
      'Uso: npx tsx scripts/create-admin.ts tu@email.com "tu-contraseña" "Tu Nombre"'
    );
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.adminUser.upsert({
    where: { email },
    update: { passwordHash, name },
    create: { email, passwordHash, name },
  });

  console.log(`✅ Usuario admin listo: ${admin.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
