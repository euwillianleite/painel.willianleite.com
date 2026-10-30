import { redirect } from "next/navigation";
import { Nav } from "@/components/nav";
import { supabaseServer } from "@/lib/supabase/server";
import { sair } from "../login/actions";
import { EMPRESA } from "@/lib/empresa";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const supabase = await supabaseServer();
  const { data: admin } = await supabase.rpc("is_admin");
  if (!admin) redirect("/login");

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">{EMPRESA.nome}</div>
        <Nav />
        <div className="spacer" />
        <form action={sair}>
          <button className="btn ghost">Sair</button>
        </form>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
