import { diasAte } from "./format";

export type Cliente = {
  id: string;
  name: string;
  document: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  services: string | null;
  status: "ativo" | "encerrado";
  billing_day: number | null;
  project_start: string | null;
  project_end: string | null;
  renewal_date: string | null;
  contract_end: string | null;
  notes: string | null;
};
export type Link = { id: string; label: string; url: string };
export type Valor = { id: string; client_id: string; starts_on: string; amount: number; note: string | null };

/** Valor vigente no mês: o mais recente com starts_on <= mês. */
export function valorVigente(valores: Valor[], mes: string): Valor | null {
  let atual: Valor | null = null;
  for (const v of valores) {
    if (v.starts_on <= mes && (!atual || v.starts_on > atual.starts_on)) atual = v;
  }
  return atual;
}

export type Alerta = { texto: string; tom: "aviso" | "perigo" } | null;

/** Destaca renovação / fim de contrato nos próximos 30 dias (ou já vencidos). */
export function alertaPrazo(c: Pick<Cliente, "status" | "renewal_date" | "contract_end">): Alerta {
  if (c.status !== "ativo") return null;
  const itens: { rotulo: string; dias: number }[] = [];
  if (c.renewal_date) itens.push({ rotulo: "Renovação", dias: diasAte(c.renewal_date) });
  if (c.contract_end) itens.push({ rotulo: "Fim do contrato", dias: diasAte(c.contract_end) });
  const proximo = itens.filter((i) => i.dias <= 30).sort((a, b) => a.dias - b.dias)[0];
  if (!proximo) return null;
  if (proximo.dias < 0) return { texto: `${proximo.rotulo} vencida há ${-proximo.dias} d`, tom: "perigo" };
  if (proximo.dias === 0) return { texto: `${proximo.rotulo} hoje`, tom: "perigo" };
  return { texto: `${proximo.rotulo} em ${proximo.dias} d`, tom: "aviso" };
}
