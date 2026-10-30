import type { Metadata } from "next";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { criarCliente } from "../actions";
import { CamposCliente } from "../campos";
import { CamposServico } from "../campos-servico";

export const metadata: Metadata = { title: "Novo cliente" };

export default async function NovoCliente({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const supabase = await supabaseServer();
  const { data } = await supabase.from("services").select("name").order("name");
  const catalogo = (data ?? []).map((s) => s.name as string);
  return (
    <>
      <p className="muted"><Link href="/clientes">← Clientes</Link></p>
      <h1 style={{ margin: "4px 0 20px" }}>Novo cliente</h1>
      <form action={criarCliente} className="card form">
        {erro && <p className="error" role="alert">{erro}</p>}
        <CamposCliente />
        <h2>Serviço contratado</h2>
        <CamposServico catalogo={catalogo} />
        <div className="actions">
          <button className="btn">Salvar cliente</button>
          <Link href="/clientes" className="btn ghost">Cancelar</Link>
        </div>
      </form>
    </>
  );
}
