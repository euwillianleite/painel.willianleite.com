import Link from "next/link";

export function Abas({ ativa }: { ativa: "fluxo" | "despesas" }) {
  return (
    <div className="tabs" style={{ marginBottom: 20 }}>
      <Link href="/financeiro" aria-current={ativa === "fluxo" ? "page" : undefined}>Fluxo de caixa</Link>
      <Link href="/financeiro/despesas" aria-current={ativa === "despesas" ? "page" : undefined}>Despesas</Link>
    </div>
  );
}
