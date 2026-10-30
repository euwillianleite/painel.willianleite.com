"use client";

import { useActionState } from "react";
import { entrar } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(entrar, undefined);
  return (
    <form action={action}>
      <div className="field">
        <label htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" autoComplete="username" required />
      </div>
      <div className="field">
        <label htmlFor="password">Senha</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {state?.erro && <p className="error" role="alert">{state.erro}</p>}
      <button className="btn" style={{ width: "100%" }} disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
