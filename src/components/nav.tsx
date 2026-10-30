"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const itens = [
  { href: "/clientes", label: "Clientes" },
  { href: "/financeiro", label: "Financeiro" },
  { href: "/conexao", label: "Conexão" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="Principal">
      {itens.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          aria-current={path === i.href || path.startsWith(i.href + "/") ? "page" : undefined}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
