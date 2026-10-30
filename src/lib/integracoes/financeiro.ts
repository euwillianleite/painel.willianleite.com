import { financeiroMeta } from "./meta";
import { financeiroGoogle } from "./google";
import { previsao, type Financeiro, type Previsao } from "./saldo";
import type { Resultado } from "./tipos";
import { hojeISO } from "../format";

export type ContaMidia = { platform: "meta_ads" | "google_ads"; external_id: string; name: string | null };
export type ContaComSaldo = { conta: ContaMidia; r: Resultado<{ fin: Financeiro; prev: Previsao }> };

/** Financeiro + previsão de cada conta, em paralelo (cada chamada tem cache próprio). */
export async function carregarSaldos(contas: ContaMidia[]): Promise<ContaComSaldo[]> {
  const hoje = hojeISO();
  return Promise.all(
    contas.map(async (conta) => {
      const r = conta.platform === "meta_ads" ? await financeiroMeta(conta.external_id) : await financeiroGoogle(conta.external_id);
      if (!r.ok) return { conta, r };
      return { conta, r: { ok: true as const, dados: { fin: r.dados, prev: previsao(r.dados, hoje) } } };
    }),
  );
}
