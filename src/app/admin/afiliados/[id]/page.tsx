import { prisma } from "@/lib/prisma";
import {
  updateAffiliate,
  deleteAffiliate,
  addDiscountCode,
  toggleDiscountCode,
  deleteDiscountCode,
} from "@/app/actions/admin";
import { notFound } from "next/navigation";

export default async function EditAffiliatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const affiliate = await prisma.affiliate.findUnique({
    where: { id },
    include: { codes: { orderBy: { createdAt: "asc" } } },
  });
  if (!affiliate) notFound();

  const updateWithId = updateAffiliate.bind(null, id);
  const deleteWithId = deleteAffiliate.bind(null, id);
  const addCodeWithId = addDiscountCode.bind(null, id);

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold mb-6">Editar afiliado</h1>

      <form
        action={updateWithId}
        className="space-y-4 bg-neutral-900 border border-neutral-800 rounded-lg p-6"
      >
        <div>
          <label className="block text-sm text-neutral-300 mb-1">Nombre</label>
          <input
            name="name"
            required
            defaultValue={affiliate.name}
            className="w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-white"
          />
        </div>

        <div>
          <label className="block text-sm text-neutral-300 mb-1">Email</label>
          <input
            name="email"
            type="email"
            required
            defaultValue={affiliate.email}
            className="w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-white"
          />
        </div>

        <div>
          <label className="block text-sm text-neutral-300 mb-1">
            Nueva contraseña (dejar en blanco para no cambiar)
          </label>
          <input
            name="password"
            type="password"
            minLength={6}
            className="w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-white"
          />
        </div>

        <div>
          <label className="block text-sm text-neutral-300 mb-1">
            % comisión afiliado
          </label>
          <input
            name="commissionPct"
            type="number"
            step="0.1"
            required
            defaultValue={affiliate.commissionPct * 100}
            className="w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-white"
          />
          <p className="text-xs text-neutral-500 mt-1">
            Se aplica igual sin importar cuál de sus códigos haya usado el
            cliente — ver la sección de códigos más abajo.
          </p>
        </div>

        <div>
          <label className="block text-sm text-neutral-300 mb-1">
            Tarifa base mensual (CLP) — dejar en blanco para usar la de
            Configuración
          </label>
          <input
            name="baseFee"
            type="number"
            defaultValue={affiliate.baseFee ?? ""}
            placeholder="200000"
            className="w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-white"
          />
        </div>

        <div>
          <label className="block text-sm text-neutral-300 mb-1">
            Notas (opcional)
          </label>
          <textarea
            name="notes"
            rows={2}
            defaultValue={affiliate.notes || ""}
            className="w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-white"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-neutral-300">
          <input
            type="checkbox"
            name="active"
            defaultChecked={affiliate.active}
            className="rounded border-neutral-700"
          />
          Afiliado activo
        </label>

        <div className="flex items-center justify-between pt-2">
          <button
            type="submit"
            className="bg-orange-600 hover:bg-orange-500 text-white rounded-md px-4 py-2 font-medium"
          >
            Guardar cambios
          </button>
        </div>
      </form>

      <div className="mt-6 bg-neutral-900 border border-neutral-800 rounded-lg p-6">
        <h2 className="text-sm font-semibold text-neutral-200 mb-1">
          Códigos de descuento
        </h2>
        <p className="text-xs text-neutral-500 mb-4">
          Este afiliado puede tener varios códigos (ej. uno de 10% de
          descuento y otro de 5%). La comisión que gana es siempre el{" "}
          {(affiliate.commissionPct * 100).toFixed(1)}% definido arriba, sin
          importar cuál use el cliente — esto solo controla qué % de
          descuento recibe el comprador y permite ver el desglose de uso por
          código en el portal.
        </p>

        <div className="divide-y divide-neutral-800 border border-neutral-800 rounded-md overflow-hidden mb-4">
          {affiliate.codes.map((c) => {
            const toggleAction = toggleDiscountCode.bind(null, c.id, id, !c.active);
            const deleteAction = deleteDiscountCode.bind(null, c.id, id);
            return (
              <div
                key={c.id}
                className="flex items-center justify-between px-4 py-3 bg-neutral-950/40"
              >
                <div>
                  <span className="font-mono text-orange-400">{c.code}</span>
                  <span className="text-neutral-500 text-xs ml-2">
                    {(c.discountPct * 100).toFixed(0)}% dto. al cliente
                  </span>
                  {!c.active && (
                    <span className="text-neutral-600 text-xs ml-2">
                      (inactivo)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <form action={toggleAction}>
                    <button
                      type="submit"
                      className="text-neutral-400 hover:text-white text-xs"
                    >
                      {c.active ? "Desactivar" : "Activar"}
                    </button>
                  </form>
                  <form action={deleteAction}>
                    <button
                      type="submit"
                      className="text-red-500 hover:text-red-400 text-xs"
                    >
                      Eliminar
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
          {affiliate.codes.length === 0 && (
            <div className="px-4 py-6 text-center text-neutral-500 text-sm">
              Este afiliado todavía no tiene códigos.
            </div>
          )}
        </div>

        <form action={addCodeWithId} className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs text-neutral-400 mb-1">
              Nuevo código (Shopify)
            </label>
            <input
              name="code"
              required
              placeholder="EJ: JUANPEREZ10"
              className="w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-white font-mono text-sm"
            />
          </div>
          <div className="w-32">
            <label className="block text-xs text-neutral-400 mb-1">
              % dto. cliente
            </label>
            <input
              name="discountPct"
              type="number"
              step="0.1"
              defaultValue="5"
              required
              className="w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-white text-sm"
            />
          </div>
          <button
            type="submit"
            className="bg-neutral-800 hover:bg-neutral-700 text-white text-sm rounded-md px-4 py-2"
          >
            Agregar
          </button>
        </form>
      </div>

      <form action={deleteWithId} className="mt-4">
        <button
          type="submit"
          className="text-red-500 hover:text-red-400 text-sm"
        >
          Eliminar afiliado
        </button>
      </form>
    </div>
  );
}
