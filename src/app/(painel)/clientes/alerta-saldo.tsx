import { carregarSaldos, type ContaMidia } from "@/lib/integracoes/financeiro";

/** Selo na lista de clientes: aparece só quando alguma conta está com poucos dias de saldo. Carrega depois da tabela. */
export async function AlertaSaldo({ contas }: { contas: ContaMidia[] }) {
  if (contas.length === 0) return null;
  const itens = await carregarSaldos(contas);
  const pior = itens
    .flatMap((i) => (i.r.ok && i.r.dados.prev.nivel && i.r.dados.prev.nivel !== "ok" && i.r.dados.prev.dias !== null ? [i.r.dados.prev] : []))
    .sort((a, b) => (a.dias ?? 0) - (b.dias ?? 0))[0];
  if (!pior) return null;
  const texto = pior.dias === 0 ? "Sem saldo" : pior.dias === 1 ? "Saldo para 1 dia" : `Saldo para ${pior.dias} dias`;
  return <span className={`badge ${pior.nivel === "critico" ? "perigo" : "aviso"}`}>{texto}</span>;
}
