import { prisma } from "./prisma";
import { getOrdersForDiscountCodes } from "./shopify";
import { calculateCommissions, groupByCode, type OrderCommission, type CodeBreakdown } from "./commission";
import type { ShopSettings, Affiliate, DiscountCode, MonthlySnapshot } from "@prisma/client";

/** Un afiliado con sus códigos de descuento cargados (lo que necesitan todas
 * las funciones de este archivo para poder consultar Shopify). */
export type AffiliateWithCodes = Affiliate & { codes: DiscountCode[] };

export interface MonthKey {
  year: number;
  month: number; // 1-12
}

export function currentMonthKey(): MonthKey {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function isCurrentMonth(key: MonthKey): boolean {
  const c = currentMonthKey();
  return key.year === c.year && key.month === c.month;
}

/** Nombre legible ("septiembre 2026") de un mes. */
export function monthLabel(key: MonthKey): string {
  const d = new Date(Date.UTC(key.year, key.month - 1, 1));
  const label = d.toLocaleDateString("es-CL", { month: "long", year: "numeric", timeZone: "UTC" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Clave ordenable "2026-09" para comparar/ordenar meses. */
export function monthSlug(key: MonthKey): string {
  return `${key.year}-${String(key.month).padStart(2, "0")}`;
}

export function parseMonthSlug(slug: string): MonthKey {
  const [y, m] = slug.split("-").map(Number);
  return { year: y, month: m };
}

/** Rango [from, to) en formato ISO (fecha) para un mes calendario dado. */
export function monthRangeISO(key: MonthKey): { from: string; to: string } {
  const from = new Date(Date.UTC(key.year, key.month - 1, 1)).toISOString().slice(0, 10);
  const to = new Date(Date.UTC(key.year, key.month, 1)).toISOString().slice(0, 10);
  return { from, to };
}

/** El mes calendario anterior al actual (el que normalmente se cierra primero). */
export function previousMonthKey(): MonthKey {
  const c = currentMonthKey();
  if (c.month === 1) return { year: c.year - 1, month: 12 };
  return { year: c.year, month: c.month - 1 };
}

/** Lista de meses calendario entre `from` y `to` (ambos inclusive), en orden. */
export function monthsBetween(from: MonthKey, to: MonthKey): MonthKey[] {
  const months: MonthKey[] = [];
  let y = from.year;
  let m = from.month;
  while (y < to.year || (y === to.year && m <= to.month)) {
    months.push({ year: y, month: m });
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return months;
}

export interface MonthData {
  key: MonthKey;
  label: string;
  timesUsed: number;
  totalSubtotal: number;
  totalNetSale: number;
  totalCommission: number;
  baseFee: number;
  totalPago: number;
  orders: OrderCommission[];
  byCode: CodeBreakdown[];
  status: "en_curso" | "cerrado" | "pagado";
  closedAt: Date | null;
  paidAt: Date | null;
  snapshotId: string | null;
}

/**
 * Trae los datos de un mes para un afiliado:
 * - Si el mes ya está cerrado (hay MonthlySnapshot), devuelve los datos
 *   CONGELADOS guardados en la base — no depende de que Shopify todavía
 *   tenga esos pedidos dentro de la ventana de 60 días.
 * - Si no está cerrado (normalmente el mes en curso), consulta Shopify en
 *   vivo para ese rango de fechas.
 */
export async function getMonthData(
  affiliate: AffiliateWithCodes,
  settings: ShopSettings,
  key: MonthKey
): Promise<MonthData> {
  const baseFee = affiliate.baseFee ?? settings.defaultBaseFee;
  const label = monthLabel(key);

  const snapshot = await prisma.monthlySnapshot.findUnique({
    where: {
      affiliateId_year_month: {
        affiliateId: affiliate.id,
        year: key.year,
        month: key.month,
      },
    },
  });

  if (snapshot) {
    return snapshotToMonthData(snapshot, key, label);
  }

  // Sin cerrar todavía: se consulta en vivo (funciona mientras el mes esté
  // dentro de la ventana de 60 días de Shopify — típicamente el mes actual
  // o el recién terminado).
  const { from, to } = monthRangeISO(key);
  const activeCodes = affiliate.codes.filter((c) => c.active).map((c) => c.code);
  const { orders } = await getOrdersForDiscountCodes(activeCodes, { from, to });
  const summary = calculateCommissions(orders, affiliate.commissionPct, settings);

  return {
    key,
    label,
    timesUsed: summary.timesUsed,
    totalSubtotal: summary.totalSubtotal,
    totalNetSale: summary.totalNetSale,
    totalCommission: summary.totalCommission,
    baseFee,
    totalPago: baseFee + summary.totalCommission,
    orders: summary.orders,
    byCode: groupByCode(summary.orders),
    status: "en_curso",
    closedAt: null,
    paidAt: null,
    snapshotId: null,
  };
}

function snapshotToMonthData(snapshot: MonthlySnapshot, key: MonthKey, label: string): MonthData {
  let orders: OrderCommission[] = [];
  try {
    orders = JSON.parse(snapshot.ordersJson);
  } catch {
    orders = [];
  }
  return {
    key,
    label,
    timesUsed: snapshot.timesUsed,
    totalSubtotal: snapshot.totalSubtotal,
    totalNetSale: snapshot.totalNetSale,
    totalCommission: snapshot.totalCommission,
    baseFee: snapshot.baseFee,
    totalPago: snapshot.totalPago,
    orders,
    byCode: groupByCode(orders),
    status: snapshot.status === "pagado" ? "pagado" : "cerrado",
    closedAt: snapshot.closedAt,
    paidAt: snapshot.paidAt,
    snapshotId: snapshot.id,
  };
}

/**
 * Cierra (congela) un mes para un afiliado: consulta Shopify en vivo una
 * última vez para ese rango de fechas y guarda el resultado en
 * MonthlySnapshot. Si el mes ya estaba cerrado, lo vuelve a calcular y
 * sobreescribe (por si se cerró por error antes de tiempo).
 */
export async function closeMonth(
  affiliate: AffiliateWithCodes,
  settings: ShopSettings,
  key: MonthKey
): Promise<MonthlySnapshot> {
  const baseFee = affiliate.baseFee ?? settings.defaultBaseFee;
  const { from, to } = monthRangeISO(key);
  const activeCodes = affiliate.codes.filter((c) => c.active).map((c) => c.code);
  const { orders } = await getOrdersForDiscountCodes(activeCodes, { from, to });
  const summary = calculateCommissions(orders, affiliate.commissionPct, settings);

  return prisma.monthlySnapshot.upsert({
    where: {
      affiliateId_year_month: {
        affiliateId: affiliate.id,
        year: key.year,
        month: key.month,
      },
    },
    update: {
      timesUsed: summary.timesUsed,
      totalSubtotal: summary.totalSubtotal,
      totalNetSale: summary.totalNetSale,
      totalCommission: summary.totalCommission,
      baseFee,
      totalPago: baseFee + summary.totalCommission,
      ordersJson: JSON.stringify(summary.orders),
      closedAt: new Date(),
    },
    create: {
      affiliateId: affiliate.id,
      year: key.year,
      month: key.month,
      timesUsed: summary.timesUsed,
      totalSubtotal: summary.totalSubtotal,
      totalNetSale: summary.totalNetSale,
      totalCommission: summary.totalCommission,
      baseFee,
      totalPago: baseFee + summary.totalCommission,
      ordersJson: JSON.stringify(summary.orders),
      status: "cerrado",
    },
  });
}

export async function markSnapshotPaid(snapshotId: string): Promise<void> {
  await prisma.monthlySnapshot.update({
    where: { id: snapshotId },
    data: { status: "pagado", paidAt: new Date() },
  });
}

/**
 * Lista de meses disponibles para filtrar en el dashboard de un afiliado:
 * todos los meses ya cerrados (más antiguos primero... en realidad más
 * recientes primero) más el mes en curso.
 */
export async function listAvailableMonths(affiliateId: string): Promise<MonthKey[]> {
  const snapshots = await prisma.monthlySnapshot.findMany({
    where: { affiliateId },
    select: { year: true, month: true },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });
  const keys: MonthKey[] = snapshots.map((s) => ({ year: s.year, month: s.month }));
  const current = currentMonthKey();
  if (!keys.some((k) => k.year === current.year && k.month === current.month)) {
    keys.unshift(current);
  }
  return keys;
}

/**
 * Total histórico "seguro" para un afiliado: suma de todos los meses ya
 * cerrados (congelados en la base, sin importar la ventana de 60 días de
 * Shopify) más el mes en curso (consultado en vivo). A diferencia de pedir
 * "todos los pedidos" directo a Shopify, este total nunca se encoge con el
 * tiempo.
 */
export async function getHistoricalTotal(
  affiliate: AffiliateWithCodes,
  settings: ShopSettings
): Promise<{ timesUsed: number; totalSubtotal: number; totalCommission: number }> {
  const snapshots = await prisma.monthlySnapshot.findMany({
    where: { affiliateId: affiliate.id },
  });

  let timesUsed = snapshots.reduce((s, x) => s + x.timesUsed, 0);
  let totalSubtotal = snapshots.reduce((s, x) => s + x.totalSubtotal, 0);
  let totalCommission = snapshots.reduce((s, x) => s + x.totalCommission, 0);

  const current = currentMonthKey();
  const alreadyClosed = snapshots.some(
    (s) => s.year === current.year && s.month === current.month
  );
  if (!alreadyClosed) {
    try {
      const currentData = await getMonthData(affiliate, settings, current);
      timesUsed += currentData.timesUsed;
      totalSubtotal += currentData.totalSubtotal;
      totalCommission += currentData.totalCommission;
    } catch {
      // si Shopify falla, se deja el histórico solo con lo ya cerrado
    }
  }

  return { timesUsed, totalSubtotal, totalCommission };
}
