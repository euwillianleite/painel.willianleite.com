import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { type Despesa, type VersaoDespesa } from "@/lib/fluxo";
import { mesAtualISO, numBR } from "@/lib/format";
import { apagarDespesa, atualizarDespesa, editarVersao, novaVersao, removerVersao } from "../actions";

export const metadata: Metadata = { title: "Editar despesa" };

export default async function EditarDespesa({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const [{ id }, { erro }] = await Promise.all([params, searchParams]);
  const supabase = await supabaseServer();
  const { data } = await supabase.from("expenses").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const d = data as Despesa;
  const { data: vs } = await supabase.from("expense_versions").select("*").eq("expense_id", id).order("starts_on", { ascending: false });
  const versoes = (vs ?? []) as VersaoDespesa[];
  const mes = mesAtualISO();
  const atual = versoes.filter((v) => v.starts_on <= mes)[0];
  const sufixo = d.currency === "USD" ? "US$" : "R$";

  return (
    <>
      <p className="muted"><Link href="/financeiro/despesas">← Despesas</Link></p>
      <h1 style={{ margin: "4px 0 20px" }}>{d.name}</h1>
      {erro && <p className="error" role="alert">{erro}</p>}

      <form action={atualizarDespesa} className="card form">
        <input type="hidden" name="id" value={id} />
        <div className="row">
          <div className="field"><label htmlFor="name">Nome *</label><input id="name" name="name" defaultValue={d.name} required /></div>
          <div className="field">
            <label htmlFor="category">Categoria</label>
            <select id="category" name="category" defaultValue={d.category}>
              <option value="ferramentas">Ferramentas e assinaturas</option>
              <option value="equipe">Equipe e freelancers</option>
              <option value="outras">Outras</option>
            </select>
          </div>
          {d.kind === "recorrente" ? (
            <div className="field">
              <label htmlFor="last_month">Último mês cobrado</label>
              <input id="last_month" name="last_month" type="month" defaultValue={d.last_month?.slice(0, 7) ?? ""} />
            </div>
          ) : (
            <>
              <div className="field"><label htmlFor="one_off_date">Data</label><input id="one_off_date" name="one_off_date" type="date" defaultValue={d.one_off_date ?? ""} required /></div>
              <div className="field"><label htmlFor="amount">Valor ({sufixo})</label><input id="amount" name="amount" inputMode="decimal" defaultValue={numBR(d.one_off_amount ?? 0)} required /></div>
            </>
          )}
        </div>
        {d.kind === "recorrente" && <p className="muted small">Deixe o último mês em branco para a despesa continuar indefinidamente. Preencha para encerrá-la.</p>}
        <div className="actions"><button className="btn">Salvar</button><Link href="/financeiro/despesas" className="btn ghost">Voltar</Link></div>
      </form>

      {d.kind === "recorrente" && (
        <section className="card">
          <h2>Valores {atual && <span className="muted small">· vigente {sufixo} {numBR(atual.amount)}, dia {atual.pay_day}</span>}</h2>
          <p className="muted small" style={{ marginBottom: 12 }}>
            Cada valor vale do mês escolhido em diante. Valores de meses já pagos ficam travados.
          </p>
          {versoes.map((v) => (
            <form key={v.id} className="row inline vrow">
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="valor_id" value={v.id} />
              <div className="field"><label>A partir de</label><input name="starts_on" type="month" defaultValue={v.starts_on.slice(0, 7)} required /></div>
              <div className="field"><label>Valor ({sufixo})</label><input name="amount" inputMode="decimal" defaultValue={numBR(v.amount)} required /></div>
              <div className="field narrow"><label>Dia do pagto</label><input name="pay_day" type="number" min={1} max={31} defaultValue={v.pay_day} required /></div>
              <div className="field grow"><label>Observação</label><input name="note" defaultValue={v.note ?? ""} /></div>
              <button className="btn" formAction={editarVersao}>Salvar</button>
              <button className="link-danger" formAction={removerVersao}>Apagar</button>
            </form>
          ))}
          <form action={novaVersao} className="row inline vrow">
            <input type="hidden" name="id" value={id} />
            <div className="field"><label>Novo valor — a partir de</label><input name="starts_on" type="month" defaultValue={mes.slice(0, 7)} required /></div>
            <div className="field"><label>Valor ({sufixo})</label><input name="amount" inputMode="decimal" placeholder="150,00" required /></div>
            <div className="field narrow"><label>Dia do pagto</label><input name="pay_day" type="number" min={1} max={31} defaultValue={atual?.pay_day ?? ""} required /></div>
            <div className="field grow"><label>Observação</label><input name="note" placeholder="Aumento, troca de plano…" /></div>
            <button className="btn ghost">Adicionar valor</button>
          </form>
        </section>
      )}

      <details className="remover card">
        <summary>Apagar esta despesa</summary>
        <form action={apagarDespesa}>
          <input type="hidden" name="id" value={id} />
          <p className="muted small">Só é possível se não houver pagamentos registrados. Caso contrário, encerre a despesa pelo último mês cobrado.</p>
          <button className="btn danger">Confirmar exclusão</button>
        </form>
      </details>
    </>
  );
}
