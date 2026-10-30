import { supabaseServer } from "@/lib/supabase/server";
import { gastoMensalMeta } from "@/lib/integracoes/meta";
import { gastoMensalGoogle } from "@/lib/integracoes/google";
import { resumirGasto } from "@/lib/integracoes/gasto";
import { hojeISO } from "@/lib/format";
import type { Resultado, MesGasto } from "@/lib/integracoes/tipos";

const fmt = (n: number, moeda?: string | null) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: moeda && moeda.length === 3 ? moeda : "BRL" }).format(n);

type Conta = { id: string; platform: "meta_ads" | "google_ads"; external_id: string; name: string | null; currency: string | null };

/** Gasto em mídia das contas do cliente (somente leitura, com cache de 1 hora). Carrega depois do restante da página. */
export async function VerbaMidia({ clientId }: { clientId: string }) {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("client_connections")
    .select("id,platform,external_id,name,currency")
    .eq("client_id", clientId)
    .in("platform", ["meta_ads", "google_ads"])
    .order("created_at");
  const contas = (data ?? []).filter((c) => c.external_id) as Conta[];

  if (contas.length === 0) {
    return <p className="muted">Nenhuma conta de anúncio vinculada. Vincule em <a href="/conexao">Conexão</a>.</p>;
  }

  const hoje = hojeISO();
  const linhas = await Promise.all(
    contas.map(async (c) => {
      const r: Resultado<{ meses: MesGasto[]; moeda?: string }> =
        c.platform === "meta_ads" ? await gastoMensalMeta(c.external_id) : await gastoMensalGoogle(c.external_id);
      return { c, r };
    }),
  );

  return (
    <div className="verba-grid">
      {linhas.map(({ c, r }) => {
        const plataforma = c.platform === "meta_ads" ? "Meta Ads" : "Google Ads";
        const nome = c.name ?? c.external_id;
        if (!r.ok) {
          return (
            <section key={c.external_id} className="verba-col">
              <header><span className="verba-plat">{plataforma}</span><strong>{nome}</strong></header>
              <p className="muted small">{r.faltando?.length ? "Integração não configurada." : r.erro}</p>
            </section>
          );
        }
        const s = resumirGasto(r.dados.meses, hoje);
        const moeda = r.dados.moeda ?? c.currency;
        return (
          <section key={c.external_id} className="verba-col">
            <header><span className="verba-plat">{plataforma}</span><strong>{nome}</strong></header>
            <dl>
              <div><dt>Mês anterior</dt><dd>{fmt(s.mesAnterior, moeda)}</dd></div>
              <div><dt>Média 3 meses</dt><dd>{fmt(s.media3, moeda)}</dd></div>
              <div><dt>Total</dt><dd>{fmt(s.total, moeda)}</dd></div>
            </dl>
          </section>
        );
      })}
    </div>
  );
}
