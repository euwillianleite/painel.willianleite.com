"use server";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export async function entrar(_prev: { erro?: string } | undefined, form: FormData) {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { erro: "Informe e-mail e senha." };

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { erro: "E-mail ou senha incorretos." };

  // Só entra quem está na lista de administradores.
  const { data: admin } = await supabase.rpc("is_admin");
  if (!admin) {
    await supabase.auth.signOut();
    return { erro: "Esta conta não tem acesso ao painel." };
  }
  redirect("/clientes");
}

export async function sair() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}
