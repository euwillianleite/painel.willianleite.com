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

  type Item = { rotulo: string; moeda: string; s: ReturnType<typeof resumirGasto> | null; erro?: string };
  const itens: Item[] = linhas.map(({ c, r }) => {
    const rotulo = `${c.platform === "meta_ads" ? "Meta" : "Google"} · ${c.name ?? c.external_id}`;
    if (!r.ok) return { rotulo, moeda: "BRL", s: null, erro: r.faltando?.length ? "integração não configurada" : r.erro };
    return { rotulo, moeda: (r.dados.moeda ?? c.currency ?? "BRL").toUpperCase(), s: resumirGasto(r.dados.meses, hoje) };
  });

  // Soma por moeda: contas em moedas diferentes nunca são somadas entre si.
  const somar = (campo: "mesAnterior" | "media3" | "total") => {
    const porMoeda = new Map<string, number>();
    for (const i of itens) if (i.s) porMoeda.set(i.moeda, (porMoeda.get(i.moeda) ?? 0) + i.s[campo]);
    return [...porMoeda.entries()].map(([m, v]) => fmt(v, m)).join(" + ") || "—";
  };
  const colunas = [
    { campo: "mesAnterior", titulo: "Mês anterior" },
    { campo: "media3", titulo: "Média 3 meses" },
    { campo: "total", titulo: "Total" },
  ] as const;

  return (
    <div className="verba-grid">
      {colunas.map((col) => (
        <section key={col.campo} className="verba-col">
          <header><span className="verba-plat">{col.titulo}</span><strong className="verba-soma">{somar(col.campo)}</strong></header>
          <ul className="verba-lista">
            {itens.map((i) => (
              <li key={i.rotulo}>
                <span>{i.rotulo}</span>
                {i.s ? <b>{fmt(i.s[col.campo], i.moeda)}</b> : <em title={i.erro}>—</em>}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {itens.some((i) => i.erro) && (
        <p className="muted small" style={{ gridColumn: "1 / -1", margin: 0 }}>
          {itens.filter((i) => i.erro).map((i) => `${i.rotulo}: ${i.erro}`).join(" · ")}
        </p>
      )}
    </div>
  );
}
