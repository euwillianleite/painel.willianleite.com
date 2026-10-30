import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { alertaPrazo, type Cliente, type Link as LinkT } from "@/lib/clientes";
import { dataBR } from "@/lib/format";
import { adicionarLink, removerLink } from "../actions";

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
  const [{ data: cli }, { data: links }, { data: cts }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).maybeSingle(),
    supabase.from("client_links").select("id,label,url").eq("client_id", id).order("created_at"),
    supabase.from("client_services").select("services(name)").eq("client_id", id).order("created_at"),
  ]);
  if (!cli) notFound();
  const c = cli as Cliente;
  const ls = (links ?? []) as LinkT[];
  const servicos = ((cts ?? []) as unknown as { services: { name: string } | null }[])
    .map((x) => x.services?.name)
    .filter(Boolean)
    .join(", ");
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
            <dt>Serviços</dt><dd>{servicos || "—"}</dd>
            <dt>Contato</dt><dd>{[c.contact_name, c.contact_phone, c.contact_email].filter(Boolean).join(" · ") || "—"}</dd>
            <dt>CNPJ / CPF</dt><dd>{c.document || "—"}</dd>
            <dt>Início do projeto</dt><dd>{dataBR(c.project_start)}</dd>
            <dt>Término / renovação</dt><dd>{dataBR(c.contract_end)}</dd>
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

    </>
  );
}
