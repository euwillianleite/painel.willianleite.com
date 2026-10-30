"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { parseBRL } from "@/lib/format";

type Supabase = Awaited<ReturnType<typeof supabaseServer>>;

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
/** Mensagem + motivo técnico (painel de uso interno). */
const motivo = (e: { code?: string; message?: string } | null) =>
  e ? ` (${[e.code, e.message].filter(Boolean).join(": ")})` : "";

/** type="month" envia "2026-10" -> "2026-10-01" */
const mesInicio = (f: FormData, k: string) => {
  const v = txt(f, k);
  return v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? `${v}-01` : null;
};
/** Valor opcional: vazio = sem valor; preenchido e inválido = erro. */
function valorOpcional(f: FormData, k: string): { ok: boolean; valor: number | null } {
  const raw = txt(f, k);
  if (!raw) return { ok: true, valor: null };
  const v = parseBRL(raw);
  return v === null ? { ok: false, valor: null } : { ok: true, valor: v > 0 ? v : null };
}
const diaPag = (f: FormData) => {
  const n = Number(txt(f, "pay_day"));
  return Number.isInteger(n) && n >= 1 && n <= 31 ? n : null;
};
const forma = (f: FormData) => {
  const v = txt(f, "setup_method");
  return v === "pix" || v === "cartao" ? v : null;
};

function camposCliente(f: FormData) {
  return {
    name: txt(f, "name"),
    document: txt(f, "document"),
    contact_name: txt(f, "contact_name"),
    contact_phone: txt(f, "contact_phone"),
    contact_email: txt(f, "contact_email"),
    status: txt(f, "status") === "encerrado" ? "encerrado" : "ativo",
    project_start: data(f, "project_start"),
    contract_end: data(f, "contract_end"),
    notes: txt(f, "notes"),
  };
}

/** Acha o serviço pelo nome (sem diferenciar maiúsculas) ou cria. */
async function servicoPorNome(supabase: Supabase, nome: string) {
  const alvo = nome.trim().toLowerCase();
  const { data: lista, error } = await supabase.from("services").select("id,name");
  if (error) return { id: null, error };
  const achado = (lista ?? []).find((s) => s.name.trim().toLowerCase() === alvo);
  if (achado) return { id: achado.id as string, error: null };
  const { data: novo, error: e2 } = await supabase.from("services").insert({ name: nome.trim() }).select("id").single();
  return { id: (novo?.id as string | undefined) ?? null, error: e2 };
}

type Vinculo = { nome: string; valor: number; inicio: string; dia: number; setup: number | null; setupData: string | null; forma: "pix" | "cartao" | null };

/** Vincula o serviço ao cliente, com a primeira mensalidade e o setup (se houver). */
async function vincularServico(supabase: Supabase, clientId: string, v: Vinculo) {
  const s = await servicoPorNome(supabase, v.nome);
  if (!s.id) return s.error ?? { message: "serviço" };
  const { data: ct, error } = await supabase
    .from("client_services")
    .insert({
      client_id: clientId,
      service_id: s.id,
      setup_amount: v.setup,
      setup_date: v.setup !== null ? v.setupData : null,
      setup_method: v.setup !== null ? v.forma : null,
    })
    .select("id")
    .single();
  if (error || !ct) return error ?? { message: "contrato" };
  const { error: e2 } = await supabase
    .from("client_price_versions")
    .insert({ client_service_id: ct.id, starts_on: v.inicio, amount: v.valor, pay_day: v.dia });
  return e2;
}

function lerVinculo(f: FormData, voltar: string): Vinculo {
  const nome = txt(f, "service_name");
  const valor = parseBRL(String(f.get("amount") ?? ""));
  const inicio = mesInicio(f, "starts_on");
  const setup = valorOpcional(f, "setup_amount");
  const dia = diaPag(f);
  const setupData = data(f, "setup_date");
  if (!nome) volta(voltar, "Informe o serviço.");
  if (valor === null) volta(voltar, "Informe a mensalidade (ex.: 1.500,00).");
  if (!inicio) volta(voltar, "Informe o mês de início da mensalidade.");
  if (dia === null) volta(voltar, "Informe o dia do pagamento (1 a 31).");
  if (!setup.ok) volta(voltar, "O valor do setup não é válido.");
  if (setup.valor !== null && !setupData) volta(voltar, "Informe a data do setup.");
  return { nome: nome!, valor: valor!, inicio: inicio!, dia: dia!, setup: setup.valor, setupData, forma: forma(f) };
}

export async function criarCliente(f: FormData) {
  const campos = camposCliente(f);
  if (!campos.name) volta("/clientes/novo", "Informe o nome do cliente.");
  const vinculo = lerVinculo(f, "/clientes/novo");

  const supabase = await supabaseServer();
  const { data: cli, error } = await supabase.from("clients").insert(campos).select("id").single();
  if (error || !cli) volta("/clientes/novo", `Não foi possível salvar o cliente.${motivo(error)}`);

  const e2 = await vincularServico(supabase, cli!.id, vinculo);
  revalidatePath("/clientes");
  if (e2) volta(`/clientes/${cli!.id}/editar`, `Cliente salvo, mas o serviço falhou. Adicione-o abaixo.${motivo(e2)}`);
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
  if (error) volta(`/clientes/${id}/editar`, `Não foi possível salvar.${motivo(error)}`);
  revalidatePath("/clientes");
  redirect(`/clientes/${id}`);
}

/* ---- links ---- */
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
  if (error) volta(`/clientes/${id}`, `Não foi possível salvar o link.${motivo(error)}`);
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

/* ---- serviços e valores (tela de edição) ---- */
export async function adicionarServico(f: FormData) {
  const id = idDe(f);
  const volt = `/clientes/${id}/editar`;
  const vinculo = lerVinculo(f, volt);
  const supabase = await supabaseServer();
  const e = await vincularServico(supabase, id, vinculo);
  if (e && "code" in e && e.code === "23505") volta(volt, "Esse serviço já está vinculado ao cliente.");
  if (e) volta(volt, `Não foi possível adicionar o serviço.${motivo(e as { code?: string; message?: string })}`);
  revalidatePath("/clientes");
  redirect(volt);
}

export async function removerServico(f: FormData) {
  const id = idDe(f);
  const ctId = idDe(f, "contrato_id");
  const supabase = await supabaseServer();
  await supabase.from("client_services").delete().eq("id", ctId).eq("client_id", id);
  revalidatePath("/clientes");
  redirect(`/clientes/${id}/editar`);
}

export async function atualizarSetup(f: FormData) {
  const id = idDe(f);
  const ctId = idDe(f, "contrato_id");
  const volt = `/clientes/${id}/editar`;
  const setup = valorOpcional(f, "setup_amount");
  if (!setup.ok) volta(volt, "O valor do setup não é válido.");
  const dataSetup = data(f, "setup_date");
  const tem = setup.valor !== null;
  if (tem && !dataSetup) volta(volt, "Informe a data do setup.");
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("client_services")
    .update({
      setup_amount: setup.valor,
      setup_date: tem ? dataSetup : null,
      setup_method: tem ? forma(f) : null,
    })
    .eq("id", ctId)
    .eq("client_id", id);
  if (error) volta(volt, `Não foi possível salvar o setup.${motivo(error)}`);
  revalidatePath("/clientes");
  redirect(volt);
}

export async function novoValor(f: FormData) {
  const id = idDe(f);
  const ctId = idDe(f, "contrato_id");
  const volt = `/clientes/${id}/editar`;
  const valor = parseBRL(String(f.get("amount") ?? ""));
  const inicio = mesInicio(f, "starts_on");
  const dia = diaPag(f);
  if (valor === null) volta(volt, "Informe o valor (ex.: 1.200,00).");
  if (!inicio) volta(volt, "Informe o mês em que o novo valor começa.");
  if (dia === null) volta(volt, "Informe o dia do pagamento (1 a 31).");
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("client_price_versions")
    .insert({ client_service_id: ctId, starts_on: inicio, amount: valor, pay_day: dia, note: txt(f, "note") });
  if (error?.code === "23505") volta(volt, "Já existe um valor começando nesse mês.");
  if (error) volta(volt, `Não foi possível salvar o valor.${motivo(error)}`);
  revalidatePath("/clientes");
  redirect(volt);
}

export async function editarValor(f: FormData) {
  const id = idDe(f);
  const valorId = idDe(f, "valor_id");
  const volt = `/clientes/${id}/editar`;
  const valor = parseBRL(String(f.get("amount") ?? ""));
  const inicio = mesInicio(f, "starts_on");
  if (valor === null) volta(volt, "Informe o valor (ex.: 1.200,00).");
  const dia = diaPag(f);
  if (!inicio) volta(volt, "Informe o mês de início.");
  if (dia === null) volta(volt, "Informe o dia do pagamento (1 a 31).");
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("client_price_versions")
    .update({ amount: valor, starts_on: inicio, pay_day: dia, note: txt(f, "note") })
    .eq("id", valorId);
  if (error?.code === "23505") volta(volt, "Já existe um valor começando nesse mês.");
  if (error) volta(volt, `Não foi possível salvar o valor.${motivo(error)}`);
  revalidatePath("/clientes");
  redirect(volt);
}

export async function removerValor(f: FormData) {
  const id = idDe(f);
  const valorId = idDe(f, "valor_id");
  const supabase = await supabaseServer();
  await supabase.from("client_price_versions").delete().eq("id", valorId);
  revalidatePath("/clientes");
  redirect(`/clientes/${id}/editar`);
}
