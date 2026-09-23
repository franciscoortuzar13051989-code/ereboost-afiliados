"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSettings } from "@/lib/settings";
import { closeMonth, markSnapshotPaid, type MonthKey } from "@/lib/monthly";

async function requireAdmin() {
  const session = await auth();
  if ((session?.user as any)?.role !== "ADMIN") {
    throw new Error("No autorizado.");
  }
}

export async function createAffiliate(formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const discountCode = String(formData.get("discountCode") || "")
    .trim()
    .toUpperCase();
  const password = String(formData.get("password") || "");
  const commissionPct = Number(formData.get("commissionPct")) / 100;
  const discountPct = Number(formData.get("discountPct")) / 100;
  const notes = String(formData.get("notes") || "").trim() || null;
  const baseFeeRaw = String(formData.get("baseFee") || "").trim();
  const baseFee = baseFeeRaw ? Number(baseFeeRaw) : null;

  if (!name || !email || !discountCode || !password) {
    throw new Error("Faltan campos obligatorios.");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // Se crea con su primer código de descuento. Se pueden agregar más
  // códigos después desde la ficha del afiliado (addDiscountCode).
  await prisma.affiliate.create({
    data: {
      name,
      email,
      passwordHash,
      commissionPct,
      baseFee,
      notes,
      codes: {
        create: [{ code: discountCode, discountPct }],
      },
    },
  });

  revalidatePath("/admin/afiliados");
  redirect("/admin/afiliados");
}

export async function updateAffiliate(id: string, formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const commissionPct = Number(formData.get("commissionPct")) / 100;
  const active = formData.get("active") === "on";
  const notes = String(formData.get("notes") || "").trim() || null;
  const baseFeeRaw = String(formData.get("baseFee") || "").trim();
  const baseFee = baseFeeRaw ? Number(baseFeeRaw) : null;

  const data: any = {
    name,
    email,
    commissionPct,
    baseFee,
    active,
    notes,
  };

  if (password) {
    data.passwordHash = await bcrypt.hash(password, 10);
  }

  await prisma.affiliate.update({ where: { id }, data });

  revalidatePath("/admin/afiliados");
  redirect(`/admin/afiliados/${id}`);
}

/** Agrega un código de descuento adicional a un afiliado ya existente
 * (ej. un segundo código con otro % de descuento al cliente). La comisión
 * del afiliado sigue siendo siempre la misma (commissionPct), sin importar
 * cuántos códigos tenga. */
export async function addDiscountCode(affiliateId: string, formData: FormData) {
  await requireAdmin();

  const code = String(formData.get("code") || "").trim().toUpperCase();
  const discountPct = Number(formData.get("discountPct")) / 100;

  if (!code) {
    throw new Error("Falta el código de descuento.");
  }

  await prisma.discountCode.create({
    data: { affiliateId, code, discountPct },
  });

  revalidatePath(`/admin/afiliados/${affiliateId}`);
}

/** Activa/desactiva un código sin borrarlo (para no perder su historial). */
export async function toggleDiscountCode(codeId: string, affiliateId: string, active: boolean) {
  await requireAdmin();
  await prisma.discountCode.update({ where: { id: codeId }, data: { active } });
  revalidatePath(`/admin/afiliados/${affiliateId}`);
}

export async function deleteDiscountCode(codeId: string, affiliateId: string) {
  await requireAdmin();
  await prisma.discountCode.delete({ where: { id: codeId } });
  revalidatePath(`/admin/afiliados/${affiliateId}`);
}

export async function deleteAffiliate(id: string) {
  await requireAdmin();
  await prisma.affiliate.delete({ where: { id } });
  revalidatePath("/admin/afiliados");
  redirect("/admin/afiliados");
}

export async function updateSettings(formData: FormData) {
  await requireAdmin();

  const freeShippingThreshold = Number(formData.get("freeShippingThreshold"));
  const avgShippingCost = Number(formData.get("avgShippingCost"));
  const defaultCommissionPct = Number(formData.get("defaultCommissionPct")) / 100;
  const ivaPct = Number(formData.get("ivaPct")) / 100;
  const defaultBaseFee = Number(formData.get("defaultBaseFee"));
  const shopDomain = String(formData.get("shopDomain") || "").trim();

  await prisma.shopSettings.upsert({
    where: { id: "settings" },
    update: {
      freeShippingThreshold,
      avgShippingCost,
      defaultCommissionPct,
      ivaPct,
      defaultBaseFee,
      shopDomain,
    },
    create: {
      id: "settings",
      freeShippingThreshold,
      avgShippingCost,
      defaultCommissionPct,
      ivaPct,
      defaultBaseFee,
      shopDomain,
    },
  });

  revalidatePath("/admin/configuracion");
}

/** Cierra (congela) un mes para UN afiliado. */
export async function closeMonthAction(affiliateId: string, year: number, month: number) {
  await requireAdmin();
  const [affiliate, settings] = await Promise.all([
    prisma.affiliate.findUniqueOrThrow({ where: { id: affiliateId }, include: { codes: true } }),
    getSettings(),
  ]);
  await closeMonth(affiliate, settings, { year, month } satisfies MonthKey);
  revalidatePath("/admin/meses");
  revalidatePath("/portal");
  revalidatePath("/admin");
}

/** Cierra (congela) un mes para TODOS los afiliados activos. */
export async function closeMonthForAllAction(year: number, month: number) {
  await requireAdmin();
  const [affiliates, settings] = await Promise.all([
    prisma.affiliate.findMany({ where: { active: true }, include: { codes: true } }),
    getSettings(),
  ]);
  for (const affiliate of affiliates) {
    await closeMonth(affiliate, settings, { year, month } satisfies MonthKey);
  }
  revalidatePath("/admin/meses");
  revalidatePath("/portal");
  revalidatePath("/admin");
}

/** Marca un mes ya cerrado como pagado. */
export async function markSnapshotPaidAction(snapshotId: string) {
  await requireAdmin();
  await markSnapshotPaid(snapshotId);
  revalidatePath("/admin/meses");
  revalidatePath("/portal");
}
