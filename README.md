# Ereboost — Dashboard de Afiliados

App privada (no es una app de Shopify App Store) que reemplaza a UpPromote/GoAffPro
para el caso específico de Ereboost: cada afiliado tiene un código de descuento,
y gana una comisión sobre la **venta neta** (subtotal del pedido, menos el costo
de envío cuando el pedido calificó para envío gratis).

- **Admin** (`/admin`): crea y edita afiliados, ve el resumen de todos los códigos,
  configura el umbral de envío gratis, el costo promedio de envío, el IVA y la
  tarifa base mensual.
- **Admin → Cierre de meses** (`/admin/meses`): "cierra" un mes por afiliado (o
  para todos a la vez) y lo marca como pagado.
- **Afiliado** (`/portal`): cada afiliado entra con su propio email/contraseña,
  ve por defecto el **mes en curso** (en vivo) y puede filtrar por meses
  anteriores ya cerrados.

El mes en curso se consulta **en vivo** contra Shopify (Admin GraphQL API) cada
vez que se abre la página — así el número siempre coincide con la realidad de
Shopify. El problema es que la Admin API de Shopify solo deja consultar pedidos
de los **últimos 60 días**: si dependiéramos solo de eso, el histórico de un mes
pagado empezaría a "encogerse" y finalmente desaparecer con el tiempo.

Por eso, cuando cierras un mes en `/admin/meses`, sus números (usos, ventas,
comisión, detalle de pedidos) quedan **congelados para siempre** en la tabla
`MonthlySnapshot` de la base de datos del propio portal. El histórico que ven
tanto el admin como cada afiliado es: *suma de todos los meses ya cerrados +
mes en curso calculado en vivo* — nunca depende de una consulta sin límite de
fecha a Shopify.

## Fórmula de comisión (la que definiste, confirmada el 22-09-2026)

Para cada pedido que usó el código de un afiliado:

```
si subtotal_pedido < umbral_envio_gratis:
    venta_neta_con_iva = subtotal_pedido              (el cliente pagó su propio envío)
si subtotal_pedido >= umbral_envio_gratis:
    venta_neta_con_iva = subtotal_pedido - costo_promedio_envio   (Ereboost pagó el envío)

venta_neta = venta_neta_con_iva / (1 + iva_pct)       (se descuenta el IVA en TODOS los casos)
comisión   = venta_neta * % de comisión del afiliado
```

Además, cada afiliado tiene una **tarifa base mensual** fija (por defecto
$200.000, configurable por afiliado) que se suma a la comisión del mes para
calcular el pago total.

Todo esto vive en `src/lib/commission.ts`. El umbral y el costo de envío se
editan en `/admin/configuracion` sin tocar código.

## Requisitos

- Node.js 20+
- Una base de datos Postgres para producción (SQLite sirve para probar local)
- Una **app personalizada (custom app)** de Shopify con acceso de lectura a pedidos

---

## 1. Crear la app personalizada en Shopify (para obtener las credenciales de la Admin API)

Las apps nuevas se crean en el **Dev Dashboard** de Shopify (ya no en el flujo
viejo de "Desarrollo de apps" con token fijo). Estas apps no muestran un
token de acceso estático — en su lugar, el dashboard pide uno nuevo
automáticamente cada 24 horas usando el **Client ID** y el **Client
Secret** de la app (flujo "client credentials grant").

1. Ve a [dev.shopify.com](https://dev.shopify.com) → tu organización → **Apps** → tu app
   (o **Crear app** si todavía no existe).
2. Pestaña **Configuración → Alcance de la API de administración (Admin API scopes)**:
   activa el permiso **`read_orders`** (alcanza con lectura, no necesitamos escribir nada).
3. En la sección **Instalaciones**, instala la app en tu tienda (`ereboost.myshopify.com`)
   si todavía no lo está.
4. En la misma pestaña **Configuración**, sección **Credenciales**, copia el
   **ID de cliente** y, con el ícono de ojo, revela y copia el **Secreto**.

   ⚠️ El **"Token de automatización de la app"** que aparece más abajo en esa
   misma página **no sirve** para esto — es solo para pipelines de CI/CD y
   la Admin API lo rechaza.

Esos dos valores van en `SHOPIFY_CLIENT_ID` y `SHOPIFY_CLIENT_SECRET`.

## 2. Variables de entorno

Copia `.env` (ya viene con la estructura) y completa:

```bash
DATABASE_URL="postgresql://usuario:password@host:5432/basededatos?sslmode=require"
SHOPIFY_STORE_DOMAIN="ereboost.myshopify.com"
SHOPIFY_CLIENT_ID="tu-client-id"
SHOPIFY_CLIENT_SECRET="tu-client-secret"
SHOPIFY_API_VERSION="2026-01"
AUTH_SECRET="genera-uno-con: openssl rand -base64 32"
```

(Si en cambio tienes una app **heredada** con un token clásico `shpat_...`,
puedes usar solo `SHOPIFY_ADMIN_API_TOKEN` en vez de las dos variables de
Client ID/Secret — el código detecta cuál de las dos formas tiene disponible.)

## 3. Pasar a producción (Postgres)

En desarrollo local, `prisma/schema.prisma` usa SQLite (`provider = "sqlite"`) para
no depender de nada externo. Para producción:

1. Crea una base de datos Postgres gratis en [Supabase](https://supabase.com),
   [Neon](https://neon.tech) o Railway.
2. En `prisma/schema.prisma`, cambia:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
3. Borra la carpeta `prisma/migrations` (las migraciones de SQLite no sirven para
   Postgres) y corre:
   ```bash
   npx prisma migrate dev --name init
   ```
4. Pon la URL de Postgres en `DATABASE_URL` (en Vercel, como variable de entorno).

## 4. Instalar y correr localmente

```bash
npm install
npx prisma migrate dev        # crea la base de datos y las tablas
npm run create-admin -- "tu@email.com" "tu-contraseña" "Tu Nombre"   # tu usuario admin
npm run dev
```

Abre `http://localhost:3000` → te manda a `/login`.

## 5. Agregar afiliados

Desde `/admin/afiliados/nuevo`:

- **Código de descuento**: debe existir EXACTAMENTE igual en Shopify
  (Descuentos → Crear descuento → código, ej. `JUANPEREZ5`, 5% de descuento).
  Ereboost sigue creando el descuento en Shopify como siempre; este dashboard
  solo LEE cuántas veces se usó y calcula la comisión — no crea descuentos.
- **Email y contraseña**: con eso el afiliado entra a `/portal` a ver sus números.
- **% comisión**: el que pactaste con ese afiliado (normalmente 5%, pero se puede
  variar por persona).

Un afiliado puede tener **varios códigos de descuento** al mismo tiempo (ej.
uno de 10% de descuento al cliente y otro de 5%). Se agregan desde su ficha
(`/admin/afiliados/[id]`), en la sección "Códigos de descuento". La comisión
del afiliado es SIEMPRE la misma (el % definido en su ficha), sin importar
cuál de sus códigos haya usado el cliente — lo único que cambia entre
códigos es el % de descuento que recibe el comprador. El portal del afiliado
(`/portal`) muestra un desglose que dice cuántas veces se usó cada código y
cuánto generó, para que el afiliado tenga transparencia total.

## 6. Desplegar en Vercel

```bash
npm install -g vercel   # si no lo tienes
vercel
```

En el dashboard de Vercel, agrega las variables de entorno de `.env` (todas menos
`DATABASE_URL` si usas la integración de Vercel Postgres, que la agrega sola).
Después de cada deploy, corre las migraciones contra la base de producción:

```bash
npx prisma migrate deploy
```

Y crea el usuario admin en producción apuntando `DATABASE_URL` a la base de
producción:

```bash
DATABASE_URL="postgresql://..." npm run create-admin -- "tu@email.com" "contraseña" "Tu Nombre"
```

## Notas de volumen y cierre de meses (Shopify)

- La consulta a Shopify pagina automáticamente hasta 5.000 pedidos por código
  por consulta (más que suficiente para uso mensual normal). Si algún código
  supera eso en un mes, avisa para subir el límite.
- Se excluyen automáticamente pedidos cancelados y pedidos de prueba (`test: true`).
- Los reembolsos se reflejan solos: se usa el subtotal *actual* del pedido
  (`currentSubtotalPriceSet`), que ya descuenta reembolsos parciales o totales.
- **La Admin API de Shopify solo deja consultar pedidos de los últimos 60
  días.** Por eso, en `/admin/meses`, cada mes se debe "cerrar" (idealmente
  apenas termine, o al pagarlo) — al cerrarlo, sus números quedan congelados
  en la base de datos del portal y dejan de depender de la ventana de 60 días.
  Si un mes queda sin cerrar por más de 60 días, Shopify deja de devolver esos
  pedidos y ya no se puede recalcular — así que conviene cerrar cada mes
  apenas se pague.

## Estructura del proyecto

```
src/
  lib/
    shopify.ts       — consulta a la Admin API de Shopify (uso de código, ventas)
    commission.ts     — la fórmula de comisión (envío gratis / no gratis / IVA)
    monthly.ts         — cierre de meses (MonthlySnapshot) e histórico "seguro"
    auth.ts           — login de admin y de afiliados (NextAuth)
    settings.ts        — configuración global (umbral, costo envío, IVA, tarifa base)
  app/
    admin/            — panel de administración
    admin/meses/       — cierre y pago de meses por afiliado
    portal/           — dashboard del afiliado (mes en curso + filtro por mes)
    actions/admin.ts   — crear/editar/eliminar afiliados, cerrar meses, config
scripts/
  create-admin.ts     — crear o resetear la contraseña del usuario admin
```
