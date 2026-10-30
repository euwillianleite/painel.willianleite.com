/** Saldo e previsão de uso de uma conta de anúncio (lógica pura, sem rede). */

export type TipoConta = "prepago" | "posgasto" | "desconhecido";
export type Financeiro = {
  moeda: string;
  tipo: TipoConta;
  /** Pré-pago: saldo disponível. Google com orçamento: orçamento restante. */
  saldo: number | null;
  saldoRotulo: string;
  /** Pós-pago: valor em aberto a pagar, quando a plataforma informa. */
  fatura: number | null;
  /** Pós-pago com limite de gasto: quanto ainda cabe no limite. */
  limiteRestante: number | null;
  /** Média diária dos últimos 7 dias fechados. */
  mediaDiaria: number;
  gastoMes: number;
};

export const DIAS_CRITICO = 3;
export const DIAS_ATENCAO = 7;

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Extrai o primeiro valor de textos como "Saldo disponível (R$ 1.234,56)" ou "$1,234.56". */
export function parseValorTexto(texto: string | null | undefined): number | null {
  const m = String(texto ?? "").match(/\d[\d.,]*/);
  if (!m) return null;
  const s = m[0].replace(/[.,]+$/, "");
  const ult = Math.max(s.lastIndexOf("."), s.lastIndexOf(","));
  const casas = ult >= 0 ? s.length - ult - 1 : 0;
  const n = ult >= 0 && casas <= 2 ? Number(s.slice(0, ult).replace(/[.,]/g, "") + "." + s.slice(ult + 1)) : Number(s.replace(/[.,]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export type Previsao = {
  /** Dias de uso restantes no ritmo atual; null quando não dá para estimar. */
  dias: number | null;
  nivel: "ok" | "atencao" | "critico" | null;
  /** Projeção do gasto total do mês corrente. */
  projecaoMes: number;
  /** Texto curto de apoio quando não há previsão. */
  motivo?: string;
};

export function previsao(f: Financeiro, hojeISO: string): Previsao {
  const [a, m, d] = hojeISO.split("-").map(Number);
  const diasNoMes = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const projecaoMes = r2((f.gastoMes / Math.max(d, 1)) * diasNoMes);

  const base = f.tipo === "prepago" ? f.saldo : f.limiteRestante;
  if (base === null) return { dias: null, nivel: null, projecaoMes, motivo: f.tipo === "prepago" ? "saldo indisponível" : undefined };
  if (base <= 0) return { dias: 0, nivel: "critico", projecaoMes };
  if (f.mediaDiaria <= 0) return { dias: null, nivel: "ok", projecaoMes, motivo: "sem gasto recente" };
  const dias = Math.floor(base / f.mediaDiaria);
  return { dias, nivel: dias <= DIAS_CRITICO ? "critico" : dias <= DIAS_ATENCAO ? "atencao" : "ok", projecaoMes };
}

// ---------- Meta ----------
type ContaFinMeta = {
  currency?: string; is_prepay_account?: boolean | string; balance?: string | number;
  spend_cap?: string | number; amount_spent?: string | number;
  funding_source_details?: { display_string?: string } | null;
};
type LinhaSpend = { spend?: string; account_currency?: string };
const soma = (l: LinhaSpend[]) => l.reduce((t, x) => t + Number(x.spend ?? 0), 0);
const menor = (v: unknown) => (v === undefined || v === null || v === "" ? null : Number(v) / 100); // Meta devolve em centavos

export function parseFinanceiroMeta(conta: ContaFinMeta, dias7: LinhaSpend[], mes: LinhaSpend[]): Financeiro {
  const texto = conta.funding_source_details?.display_string ?? "";
  const prepagoFlag = conta.is_prepay_account === true || conta.is_prepay_account === "true";
  const posFlag = conta.is_prepay_account === false || conta.is_prepay_account === "false";
  const pareceSaldo = /saldo|balance|pr[eé]-?pag|prepa/i.test(texto);
  const tipo: TipoConta = prepagoFlag || (!posFlag && pareceSaldo) ? "prepago" : posFlag ? "posgasto" : "desconhecido";

  const cap = menor(conta.spend_cap);
  const gasto = menor(conta.amount_spent);
  const bal = menor(conta.balance);
  return {
    moeda: (conta.currency ?? dias7.find((l) => l.account_currency)?.account_currency ?? "BRL").toUpperCase(),
    tipo,
    saldo: tipo === "prepago" ? parseValorTexto(texto) : null,
    saldoRotulo: "Saldo disponível",
    fatura: tipo === "posgasto" && bal !== null && bal > 0 ? r2(bal) : null,
    limiteRestante: cap && cap > 0 && gasto !== null ? r2(cap - gasto) : null,
    mediaDiaria: r2(soma(dias7) / 7),
    gastoMes: r2(soma(mes)),
  };
}

// ---------- Google ----------
type LinhaDiaG = { customer?: { currencyCode?: string }; metrics?: { costMicros?: string | number } };
type LinhaOrc = {
  accountBudget?: {
    status?: string; adjustedSpendingLimitMicros?: string | number; approvedSpendingLimitMicros?: string | number;
    amountServedMicros?: string | number; approvedEndDateTime?: string;
  };
};
const micros = (l: LinhaDiaG[]) => l.reduce((t, x) => t + Number(x.metrics?.costMicros ?? 0), 0) / 1_000_000;

export function parseFinanceiroGoogle(dias7: LinhaDiaG[], mes: LinhaDiaG[], orcamentos: LinhaOrc[], hojeISO: string): Financeiro {
  const ativos = orcamentos
    .map((o) => o.accountBudget)
    .filter((b) => b && b.status === "APPROVED" && (!b.approvedEndDateTime || b.approvedEndDateTime.slice(0, 10) >= hojeISO))
    .map((b) => ({ limite: Number(b!.adjustedSpendingLimitMicros ?? b!.approvedSpendingLimitMicros ?? 0) / 1_000_000, servido: Number(b!.amountServedMicros ?? 0) / 1_000_000 }))
    .filter((b) => b.limite > 0);
  const temOrc = ativos.length > 0;
  return {
    moeda: (dias7.find((l) => l.customer?.currencyCode)?.customer?.currencyCode ?? "BRL").toUpperCase(),
    tipo: temOrc ? "prepago" : "desconhecido",
    saldo: temOrc ? r2(ativos.reduce((t, b) => t + b.limite - b.servido, 0)) : null,
    saldoRotulo: "Orçamento restante",
    fatura: null,
    limiteRestante: null,
    mediaDiaria: r2(micros(dias7) / 7),
    gastoMes: r2(micros(mes)),
  };
}
