import type { Metadata } from "next";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { faltando, type Conta, type Plataforma, type Resultado } from "@/lib/integracoes/tipos";
import { listarContasMeta, META_VARS } from "@/lib/integracoes/meta";
import { GOOGLE_VARS, listarContasGoogle } from "@/lib/integracoes/google";
import { listarGruposZapi, statusZapi, ZAPI_VARS } from "@/lib/integracoes/zapi";
import { adicionarManual, atualizarLista, desvincular, vincular } from "./actions";

export const metadata: Metadata = { title: "Conexão" };

type Conexao = { id: string; client_id: string; platform: Plataforma; external_id: string | null; name: string | null; url: string | null };
type CliLeve = { id: string; name: string; status: string };

const ABAS = [
  { v: "meta", r: "Meta Ads", vars: META_VARS },
  { v: "google", r: "Google Ads", vars: GOOGLE_VARS },
  { v: "whatsapp", r: "WhatsApp (Z-API)", vars: ZAPI_VARS },
  { v: "outros", r: "Outros", vars: [] as string[] },
] as const;
const PLAT: Record<string, Plataforma> = { meta: "meta_ads", google: "google_ads", whatsapp: "whatsapp_group" };
export const ROTULO: Record<Plataforma, string> = {
  meta_ads: "Meta Ads", google_ads: "Google Ads", whatsapp_group: "Grupo de WhatsApp",
  gmb: "Google Meu Negócio", hotjar: "Hotjar", analytics: "Google Analytics",
};

export default async function Conexao({ searchParams }: { searchParams: Promise<{ aba?: string; erro?: string }> }) {
  const sp = await searchParams;
  const aba = ABAS.find((a) => a.v === sp.aba) ?? ABAS[0];

  const supabase = await supabaseServer();
  const [{ data: cl }, { data: cx }] = await Promise.all([
    supabase.from("clients").select("id,name,status").order("name"),
    supabase.from("client_connections").select("id,client_id,platform,external_id,name,url").order("created_at"),
  ]);
  const clientes = (cl ?? []) as CliLeve[];
  const conexoes = (cx ?? []) as Conexao[];

  // Só consulta a plataforma da aba aberta (carregamento rápido).
  let lista: Resultado<Conta[]> | null = null;
  let zapiOnline: boolean | null = null;
  if (aba.v === "meta") lista = await listarContasMeta();
  if (aba.v === "google") lista = await listarContasGoogle();
  if (aba.v === "whatsapp") {
    lista = await listarGruposZapi();
    const s = await statusZapi();
    zapiOnline = s.ok ? s.dados.conectado : null;
  }

  return (
    <>
      <h1 style={{ marginBottom: 12 }}>Conexão</h1>
      <div className="tabs" style={{ marginBottom: 20 }}>
        {ABAS.map((a) => {
          const ok = a.vars.length === 0 || faltando([...a.vars]).length === 0;
          return (
            <Link key={a.v} href={`/conexao?aba=${a.v}`} aria-current={a.v === aba.v ? "page" : undefined}>
              {a.r}{a.vars.length > 0 && <span className={`dot ${ok ? "on" : "off"}`} title={ok ? "Configurado" : "Não configurado"} />}
            </Link>
          );
        })}
      </div>
      {sp.erro && <p className="error" role="alert">{sp.erro}</p>}

      {aba.v === "outros" ? (
        <Outros clientes={clientes} conexoes={conexoes} />
      ) : (
        <section className="card">
          <div className="toolbar" style={{ marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>
              {aba.r}
              {zapiOnline !== null && (
                <span className={`badge ${zapiOnline ? "ativo" : "perigo"}`}>{zapiOnline ? "Número conectado" : "Número desconectado"}</span>
              )}
            </h2>
            <form action={atualizarLista}>
              <input type="hidden" name="aba" value={aba.v} />
              <button className="btn ghost">Atualizar lista</button>
            </form>
          </div>
          <Conteudo aba={aba.v} lista={lista!} clientes={clientes} conexoes={conexoes} />
        </section>
      )}
    </>
  );
}

function Conteudo({ aba, lista, clientes, conexoes }: { aba: string; lista: Resultado<Conta[]>; clientes: CliLeve[]; conexoes: Conexao[] }) {
  if (!lista.ok) {
    return lista.faltando?.length ? (
      <div>
        <p>Esta integração ainda não está configurada. Na Vercel, em <strong>Settings → Environment Variables</strong>, defina:</p>
        <ul className="vars">{lista.faltando.map((v) => <li key={v}><code>{v}</code></li>)}</ul>
        <p className="muted small">Depois faça um novo deploy. Os valores ficam só no servidor e nunca aparecem no navegador.</p>
      </div>
    ) : (
      <p className="error" role="alert">{lista.erro}</p>
    );
  }
  const plataforma = PLAT[aba];
  const vinculos = new Map(conexoes.filter((c) => c.platform === plataforma).map((c) => [c.external_id, c]));
  const nomeCliente = (id: string) => clientes.find((c) => c.id === id)?.name ?? "—";
  if (lista.dados.length === 0) return <p className="muted">Nenhum item encontrado nesta conta.</p>;

  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Nome</th><th>ID</th><th>Situação</th><th>Cliente</th></tr></thead>
        <tbody>
          {lista.dados.map((c) => {
            const v = vinculos.get(c.id);
            return (
              <tr key={c.id}>
                <td className="strong">{c.nome}</td>
                <td className="muted"><code>{c.id}</code></td>
                <td className="muted">{[c.detalhe, c.moeda].filter(Boolean).join(" · ") || "—"}</td>
                <td>
                  {v ? (
                    <form action={desvincular} className="inlinef">
                      <input type="hidden" name="aba" value={aba} />
                      <input type="hidden" name="id" value={v.id} />
                      <Link href={`/clientes/${v.client_id}`} className="strong">{nomeCliente(v.client_id)}</Link>
                      <button className="link-danger">Desvincular</button>
                    </form>
                  ) : (
                    <form action={vincular} className="inlinef">
                      <input type="hidden" name="aba" value={aba} />
                      <input type="hidden" name="platform" value={plataforma} />
                      <input type="hidden" name="external_id" value={c.id} />
                      <input type="hidden" name="name" value={c.nome} />
                      <input type="hidden" name="currency" value={c.moeda ?? ""} />
                      <select name="client_id" aria-label={`Cliente de ${c.nome}`} defaultValue="" required>
                        <option value="" disabled>Escolher cliente…</option>
                        {clientes.map((cl) => <option key={cl.id} value={cl.id}>{cl.name}{cl.status === "encerrado" ? " (encerrado)" : ""}</option>)}
                      </select>
                      <button className="btn ghost">Vincular</button>
                    </form>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Outros({ clientes, conexoes }: { clientes: CliLeve[]; conexoes: Conexao[] }) {
  const manuais = conexoes.filter((c) => ["gmb", "hotjar", "analytics"].includes(c.platform));
  const nomeCliente = (id: string) => clientes.find((c) => c.id === id)?.name ?? "—";
  return (
    <>
      <section className="card form" style={{ marginBottom: 16 }}>
        <h2>Adicionar link</h2>
        <p className="muted small" style={{ marginBottom: 12 }}>
          Google Meu Negócio, Hotjar e Analytics ainda não têm listagem automática: cadastre o link e ele vira um botão na ficha do cliente.
        </p>
        <form action={adicionarManual}>
          <div className="row">
            <div className="field">
              <label htmlFor="client_id">Cliente *</label>
              <select id="client_id" name="client_id" defaultValue="" required>
                <option value="" disabled>Escolher…</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="platform">Plataforma *</label>
              <select id="platform" name="platform" defaultValue="analytics">
                <option value="analytics">Google Analytics</option>
                <option value="hotjar">Hotjar</option>
                <option value="gmb">Google Meu Negócio</option>
              </select>
            </div>
            <div className="field"><label htmlFor="name">Nome</label><input id="name" name="name" placeholder="Site institucional" /></div>
          </div>
          <div className="row">
            <div className="field"><label htmlFor="external_id">ID (opcional)</label><input id="external_id" name="external_id" /></div>
            <div className="field"><label htmlFor="url">Link *</label><input id="url" name="url" placeholder="https://…" required /></div>
          </div>
          <div className="actions"><button className="btn">Adicionar</button></div>
        </form>
      </section>

      {manuais.length > 0 && (
        <div className="card table-wrap">
          <table>
            <thead><tr><th>Cliente</th><th>Plataforma</th><th>Nome</th><th>Link</th><th /></tr></thead>
            <tbody>
              {manuais.map((m) => (
                <tr key={m.id}>
                  <td><Link href={`/clientes/${m.client_id}`} className="strong">{nomeCliente(m.client_id)}</Link></td>
                  <td>{ROTULO[m.platform]}</td>
                  <td className="muted">{m.name ?? "—"}</td>
                  <td>{m.url && <a href={m.url} target="_blank" rel="noopener noreferrer">abrir</a>}</td>
                  <td className="num">
                    <form action={desvincular}>
                      <input type="hidden" name="aba" value="outros" />
                      <input type="hidden" name="id" value={m.id} />
                      <button className="link-danger">Remover</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
