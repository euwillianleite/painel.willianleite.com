import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { alertaPrazo, type Cliente, type Link as LinkT } from "@/lib/clientes";
import { dataBR } from "@/lib/format";
import { adicionarLink, removerLink } from "../actions";
import { VerbaMidia } from "./verba";

export const metadata: Metadata = { title: "Ficha do cliente" };

const ROTULO_CURTO: Record<string, string> = {
  meta_ads: "Meta Ads", google_ads: "Google Ads", whatsapp_group: "WhatsApp", gmb: "Meu Negócio", hotjar: "Hotjar", analytics: "Analytics",
};
/** Link direto para a conta na plataforma (ou o link cadastrado à mão). */
function urlConexao(x: { platform: string; external_id: string | null; url: string | null }) {
  if (x.url) return x.url;
  const id = encodeURIComponent(x.external_id ?? "");
  if (x.platform === "meta_ads") return `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${id}`;
  if (x.platform === "google_ads") return `https://ads.google.com/aw/overview?__e=${id}`;
  return null;
}

export default async function Ficha({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const [{ id }, { erro }] = await Promise.all([params, searchParams]);
  const supabase = await supabaseServer();
  const [{ data: cli }, { data: links }, { data: cts }, { data: cxs }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).maybeSingle(),
    supabase.from("client_links").select("id,label,url").eq("client_id", id).order("created_at"),
    supabase.from("client_services").select("services(name)").eq("client_id", id).order("created_at"),
    supabase.from("client_connections").select("id,platform,external_id,name,url").eq("client_id", id).order("created_at"),
  ]);
  if (!cli) notFound();
  const c = cli as Cliente;
  const ls = (links ?? []) as LinkT[];
  const servicos = ((cts ?? []) as unknown as { services: { name: string } | null }[])
    .map((x) => x.services?.name)
    .filter(Boolean)
    .join(", ");
  const conectados = ((cxs ?? []) as { id: string; platform: string; external_id: string | null; name: string | null; url: string | null }[])
    .map((x) => ({ id: x.id, label: `${ROTULO_CURTO[x.platform] ?? x.platform}${x.name ? ` · ${x.name}` : ""}`, url: urlConexao(x) }));
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
        {conectados.length > 0 && (
          <div className="links">
            {conectados.map((x) =>
              x.url ? (
                <div key={x.id} className="linkbtn conectado"><a href={x.url} target="_blank" rel="noopener noreferrer">{x.label}</a></div>
              ) : (
                <div key={x.id} className="linkbtn conectado"><span>{x.label}</span></div>
              ),
            )}
          </div>
        )}
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
          <Suspense fallback={<p className="muted">Carregando…</p>}>
            <VerbaMidia clientId={id} />
          </Suspense>
        </section>
      </div>

    </>
  );
}
