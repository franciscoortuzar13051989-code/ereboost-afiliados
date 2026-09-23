import type { ShopifyOrderRow } from "./shopify";

export interface CommissionSettings {
  freeShippingThreshold: number; // ej. 49990
  avgShippingCost: number; // ej. 3000 (solo se resta en pedidos con envío gratis)
  ivaPct: number; // ej. 0.19 (19% IVA Chile)
}

export interface OrderCommission {
  orderId: string;
  orderName: string;
  createdAt: string;
  subtotal: number;
  hadFreeShipping: boolean;
  shippingDeducted: number;
  netSaleWithIva: number;
  netSale: number;
  commission: number;
  code: string;
}

export interface CommissionSummary {
  timesUsed: number;
  totalSubtotal: number;
  totalNetSale: number;
  totalCommission: number;
  orders: OrderCommission[];
}

export interface CodeBreakdown {
  code: string;
  timesUsed: number;
  totalSubtotal: number;
  totalNetSale: number;
  totalCommission: number;
}

/**
 * Agrupa las comisiones ya calculadas por código de descuento, para mostrar
 * en el portal del afiliado cuántas veces se usó cada uno y cuánto generó
 * (la comisión POR código es solo informativa — la comisión real del
 * afiliado es la suma total, siempre al mismo % sin importar el código).
 */
export function groupByCode(orders: OrderCommission[]): CodeBreakdown[] {
  const byCode = new Map<string, CodeBreakdown>();
  for (const o of orders) {
    const key = o.code || "SIN CÓDIGO";
    const existing = byCode.get(key);
    if (existing) {
      existing.timesUsed += 1;
      existing.totalSubtotal += o.subtotal;
      existing.totalNetSale += o.netSale;
      existing.totalCommission += o.commission;
    } else {
      byCode.set(key, {
        code: key,
        timesUsed: 1,
        totalSubtotal: o.subtotal,
        totalNetSale: o.netSale,
        totalCommission: o.commission,
      });
    }
  }
  return Array.from(byCode.values()).sort((a, b) => b.timesUsed - a.timesUsed);
}

export interface MonthBreakdown {
  year: number;
  month: number; // 1-12
  timesUsed: number;
  totalSubtotal: number;
  totalNetSale: number;
  totalCommission: number;
}

/**
 * Agrupa comisiones ya calculadas por mes calendario (según createdAt),
 * ordenadas cronológicamente. Se usa para simulaciones históricas de rangos
 * de varios meses, donde además de la comisión hay que sumar una tarifa
 * base POR MES.
 */
export function groupByMonth(orders: OrderCommission[]): MonthBreakdown[] {
  const byMonth = new Map<string, MonthBreakdown>();
  for (const o of orders) {
    const d = new Date(o.createdAt);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    const key = `${year}-${month}`;
    const existing = byMonth.get(key);
    if (existing) {
      existing.timesUsed += 1;
      existing.totalSubtotal += o.subtotal;
      existing.totalNetSale += o.netSale;
      existing.totalCommission += o.commission;
    } else {
      byMonth.set(key, {
        year,
        month,
        timesUsed: 1,
        totalSubtotal: o.subtotal,
        totalNetSale: o.netSale,
        totalCommission: o.commission,
      });
    }
  }
  return Array.from(byMonth.values()).sort((a, b) =>
    a.year !== b.year ? a.year - b.year : a.month - b.month
  );
}

/**
 * Calcula la comisión de un afiliado siguiendo la regla acordada con Kiko
 * (confirmada el 22-09-2026):
 *
 * - Pedido con subtotal < umbral de envío gratis:
 *     el cliente pagó su propio envío (aparece como item aparte) -> no se resta nada
 *     venta_neta_con_iva = subtotal
 * - Pedido con subtotal >= umbral de envío gratis:
 *     Ereboost pagó el envío -> venta_neta_con_iva = subtotal - costoPromedioEnvio
 *     (nunca negativa: si el costo de envío superara el subtotal, se limita a 0)
 * - En ambos casos se descuenta el IVA antes de calcular la comisión:
 *     venta_neta = venta_neta_con_iva / (1 + ivaPct)
 *
 * comisión = venta_neta * commissionPct
 */
export function calculateCommissions(
  orders: ShopifyOrderRow[],
  commissionPct: number,
  settings: CommissionSettings
): CommissionSummary {
  const orderCommissions: OrderCommission[] = orders.map((o) => {
    const hadFreeShipping = o.subtotal >= settings.freeShippingThreshold;
    const shippingDeducted = hadFreeShipping ? settings.avgShippingCost : 0;
    const netSaleWithIva = Math.max(0, o.subtotal - shippingDeducted);
    const netSale = netSaleWithIva / (1 + settings.ivaPct);
    const commission = netSale * commissionPct;

    return {
      orderId: o.id,
      orderName: o.name,
      createdAt: o.createdAt,
      subtotal: o.subtotal,
      hadFreeShipping,
      shippingDeducted,
      netSaleWithIva,
      netSale,
      commission,
      code: o.code,
    };
  });

  const totalSubtotal = orderCommissions.reduce((s, o) => s + o.subtotal, 0);
  const totalNetSale = orderCommissions.reduce((s, o) => s + o.netSale, 0);
  const totalCommission = orderCommissions.reduce((s, o) => s + o.commission, 0);

  return {
    timesUsed: orderCommissions.length,
    totalSubtotal,
    totalNetSale,
    totalCommission,
    orders: orderCommissions.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
  };
}
