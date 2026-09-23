import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { getMonthData, getHistoricalTotal, currentMonthKey } from "@/lib/monthly";
import Link from "next/link";

export const dynamic = "force-dynamic"; // siempre pedir datos frescos a Shopify

function formatCLP(n: number) {
  return n.toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}

const MES_NOMBRE = new Date().toLocaleDateString("es-CL", { month: "long", year: "numeric" });

export default async function AdminOverviewPage() {
  const [affiliates, settings] = await Promise.all([
    prisma.affiliate.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      include: { codes: true },
    }),
    getSettings(),
  ]);

  const current = currentMonthKey();

  let rows: {
    id: string;
    name: string;
    codes: string[];
    timesUsed: number;
    totalSubtotal: number;
    totalCommission: number;
    baseFee: number;
    monthCommission: number;
    pagoEstimadoMes: number;
    error?: string;
  }[] = [];

  try {
    rows = await Promise.all(
      affiliates.map(async (a) => {
        const baseFee = a.baseFee ?? settings.defaultBaseFee;
        try {
          const [historico, monthData] = await Promise.all([
            getHistoricalTotal(a, settings),
            getMonthData(a, settings, current),
          ]);
          return {
            id: a.id,
            name: a.name,
            codes: a.codes.map((c) => c.code),
            timesUsed: historico.timesUsed,
            totalSubtotal: historico.totalSubtotal,
            totalCommission: historico.totalCommission,
            baseFee,
            monthCommission: monthData.totalCommission,
            pagoEstimadoMes: monthData.totalPago,
          };
        } catch (err: any) {
          return {
            id: a.id,
            name: a.name,
            codes: a.codes.map((c) => c.code),
            timesUsed: 0,
            totalSubtotal: 0,
            totalCommission: 0,
            baseFee,
            monthCommission: 0,
            pagoEstimadoMes: baseFee,
            error: err?.message || "Error al consultar Shopify",
          };
        }
      })
    );
  } catch {
    // noop — errores individuales ya se capturan por fila
  }

  const totalComision = rows.reduce((s, r) => s + r.totalCommission, 0);
  const totalUsos = rows.reduce((s, r) => s + r.timesUsed, 0);
  const totalPagoMes = rows.reduce((s, r) => s + r.pagoEstimadoMes, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Resumen</h1>
        <div className="flex gap-3">
          <Link
            href="/admin/meses"
            className="bg-neutral-800 hover:bg-neutral-700 text-white text-sm rounded-md px-4 py-2"
          >
            Cierre de meses
          </Link>
          <Link
            href="/admin/afiliados/nuevo"
            className="bg-orange-600 hover:bg-orange-500 text-white text-sm rounded-md px-4 py-2"
          >
            + Nuevo afiliado
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
          <p className="text-neutral-400 text-sm">Afiliados activos</p>
          <p className="text-2xl font-semibold">{affiliates.length}</p>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
          <p className="text-neutral-400 text-sm">Usos totales de códigos (histórico)</p>
          <p className="text-2xl font-semibold">{totalUsos}</p>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
          <p className="text-neutral-400 text-sm">Comisión histórica total</p>
          <p className="text-2xl font-semibold">{formatCLP(totalComision)}</p>
        </div>
        <div className="bg-orange-950/40 border border-orange-800 rounded-lg p-4">
          <p className="text-orange-300 text-sm capitalize">A pagar — {MES_NOMBRE}</p>
          <p className="text-2xl font-semibold text-orange-400">{formatCLP(totalPagoMes)}</p>
        </div>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-800/50 text-neutral-400 text-left">
            <tr>
              <th className="px-4 py-3">Afiliado</th>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3 text-right">Usos (histórico)</th>
              <th className="px-4 py-3 text-right">Ventas (histórico)</th>
              <th className="px-4 py-3 text-right">Comisión (histórico)</th>
              <th className="px-4 py-3 text-right">Tarifa base</th>
              <th className="px-4 py-3 text-right">Comisión este mes</th>
              <th className="px-4 py-3 text-right font-semibold">A pagar este mes</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-neutral-800">
                <td className="px-4 py-3">{r.name}</td>
                <td className="px-4 py-3 font-mono text-orange-400 text-xs">
                  {r.codes.length > 0 ? r.codes.join(", ") : "—"}
                </td>
                <td className="px-4 py-3 text-right">{r.timesUsed}</td>
                <td className="px-4 py-3 text-right">
                  {formatCLP(r.totalSubtotal)}
                </td>
                <td className="px-4 py-3 text-right">
                  {formatCLP(r.totalCommission)}
                </td>
                <td className="px-4 py-3 text-right text-neutral-400">
                  {formatCLP(r.baseFee)}
                </td>
                <td className="px-4 py-3 text-right text-neutral-400">
                  {formatCLP(r.monthCommission)}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-orange-400">
                  {formatCLP(r.pagoEstimadoMes)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/afiliados/${r.id}`}
                    className="text-neutral-400 hover:text-white text-xs"
                  >
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-neutral-500">
                  Todavía no hay afiliados activos.
                </td>
              </tr>
            )}
            {rows.some((r) => r.error) && (
              <tr>
                <td colSpan={9} className="px-4 py-3 text-xs text-red-500">
                  Algunos afiliados no pudieron consultarse en Shopify — revisa
                  la conexión en Configuración.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-neutral-500 text-xs mt-4">
        El histórico suma los meses ya cerrados (guardados en el portal) más
        el mes en curso, calculado en vivo contra Shopify — así el número no
        se achica cuando un mes pasa los 60 días de Shopify. Umbral envío
        gratis: {formatCLP(settings.freeShippingThreshold)} · Costo promedio
        envío descontado: {formatCLP(settings.avgShippingCost)} · IVA
        descontado: {(settings.ivaPct * 100).toFixed(0)}% · Tarifa base por
        defecto: {formatCLP(settings.defaultBaseFee)}.
      </p>
    </div>
  );
}
