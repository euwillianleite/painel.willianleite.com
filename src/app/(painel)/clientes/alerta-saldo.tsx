import { carregarSaldos, type ContaMidia } from "@/lib/integracoes/financeiro";

const PLATAFORMA = { meta_ads: "Meta Ads", google_ads: "Google Ads" } as const;

/** Selo na lista de clientes: aparece só quando alguma conta está com poucos dias de saldo. Carrega depois da tabela. */
export async function AlertaSaldo({ contas }: { contas: ContaMidia[] }) {
  if (contas.length === 0) return null;
  const itens = await carregarSaldos(contas);
  // A conta mais perto de ficar sem saldo define o selo, e ele diz de qual plataforma é.
  const pior = itens
    .flatMap((i) =>
      i.r.ok && i.r.dados.prev.nivel && i.r.dados.prev.nivel !== "ok" && i.r.dados.prev.dias !== null
        ? [{ prev: i.r.dados.prev, plataforma: PLATAFORMA[i.conta.platform] }]
        : [],
    )
    .sort((a, b) => (a.prev.dias ?? 0) - (b.prev.dias ?? 0))[0];
  if (!pior) return null;
  const { prev, plataforma } = pior;
  const texto = prev.dias === 0 ? "Sem saldo" : prev.dias === 1 ? "Saldo para 1 dia" : `Saldo para ${prev.dias} dias`;
  return <span className={`badge ${prev.nivel === "critico" ? "perigo" : "aviso"}`}>{`${texto} • ${plataforma}`}</span>;
}
