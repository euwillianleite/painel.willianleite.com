import type { Metadata } from "next";
import { LoginForm } from "./form";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <main className="login">
      <div className="card">
        <h1>Painel</h1>
        <p className="muted">Acesso restrito.</p>
        <LoginForm />
      </div>
    </main>
  );
}
