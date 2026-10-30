import type { Metadata } from "next";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { rotuloCategoria, type Despesa, type VersaoDespesa } from "@/lib/fluxo";
import { brl, dataBR, mesAtualISO, mesBR, numBR } from "@/lib/format";
import { Abas } from "../abas";
import { criarDespesa } from "./actions";

export const metadata: Metadata = { title: "Despesas" };

const valorAtual = (vs: VersaoDespesa[], mes: string) =>
  vs.filter((v) => v.starts_on <= mes).sort((a, b) => b.starts_on.localeCompare(a.starts_on))[0] ?? null;
const moeda = (c: "BRL" | "USD", n: number) => (c === "USD" ? `US$ ${numBR(n)}` : brl(n));

export default async function Despesas({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const supabase = await supabaseServer();
  const [{ data: ds }, { data: vs }] = await Promise.all([
    supabase.from("expenses").select("*").order("name"),
    supabase.from("expense_versions").select("*"),
  ]);
  const despesas = (ds ?? []) as Despesa[];
  const versoes = (vs ?? []) as VersaoDespesa[];
  const mes = mesAtualISO();

  return (
    <>
      <h1 style={{ marginBottom: 12 }}>Financeiro</h1>
      <Abas ativa="despesas" />
      {erro && <p className="error" role="alert">{erro}</p>}

      <details className="card" style={{ marginBottom: 16 }} open={despesas.length === 0}>
        <summary className="strong" style={{ cursor: "pointer" }}>Nova despesa</summary>
        <form action={criarDespesa} className="form" style={{ marginTop: 16 }}>
          <div className="row">
            <div className="field"><label htmlFor="name">Nome *</label><input id="name" name="name" placeholder="Claude, Vercel, freelancer…" required /></div>
            <div className="field">
              <label htmlFor="category">Categoria</label>
              <select id="category" name="category" defaultValue="ferramentas">
                <option value="ferramentas">Ferramentas e assinaturas</option>
                <option value="equipe">Equipe e freelancers</option>
                <option value="outras">Outras</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="kind">Tipo</label>
              <select id="kind" name="kind" defaultValue="recorrente">
                <option value="recorrente">Recorrente (todo mês)</option>
                <option value="pontual">Pontual (uma vez)</option>
              </select>
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label htmlFor="currency">Moeda</label>
              <select id="currency" name="currency" defaultValue="BRL">
                <option value="BRL">Real (R$)</option>
                <option value="USD">Dólar (US$)</option>
              </select>
            </div>
            <div className="field"><label htmlFor="amount">Valor *</label><input id="amount" name="amount" inputMode="decimal" placeholder="120,00" required /></div>
          </div>
          <div className="row">
            <div className="field"><label htmlFor="starts_on">Recorrente: a partir de</label><input id="starts_on" name="starts_on" type="month" defaultValue={mes.slice(0, 7)} /></div>
            <div className="field"><label htmlFor="pay_day">Recorrente: dia do pagamento</label><input id="pay_day" name="pay_day" type="number" min={1} max={31} placeholder="10" /></div>
            <div className="field"><label htmlFor="one_off_date">Pontual: data</label><input id="one_off_date" name="one_off_date" type="date" /></div>
          </div>
          <p className="muted small">Despesas em dólar são convertidas pela cotação PTAX do dia. Dia 29, 30 ou 31 em meses curtos cai no último dia do mês.</p>
          <div className="actions"><button className="btn">Salvar despesa</button></div>
        </form>
      </details>

      {despesas.length === 0 ? (
        <div className="card muted">Nenhuma despesa cadastrada.</div>
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr><th>Despesa</th><th>Categoria</th><th>Tipo</th><th className="num">Valor</th><th>Dia</th><th>Situação</th></tr>
            </thead>
            <tbody>
              {despesas.map((d) => {
                const v = d.kind === "recorrente" ? valorAtual(versoes.filter((x) => x.expense_id === d.id), mes) : null;
                const encerrada = d.kind === "recorrente" && !!d.last_month && d.last_month < mes;
                return (
                  <tr key={d.id}>
                    <td><Link href={`/financeiro/despesas/${d.id}`} className="strong">{d.name}</Link></td>
                    <td className="muted">{rotuloCategoria(d.category)}</td>
                    <td>{d.kind === "recorrente" ? "Recorrente" : "Pontual"}</td>
                    <td className="num">
                      {d.kind === "pontual" ? moeda(d.currency, d.one_off_amount ?? 0) : v ? moeda(d.currency, v.amount) : "—"}
                    </td>
                    <td>{d.kind === "pontual" ? dataBR(d.one_off_date) : v ? `dia ${v.pay_day}` : "—"}</td>
                    <td>
                      {encerrada ? <span className="badge encerrado">Encerrada em {mesBR(d.last_month!)}</span>
                        : d.kind === "recorrente" && d.last_month ? <span className="badge aviso">Até {mesBR(d.last_month)}</span>
                        : <span className="badge ativo">Ativa</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
