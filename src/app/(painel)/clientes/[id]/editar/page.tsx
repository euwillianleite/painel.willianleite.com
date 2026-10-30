import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import type { Cliente } from "@/lib/clientes";
import { atualizarCliente } from "../../actions";
import { CamposCliente } from "../../campos";

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
  return (
    <>
      <p className="muted"><Link href={`/clientes/${id}`}>← {c.name}</Link></p>
      <h1 style={{ margin: "4px 0 20px" }}>Editar cliente</h1>
      <form action={atualizarCliente} className="card form">
        <input type="hidden" name="id" value={id} />
        {erro && <p className="error" role="alert">{erro}</p>}
        <CamposCliente c={c} />
        <p className="muted small">Ao marcar como encerrado, o cliente deixa de entrar na projeção de receita.</p>
        <div className="actions">
          <button className="btn">Salvar</button>
          <Link href={`/clientes/${id}`} className="btn ghost">Cancelar</Link>
        </div>
      </form>
    </>
  );
}
