"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { parseBRL } from "@/lib/format";

const txt = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || null;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const mes = (f: FormData, k: string) => {
  const v = txt(f, k);
  return v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? `${v}-01` : null;
};
const dia = (f: FormData) => {
  const n = Number(txt(f, "pay_day"));
  return Number.isInteger(n) && n >= 1 && n <= 31 ? n : null;
};
const dataISO = (f: FormData, k: string) => {
  const v = txt(f, k);
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
};
const idDe = (f: FormData, k = "id") => {
  const v = txt(f, k);
  if (!v || !UUID.test(v)) redirect("/financeiro/despesas");
  return v;
};
const volta = (path: string, erro: string): never => redirect(`${path}?erro=${encodeURIComponent(erro)}`);
const motivo = (e: { code?: string; message?: string } | null) =>
  e ? ` (${[e.code, e.message].filter(Boolean).join(": ")})` : "";
const CATS = ["ferramentas", "equipe", "outras"] as const;
const categoria = (f: FormData) => CATS.find((c) => c === txt(f, "category")) ?? "outras";

export async function criarDespesa(f: FormData) {
  const L = "/financeiro/despesas";
  const nome = txt(f, "name");
  const moeda = txt(f, "currency") === "USD" ? "USD" : "BRL";
  const tipo = txt(f, "kind") === "pontual" ? "pontual" : "recorrente";
  const valor = parseBRL(String(f.get("amount") ?? ""));
  if (!nome) volta(L, "Informe o nome da despesa.");
  if (valor === null) volta(L, "Informe o valor (ex.: 120,00).");

  const supabase = await supabaseServer();
  if (tipo === "pontual") {
    const data = dataISO(f, "one_off_date");
    if (!data) volta(L, "Informe a data da despesa pontual.");
    const { error } = await supabase.from("expenses").insert({
      name: nome, category: categoria(f), currency: moeda, kind: "pontual", one_off_date: data, one_off_amount: valor,
    });
    if (error) volta(L, `Não foi possível salvar.${motivo(error)}`);
  } else {
    const inicio = mes(f, "starts_on");
    const d = dia(f);
    if (!inicio) volta(L, "Informe o mês de início.");
    if (d === null) volta(L, "Informe o dia do pagamento (1 a 31).");
    const { data: desp, error } = await supabase
      .from("expenses")
      .insert({ name: nome, category: categoria(f), currency: moeda, kind: "recorrente" })
      .select("id")
      .single();
    if (error || !desp) volta(L, `Não foi possível salvar.${motivo(error)}`);
    const { error: e2 } = await supabase
      .from("expense_versions")
      .insert({ expense_id: desp!.id, starts_on: inicio, amount: valor, pay_day: d });
    if (e2) volta(`${L}/${desp!.id}`, `Despesa salva, mas o valor falhou. Adicione-o abaixo.${motivo(e2)}`);
  }
  revalidatePath("/financeiro");
  redirect(L);
}

export async function atualizarDespesa(f: FormData) {
  const id = idDe(f);
  const P = `/financeiro/despesas/${id}`;
  const nome = txt(f, "name");
  if (!nome) volta(P, "Informe o nome da despesa.");
  const supabase = await supabaseServer();
  const campos: Record<string, unknown> = { name: nome, category: categoria(f) };

  const { data: d } = await supabase.from("expenses").select("kind").eq("id", id).maybeSingle();
  if (!d) redirect("/financeiro/despesas");
  if (d!.kind === "recorrente") {
    campos.last_month = mes(f, "last_month");
  } else {
    const data = dataISO(f, "one_off_date");
    const valor = parseBRL(String(f.get("amount") ?? ""));
    if (!data || valor === null) volta(P, "Informe a data e o valor.");
    const { count } = await supabase.from("expense_payments").select("id", { count: "exact", head: true }).eq("expense_id", id);
    if (count) volta(P, "Esta despesa já foi paga. Desfaça o pagamento para alterar data ou valor.");
    campos.one_off_date = data;
    campos.one_off_amount = valor;
  }
  const { error } = await supabase.from("expenses").update(campos).eq("id", id);
  if (error) volta(P, `Não foi possível salvar.${motivo(error)}`);
  revalidatePath("/financeiro");
  redirect("/financeiro/despesas");
}

export async function novaVersao(f: FormData) {
  const id = idDe(f);
  const P = `/financeiro/despesas/${id}`;
  const valor = parseBRL(String(f.get("amount") ?? ""));
  const inicio = mes(f, "starts_on");
  const d = dia(f);
  if (valor === null) volta(P, "Informe o valor (ex.: 120,00).");
  if (!inicio) volta(P, "Informe o mês de início.");
  if (d === null) volta(P, "Informe o dia do pagamento (1 a 31).");
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("expense_versions")
    .insert({ expense_id: id, starts_on: inicio, amount: valor, pay_day: d, note: txt(f, "note") });
  if (error?.code === "23505") volta(P, "Já existe um valor começando nesse mês.");
  if (error) volta(P, `Não foi possível salvar o valor.${motivo(error)}`);
  revalidatePath("/financeiro");
  redirect(P);
}

export async function editarVersao(f: FormData) {
  const id = idDe(f);
  const vid = idDe(f, "valor_id");
  const P = `/financeiro/despesas/${id}`;
  const valor = parseBRL(String(f.get("amount") ?? ""));
  const inicio = mes(f, "starts_on");
  const d = dia(f);
  if (valor === null) volta(P, "Informe o valor (ex.: 120,00).");
  if (!inicio) volta(P, "Informe o mês de início.");
  if (d === null) volta(P, "Informe o dia do pagamento (1 a 31).");
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("expense_versions")
    .update({ amount: valor, starts_on: inicio, pay_day: d, note: txt(f, "note") })
    .eq("id", vid);
  if (error?.code === "23505") volta(P, "Já existe um valor começando nesse mês.");
  if (error) volta(P, `${error.code === "23514" ? error.message : "Não foi possível salvar o valor."}${error.code === "23514" ? "" : motivo(error)}`);
  revalidatePath("/financeiro");
  redirect(P);
}

export async function removerVersao(f: FormData) {
  const id = idDe(f);
  const vid = idDe(f, "valor_id");
  const P = `/financeiro/despesas/${id}`;
  const supabase = await supabaseServer();
  const { error } = await supabase.from("expense_versions").delete().eq("id", vid);
  if (error) volta(P, error.code === "23514" ? error.message : `Não foi possível apagar.${motivo(error)}`);
  revalidatePath("/financeiro");
  redirect(P);
}

export async function apagarDespesa(f: FormData) {
  const id = idDe(f);
  const supabase = await supabaseServer();
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) {
    volta(
      `/financeiro/despesas/${id}`,
      error.code === "23503" || error.code === "23514"
        ? "Esta despesa tem pagamentos registrados. Encerre-a em vez de apagar."
        : `Não foi possível apagar.${motivo(error)}`,
    );
  }
  revalidatePath("/financeiro");
  redirect("/financeiro/despesas");
}
