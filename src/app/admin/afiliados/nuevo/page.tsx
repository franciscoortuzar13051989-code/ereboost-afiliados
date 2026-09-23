import { createAffiliate } from "@/app/actions/admin";
import { getSettings } from "@/lib/settings";

export default async function NewAffiliatePage() {
  const settings = await getSettings();
  const defaultPct = (settings.defaultCommissionPct * 100).toString();

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold mb-6">Nuevo afiliado</h1>

      <form action={createAffiliate} className="space-y-4 bg-neutral-900 border border-neutral-800 rounded-lg p-6">
        <div>
          <label className="block text-sm text-neutral-300 mb-1">Nombre</label>
          <input
            name="name"
            required
            className="w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-white"
          />
        </div>

        <div>
          <label className="block text-sm text-neutral-300 mb-1">Email</label>
          <input
            name="email"
            type="email"
            required
            className="w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-white"
          />
          <p className="text-xs text-neutral-500 mt-1">
            Con este email el afiliado entra a su propio dashboard.
          </p>
        </div>

        <div>
          <label className="block text-sm text-neutral-300 mb-1">
            Contraseña del afiliado
          </label>
          <input
            name="password"
            type="password"
            required
            minLength={6}
            className="w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-white"
          />
        </div>

        <div>
          <label className="block text-sm text-neutral-300 mb-1">
            Primer código de descuento (Shopify)
          </label>
          <input
            name="discountCode"
            required
            placeholder="EJ: JUANPEREZ5"
            className="w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-white font-mono"
          />
          <p className="text-xs text-neutral-500 mt-1">
            Debe coincidir EXACTAMENTE con un código de descuento ya creado en
            Shopify (Descuentos → Crear descuento). Podrás agregar más
            códigos a este afiliado (ej. uno de 10% y otro de 5%) después de
            crearlo, desde su ficha — la comisión del afiliado es siempre la
            misma sin importar cuál código use el cliente.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-neutral-300 mb-1">
              % descuento al cliente
            </label>
            <input
              name="discountPct"
              type="number"
              step="0.1"
              defaultValue="5"
              required
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
              defaultValue={defaultPct}
              required
              className="w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-neutral-300 mb-1">
            Tarifa base mensual (CLP) — dejar en blanco para usar la de
            Configuración (${settings.defaultBaseFee.toLocaleString("es-CL")})
          </label>
          <input
            name="baseFee"
            type="number"
            placeholder={settings.defaultBaseFee.toString()}
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
            className="w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-white"
          />
        </div>

        <button
          type="submit"
          className="bg-orange-600 hover:bg-orange-500 text-white rounded-md px-4 py-2 font-medium"
        >
          Crear afiliado
        </button>
      </form>
    </div>
  );
}
