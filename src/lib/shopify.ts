import { GraphQLClient, gql } from "graphql-request";

const domain = process.env.SHOPIFY_STORE_DOMAIN;
const apiVersion = process.env.SHOPIFY_API_VERSION || "2026-01";

// Las apps creadas en el "Dev Dashboard" nuevo de Shopify (2026+) ya no
// exponen un token fijo (shpat_...) en la interfaz. En vez de eso, hay que
// intercambiar el Client ID + Client Secret de la app por un token de
// acceso temporal (dura 24 horas) usando el flujo "client credentials
// grant". Acá lo pedimos y lo guardamos en memoria, renovándolo solo
// cuando está por vencer — así el resto del código no tiene que saber que
// esto existe.
const clientId = process.env.SHOPIFY_CLIENT_ID;
const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
// Compatibilidad: si alguien todavía tiene un token clásico (shpat_...) de
// una app "heredada", se puede seguir usando directo, sin pedir uno nuevo.
const staticToken = process.env.SHOPIFY_ADMIN_API_TOKEN;

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (staticToken) return staticToken;

  if (!domain || !clientId || !clientSecret) {
    throw new Error(
      "Faltan variables de entorno de Shopify. Necesitas SHOPIFY_STORE_DOMAIN y, o bien SHOPIFY_ADMIN_API_TOKEN (app heredada), o bien SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET (app del Dev Dashboard). Revisa .env"
    );
  }

  // Reutiliza el token mientras le queden al menos 5 minutos de vida.
  if (cachedToken && cachedToken.expiresAt - Date.now() > 5 * 60 * 1000) {
    return cachedToken.value;
  }

  const res = await fetch(`https://${domain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `No se pudo obtener un token de acceso de Shopify (${res.status}). ${body}`
    );
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.value;
}

async function getClient() {
  if (!domain) {
    throw new Error(
      "Falta SHOPIFY_STORE_DOMAIN en las variables de entorno. Revisa .env"
    );
  }
  const accessToken = await getAccessToken();
  return new GraphQLClient(
    `https://${domain}/admin/api/${apiVersion}/graphql.json`,
    {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    }
  );
}

const ORDERS_BY_DISCOUNT_CODE = gql`
  query OrdersByDiscountCode($queryString: String!, $cursor: String) {
    orders(first: 100, after: $cursor, query: $queryString, sortKey: CREATED_AT) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          name
          createdAt
          cancelledAt
          test
          displayFinancialStatus
          currentSubtotalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          discountApplications(first: 5) {
            edges {
              node {
                ... on DiscountCodeApplication {
                  code
                }
              }
            }
          }
        }
      }
    }
  }
`;

export interface ShopifyOrderRow {
  id: string;
  name: string;
  createdAt: string;
  subtotal: number;
  currency: string;
  financialStatus: string;
  // Cuál de los códigos del afiliado usó este pedido (en mayúsculas), para
  // poder armar el desglose "veces usado por código" en el portal.
  code: string;
}

export interface OrdersForCodeResult {
  orders: ShopifyOrderRow[];
  timesUsed: number;
  totalSubtotal: number;
}

/**
 * Trae TODOS los pedidos (paginando) que usaron alguno de los códigos de
 * descuento dados, excluyendo pedidos cancelados y pedidos de prueba
 * (test:true). Cada pedido devuelto trae marcado cuál código específico usó.
 *
 * `from`/`to` son fechas ISO opcionales (ej. "2026-09-01") para acotar a un
 * periodo (por ejemplo, el mes de pago de comisiones).
 */
export async function getOrdersForDiscountCodes(
  codes: string[],
  opts?: { from?: string; to?: string }
): Promise<OrdersForCodeResult> {
  const activeCodes = codes.filter((c) => c && c.trim().length > 0);
  if (activeCodes.length === 0) {
    return { orders: [], timesUsed: 0, totalSubtotal: 0 };
  }

  if (process.env.DEMO_MODE === "true") {
    return getDemoOrders(activeCodes, opts);
  }
  const client = await getClient();

  const codeGroup =
    "(" + activeCodes.map((c) => `discount_code:${JSON.stringify(c)}`).join(" OR ") + ")";
  const parts = [codeGroup, `-cancelled_at:*`, `-test:true`];
  if (opts?.from) parts.push(`created_at:>=${opts.from}`);
  if (opts?.to) parts.push(`created_at:<${opts.to}`);
  const queryString = parts.join(" AND ");

  const upperCodes = activeCodes.map((c) => c.toUpperCase());
  const orders: ShopifyOrderRow[] = [];
  let cursor: string | null = null;
  let hasNextPage = true;
  let pages = 0;
  const MAX_PAGES = 50; // hasta 5,000 pedidos por consulta, suficiente para uso mensual normal

  while (hasNextPage && pages < MAX_PAGES) {
    pages++;
    const data: any = await requestWithRetry(client, ORDERS_BY_DISCOUNT_CODE, {
      queryString,
      cursor,
    });

    for (const edge of data.orders.edges) {
      const node = edge.node;
      // Verificación extra: confirmar cuál de nuestros códigos realmente
      // aparece en las discountApplications (por si el filtro de Shopify
      // trajera algo de más), y guardar cuál fue.
      const appliedCodes: string[] = node.discountApplications.edges.map(
        (e: any) => e.node?.code
      );
      const matchedCode = appliedCodes.find(
        (c) => c && upperCodes.includes(c.toUpperCase())
      );
      if (!matchedCode) continue;

      orders.push({
        id: node.id,
        name: node.name,
        createdAt: node.createdAt,
        subtotal: parseFloat(node.currentSubtotalPriceSet.shopMoney.amount),
        currency: node.currentSubtotalPriceSet.shopMoney.currencyCode,
        financialStatus: node.displayFinancialStatus,
        code: matchedCode.toUpperCase(),
      });
    }

    hasNextPage = data.orders.pageInfo.hasNextPage;
    cursor = data.orders.pageInfo.endCursor;
  }

  const totalSubtotal = orders.reduce((sum, o) => sum + o.subtotal, 0);

  return { orders, timesUsed: orders.length, totalSubtotal };
}

/** Reintenta automáticamente si Shopify responde THROTTLED (rate limit de costo). */
async function requestWithRetry(
  client: GraphQLClient,
  query: string,
  variables: Record<string, unknown>,
  attempt = 1
): Promise<any> {
  try {
    return await client.request(query, variables);
  } catch (err: any) {
    const isThrottled =
      err?.response?.errors?.some((e: any) => e.extensions?.code === "THROTTLED") ??
      false;
    if (isThrottled && attempt <= 5) {
      const waitMs = 500 * attempt;
      await new Promise((r) => setTimeout(r, waitMs));
      return requestWithRetry(client, query, variables, attempt + 1);
    }
    throw err;
  }
}

// ---- SOLO PARA DEMO/CAPTURAS: datos reales exportados por CSV, no se usan en producción ----
async function getDemoOrders(
  codes: string[],
  opts?: { from?: string; to?: string }
): Promise<OrdersForCodeResult> {
  const fixtures: Record<string, () => Promise<{ default: any[] }>> = {
    PROFEJOAKO: () => import("./demo-fixtures/profejoako.json").then((m: any) => ({ default: m.default || m })),
    GUILLERIVERA: () => import("./demo-fixtures/guillerivera.json").then((m: any) => ({ default: m.default || m })),
  };
  let orders: ShopifyOrderRow[] = [];
  for (const code of codes) {
    const loader = fixtures[code.toUpperCase()];
    if (!loader) continue;
    const rows = (await loader()).default;
    orders.push(...rows.map((r: any) => ({ ...r, code: (r.code || code).toUpperCase() })));
  }
  if (opts?.from) orders = orders.filter((o) => o.createdAt >= opts.from!);
  if (opts?.to) orders = orders.filter((o) => o.createdAt < opts.to!);
  const totalSubtotal = orders.reduce((s, o) => s + o.subtotal, 0);
  return { orders, timesUsed: orders.length, totalSubtotal };
}

/** Prueba rápida de conexión a la Admin API (usada en el panel admin). */
export async function testShopifyConnection(): Promise<{ ok: boolean; shopName?: string; error?: string }> {
  if (process.env.DEMO_MODE === "true") {
    return { ok: true, shopName: "Ereboost (demo)" };
  }
  try {
    const client = await getClient();
    const data: any = await client.request(gql`
      query {
        shop {
          name
        }
      }
    `);
    return { ok: true, shopName: data.shop.name };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Error desconocido" };
  }
}
