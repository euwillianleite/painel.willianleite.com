import { unstable_cache } from "next/cache";
import { faltando, falha, type Conta, type MesGasto, type Resultado } from "./tipos";
import { parseFinanceiroMeta, type Financeiro } from "./saldo";

export const META_VARS = ["META_ACCESS_TOKEN"];
const versao = () => process.env.META_GRAPH_VERSION?.trim() || "v26.0";
const base = () => `https://graph.facebook.com/${versao()}`;

const STATUS: Record<number, string> = {
  1: "Ativa", 2: "Desativada", 3: "Pagamento pendente", 7: "Em análise de risco", 8: "Liquidação pendente",
  9: "Período de carência", 100: "Encerramento pendente", 101: "Encerrada",
};

async function graph(url: string): Promise<{ data?: unknown[]; paging?: { next?: string } }> {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${process.env.META_ACCESS_TOKEN}` }, cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Meta: ${j?.error?.message ?? `HTTP ${r.status}`}`);
  return j;
}

type ContaMeta = { account_id?: string; name?: string; account_status?: number; currency?: string };
export function parseContasMeta(itens: ContaMeta[]): Conta[] {
  return itens
    .filter((c) => c.account_id)
    .map((c) => ({
      id: String(c.account_id), nome: c.name || `Conta ${c.account_id}`,
      detalhe: STATUS[c.account_status ?? 0] ?? undefined, moeda: c.currency,
    }));
}

type LinhaInsights = { spend?: string; date_start?: string; account_currency?: string };
export function parseGastoMeta(itens: LinhaInsights[]): { meses: MesGasto[]; moeda?: string } {
  return {
    meses: itens.filter((i) => i.date_start).map((i) => ({ mes: i.date_start!.slice(0, 7) + "-01", valor: Number(i.spend ?? 0) })),
    moeda: itens.find((i) => i.account_currency)?.account_currency,
  };
}

async function paginar<T>(url: string, max = 10): Promise<T[]> {
  const out: T[] = [];
  let prox: string | undefined = url;
  for (let i = 0; i < max && prox; i++) {
    const j = await graph(prox);
    out.push(...((j.data ?? []) as T[]));
    prox = j.paging?.next;
  }
  return out;
}

export const listarContasMeta = unstable_cache(
  async (): Promise<Resultado<Conta[]>> => {
    const f = faltando(META_VARS);
    if (f.length) return { ok: false, erro: "Meta não configurado.", faltando: f };
    try {
      const itens = await paginar<ContaMeta>(`${base()}/me/adaccounts?fields=account_id,name,account_status,currency&limit=100`);
      return { ok: true, dados: parseContasMeta(itens).sort((a, b) => a.nome.localeCompare(b.nome)) };
    } catch (e) {
      return falha(e);
    }
  },
  ["meta-contas"],
  { revalidate: 300, tags: ["conexao"] },
);

export const gastoMensalMeta = unstable_cache(
  async (contaId: string): Promise<Resultado<{ meses: MesGasto[]; moeda?: string }>> => {
    const f = faltando(META_VARS);
    if (f.length) return { ok: false, erro: "Meta não configurado.", faltando: f };
    try {
      const itens = await paginar<LinhaInsights>(
        `${base()}/act_${encodeURIComponent(contaId)}/insights?fields=spend,account_currency&time_increment=monthly&date_preset=maximum&limit=100`,
      );
      return { ok: true, dados: parseGastoMeta(itens) };
    } catch (e) {
      return falha(e);
    }
  },
  ["meta-gasto"],
  { revalidate: 3600, tags: ["conexao"] },
);

/** Saldo, ritmo de gasto (7 dias) e gasto do mês de uma conta. Cache curto: o saldo muda ao longo do dia. */
export const financeiroMeta = unstable_cache(
  async (contaId: string): Promise<Resultado<Financeiro>> => {
    const f = faltando(META_VARS);
    if (f.length) return { ok: false, erro: "Meta não configurado.", faltando: f };
    try {
      const id = encodeURIComponent(contaId);
      const [conta, dias, mes] = await Promise.all([
        graph(`${base()}/act_${id}?fields=currency,is_prepay_account,balance,spend_cap,amount_spent,funding_source_details`),
        graph(`${base()}/act_${id}/insights?fields=spend,account_currency&time_increment=1&date_preset=last_7d&limit=31`),
        graph(`${base()}/act_${id}/insights?fields=spend&date_preset=this_month`),
      ]);
      return {
        ok: true,
        dados: parseFinanceiroMeta(conta as Parameters<typeof parseFinanceiroMeta>[0], (dias.data ?? []) as LinhaInsights[], (mes.data ?? []) as LinhaInsights[]),
      };
    } catch (e) {
      return falha(e);
    }
  },
  ["meta-financeiro"],
  { revalidate: 600, tags: ["conexao"] },
);

/** Altera o nome da conta de anúncio na Meta (exige permissão de gerenciamento de anúncios no token). */
export async function renomearContaMeta(contaId: string, nome: string): Promise<Resultado<null>> {
  const f = faltando(META_VARS);
  if (f.length) return { ok: false, erro: "Meta não configurado.", faltando: f };
  try {
    const r = await fetch(`${base()}/act_${encodeURIComponent(contaId)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.META_ACCESS_TOKEN}`, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ name: nome }),
      cache: "no-store",
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j?.error || j?.success === false) throw new Error(`Meta: ${j?.error?.error_user_msg ?? j?.error?.message ?? `HTTP ${r.status}`}`);
    return { ok: true, dados: null };
  } catch (e) {
    return falha(e);
  }
}
