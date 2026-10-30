const TZ = "America/Sao_Paulo";

export const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

/** "2026-10-05" -> "05/10/2026" (sem passar por Date, evita deslocamento de fuso) */
export function dataBR(iso: string | null | undefined) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
/** "2026-10-01" -> "out/2026" */
export function mesBR(iso: string) {
  const [y, m] = iso.split("-");
  return `${MESES[Number(m) - 1]}/${y}`;
}

/** Hoje em Brasília, como "YYYY-MM-DD". */
export function hojeISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}
/** Primeiro dia do mês atual em Brasília. */
export const mesAtualISO = () => hojeISO().slice(0, 7) + "-01";

/** Dias entre hoje (Brasília) e a data. Negativo = já passou. */
export function diasAte(iso: string) {
  const a = Date.parse(hojeISO() + "T00:00:00Z");
  const b = Date.parse(iso.slice(0, 10) + "T00:00:00Z");
  return Math.round((b - a) / 86_400_000);
}

/** Aceita "1.500,00", "1500,5", "1500.50". Retorna null se inválido. */
export function parseBRL(texto: string): number | null {
  let s = texto.replace(/[R$\s]/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

/** 1500 -> "1500,00" (para preencher campos de formulário) */
export const numBR = (n: number) => n.toFixed(2).replace(".", ",");

/** Data de pagamento em um mês: dia pedido, limitado ao último dia do mês (31 em fevereiro -> 28/29). */
export function dataNoMes(mesISO: string, dia: number): string {
  const [y, m] = mesISO.split("-").map(Number);
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${mesISO.slice(0, 7)}-${String(Math.min(dia, ultimo)).padStart(2, "0")}`;
}
