import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { mensalidadeCliente, valorVigente, type Cliente, type Contrato, type Valor } from "@/lib/clientes";
import { brl, mesAtualISO, numBR } from "@/lib/format";
import {
  adicionarServico, atualizarCliente, atualizarSetup, editarValor, novoValor, removerServico, removerValor,
} from "../../actions";
import { CamposCliente } from "../../campos";
import { CamposServico } from "../../campos-servico";

export const metadata: Metadata = { title: "Editar cliente" };

export default async function EditarCliente({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const [{ id }, { erro }] = await Promise.all([params, searchParams]);
  const supabase = await supabaseServer();
  const { data } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const c = data as Cliente;

  const [{ data: cts }, { data: cat }] = await Promise.all([
    supabase.from("client_services").select("id,client_id,setup_amount,setup_date,setup_method,services(name)").eq("client_id", id).order("created_at"),
    supabase.from("services").select("name").order("name"),
  ]);
  const contratos = (cts ?? []) as unknown as Contrato[];
  const ids = contratos.map((x) => x.id);
  const { data: vals } = ids.length
    ? await supabase.from("client_price_versions").select("*").in("client_service_id", ids).order("starts_on", { ascending: false })
    : { data: [] };
  const valores = (vals ?? []) as Valor[];
  const catalogo = (cat ?? []).map((s) => s.name as string);
  const mes = mesAtualISO();

  return (
    <>
      <p className="muted"><Link href={`/clientes/${id}`}>← {c.name}</Link></p>
      <h1 style={{ margin: "4px 0 20px" }}>Editar cliente</h1>
      {erro && <p className="error" role="alert">{erro}</p>}

      <form action={atualizarCliente} className="card form">
        <input type="hidden" name="id" value={id} />
        <CamposCliente c={c} />
        <p className="muted small">Ao marcar como encerrado, o cliente e seus serviços saem da projeção de receita.</p>
        <div className="actions">
          <button className="btn">Salvar dados</button>
          <Link href={`/clientes/${id}`} className="btn ghost">Voltar à ficha</Link>
        </div>
      </form>

      <section className="card">
        <h2>Serviços e valores</h2>
        <p className="muted small" style={{ marginBottom: 16 }}>
          Total mensal vigente em {mes.slice(5, 7)}/{mes.slice(0, 4)}: <strong>{brl(mensalidadeCliente(contratos, valores, mes))}</strong>.
          Valores podem ser corrigidos enquanto o mês não estiver pago.
        </p>

        {contratos.length === 0 && <p className="muted">Nenhum serviço vinculado.</p>}
        {contratos.map((ct) => {
          const vs = valores.filter((v) => v.client_service_id === ct.id);
          const atual = valorVigente(vs, mes);
          return (
            <div key={ct.id} className="svc">
              <div className="toolbar">
                <h3 style={{ margin: 0 }}>{ct.services?.name ?? "Serviço"} <span className="muted small">· vigente {atual ? brl(atual.amount) : "—"}</span></h3>
              </div>

              <h4>Mensalidade</h4>
              {vs.map((v) => (
                <form key={v.id} className="row inline vrow">
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="valor_id" value={v.id} />
                  <div className="field"><label>A partir de</label><input name="starts_on" type="month" defaultValue={v.starts_on.slice(0, 7)} required /></div>
                  <div className="field"><label>Valor (R$)</label><input name="amount" inputMode="decimal" defaultValue={numBR(v.amount)} required /></div>
                  <div className="field narrow"><label>Dia do pagto</label><input name="pay_day" type="number" min={1} max={31} defaultValue={v.pay_day ?? ""} placeholder="dia" required /></div>
                  <div className="field grow"><label>Observação</label><input name="note" defaultValue={v.note ?? ""} /></div>
                  <button className="btn" formAction={editarValor}>Salvar</button>
                  <button className="link-danger" formAction={removerValor}>Apagar</button>
                </form>
              ))}
              <form action={novoValor} className="row inline vrow">
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="contrato_id" value={ct.id} />
                <div className="field"><label>Novo valor — a partir de</label><input name="starts_on" type="month" defaultValue={mes.slice(0, 7)} required /></div>
                <div className="field"><label>Valor (R$)</label><input name="amount" inputMode="decimal" placeholder="1.200,00" required /></div>
                <div className="field narrow"><label>Dia do pagto</label><input name="pay_day" type="number" min={1} max={31} defaultValue={atual?.pay_day ?? ""} placeholder="dia" required /></div>
                <div className="field grow"><label>Observação</label><input name="note" placeholder="Renegociado, desconto…" /></div>
                <button className="btn ghost">Adicionar valor</button>
              </form>

              <h4>Setup</h4>
              <form action={atualizarSetup} className="row inline vrow">
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="contrato_id" value={ct.id} />
                <div className="field"><label>Valor (R$)</label><input name="setup_amount" inputMode="decimal" placeholder="sem setup" defaultValue={ct.setup_amount ? numBR(ct.setup_amount) : ""} /></div>
                <div className="field"><label>Data</label><input name="setup_date" type="date" defaultValue={ct.setup_date ?? ""} /></div>
                <div className="field">
                  <label>Forma</label>
                  <select name="setup_method" defaultValue={ct.setup_method ?? ""}>
                    <option value="">—</option><option value="pix">Pix</option><option value="cartao">Cartão</option>
                  </select>
                </div>
                <button className="btn ghost">Salvar setup</button>
              </form>

              <details className="remover">
                <summary>Remover este serviço</summary>
                <form action={removerServico}>
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="contrato_id" value={ct.id} />
                  <p className="muted small">Apaga o serviço do cliente junto com o histórico de valores e o setup.</p>
                  <button className="btn danger">Confirmar remoção</button>
                </form>
              </details>
            </div>
          );
        })}

        <h3>Adicionar serviço</h3>
        <form action={adicionarServico} className="form">
          <input type="hidden" name="id" value={id} />
          <CamposServico catalogo={catalogo} />
          <div className="actions"><button className="btn">Adicionar serviço</button></div>
        </form>
      </section>
    </>
  );
}
