import { dataNoMes } from "./format";
import { valorVigente, type Cliente, type Contrato, type Valor } from "./clientes";

export type PagCliente = { id: string; client_service_id: string; kind: "mensalidade" | "setup"; ref_month: string; amount: number; paid_on: string };
export type Despesa = {
  id: string; name: string; category: "ferramentas" | "equipe" | "outras"; currency: "BRL" | "USD";
  kind: "recorrente" | "pontual"; one_off_date: string | null; one_off_amount: number | null; last_month: string | null;
};
export type VersaoDespesa = { id: string; expense_id: string; starts_on: string; amount: number; pay_day: number; note: string | null };
export type PagDespesa = { id: string; expense_id: string; ref_month: string; amount: number; fx_rate: number | null; amount_brl: number; paid_on: string };

export type Lancamento = {
  chave: string;
  tipo: "entrada" | "saida";
  origem: "mensalidade" | "setup" | "despesa";
  refId: string;               // client_service_id ou expense_id
  mes: string;                 // YYYY-MM-01
  data: string;                // previsto (ou pago, quando pago)
  titulo: string;
  detalhe: string;
  valor: number;               // em reais
  moeda: "BRL" | "USD";
  valorOriginal: number;       // na moeda de origem (previsto)
  status: "pago" | "atrasado" | "previsto";
  pagoId?: string;
  semCotacao?: boolean;
};

export const primeiroDia = (iso: string) => iso.slice(0, 7) + "-01";
export function addMeses(mes: string, n: number) {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}
export function listaMeses(de: string, ate: string) {
  const out: string[] = [];
  for (let m = de; m <= ate; m = addMeses(m, 1)) out.push(m);
  return out;
}

export type EntradaFluxo = {
  clientes: Pick<Cliente, "id" | "name" | "status">[];
  contratos: Contrato[];
  valores: Valor[];
  pagamentos: PagCliente[];
  despesas: Despesa[];
  versoes: VersaoDespesa[];
  pagDespesas: PagDespesa[];
  usd: number | null;   // cotação mais recente (para o que ainda não foi pago)
  hoje: string;         // YYYY-MM-DD
};

const status = (data: string, hoje: string): Lancamento["status"] => (data < hoje ? "atrasado" : "previsto");

/**
 * Gera todos os lançamentos (entradas e saídas) do início do histórico até `ate`.
 * Cliente encerrado não projeta mais nada; só mantém o que já foi pago.
 */
export function gerarLancamentos(e: EntradaFluxo, ate: string): Lancamento[] {
  const out: Lancamento[] = [];

  for (const ct of e.contratos) {
    const cli = e.clientes.find((c) => c.id === ct.client_id);
    if (!cli) continue;
    const ativo = cli.status === "ativo";
    const vs = e.valores.filter((v) => v.client_service_id === ct.id);
    const nome = ct.services?.name ?? "Serviço";
    const inicio = vs.reduce<string | null>((a, v) => (a === null || v.starts_on < a ? v.starts_on : a), null);

    if (inicio) {
      for (const mes of listaMeses(inicio, ate)) {
        const pago = e.pagamentos.find((p) => p.client_service_id === ct.id && p.kind === "mensalidade" && p.ref_month === mes);
        const v = valorVigente(vs, mes);
        if (pago) {
          out.push({ chave: `m:${ct.id}:${mes}`, tipo: "entrada", origem: "mensalidade", refId: ct.id, mes, data: pago.paid_on,
            titulo: cli.name, detalhe: `${nome} · mensalidade`, valor: pago.amount, moeda: "BRL",
            valorOriginal: v?.amount ?? pago.amount, status: "pago", pagoId: pago.id });
        } else if (ativo && v) {
          const data = dataNoMes(mes, v.pay_day ?? 1);
          out.push({ chave: `m:${ct.id}:${mes}`, tipo: "entrada", origem: "mensalidade", refId: ct.id, mes, data,
            titulo: cli.name, detalhe: `${nome} · mensalidade${v.pay_day ? "" : " · dia não definido"}`, valor: v.amount,
            moeda: "BRL", valorOriginal: v.amount, status: status(data, e.hoje) });
        }
      }
    }

    if (ct.setup_amount && ct.setup_date) {
      const mes = primeiroDia(ct.setup_date);
      if (mes <= ate) {
        const pago = e.pagamentos.find((p) => p.client_service_id === ct.id && p.kind === "setup");
        if (pago) {
          out.push({ chave: `s:${ct.id}:${primeiroDia(pago.ref_month)}`, tipo: "entrada", origem: "setup", refId: ct.id, mes: primeiroDia(pago.ref_month),
            data: pago.paid_on, titulo: cli.name, detalhe: `${nome} · setup`, valor: pago.amount, moeda: "BRL",
            valorOriginal: ct.setup_amount, status: "pago", pagoId: pago.id });
        } else if (ativo) {
          out.push({ chave: `s:${ct.id}:${mes}`, tipo: "entrada", origem: "setup", refId: ct.id, mes, data: ct.setup_date,
            titulo: cli.name, detalhe: `${nome} · setup`, valor: ct.setup_amount, moeda: "BRL",
            valorOriginal: ct.setup_amount, status: status(ct.setup_date, e.hoje) });
        }
      }
    }
  }

  for (const d of e.despesas) {
    const brl = (valor: number) => (d.currency === "USD" ? (e.usd ? Math.round(valor * e.usd * 100) / 100 : 0) : valor);
    const semCotacao = d.currency === "USD" && !e.usd;
    const base = { tipo: "saida" as const, origem: "despesa" as const, refId: d.id, titulo: d.name, moeda: d.currency };

    if (d.kind === "pontual") {
      if (!d.one_off_date || d.one_off_amount === null) continue;
      const mes = primeiroDia(d.one_off_date);
      const pago = e.pagDespesas.find((p) => p.expense_id === d.id);
      if (pago) {
        out.push({ ...base, chave: `d:${d.id}:${primeiroDia(pago.ref_month)}`, mes: primeiroDia(pago.ref_month), data: pago.paid_on, detalhe: `${rotuloCategoria(d.category)} · pontual`,
          valor: pago.amount_brl, valorOriginal: pago.amount, status: "pago", pagoId: pago.id });
      } else if (mes <= ate) {
        out.push({ ...base, chave: `d:${d.id}:${mes}`, mes, data: d.one_off_date, detalhe: `${rotuloCategoria(d.category)} · pontual`,
          valor: brl(d.one_off_amount), valorOriginal: d.one_off_amount, status: status(d.one_off_date, e.hoje), semCotacao });
      }
      continue;
    }

    const vs = e.versoes.filter((v) => v.expense_id === d.id);
    const inicio = vs.reduce<string | null>((a, v) => (a === null || v.starts_on < a ? v.starts_on : a), null);
    if (!inicio) continue;
    for (const mes of listaMeses(inicio, ate)) {
      const pago = e.pagDespesas.find((p) => p.expense_id === d.id && p.ref_month === mes);
      const v = valorVigente(vs.map((x) => ({ ...x, client_service_id: x.expense_id, pay_day: x.pay_day })) as unknown as Valor[], mes) as unknown as VersaoDespesa | null;
      if (pago) {
        out.push({ ...base, chave: `d:${d.id}:${mes}`, mes, data: pago.paid_on, detalhe: `${rotuloCategoria(d.category)} · recorrente`,
          valor: pago.amount_brl, valorOriginal: pago.amount, status: "pago", pagoId: pago.id });
      } else if (v && (!d.last_month || mes <= d.last_month)) {
        const data = dataNoMes(mes, v.pay_day);
        out.push({ ...base, chave: `d:${d.id}:${mes}`, mes, data, detalhe: `${rotuloCategoria(d.category)} · recorrente`,
          valor: brl(v.amount), valorOriginal: v.amount, status: status(data, e.hoje), semCotacao });
      }
    }
  }

  return out.sort((a, b) => a.data.localeCompare(b.data) || a.titulo.localeCompare(b.titulo));
}

export const rotuloCategoria = (c: Despesa["category"]) =>
  ({ ferramentas: "Ferramentas e assinaturas", equipe: "Equipe e freelancers", outras: "Outras" })[c];

export type Totais = { entradas: number; saidas: number; lucro: number; entradasPagas: number; saidasPagas: number; lucroReal: number };

export function totais(ls: Lancamento[]): Totais {
  const soma = (f: (l: Lancamento) => boolean) => Math.round(ls.filter(f).reduce((t, l) => t + l.valor, 0) * 100) / 100;
  const entradas = soma((l) => l.tipo === "entrada");
  const saidas = soma((l) => l.tipo === "saida");
  const entradasPagas = soma((l) => l.tipo === "entrada" && l.status === "pago");
  const saidasPagas = soma((l) => l.tipo === "saida" && l.status === "pago");
  return {
    entradas, saidas, lucro: Math.round((entradas - saidas) * 100) / 100,
    entradasPagas, saidasPagas, lucroReal: Math.round((entradasPagas - saidasPagas) * 100) / 100,
  };
}

export type Periodo = { rotulo: string; de: string; ate: string; totais: Totais; acumulado: number };

/** Agrupa os meses em períodos de `tamanho` meses (1, 6 ou 12) e calcula o acumulado. */
export function periodos(ls: Lancamento[], inicio: string, qtdMeses: number, tamanho: number, nomeMes: (m: string) => string): Periodo[] {
  const out: Periodo[] = [];
  let acumulado = 0;
  for (let i = 0; i < qtdMeses; i += tamanho) {
    const de = addMeses(inicio, i);
    const ate = addMeses(inicio, Math.min(i + tamanho, qtdMeses) - 1);
    const t = totais(ls.filter((l) => l.mes >= de && l.mes <= ate));
    acumulado = Math.round((acumulado + t.lucro) * 100) / 100;
    const rotulo = tamanho === 1 ? nomeMes(de) : `${nomeMes(de)} – ${nomeMes(ate)}`;
    out.push({ rotulo, de, ate, totais: t, acumulado });
  }
  return out;
}
