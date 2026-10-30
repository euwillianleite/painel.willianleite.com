import type { Metadata } from "next";

export const metadata: Metadata = { title: "Clientes" };

export default function Clientes() {
  return (
    <>
      <h1>Clientes</h1>
      <p className="muted" style={{ marginTop: 8 }}>Em construção — PR 2.</p>
    </>
  );
}
