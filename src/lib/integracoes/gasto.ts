import { addMeses, primeiroDia } from "../fluxo";
import type { MesGasto } from "./tipos";

export type ResumoGasto = { mesAnterior: number; media3: number; total: number };

/**
 * mesAnterior = mês fechado anterior ao atual; media3 = média dos 3 meses fechados anteriores
 * (meses antes do primeiro gasto da conta não entram no divisor); total = soma de tudo.
 */
export function resumirGasto(meses: MesGasto[], hojeISO: string): ResumoGasto {
  const atual = primeiroDia(hojeISO);
  const mapa = new Map<string, number>();
  for (const m of meses) mapa.set(primeiroDia(m.mes), (mapa.get(primeiroDia(m.mes)) ?? 0) + m.valor);
  const primeiro = [...mapa.keys()].sort()[0];
  const janela = [addMeses(atual, -3), addMeses(atual, -2), addMeses(atual, -1)].filter((m) => primeiro && m >= primeiro);
  const soma = janela.reduce((t, m) => t + (mapa.get(m) ?? 0), 0);
  const r = (n: number) => Math.round(n * 100) / 100;
  return {
    mesAnterior: r(mapa.get(addMeses(atual, -1)) ?? 0),
    media3: janela.length ? r(soma / janela.length) : 0,
    total: r([...mapa.values()].reduce((t, v) => t + v, 0)),
  };
}
