"use server";

import { redirect } from "next/navigation";
import { revalidatePath, updateTag } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { renomearContaMeta } from "@/lib/integracoes/meta";
import { renomearContaGoogle } from "@/lib/integracoes/google";

const txt = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || null;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const API = ["meta_ads", "google_ads", "whatsapp_group"] as const;
const MANUAL = ["gmb", "hotjar", "analytics"] as const;
const motivo = (e: { code?: string; message?: string } | null) =>
  e ? ` (${[e.code, e.message].filter(Boolean).join(": ")})` : "";
// Mantém a busca e o filtro ao vincular/desvincular, para seguir trabalhando na mesma lista.
const criarVolta = (f: FormData) => {
  const q = txt(f, "q")?.slice(0, 80);
  const v = txt(f, "v");
  return (aba: string, erro?: string, ok?: string): never => {
    const p = new URLSearchParams({ aba });
    if (ok) p.set("ok", ok);
    if (q) p.set("q", q);
    if (v === "com" || v === "sem") p.set("v", v);
    if (erro) p.set("erro", erro);
    redirect(`/conexao?${p}`);
  };
};
const abaDe = (f: FormData) => txt(f, "aba") ?? "meta";

export async function atualizarLista(f: FormData) {
  const volta = criarVolta(f);
  updateTag("conexao");
  volta(abaDe(f));
}

export async function vincular(f: FormData) {
  const volta = criarVolta(f);
  const aba = abaDe(f);
  const clientId = txt(f, "client_id");
  const plataforma = API.find((p) => p === txt(f, "platform"));
  const externo = txt(f, "external_id");
  if (!clientId || !UUID.test(clientId)) volta(aba, "Escolha o cliente para vincular.");
  if (!plataforma || !externo) volta(aba, "Conta inválida.");
  const supabase = await supabaseServer();
  const { error } = await supabase.from("client_connections").insert({
    client_id: clientId, platform: plataforma, external_id: externo!.slice(0, 120),
    name: txt(f, "name")?.slice(0, 200) ?? null, currency: txt(f, "currency")?.slice(0, 8) ?? null,
  });
  if (error?.code === "23505") volta(aba, "Essa conta já está vinculada a um cliente.");
  if (error) volta(aba, `Não foi possível vincular.${motivo(error)}`);
  revalidatePath("/conexao");
  volta(aba);
}

export async function desvincular(f: FormData) {
  const volta = criarVolta(f);
  const aba = abaDe(f);
  const id = txt(f, "id");
  if (!id || !UUID.test(id)) volta(aba, "Vínculo inválido.");
  const supabase = await supabaseServer();
  const { error } = await supabase.from("client_connections").delete().eq("id", id);
  if (error) volta(aba, `Não foi possível desvincular.${motivo(error)}`);
  revalidatePath("/conexao");
  volta(aba);
}

export async function adicionarManual(f: FormData) {
  const volta = criarVolta(new FormData());
  const clientId = txt(f, "client_id");
  const plataforma = MANUAL.find((p) => p === txt(f, "platform"));
  let url = txt(f, "url");
  if (!clientId || !UUID.test(clientId)) volta("outros", "Escolha o cliente.");
  if (!plataforma) volta("outros", "Escolha a plataforma.");
  if (!url) volta("outros", "Informe o link.");
  if (!/^https?:\/\//i.test(url!)) url = `https://${url}`;
  try {
    new URL(url!);
  } catch {
    volta("outros", "O link não é válido.");
  }
  const supabase = await supabaseServer();
  const { error } = await supabase.from("client_connections").insert({
    client_id: clientId, platform: plataforma, name: txt(f, "name")?.slice(0, 200) ?? null,
    external_id: txt(f, "external_id")?.slice(0, 120) ?? null, url,
  });
  if (error?.code === "23505") volta("outros", "Esse ID já está cadastrado.");
  if (error) volta("outros", `Não foi possível salvar.${motivo(error)}`);
  revalidatePath("/conexao");
  volta("outros");
}

/** Renomeia a conta na plataforma (Meta ou Google) e atualiza o nome guardado no painel. */
export async function renomearConta(f: FormData) {
  const volta = criarVolta(f);
  const aba = abaDe(f);
  const plataforma = API.find((p) => p === txt(f, "platform"));
  const externo = txt(f, "external_id");
  const nome = txt(f, "nome")?.replace(/\s+/g, " ").slice(0, 100);
  if (plataforma !== "meta_ads" && plataforma !== "google_ads") volta(aba, "Só dá para renomear contas do Meta e do Google.");
  if (!externo || !/^\d{5,20}$/.test(externo)) volta(aba, "Conta inválida.");
  if (!nome) volta(aba, "Informe o novo nome.");

  const r = plataforma === "meta_ads" ? await renomearContaMeta(externo!, nome!) : await renomearContaGoogle(externo!, nome!);
  if (!r.ok) volta(aba, `Não foi possível renomear na plataforma. ${r.faltando?.length ? "Integração não configurada." : r.erro}`);

  const supabase = await supabaseServer();
  await supabase.from("client_connections").update({ name: nome }).eq("platform", plataforma!).eq("external_id", externo!);
  updateTag("conexao");
  revalidatePath("/conexao");
  revalidatePath("/clientes", "layout");
  volta(aba, undefined, `Conta renomeada para "${nome}".`);
}
