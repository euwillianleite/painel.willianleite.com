import { diasAte } from "./format";

export type Cliente = {
  id: string;
  name: string;
  document: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  status: "ativo" | "encerrado";
  billing_day: number | null;
  project_start: string | null;
  contract_end: string | null; // término / renovação do contrato
  notes: string | null;
};
export type Link = { id: string; label: string; url: string };
export type Valor = { id: string; client_service_id: string; starts_on: string; amount: number; note: string | null };
/** Serviço vinculado ao cliente (com setup opcional). */
export type Contrato = {
  id: string;
  client_id: string;
  setup_amount: number | null;
  setup_month: string | null;
  setup_method: "pix" | "cartao" | null;
  services: { name: string } | null;
};

/** Valor vigente no mês: o mais recente com starts_on <= mês. */
export function valorVigente(valores: Valor[], mes: string): Valor | null {
  let atual: Valor | null = null;
  for (const v of valores) {
    if (v.starts_on <= mes && (!atual || v.starts_on > atual.starts_on)) atual = v;
  }
  return atual;
}

export type Alerta = { texto: string; tom: "aviso" | "perigo" } | null;

/** Destaca o término/renovação do contrato nos próximos 30 dias (ou já vencido). */
export function alertaPrazo(c: Pick<Cliente, "status" | "contract_end">): Alerta {
  if (c.status !== "ativo" || !c.contract_end) return null;
  const dias = diasAte(c.contract_end);
  if (dias > 30) return null;
  if (dias < 0) return { texto: `Renovação vencida há ${-dias} d`, tom: "perigo" };
  if (dias === 0) return { texto: "Renova hoje", tom: "perigo" };
  return { texto: `Renova em ${dias} d`, tom: "aviso" };
}

/** Soma das mensalidades vigentes no mês, de todos os serviços do cliente. */
export function mensalidadeCliente(contratos: Contrato[], valores: Valor[], mes: string): number {
  return contratos.reduce((t, ct) => {
    const v = valorVigente(valores.filter((x) => x.client_service_id === ct.id), mes);
    return t + (v?.amount ?? 0);
  }, 0);
}
