import { supabaseServer } from "./supabase/server";
import type { Cliente, Contrato, Valor } from "./clientes";
import type { Despesa, PagCliente, PagDespesa, VersaoDespesa } from "./fluxo";

/** Carrega tudo o que o fluxo de caixa precisa (poucos registros; uma ida ao banco por tabela). */
export async function carregarFluxoBase() {
  const supabase = await supabaseServer();
  const [cl, ct, vs, pc, ds, dv, pd, st] = await Promise.all([
    supabase.from("clients").select("id,name,status"),
    supabase.from("client_services").select("id,client_id,setup_amount,setup_date,setup_method,services(name)"),
    supabase.from("client_price_versions").select("*"),
    supabase.from("client_payments").select("*"),
    supabase.from("expenses").select("*").order("name"),
    supabase.from("expense_versions").select("*"),
    supabase.from("expense_payments").select("*"),
    supabase.from("settings").select("value").eq("key", "finance_start").maybeSingle(),
  ]);
  return {
    clientes: (cl.data ?? []) as Pick<Cliente, "id" | "name" | "status">[],
    contratos: (ct.data ?? []) as unknown as Contrato[],
    valores: (vs.data ?? []) as Valor[],
    pagamentos: (pc.data ?? []) as PagCliente[],
    despesas: (ds.data ?? []) as Despesa[],
    versoes: (dv.data ?? []) as VersaoDespesa[],
    pagDespesas: (pd.data ?? []) as PagDespesa[],
    inicioControle: (st.data?.value as string | undefined) ?? null,
  };
}
