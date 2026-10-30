import { hojeISO } from "./format";

const mdy = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${m}-${d}-${y}`;
};
const menosDias = (iso: string, n: number) =>
  new Date(Date.parse(iso + "T00:00:00Z") - n * 86_400_000).toISOString().slice(0, 10);

/**
 * Dólar (PTAX venda) do Banco Central na data, ou o último dia útil anterior.
 * Retorna null se a consulta falhar; quem chama decide o que fazer.
 */
export async function cotacaoUSD(ate: string = hojeISO()): Promise<{ taxa: number; data: string } | null> {
  try {
    const url =
      "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/" +
      "CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)" +
      `?@dataInicial='${mdy(menosDias(ate, 10))}'&@dataFinalCotacao='${mdy(ate)}'` +
      "&$orderby=dataHoraCotacao%20desc&$top=1&$select=cotacaoVenda,dataHoraCotacao&$format=json";
    const r = await fetch(url, { next: { revalidate: 3600 } });
    if (!r.ok) return null;
    const q = (await r.json())?.value?.[0];
    if (!q || typeof q.cotacaoVenda !== "number") return null;
    return { taxa: q.cotacaoVenda, data: String(q.dataHoraCotacao).slice(0, 10) };
  } catch {
    return null;
  }
}
