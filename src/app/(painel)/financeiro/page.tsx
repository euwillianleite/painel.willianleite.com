import type { Metadata } from "next";
import Link from "next/link";
import { carregarFluxoBase } from "@/lib/dados-financeiro";
import { cotacaoUSD } from "@/lib/bcb";
import { addMeses, gerarLancamentos, periodos, primeiroDia, totais, type Lancamento } from "@/lib/fluxo";
import { brl, dataBR, hojeISO, mesAtualISO, mesBR, numBR } from "@/lib/format";
import { definirInicioControle, desfazerEntrada, desfazerSaida, marcarEntrada, marcarSaida } from "./actions";
import { Abas } from "./abas";

export const metadata: Metadata = { title: "Financeiro" };

const VISOES = [
  { v: "mensal", r: "Mensal", n: 1 },
  { v: "semestral", r: "Semestral", n: 6 },
  { v: "anual", r: "Anual", n: 12 },
] as const;
const HORIZONTE = 12;

export default async function Financeiro({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; visao?: string; erro?: string }>;
}) {
  const sp = await searchParams;
  const atual = mesAtualISO();
  const mes = sp.mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.mes) ? `${sp.mes}-01` : atual;
  const visao = VISOES.find((x) => x.v === sp.visao) ?? VISOES[0];

  const { inicioControle: inicioSalvo, ...base } = await carregarFluxoBase();
  const temUSD = base.despesas.some((d) => d.currency === "USD");
  const cot = temUSD ? await cotacaoUSD() : null;
  const hoje = hojeISO();

  // Gera do início do histórico até o fim do horizonte (ou do mês selecionado, se for além).
  const fim = [addMeses(atual, HORIZONTE - 1), mes].sort().at(-1)!;
  // Antes do "início do controle" só aparece o que já foi pago. Sem configuração: começa no mês atual.
  const inicio = inicioSalvo ?? atual;
  const todos = gerarLancamentos({ ...base, usd: cot?.taxa ?? null, hoje }, fim).filter(
    (l) => l.mes >= inicio || l.status === "pago",
  );

  const doMes = todos.filter((l) => l.mes === mes);
  const t = totais(doMes);
  const atrasados = todos.filter((l) => l.status === "atrasado");
  const atrasadosEntrada = atrasados.filter((l) => l.tipo === "entrada");
  const atrasadosSaida = atrasados.filter((l) => l.tipo === "saida");
  const soma = (ls: Lancamento[]) => ls.reduce((s, l) => s + l.valor, 0);

  const ps = periodos(todos, atual, HORIZONTE, visao.n, (m) => mesBR(m));
  const maximo = Math.max(1, ...ps.flatMap((p) => [p.totais.entradas, p.totais.saidas]));
  const qs = (m: string, v = visao.v) => `/financeiro?mes=${m.slice(0, 7)}&visao=${v}`;

  const entradas = doMes.filter((l) => l.tipo === "entrada");
  const saidas = doMes.filter((l) => l.tipo === "saida");

  return (
    <>
      <h1 style={{ marginBottom: 12 }}>Financeiro</h1>
      <Abas ativa="fluxo" />
      {sp.erro && <p className="error" role="alert">{sp.erro}</p>}

      <div className="monthnav">
        <Link href={qs(addMeses(mes, -1))} aria-label="Mês anterior">←</Link>
        <strong>{mesBR(mes)}</strong>
        <Link href={qs(addMeses(mes, 1))} aria-label="Próximo mês">→</Link>
        {mes !== atual && <Link href={qs(atual)} className="muted small">ir para o mês atual</Link>}
      </div>

      <div className="stats">
        <div className="card">
          <div className="muted small">Entradas do mês</div>
          <div className="stat">{brl(t.entradas)}</div>
          <div className="muted small">recebido {brl(t.entradasPagas)}</div>
        </div>
        <div className="card">
          <div className="muted small">Saídas do mês</div>
          <div className="stat">{brl(t.saidas)}</div>
          <div className="muted small">pago {brl(t.saidasPagas)}</div>
        </div>
        <div className="card">
          <div className="muted small">Lucro do mês</div>
          <div className={`stat ${t.lucro < 0 ? "neg" : ""}`}>{brl(t.lucro)}</div>
          <div className="muted small">realizado {brl(t.lucroReal)}</div>
        </div>
        <div className="card">
          <div className="muted small">Em atraso</div>
          <div className="stat">{atrasados.length}</div>
          <div className="muted small">
            {atrasados.length ? `a receber ${brl(soma(atrasadosEntrada))} · a pagar ${brl(soma(atrasadosSaida))}` : "nada atrasado"}
          </div>
        </div>
      </div>

      <section className="card">
        <div className="toolbar" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Fluxo de caixa — próximos {HORIZONTE} meses</h2>
          <div className="tabs" style={{ margin: 0 }}>
            {VISOES.map((x) => (
              <Link key={x.v} href={qs(mes, x.v)} aria-current={x.v === visao.v ? "page" : undefined}>{x.r}</Link>
            ))}
          </div>
        </div>

        {visao.n === 1 && (
          <div className="chart" role="img" aria-label="Entradas e saídas por mês">
            {ps.map((p) => (
              <div key={p.de} className="col" title={`${p.rotulo}: entradas ${brl(p.totais.entradas)}, saídas ${brl(p.totais.saidas)}`}>
                <div className="bars">
                  <span className="bar in" style={{ height: `${(p.totais.entradas / maximo) * 100}%` }} />
                  <span className="bar out" style={{ height: `${(p.totais.saidas / maximo) * 100}%` }} />
                </div>
                <span className="lbl">{p.rotulo.slice(0, 3)}</span>
              </div>
            ))}
          </div>
        )}
        {visao.n === 1 && (
          <p className="legend small muted"><span className="dot in" /> Entradas <span className="dot out" /> Saídas</p>
        )}

        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Período</th><th className="num">Entradas</th><th className="num">Saídas</th><th className="num">Lucro</th><th className="num">Acumulado</th></tr>
            </thead>
            <tbody>
              {ps.map((p) => (
                <tr key={p.de}>
                  <td>{p.rotulo}</td>
                  <td className="num">{brl(p.totais.entradas)}</td>
                  <td className="num">{brl(p.totais.saidas)}</td>
                  <td className={`num strong ${p.totais.lucro < 0 ? "neg" : ""}`}>{brl(p.totais.lucro)}</td>
                  <td className={`num ${p.acumulado < 0 ? "neg" : ""}`}>{brl(p.acumulado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small" style={{ marginTop: 12 }}>
          Clientes ativos renovam automaticamente; clientes encerrados não entram na projeção.
          {cot && ` Dólar: R$ ${numBR(cot.taxa)} (PTAX de ${dataBR(cot.data)}).`}
          {temUSD && !cot && " Cotação do dólar indisponível agora: despesas em dólar aparecem zeradas."}
        </p>
      </section>

      <div className="two">
        <Lista titulo="Entradas" itens={entradas} mes={mes} hoje={hoje} />
        <Lista titulo="Saídas" itens={saidas} mes={mes} hoje={hoje} />
      </div>

      <section className="card">
        <h2>Início do controle</h2>
        <p className="muted small" style={{ marginBottom: 12 }}>
          Meses anteriores a este não geram cobranças em aberto nem atrasos (só aparece o que foi marcado como pago).
          Para lançar o histórico, escolha um mês mais antigo.
        </p>
        <form action={definirInicioControle} className="row inline">
          <input type="hidden" name="mes" value={mes.slice(0, 7)} />
          <div className="field"><label htmlFor="inicio">Começa em</label><input id="inicio" name="inicio" type="month" defaultValue={inicio.slice(0, 7)} required /></div>
          <button className="btn ghost">Salvar</button>
        </form>
      </section>
    </>
  );
}

function Lista({ titulo, itens, mes, hoje }: { titulo: string; itens: Lancamento[]; mes: string; hoje: string }) {
  return (
    <section className="card">
      <h2>{titulo} de {mesBR(mes)}</h2>
      {itens.length === 0 && <p className="muted">Nada neste mês.</p>}
      <ul className="lanc">
        {itens.map((l) => (
          <li key={l.chave} className={l.status}>
            <div className="info">
              <div className="strong">{l.titulo}</div>
              <div className="muted small">{l.detalhe}</div>
              <div className="small">
                {l.status === "pago" ? <span className="ok">✓ pago em {dataBR(l.data)}</span> : (
                  <>
                    {dataBR(l.data)}
                    {l.status === "atrasado" && <span className="badge perigo">atrasado</span>}
                    {l.moeda === "USD" && <span className="muted"> · US$ {numBR(l.valorOriginal)}</span>}
                    {l.semCotacao && <span className="muted"> · sem cotação</span>}
                  </>
                )}
              </div>
            </div>
            <div className="val">{brl(l.valor)}</div>
            {l.status === "pago" ? (
              <form action={l.tipo === "entrada" ? desfazerEntrada : desfazerSaida}>
                <input type="hidden" name="id" value={l.pagoId} />
                <input type="hidden" name="mes" value={mes.slice(0, 7)} />
                <button className="link-danger">Desfazer</button>
              </form>
            ) : (
              <form action={l.tipo === "entrada" ? marcarEntrada : marcarSaida} className="pagar">
                <input type="hidden" name="id" value={l.refId} />
                <input type="hidden" name="ref_month" value={l.mes} />
                <input type="hidden" name="mes" value={mes.slice(0, 7)} />
                {l.origem !== "despesa" && <input type="hidden" name="kind" value={l.origem} />}
                <input name="amount" inputMode="decimal" aria-label={l.moeda === "USD" ? "Valor pago em dólar" : "Valor pago"}
                  defaultValue={numBR(l.moeda === "USD" ? l.valorOriginal : l.valor)} required />
                <input name="paid_on" type="date" aria-label="Data do pagamento" defaultValue={l.data > hoje ? hoje : l.data} required />
                <button className="btn ghost">{l.tipo === "entrada" ? "Recebido" : "Pago"}</button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
