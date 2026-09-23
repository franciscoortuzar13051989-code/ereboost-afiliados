import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AffiliatesListPage() {
  const affiliates = await prisma.affiliate.findMany({
    orderBy: { createdAt: "desc" },
    include: { codes: true },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Afiliados</h1>
        <Link
          href="/admin/afiliados/nuevo"
          className="bg-orange-600 hover:bg-orange-500 text-white text-sm rounded-md px-4 py-2"
        >
          + Nuevo afiliado
        </Link>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-800/50 text-neutral-400 text-left">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Códigos</th>
              <th className="px-4 py-3 text-right">Comisión</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {affiliates.map((a) => (
              <tr key={a.id} className="border-t border-neutral-800">
                <td className="px-4 py-3">{a.name}</td>
                <td className="px-4 py-3 text-neutral-400">{a.email}</td>
                <td className="px-4 py-3 font-mono text-orange-400 text-xs">
                  {a.codes.length > 0
                    ? a.codes.map((c) => c.code).join(", ")
                    : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  {(a.commissionPct * 100).toFixed(1)}%
                </td>
                <td className="px-4 py-3">
                  {a.active ? (
                    <span className="text-green-500 text-xs">Activo</span>
                  ) : (
                    <span className="text-neutral-500 text-xs">Inactivo</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/afiliados/${a.id}`}
                    className="text-neutral-400 hover:text-white text-xs"
                  >
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
            {affiliates.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                  Aún no has agregado afiliados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
