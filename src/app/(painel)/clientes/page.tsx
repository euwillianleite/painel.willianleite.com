import type { Metadata } from "next";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { alertaPrazo, valorVigente, type Cliente, type Valor } from "@/lib/clientes";
import { brl, dataBR, mesAtualISO } from "@/lib/format";

export const metadata: Metadata = { title: "Clientes" };

const FILTROS = [
  { v: "ativo", r: "Ativos" },
  { v: "encerrado", r: "Encerrados" },
  { v: "todos", r: "Todos" },
] as const;

export default async function Clientes({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status: s } = await searchParams;
  const filtro = FILTROS.some((f) => f.v === s) ? s! : "ativo";

  const supabase = await supabaseServer();
  const [{ data: clientes }, { data: valores }] = await Promise.all([
    supabase.from("clients").select("*").order("name"),
    supabase.from("client_price_versions").select("*"),
  ]);
  const todos = (clientes ?? []) as Cliente[];
  const vals = (valores ?? []) as Valor[];
  const mes = mesAtualISO();

  const porCliente = (id: string) => vals.filter((v) => v.client_id === id);
  const lista = todos.filter((c) => filtro === "todos" || c.status === filtro);
  const ativos = todos.filter((c) => c.status === "ativo");
  const mrr = ativos.reduce((t, c) => t + (valorVigente(porCliente(c.id), mes)?.amount ?? 0), 0);

  return (
    <>
      <div className="toolbar">
        <h1>Clientes</h1>
        <Link href="/clientes/novo" className="btn">Novo cliente</Link>
      </div>

      <div className="stats">
        <div className="card">
          <div className="muted small">Clientes ativos</div>
          <div className="stat">{ativos.length}</div>
        </div>
        <div className="card">
          <div className="muted small">Mensalidades contratadas (mês atual)</div>
          <div className="stat">{brl(mrr)}</div>
        </div>
      </div>

      <div className="tabs" role="tablist">
        {FILTROS.map((f) => (
          <Link key={f.v} href={`/clientes?status=${f.v}`} aria-current={filtro === f.v ? "page" : undefined}>
            {f.r}
          </Link>
        ))}
      </div>

      {lista.length === 0 ? (
        <div className="card muted">Nenhum cliente {filtro === "todos" ? "cadastrado" : filtro} ainda.</div>
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Status</th>
                <th className="num">Mensalidade</th>
                <th>Início</th>
                <th>Renovação</th>
                <th>Fim do contrato</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => {
                const v = valorVigente(porCliente(c.id), mes);
                const alerta = alertaPrazo(c);
                return (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/clientes/${c.id}`} className="strong">{c.name}</Link>
                      {alerta && <span className={`badge ${alerta.tom}`}>{alerta.texto}</span>}
                    </td>
                    <td><span className={`badge ${c.status}`}>{c.status === "ativo" ? "Ativo" : "Encerrado"}</span></td>
                    <td className="num">{v ? brl(v.amount) : "—"}</td>
                    <td>{dataBR(c.project_start)}</td>
                    <td>{dataBR(c.renewal_date)}</td>
                    <td>{dataBR(c.contract_end)}</td>
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
