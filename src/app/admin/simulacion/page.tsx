import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { getOrdersForDiscountCodes } from "@/lib/shopify";
import { calculateCommissions, groupByMonth } from "@/lib/commission";
import { monthsBetween, monthLabel, type MonthKey } from "@/lib/monthly";
import Link from "next/link";

export const dynamic = "force-dynamic";

function formatCLP(n: number) {
  return n.toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** Suma un día a una fecha "YYYY-MM-DD" (para convertir un "hasta" inclusive
 * en el límite exclusivo que espera la consulta a Shopify). */
function addOneDay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function keyOf(mk: MonthKey) {
  return `${mk.year}-${mk.month}`;
}

export default async function SimulationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const settings = await getSettings();
  const affiliates = await prisma.affiliate.findMany({
    orderBy: { name: "asc" },
    include: { codes: true },
  });

  const today = todayISO();

  const cards = await Promise.all(
    affiliates.map(async (a) => {
      // Rango por defecto pedido por Kiko (22-09-2026): Profe Joaco, todo el
      // año hasta hoy. Guille, solo enero-marzo (sin mostrar meses
      // recientes, porque el trato con él cambia con un código nuevo).
      // Ajustable por afiliado con los parámetros desde_<id> / hasta_<id>.
      const year = new Date().getFullYear();
      const isGuille = a.name.toLowerCase().includes("guille");
      const desde = sp[`desde_${a.id}`] || `${year}-01-01`;
      const hasta = sp[`hasta_${a.id}`] || (isGuille ? `${year}-03-31` : today);

      const activeCodes = a.codes.filter((c) => c.active).map((c) => c.code);

      let error: string | null = null;
      let monthly: ReturnType<typeof groupByMonth> = [];
      let timesUsed = 0;
      let totalSubtotal = 0;
      let totalCommission = 0;

      try {
        const { orders } = await getOrdersForDiscountCodes(activeCodes, {
          from: desde,
          to: addOneDay(hasta),
        });
        const summary = calculateCommissions(orders, a.commissionPct, settings);
        monthly = groupByMonth(summary.orders);
        timesUsed = summary.timesUsed;
        totalSubtotal = summary.totalSubtotal;
        totalCommission = summary.totalCommission;
      } catch (err: any) {
        error = err?.message || "No se pudo consultar Shopify.";
      }

      const [yDesde, mDesde] = desde.split("-").map(Number);
      const [yHasta, mHasta] = hasta.split("-").map(Number);
      const monthRange = monthsBetween(
        { year: yDesde, month: mDesde },
        { year: yHasta, month: mHasta }
      );
      const baseFee = a.baseFee ?? settings.defaultBaseFee;
      const byKey = new Map(monthly.map((m) => [keyOf(m), m]));
      const rows = monthRange.map((mk) => {
        const m = byKey.get(keyOf(mk));
        return {
          key: mk,
          label: monthLabel(mk),
          timesUsed: m?.timesUsed ?? 0,
          totalSubtotal: m?.totalSubtotal ?? 0,
          totalCommission: m?.totalCommission ?? 0,
          baseFee,
          totalPago: (m?.totalCommission ?? 0) + baseFee,
        };
      });
      const totalBaseFees = baseFee * monthRange.length;
      const totalPagoSimulado = totalCommission + totalBaseFees;

      return {
        affiliate: a,
        desde,
        hasta,
        codes: activeCodes,
        error,
        rows,
        timesUsed,
        totalSubtotal,
        totalCommission,
        totalBaseFees,
        totalPagoSimulado,
        monthsCount: monthRange.length,
      };
    })
  );

  const soloId = sp["afiliado"];
  const visibleCards = soloId ? cards.filter((c) => c.affiliate.id === soloId) : cards;

  // Para armar los links "Ver solo este afiliado" / "Ver todos" conservando
  // los rangos de fecha que ya están elegidos.
  const rangeParams = new URLSearchParams();
  for (const c of cards) {
    rangeParams.set(`desde_${c.affiliate.id}`, sp[`desde_${c.affiliate.id}`] || c.desde);
    rangeParams.set(`hasta_${c.affiliate.id}`, sp[`hasta_${c.affiliate.id}`] || c.hasta);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Simulación histórica</h1>
        <p className="text-neutral-500 text-sm mt-1 max-w-3xl">
          Esto NO cierra ni guarda meses — solo consulta Shopify en vivo con
          los códigos actuales de cada afiliado para simular cuánto hubieran
          ganado en un rango de fechas, incluyendo la tarifa base mensual
          ({formatCLP(settings.defaultBaseFee)} por defecto). Sirve para
          mostrárselo a ellos antes de pasar a los códigos nuevos del
          próximo trato.
        </p>
        {soloId && (
          <p className="text-xs mt-2">
            <Link
              href={`/admin/simulacion?${rangeParams.toString()}`}
              className="text-orange-400 hover:text-orange-300"
            >
              ← Ver todos los afiliados
            </Link>
          </p>
        )}
        {!soloId && cards.length > 1 && (
          <p className="text-neutral-600 text-xs mt-2">
            Al compartir pantalla o capturas con un afiliado, usa "Ver solo
            este afiliado" en su tarjeta — así no ve los números de los
            demás.
          </p>
        )}
      </div>

      <div className="space-y-8">
        {visibleCards.map((c) => (
          <div
            key={c.affiliate.id}
            className="bg-neutral-900 border border-neutral-800 rounded-lg p-6"
          >
            <div className="flex items-start justify-between flex-wrap gap-4 mb-4">
              <div>
                <h2 className="text-lg font-medium">{c.affiliate.name}</h2>
                <p className="text-neutral-500 text-xs mt-1">
                  Código{c.codes.length > 1 ? "s" : ""}:{" "}
                  <span className="font-mono text-orange-400">
                    {c.codes.length > 0 ? c.codes.join(", ") : "sin código activo"}
                  </span>{" "}
                  · Comisión {(c.affiliate.commissionPct * 100).toFixed(1)}% ·
                  Tarifa base {formatCLP(c.affiliate.baseFee ?? settings.defaultBaseFee)}
                  /mes
                </p>
                {!soloId && (
                  <Link
                    href={`/admin/simulacion?afiliado=${c.affiliate.id}&${rangeParams.toString()}`}
                    className="text-xs text-neutral-500 hover:text-orange-400 underline"
                  >
                    Ver solo este afiliado (para mostrarle a él)
                  </Link>
                )}
              </div>

              <form method="get" className="flex items-end gap-2">
                {/* Mantiene el rango de los demás afiliados al enviar este formulario. */}
                {cards
                  .filter((other) => other.affiliate.id !== c.affiliate.id)
                  .map((other) => (
                    <input
                      key={other.affiliate.id}
                      type="hidden"
                      name={`desde_${other.affiliate.id}`}
                      value={sp[`desde_${other.affiliate.id}`] || other.desde}
                    />
                  ))}
                {cards
                  .filter((other) => other.affiliate.id !== c.affiliate.id)
                  .map((other) => (
                    <input
                      key={`h-${other.affiliate.id}`}
                      type="hidden"
                      name={`hasta_${other.affiliate.id}`}
                      value={sp[`hasta_${other.affiliate.id}`] || other.hasta}
                    />
                  ))}
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Desde</label>
                  <input
                    type="date"
                    name={`desde_${c.affiliate.id}`}
                    defaultValue={c.desde}
                    className="rounded-md bg-neutral-800 border border-neutral-700 px-2 py-1.5 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">
                    Hasta (inclusive)
                  </label>
                  <input
                    type="date"
                    name={`hasta_${c.affiliate.id}`}
                    defaultValue={c.hasta}
                    className="rounded-md bg-neutral-800 border border-neutral-700 px-2 py-1.5 text-white text-sm"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-neutral-800 hover:bg-neutral-700 text-white text-sm rounded-md px-3 py-1.5"
                >
                  Ver
                </button>
              </form>
            </div>

            {c.error && (
              <div className="rounded-lg border border-red-800 bg-red-950 text-red-400 p-3 text-sm mb-4">
                {c.error}
              </div>
            )}

            <div className="grid grid-cols-4 gap-4 mb-4">
              <div className="bg-neutral-950/60 border border-neutral-800 rounded-lg p-3">
                <p className="text-neutral-400 text-xs">Meses simulados</p>
                <p className="text-xl font-semibold">{c.monthsCount}</p>
              </div>
              <div className="bg-neutral-950/60 border border-neutral-800 rounded-lg p-3">
                <p className="text-neutral-400 text-xs">Pedidos con su código</p>
                <p className="text-xl font-semibold">{c.timesUsed}</p>
              </div>
              <div className="bg-neutral-950/60 border border-neutral-800 rounded-lg p-3">
                <p className="text-neutral-400 text-xs">Comisión total (sin base)</p>
                <p className="text-xl font-semibold">{formatCLP(c.totalCommission)}</p>
              </div>
              <div className="bg-orange-950/40 border border-orange-800 rounded-lg p-3">
                <p className="text-orange-300 text-xs">
                  Total simulado (comisión + {c.monthsCount} tarifas base)
                </p>
                <p className="text-xl font-semibold text-orange-400">
                  {formatCLP(c.totalPagoSimulado)}
                </p>
              </div>
            </div>

            <div className="bg-neutral-950/40 border border-neutral-800 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-neutral-800/50 text-neutral-400 text-left">
                  <tr>
                    <th className="px-4 py-2">Mes</th>
                    <th className="px-4 py-2 text-right">Usos</th>
                    <th className="px-4 py-2 text-right">Ventas</th>
                    <th className="px-4 py-2 text-right">Comisión</th>
                    <th className="px-4 py-2 text-right">Tarifa base</th>
                    <th className="px-4 py-2 text-right">Total del mes</th>
                  </tr>
                </thead>
                <tbody>
                  {c.rows.map((r) => (
                    <tr key={keyOf(r.key)} className="border-t border-neutral-800">
                      <td className="px-4 py-2 capitalize">{r.label}</td>
                      <td className="px-4 py-2 text-right">{r.timesUsed}</td>
                      <td className="px-4 py-2 text-right">{formatCLP(r.totalSubtotal)}</td>
                      <td className="px-4 py-2 text-right">{formatCLP(r.totalCommission)}</td>
                      <td className="px-4 py-2 text-right text-neutral-400">
                        {formatCLP(r.baseFee)}
                      </td>
                      <td className="px-4 py-2 text-right font-medium">
                        {formatCLP(r.totalPago)}
                      </td>
                    </tr>
                  ))}
                  {c.rows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-neutral-500">
                        Sin meses en este rango.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {visibleCards.length === 0 && (
          <p className="text-neutral-500 text-sm">
            {soloId ? "Afiliado no encontrado." : "Todavía no hay afiliados."}
          </p>
        )}
      </div>
    </div>
  );
}
