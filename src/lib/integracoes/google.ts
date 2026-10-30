import { unstable_cache } from "next/cache";
import { addMeses, primeiroDia } from "../fluxo";
import { hojeISO } from "../format";
import { faltando, falha, type Conta, type MesGasto, type Resultado } from "./tipos";

export const GOOGLE_VARS = [
  "GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET",
  "GOOGLE_ADS_REFRESH_TOKEN", "GOOGLE_ADS_LOGIN_CUSTOMER_ID",
];
const versao = () => process.env.GOOGLE_ADS_API_VERSION?.trim() || "v25";
const soDigitos = (s: string) => s.replace(/\D/g, "");

let cacheToken: { valor: string; expira: number } | null = null;
async function accessToken(): Promise<string> {
  if (cacheToken && cacheToken.expira > Date.now() + 60_000) return cacheToken.valor;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID!, client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!, grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(`Google OAuth: ${j.error_description ?? j.error ?? `HTTP ${r.status}`}`);
  cacheToken = { valor: j.access_token, expira: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return cacheToken.valor;
}

/** Consulta GAQL pelo MCC (login-customer-id). */
async function gaql(customerId: string, query: string): Promise<Record<string, any>[]> {
  const mcc = soDigitos(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID!);
  const out: Record<string, any>[] = [];
  let pageToken: string | undefined;
  for (let i = 0; i < 20; i++) {
    const r = await fetch(`https://googleads.googleapis.com/${versao()}/customers/${soDigitos(customerId)}/googleAds:search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await accessToken()}`,
        // Opcional: desde set/2026 o acesso pertence ao projeto do Google Cloud (o cabeçalho é ignorado).
        ...(process.env.GOOGLE_ADS_DEVELOPER_TOKEN ? { "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN } : {}),
        "login-customer-id": mcc,
        "content-type": "application/json",
      },
      body: JSON.stringify({ query, pageToken }),
      cache: "no-store",
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`Google Ads: ${j?.error?.message ?? `HTTP ${r.status}`}`);
    out.push(...(j.results ?? []));
    pageToken = j.nextPageToken;
    if (!pageToken) break;
  }
  return out;
}

type LinhaCliente = { customerClient?: { id?: string; descriptiveName?: string; status?: string; currencyCode?: string } };
export function parseContasGoogle(linhas: LinhaCliente[]): Conta[] {
  const STATUS: Record<string, string> = { ENABLED: "Ativa", CANCELED: "Cancelada", SUSPENDED: "Suspensa", CLOSED: "Fechada" };
  return linhas
    .filter((l) => l.customerClient?.id)
    .map((l) => ({
      id: String(l.customerClient!.id), nome: l.customerClient!.descriptiveName || `Conta ${l.customerClient!.id}`,
      detalhe: STATUS[l.customerClient!.status ?? ""] ?? l.customerClient!.status, moeda: l.customerClient!.currencyCode,
    }));
}

type LinhaGasto = { segments?: { month?: string }; metrics?: { costMicros?: string | number } };
export function parseGastoGoogle(linhas: LinhaGasto[]): MesGasto[] {
  return linhas
    .filter((l) => l.segments?.month)
    .map((l) => ({ mes: l.segments!.month!.slice(0, 7) + "-01", valor: Number(l.metrics?.costMicros ?? 0) / 1_000_000 }));
}

export const listarContasGoogle = unstable_cache(
  async (): Promise<Resultado<Conta[]>> => {
    const f = faltando(GOOGLE_VARS);
    if (f.length) return { ok: false, erro: "Google Ads não configurado.", faltando: f };
    try {
      const linhas = await gaql(
        process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID!,
        "SELECT customer_client.id, customer_client.descriptive_name, customer_client.status, customer_client.currency_code " +
          "FROM customer_client WHERE customer_client.manager = FALSE",
      );
      return { ok: true, dados: parseContasGoogle(linhas).sort((a, b) => a.nome.localeCompare(b.nome)) };
    } catch (e) {
      return falha(e);
    }
  },
  ["google-contas"],
  { revalidate: 300, tags: ["conexao"] },
);

export const gastoMensalGoogle = unstable_cache(
  async (contaId: string): Promise<Resultado<{ meses: MesGasto[]; moeda?: string }>> => {
    const f = faltando(GOOGLE_VARS);
    if (f.length) return { ok: false, erro: "Google Ads não configurado.", faltando: f };
    try {
      const hoje = hojeISO();
      const de = addMeses(primeiroDia(hoje), -35);
      const linhas = await gaql(
        contaId,
        `SELECT segments.month, metrics.cost_micros FROM customer WHERE segments.date BETWEEN '${de}' AND '${hoje}'`,
      );
      return { ok: true, dados: { meses: parseGastoGoogle(linhas) } };
    } catch (e) {
      return falha(e);
    }
  },
  ["google-gasto"],
  { revalidate: 3600, tags: ["conexao"] },
);
