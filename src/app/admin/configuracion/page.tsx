import { getSettings } from "@/lib/settings";
import { updateSettings } from "@/app/actions/admin";
import { testShopifyConnection } from "@/lib/shopify";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getSettings();
  const connection = await testShopifyConnection();

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-xl font-semibold">Configuración</h1>

      <div
        className={`rounded-lg border p-4 text-sm ${
          connection.ok
            ? "border-green-800 bg-green-950 text-green-400"
            : "border-red-800 bg-red-950 text-red-400"
        }`}
      >
        {connection.ok
          ? `Conectado a Shopify: ${connection.shopName}`
          : `No se pudo conectar a Shopify: ${connection.error}. Revisa SHOPIFY_STORE_DOMAIN y SHOPIFY_ADMIN_API_TOKEN en las variables de entorno.`}
      </div>

      <form
        action={updateSettings}
        className="space-y-4 bg-neutral-900 border border-neutral-800 rounded-lg p-6"
      >
        <div>
          <label className="block text-sm text-neutral-300 mb-1">
            Dominio de la tienda (informativo)
          </label>
          <input
            name="shopDomain"
            defaultValue={settings.shopDomain}
            className="w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-white"
          />
        </div>

        <div>
          <label className="block text-sm text-neutral-300 mb-1">
            Umbral de envío gratis (CLP)
          </label>
          <input
            name="freeShippingThreshold"
            type="number"
            required
            defaultValue={settings.freeShippingThreshold}
            className="w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-white"
          />
          <p className="text-xs text-neutral-500 mt-1">
            Pedidos con subtotal igual o mayor a este monto se consideran envío
            gratis (Ereboost paga el envío).
          </p>
        </div>

        <div>
          <label className="block text-sm text-neutral-300 mb-1">
            Costo promedio de envío que paga Ereboost (CLP)
          </label>
          <input
            name="avgShippingCost"
            type="number"
            required
            defaultValue={settings.avgShippingCost}
            className="w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-white"
          />
          <p className="text-xs text-neutral-500 mt-1">
            Se descuenta de la venta antes de calcular la comisión, solo en
            pedidos con envío gratis.
          </p>
        </div>

        <div>
          <label className="block text-sm text-neutral-300 mb-1">
            % IVA a descontar antes de calcular la comisión
          </label>
          <input
            name="ivaPct"
            type="number"
            step="0.1"
            required
            defaultValue={settings.ivaPct * 100}
            className="w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-white"
          />
          <p className="text-xs text-neutral-500 mt-1">
            Se descuenta de TODOS los pedidos (con o sin envío gratis) antes de
            calcular el % de comisión. Chile = 19.
          </p>
        </div>

        <div>
          <label className="block text-sm text-neutral-300 mb-1">
            Tarifa base mensual por afiliado (CLP)
          </label>
          <input
            name="defaultBaseFee"
            type="number"
            required
            defaultValue={settings.defaultBaseFee}
            className="w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-white"
          />
          <p className="text-xs text-neutral-500 mt-1">
            Se le paga a cada afiliado a fin de mes además de su comisión
            acumulada. Se puede sobreescribir por afiliado individual.
          </p>
        </div>

        <div>
          <label className="block text-sm text-neutral-300 mb-1">
            % comisión por defecto para afiliados nuevos
          </label>
          <input
            name="defaultCommissionPct"
            type="number"
            step="0.1"
            required
            defaultValue={settings.defaultCommissionPct * 100}
            className="w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-white"
          />
        </div>

        <button
          type="submit"
          className="bg-orange-600 hover:bg-orange-500 text-white rounded-md px-4 py-2 font-medium"
        >
          Guardar
        </button>
      </form>
    </div>
  );
}
