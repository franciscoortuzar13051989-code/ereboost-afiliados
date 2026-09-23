import { prisma } from "./prisma";

/** Trae la configuración global, creándola con valores por defecto si no existe. */
export async function getSettings() {
  const settings = await prisma.shopSettings.upsert({
    where: { id: "settings" },
    update: {},
    create: { id: "settings" },
  });
  return settings;
}
