import type { Metadata } from "next";

export const metadata: Metadata = { title: "Financeiro" };

export default function Financeiro() {
  return (
    <>
      <h1>Financeiro</h1>
      <p className="muted" style={{ marginTop: 8 }}>Em construção — PR 3.</p>
    </>
  );
}
