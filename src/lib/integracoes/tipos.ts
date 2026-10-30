export type Plataforma = "meta_ads" | "google_ads" | "whatsapp_group" | "gmb" | "hotjar" | "analytics";

/** Item listado por uma plataforma (conta de anúncio, grupo…). */
export type Conta = { id: string; nome: string; detalhe?: string; moeda?: string };
export type MesGasto = { mes: string; valor: number }; // mes = YYYY-MM-01

export type Resultado<T> =
  | { ok: true; dados: T }
  | { ok: false; erro: string; faltando?: string[] };

/** Variáveis de ambiente que não estão definidas. */
export const faltando = (nomes: string[]) => nomes.filter((n) => !process.env[n]?.trim());

export const falha = (erro: unknown): { ok: false; erro: string } => ({
  ok: false,
  erro: erro instanceof Error ? erro.message : String(erro),
});
