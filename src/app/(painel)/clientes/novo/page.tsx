import type { Metadata } from "next";
import Link from "next/link";
import { mesAtualISO } from "@/lib/format";
import { criarCliente } from "../actions";
import { CamposCliente } from "../campos";

export const metadata: Metadata = { title: "Novo cliente" };

export default async function NovoCliente({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return (
    <>
      <p className="muted"><Link href="/clientes">← Clientes</Link></p>
      <h1 style={{ margin: "4px 0 20px" }}>Novo cliente</h1>
      <form action={criarCliente} className="card form">
        {erro && <p className="error" role="alert">{erro}</p>}
        <CamposCliente />
        <h2>Mensalidade inicial</h2>
        <div className="row">
          <div className="field">
            <label htmlFor="amount">Valor (R$) *</label>
            <input id="amount" name="amount" inputMode="decimal" placeholder="1.500,00" required />
          </div>
          <div className="field">
            <label htmlFor="starts_on">Vale a partir de *</label>
            <input id="starts_on" name="starts_on" type="month" defaultValue={mesAtualISO().slice(0, 7)} required />
          </div>
        </div>
        <p className="muted small">Mudanças futuras de valor são cadastradas na ficha, sem alterar os meses anteriores.</p>
        <div className="actions">
          <button className="btn">Salvar cliente</button>
          <Link href="/clientes" className="btn ghost">Cancelar</Link>
        </div>
      </form>
    </>
  );
}
