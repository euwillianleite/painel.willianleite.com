"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { parseBRL } from "@/lib/format";

const txt = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || null;
const data = (f: FormData, k: string) => {
  const v = txt(f, k);
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const idDe = (f: FormData, k = "id") => {
  const v = txt(f, k);
  if (!v || !UUID.test(v)) redirect("/clientes");
  return v;
};
const volta = (path: string, erro: string): never =>
  redirect(`${path}?erro=${encodeURIComponent(erro)}`);

/** type="month" envia "2026-10" -> "2026-10-01" */
const mesInicio = (f: FormData, k: string) => {
  const v = txt(f, k);
  return v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? `${v}-01` : null;
};

function camposCliente(f: FormData) {
  const dia = Number(txt(f, "billing_day"));
  return {
    name: txt(f, "name"),
    document: txt(f, "document"),
    contact_name: txt(f, "contact_name"),
    contact_phone: txt(f, "contact_phone"),
    contact_email: txt(f, "contact_email"),
    services: txt(f, "services"),
    status: txt(f, "status") === "encerrado" ? "encerrado" : "ativo",
    billing_day: Number.isInteger(dia) && dia >= 1 && dia <= 31 ? dia : null,
    project_start: data(f, "project_start"),
    project_end: data(f, "project_end"),
    renewal_date: data(f, "renewal_date"),
    contract_end: data(f, "contract_end"),
    notes: txt(f, "notes"),
  };
}

export async function criarCliente(f: FormData) {
  const campos = camposCliente(f);
  if (!campos.name) volta("/clientes/novo", "Informe o nome do cliente.");
  const valor = parseBRL(String(f.get("amount") ?? ""));
  const inicio = mesInicio(f, "starts_on");
  if (valor === null) volta("/clientes/novo", "Informe a mensalidade (ex.: 1.500,00).");
  if (!inicio) volta("/clientes/novo", "Informe o mês de início da mensalidade.");

  const supabase = await supabaseServer();
  const { data: cli, error } = await supabase.from("clients").insert(campos).select("id").single();
  if (error || !cli) volta("/clientes/novo", "Não foi possível salvar o cliente.");

  const { error: e2 } = await supabase
    .from("client_price_versions")
    .insert({ client_id: cli!.id, starts_on: inicio, amount: valor });
  revalidatePath("/clientes");
  if (e2) volta(`/clientes/${cli!.id}`, "Cliente salvo, mas a mensalidade falhou. Cadastre o valor abaixo.");
  redirect(`/clientes/${cli!.id}`);
}

export async function atualizarCliente(f: FormData) {
  const id = idDe(f);
  const campos = camposCliente(f);
  if (!campos.name) volta(`/clientes/${id}/editar`, "Informe o nome do cliente.");
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("clients")
    .update({ ...campos, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) volta(`/clientes/${id}/editar`, "Não foi possível salvar.");
  revalidatePath("/clientes");
  redirect(`/clientes/${id}`);
}

export async function adicionarLink(f: FormData) {
  const id = idDe(f);
  const label = txt(f, "label");
  let url = txt(f, "url");
  if (!label || !url) volta(`/clientes/${id}`, "Informe o nome e o endereço do link.");
  if (!/^https?:\/\//i.test(url!)) url = `https://${url}`;
  try {
    new URL(url!);
  } catch {
    volta(`/clientes/${id}`, "O endereço do link não é válido.");
  }
  const supabase = await supabaseServer();
  const { error } = await supabase.from("client_links").insert({ client_id: id, label, url });
  if (error) volta(`/clientes/${id}`, "Não foi possível salvar o link.");
  revalidatePath(`/clientes/${id}`);
  redirect(`/clientes/${id}`);
}

export async function removerLink(f: FormData) {
  const id = idDe(f);
  const linkId = idDe(f, "link_id");
  const supabase = await supabaseServer();
  await supabase.from("client_links").delete().eq("id", linkId).eq("client_id", id);
  revalidatePath(`/clientes/${id}`);
  redirect(`/clientes/${id}`);
}

export async function novoValor(f: FormData) {
  const id = idDe(f);
  const valor = parseBRL(String(f.get("amount") ?? ""));
  const inicio = mesInicio(f, "starts_on");
  if (valor === null) volta(`/clientes/${id}`, "Informe o valor (ex.: 1.500,00).");
  if (!inicio) volta(`/clientes/${id}`, "Informe o mês em que o novo valor começa.");
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("client_price_versions")
    .insert({ client_id: id, starts_on: inicio, amount: valor, note: txt(f, "note") });
  if (error?.code === "23505") volta(`/clientes/${id}`, "Já existe um valor começando nesse mês.");
  if (error) volta(`/clientes/${id}`, "Não foi possível salvar o valor.");
  revalidatePath("/clientes");
  redirect(`/clientes/${id}`);
}

export async function removerValor(f: FormData) {
  const id = idDe(f);
  const valorId = idDe(f, "valor_id");
  const supabase = await supabaseServer();
  const { data: apagados } = await supabase
    .from("client_price_versions")
    .delete()
    .eq("id", valorId)
    .eq("client_id", id)
    .select("id");
  if (!apagados?.length) volta(`/clientes/${id}`, "Só é possível apagar valores do mês atual em diante.");
  revalidatePath("/clientes");
  redirect(`/clientes/${id}`);
}
