import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import {
  getMonthData,
  getHistoricalTotal,
  listAvailableMonths,
  monthSlug,
  monthLabel,
  parseMonthSlug,
  currentMonthKey,
  isCurrentMonth,
} from "@/lib/monthly";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic"; // siempre en vivo, sin caché

function formatCLP(n: number) {
  return n.toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AffiliatePortalPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const session = await auth();
  const affiliateId = (session?.user as any)?.id as string | undefined;
  if (!affiliateId) redirect("/login?as=afiliado");

  const affiliate = await prisma.affiliate.findUnique({
    where: { id: affiliateId },
    include: { codes: true },
  });
  if (!affiliate) redirect("/login?as=afiliado");

  const { mes } = await searchParams;
  const selectedKey = mes ? parseMonthSlug(mes) : currentMonthKey();
  const viewingCurrent = isCurrentMonth(selectedKey);

  const settings = await getSettings();

  let errorMsg: string | null = null;
  let monthData: Awaited<ReturnType<typeof getMonthData>> | null = null;
  let historico: Awaited<ReturnType<typeof getHistoricalTotal>> | null = null;
  let availableMonths: Awaited<ReturnType<typeof listAvailableMonths>> = [];

  try {
    [monthData, historico, availableMonths] = await Promise.all([
      getMonthData(affiliate, settings, selectedKey),
      getHistoricalTotal(affiliate, settings),
      listAvailableMonths(affiliate.id),
    ]);
  } catch (err: any) {
    errorMsg = err?.message || "No se pudo consultar Shopify en este momento.";
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-neutral-400 text-sm">
            {affiliate.codes.length > 1 ? "Tus códigos de descuento" : "Tu código de descuento"}
          </p>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mt-1">
            {affiliate.codes.map((c) => (
              <span key={c.id} className="text-3xl font-mono font-semibold text-orange-500">
                {c.code}
                <span className="text-sm font-sans font-normal text-neutral-500 ml-1">
                  ({(c.discountPct * 100).toFixed(0)}% dto.)
                  {!c.active && " · inactivo"}
                </span>
              </span>
            ))}
            {affiliate.codes.length === 0 && (
              <span className="text-neutral-500 text-sm">Todavía no tienes códigos asignados.</span>
            )}
          </div>
          <p className="text-neutral-500 text-sm mt-1">
            Ganas {(affiliate.commissionPct * 100).toFixed(0)}% de comisión
            sobre la venta neta, sin importar cuál de tus códigos haya usado
            el cliente.
          </p>
        </div>

        <form method="get" className="flex items-end gap-2">
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Ver mes</label>
            <select
              name="mes"
              defaultValue={monthSlug(selectedKey)}
              className="rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-white text-sm"
            >
              {availableMonths.map((k) => (
                <option key={monthSlug(k)} value={monthSlug(k)}>
                  {monthLabel(k)}
                  {isCurrentMonth(k) ? " (en curso)" : ""}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="bg-neutral-800 hover:bg-neutral-700 text-white text-sm rounded-md px-4 py-2"
          >
            Ver
          </button>
        </form>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-red-800 bg-red-950 text-red-400 p-4 text-sm mb-6">
          {errorMsg}
        </div>
      )}

      {monthData && (
        <>
          <div className="mb-6 rounded-xl border border-orange-700 bg-gradient-to-br from-orange-950 to-neutral-900 p-6">
            <p className="text-orange-300 text-sm capitalize">
              {viewingCurrent ? "Pago estimado" : monthData.status === "pagado" ? "Pagado" : "Cerrado"}{" "}
              — {monthData.label}
            </p>
            <p className="text-4xl font-bold text-white mt-1">
              {formatCLP(monthData.totalPago)}
            </p>
            <div className="mt-3 flex gap-6 text-sm text-neutral-300">
              <span>
                Tarifa base: <strong className="text-white">{formatCLP(monthData.baseFee)}</strong>
              </span>
              <span>+</span>
              <span>
                Comisión del mes:{" "}
                <strong className="text-white">{formatCLP(monthData.totalCommission)}</strong>
              </span>
            </div>
            <p className="text-neutral-500 text-xs mt-2">
              {monthData.timesUsed} pedidos con tu código en {monthData.label}.{" "}
              {viewingCurrent
                ? "Este número se actualiza en vivo — puede variar hasta el cierre del mes."
                : monthData.status === "pagado"
                ? "Mes cerrado y pagado — estos números ya no cambian."
                : "Mes cerrado — estos números quedaron guardados y ya no cambian."}
            </p>
          </div>

          {historico && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
                <p className="text-neutral-400 text-sm">Veces usado (histórico)</p>
                <p className="text-2xl font-semibold">{historico.timesUsed}</p>
              </div>
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
                <p className="text-neutral-400 text-sm">Ventas generadas (histórico)</p>
                <p className="text-2xl font-semibold">{formatCLP(historico.totalSubtotal)}</p>
              </div>
              <div className="bg-neutral-900 border border-orange-800 bg-orange-950/40 rounded-lg p-4">
                <p className="text-orange-300 text-sm">Comisión acumulada (histórico)</p>
                <p className="text-2xl font-semibold text-orange-400">
                  {formatCLP(historico.totalCommission)}
                </p>
              </div>
            </div>
          )}

          {affiliate.codes.length > 1 && (
            <>
              <h2 className="text-sm font-medium text-neutral-300 mb-2 capitalize">
                Desglose por código — {monthData.label}
              </h2>
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden mb-6">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-800/50 text-neutral-400 text-left">
                    <tr>
                      <th className="px-4 py-3">Código</th>
                      <th className="px-4 py-3 text-right">Veces usado</th>
                      <th className="px-4 py-3 text-right">Ventas</th>
                      <th className="px-4 py-3 text-right">Comisión generada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthData.byCode.map((c) => (
                      <tr key={c.code} className="border-t border-neutral-800">
                        <td className="px-4 py-3 font-mono text-orange-400">{c.code}</td>
                        <td className="px-4 py-3 text-right">{c.timesUsed}</td>
                        <td className="px-4 py-3 text-right">{formatCLP(c.totalSubtotal)}</td>
                        <td className="px-4 py-3 text-right font-medium">
                          {formatCLP(c.totalCommission)}
                        </td>
                      </tr>
                    ))}
                    {monthData.byCode.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-neutral-500">
                          Sin pedidos todavía en {monthData.label}.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <h2 className="text-sm font-medium text-neutral-300 mb-2 capitalize">
            Detalle de pedidos — {monthData.label}
          </h2>
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-neutral-800/50 text-neutral-400 text-left">
                <tr>
                  <th className="px-4 py-3">Pedido</th>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3 text-right">Subtotal</th>
                  <th className="px-4 py-3 text-center">Envío gratis</th>
                  <th className="px-4 py-3 text-right">Venta neta (sin IVA)</th>
                  <th className="px-4 py-3 text-right">Tu comisión</th>
                </tr>
              </thead>
              <tbody>
                {monthData.orders.map((o) => (
                  <tr key={o.orderId} className="border-t border-neutral-800">
                    <td className="px-4 py-3">{o.orderName}</td>
                    <td className="px-4 py-3 font-mono text-neutral-400">{o.code}</td>
                    <td className="px-4 py-3 text-neutral-400">{formatDate(o.createdAt)}</td>
                    <td className="px-4 py-3 text-right">{formatCLP(o.subtotal)}</td>
                    <td className="px-4 py-3 text-center">{o.hadFreeShipping ? "Sí" : "No"}</td>
                    <td className="px-4 py-3 text-right text-neutral-400">
                      {formatCLP(o.netSale)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{formatCLP(o.commission)}</td>
                  </tr>
                ))}
                {monthData.orders.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-neutral-500">
                      No hay pedidos con tus códigos en {monthData.label}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="text-neutral-600 text-xs mt-4">
        {viewingCurrent
          ? "El mes en curso se consulta en vivo directo desde la tienda. Actualiza la página para ver los datos más recientes."
          : "Este mes ya está cerrado: los números quedaron guardados en el portal y no dependen de Shopify."}
      </p>
    </div>
  );
}
