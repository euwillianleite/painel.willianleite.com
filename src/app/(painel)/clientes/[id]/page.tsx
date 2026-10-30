import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { alertaPrazo, valorVigente, type Cliente, type Link as LinkT, type Valor } from "@/lib/clientes";
import { brl, dataBR, mesAtualISO, mesBR } from "@/lib/format";
import { adicionarLink, novoValor, removerLink, removerValor } from "../actions";

export const metadata: Metadata = { title: "Ficha do cliente" };

export default async function Ficha({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const [{ id }, { erro }] = await Promise.all([params, searchParams]);
  const supabase = await supabaseServer();
  const [{ data: cli }, { data: links }, { data: valores }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).maybeSingle(),
    supabase.from("client_links").select("id,label,url").eq("client_id", id).order("created_at"),
    supabase.from("client_price_versions").select("*").eq("client_id", id).order("starts_on", { ascending: false }),
  ]);
  if (!cli) notFound();
  const c = cli as Cliente;
  const ls = (links ?? []) as LinkT[];
  const vs = (valores ?? []) as Valor[];
  const mes = mesAtualISO();
  const atual = valorVigente(vs, mes);
  const alerta = alertaPrazo(c);

  return (
    <>
      <p className="muted"><Link href="/clientes">← Clientes</Link></p>
      <div className="toolbar" style={{ marginTop: 4 }}>
        <h1>
          {c.name} <span className={`badge ${c.status}`}>{c.status === "ativo" ? "Ativo" : "Encerrado"}</span>
          {alerta && <span className={`badge ${alerta.tom}`}>{alerta.texto}</span>}
        </h1>
        <Link href={`/clientes/${id}/editar`} className="btn ghost">Editar</Link>
      </div>
      {erro && <p className="error" role="alert">{erro}</p>}

      <section className="card">
        <h2>Links</h2>
        {ls.length > 0 && (
          <div className="links">
            {ls.map((l) => (
              <div key={l.id} className="linkbtn">
                <a href={l.url} target="_blank" rel="noopener noreferrer">{l.label}</a>
                <form action={removerLink}>
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="link_id" value={l.id} />
                  <button aria-label={`Remover ${l.label}`} title="Remover">×</button>
                </form>
              </div>
            ))}
          </div>
        )}
        <form action={adicionarLink} className="row inline">
          <input type="hidden" name="id" value={id} />
          <div className="field"><label htmlFor="label">Nome do botão</label><input id="label" name="label" placeholder="Drive" required /></div>
          <div className="field grow"><label htmlFor="url">Endereço</label><input id="url" name="url" placeholder="https://…" required /></div>
          <button className="btn">Adicionar</button>
        </form>
      </section>

      <div className="two">
        <section className="card">
          <h2>Dados</h2>
          <dl>
            <dt>Serviços</dt><dd>{c.services || "—"}</dd>
            <dt>Contato</dt><dd>{[c.contact_name, c.contact_phone, c.contact_email].filter(Boolean).join(" · ") || "—"}</dd>
            <dt>CNPJ / CPF</dt><dd>{c.document || "—"}</dd>
            <dt>Vencimento</dt><dd>{c.billing_day ? `dia ${c.billing_day}` : "—"}</dd>
            <dt>Início do projeto</dt><dd>{dataBR(c.project_start)}</dd>
            <dt>Término do projeto</dt><dd>{dataBR(c.project_end)}</dd>
            <dt>Renovação</dt><dd>{dataBR(c.renewal_date)}</dd>
            <dt>Fim do contrato</dt><dd>{dataBR(c.contract_end)}</dd>
            {c.notes && (<><dt>Observações</dt><dd className="pre">{c.notes}</dd></>)}
          </dl>
        </section>

        <section className="card">
          <h2>Verba de mídia</h2>
          <p className="muted">
            Último mês, média dos últimos 3 meses e total gasto serão puxados direto do Meta Ads e do Google Ads
            quando as contas forem conectadas (tela de Conexão).
          </p>
        </section>
      </div>

      <section className="card">
        <h2>Mensalidade</h2>
        <p className="big">{atual ? brl(atual.amount) : "—"} <span className="muted small">vigente em {mesBR(mes)}</span></p>

        <h3>Histórico de valores</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>A partir de</th><th className="num">Valor</th><th>Observação</th><th /></tr></thead>
            <tbody>
              {vs.map((v) => (
                <tr key={v.id}>
                  <td>{mesBR(v.starts_on)}</td>
                  <td className="num">{brl(v.amount)}</td>
                  <td className="muted">{v.note || ""}</td>
                  <td className="num">
                    {v.starts_on >= mes && (
                      <form action={removerValor}>
                        <input type="hidden" name="id" value={id} />
                        <input type="hidden" name="valor_id" value={v.id} />
                        <button className="link-danger">Apagar</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
              {vs.length === 0 && <tr><td colSpan={4} className="muted">Nenhum valor cadastrado.</td></tr>}
            </tbody>
          </table>
        </div>

        <h3>Novo valor</h3>
        <p className="muted small">Vale do mês escolhido em diante. Os meses anteriores não mudam.</p>
        <form action={novoValor} className="row inline">
          <input type="hidden" name="id" value={id} />
          <div className="field"><label htmlFor="amount">Valor (R$)</label><input id="amount" name="amount" inputMode="decimal" placeholder="1.200,00" required /></div>
          <div className="field"><label htmlFor="starts_on">A partir de</label><input id="starts_on" name="starts_on" type="month" defaultValue={mes.slice(0, 7)} required /></div>
          <div className="field grow"><label htmlFor="note">Observação</label><input id="note" name="note" placeholder="Renegociado, desconto…" /></div>
          <button className="btn">Adicionar valor</button>
        </form>
      </section>
    </>
  );
}
