import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import {
  getMonthData,
  currentMonthKey,
  previousMonthKey,
  monthLabel,
  monthSlug,
  parseMonthSlug,
  isCurrentMonth,
  type MonthKey,
} from "@/lib/monthly";
import {
  closeMonthAction,
  closeMonthForAllAction,
  markSnapshotPaidAction,
} from "@/app/actions/admin";

export const dynamic = "force-dynamic";

function formatCLP(n: number) {
  return n.toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}

function formatDateTime(d: Date) {
  return d.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Últimos 12 meses (incluyendo el actual) para el selector.
function recentMonthOptions(): MonthKey[] {
  const { year, month } = currentMonthKey();
  const options: MonthKey[] = [];
  for (let i = 0; i < 12; i++) {
    let y = year;
    let m = month - i;
    while (m <= 0) {
      m += 12;
      y -= 1;
    }
    options.push({ year: y, month: m });
  }
  return options;
}

export default async function AdminMonthsPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes } = await searchParams;
  const selected: MonthKey = mes ? parseMonthSlug(mes) : previousMonthKey();
  const selectedIsCurrent = isCurrentMonth(selected);

  const [affiliates, settings] = await Promise.all([
    prisma.affiliate.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      include: { codes: true },
    }),
    getSettings(),
  ]);

  const closeAllWithMonth = closeMonthForAllAction.bind(null, selected.year, selected.month);

  const rows = await Promise.all(
    affiliates.map(async (a) => {
      try {
        const data = await getMonthData(a, settings, selected);
        return { affiliate: a, data, error: null as string | null };
      } catch (err: any) {
        return {
          affiliate: a,
          data: null,
          error: err?.message || "Error al consultar Shopify",
        };
      }
    })
  );

  const totalPago = rows.reduce((s, r) => s + (r.data?.totalPago ?? 0), 0);
  const pendientes = rows.filter((r) => r.data?.status === "en_curso").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Cierre de meses</h1>
          <p className="text-neutral-500 text-sm mt-1 max-w-2xl">
            Shopify solo deja consultar pedidos de los últimos 60 días. Al
            "cerrar" un mes, sus números quedan guardados para siempre acá —
            así el histórico no se pierde y cada afiliado puede seguir
            viéndolo en su portal.
          </p>
        </div>
      </div>

      <form className="flex items-end gap-3 mb-6" method="get">
        <div>
          <label className="block text-xs text-neutral-400 mb-1">Mes</label>
          <select
            name="mes"
            defaultValue={monthSlug(selected)}
            className="rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-white text-sm"
          >
            {recentMonthOptions().map((k) => (
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

      {selectedIsCurrent && (
        <div className="rounded-lg border border-amber-800 bg-amber-950/40 text-amber-300 text-sm p-4 mb-6">
          Este mes todavía está en curso — los números se recalculan en vivo
          y van a seguir cambiando. Ciérralo recién cuando termine el mes y
          estés listo para pagar (o justo antes de que pasen 60 días desde
          que empezó).
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
          <p className="text-neutral-400 text-sm capitalize">{monthLabel(selected)}</p>
          <p className="text-2xl font-semibold">{affiliates.length} afiliados</p>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
          <p className="text-neutral-400 text-sm">Sin cerrar todavía</p>
          <p className="text-2xl font-semibold">{pendientes}</p>
        </div>
        <div className="bg-orange-950/40 border border-orange-800 rounded-lg p-4">
          <p className="text-orange-300 text-sm">Total a pagar este mes</p>
          <p className="text-2xl font-semibold text-orange-400">{formatCLP(totalPago)}</p>
        </div>
      </div>

      <div className="flex justify-end mb-3">
        <form action={closeAllWithMonth}>
          <button
            type="submit"
            className="bg-orange-600 hover:bg-orange-500 text-white text-sm rounded-md px-4 py-2"
          >
            Cerrar {monthLabel(selected)} para todos
          </button>
        </form>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-800/50 text-neutral-400 text-left">
            <tr>
              <th className="px-4 py-3">Afiliado</th>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3 text-right">Usos</th>
              <th className="px-4 py-3 text-right">Comisión</th>
              <th className="px-4 py-3 text-right">Tarifa base</th>
              <th className="px-4 py-3 text-right">Total a pagar</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ affiliate, data, error }) => {
              const closeOne = closeMonthAction.bind(
                null,
                affiliate.id,
                selected.year,
                selected.month
              );
              return (
                <tr key={affiliate.id} className="border-t border-neutral-800">
                  <td className="px-4 py-3">{affiliate.name}</td>
                  <td className="px-4 py-3 font-mono text-orange-400 text-xs">
                    {affiliate.codes.length > 0
                      ? affiliate.codes.map((c) => c.code).join(", ")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">{data?.timesUsed ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    {data ? formatCLP(data.totalCommission) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-400">
                    {data ? formatCLP(data.baseFee) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {data ? formatCLP(data.totalPago) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {error && <span className="text-red-500 text-xs">Error Shopify</span>}
                    {!error && data?.status === "en_curso" && (
                      <span className="text-amber-400 text-xs">En curso</span>
                    )}
                    {!error && data?.status === "cerrado" && (
                      <span className="text-blue-400 text-xs">
                        Cerrado {data.closedAt ? formatDateTime(data.closedAt) : ""}
                      </span>
                    )}
                    {!error && data?.status === "pagado" && (
                      <span className="text-green-400 text-xs">
                        Pagado {data.paidAt ? formatDateTime(data.paidAt) : ""}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <form action={closeOne} className="inline">
                      <button
                        type="submit"
                        className="text-neutral-400 hover:text-white text-xs mr-3"
                      >
                        {data?.status === "en_curso" ? "Cerrar mes" : "Recalcular"}
                      </button>
                    </form>
                    {data?.status === "cerrado" && data.snapshotId && (
                      <form
                        action={markSnapshotPaidAction.bind(null, data.snapshotId)}
                        className="inline"
                      >
                        <button type="submit" className="text-orange-400 hover:text-orange-300 text-xs">
                          Marcar pagado
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-neutral-500">
                  No hay afiliados activos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-neutral-500 text-xs mt-4">
        "Cerrar mes" congela los números actuales en la base de datos del
        portal. Si lo cierras y todavía faltan pedidos por sincronizar en
        Shopify, puedes volver a esta página y usar "Recalcular" mientras el
        mes siga dentro de los 60 días — una vez que se pase esa ventana, el
        número congelado queda como definitivo.
      </p>
    </div>
  );
}
