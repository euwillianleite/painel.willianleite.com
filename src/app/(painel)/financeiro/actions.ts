"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { parseBRL } from "@/lib/format";
import { cotacaoUSD } from "@/lib/bcb";

const txt = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || null;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const volta = (mes: string, erro?: string): never => {
  const q = new URLSearchParams({ mes: /^\d{4}-\d{2}$/.test(mes) ? mes : "" });
  if (erro) q.set("erro", erro);
  redirect(`/financeiro?${q}`);
};
const motivo = (e: { code?: string; message?: string } | null) =>
  e ? ` (${[e.code, e.message].filter(Boolean).join(": ")})` : "";

function ler(f: FormData) {
  const mes = txt(f, "mes") ?? "";
  const id = txt(f, "id");
  const ref = txt(f, "ref_month");
  const pago = txt(f, "paid_on");
  const valor = parseBRL(String(f.get("amount") ?? ""));
  if (!id || !UUID.test(id) || !ref || !ISO.test(ref) || !ref.endsWith("-01")) volta(mes, "Lançamento inválido.");
  if (!pago || !ISO.test(pago)) volta(mes, "Informe a data do pagamento.");
  if (valor === null) volta(mes, "Informe o valor pago (ex.: 1.500,00).");
  return { mes, id: id!, ref: ref!, pago: pago!, valor: valor! };
}

export async function marcarEntrada(f: FormData) {
  const { mes, id, ref, pago, valor } = ler(f);
  const kind = txt(f, "kind") === "setup" ? "setup" : "mensalidade";
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("client_payments")
    .insert({ client_service_id: id, kind, ref_month: ref, amount: valor, paid_on: pago });
  if (error) volta(mes, `Não foi possível registrar o recebimento.${motivo(error)}`);
  revalidatePath("/financeiro");
  volta(mes);
}

export async function desfazerEntrada(f: FormData) {
  const mes = txt(f, "mes") ?? "";
  const id = txt(f, "id");
  if (!id || !UUID.test(id)) volta(mes, "Lançamento inválido.");
  const supabase = await supabaseServer();
  const { error } = await supabase.from("client_payments").delete().eq("id", id!);
  if (error) volta(mes, `Não foi possível desfazer.${motivo(error)}`);
  revalidatePath("/financeiro");
  volta(mes);
}

export async function marcarSaida(f: FormData) {
  const { mes, id, ref, pago, valor } = ler(f);
  const supabase = await supabaseServer();
  const { data: d } = await supabase.from("expenses").select("currency").eq("id", id).maybeSingle();
  if (!d) volta(mes, "Despesa não encontrada.");

  let taxa: number | null = null;
  let brl = valor;
  if (d!.currency === "USD") {
    const c = await cotacaoUSD(pago);
    if (!c) volta(mes, "Não consegui a cotação do dólar agora. Tente de novo em instantes.");
    taxa = c!.taxa;
    brl = Math.round(valor * taxa * 100) / 100;
  }
  const { error } = await supabase.from("expense_payments").insert({
    expense_id: id, ref_month: ref, amount: valor, fx_rate: taxa, amount_brl: brl, paid_on: pago,
  });
  if (error) volta(mes, `Não foi possível registrar o pagamento.${motivo(error)}`);
  revalidatePath("/financeiro");
  volta(mes);
}

export async function desfazerSaida(f: FormData) {
  const mes = txt(f, "mes") ?? "";
  const id = txt(f, "id");
  if (!id || !UUID.test(id)) volta(mes, "Lançamento inválido.");
  const supabase = await supabaseServer();
  const { error } = await supabase.from("expense_payments").delete().eq("id", id!);
  if (error) volta(mes, `Não foi possível desfazer.${motivo(error)}`);
  revalidatePath("/financeiro");
  volta(mes);
}

export async function definirInicioControle(f: FormData) {
  const mes = txt(f, "mes") ?? "";
  const inicio = txt(f, "inicio");
  if (!inicio || !/^\d{4}-(0[1-9]|1[0-2])$/.test(inicio)) volta(mes, "Informe o mês de início do controle.");
  const supabase = await supabaseServer();
  const { error } = await supabase.from("settings").upsert({ key: "finance_start", value: `${inicio}-01` });
  if (error) volta(mes, `Não foi possível salvar.${motivo(error)}`);
  revalidatePath("/financeiro");
  volta(mes);
}
