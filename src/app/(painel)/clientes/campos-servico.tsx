import { mesAtualISO } from "@/lib/format";

/** Serviço + mensalidade inicial + setup opcional. Sem JavaScript no navegador. */
export function CamposServico({ catalogo }: { catalogo: string[] }) {
  return (
    <>
      <div className="row">
        <div className="field">
          <label htmlFor="service_name">Serviço *</label>
          <input id="service_name" name="service_name" list="catalogo" placeholder="Assessoria de Tráfego" autoComplete="off" required />
          <datalist id="catalogo">
            {catalogo.map((n) => <option key={n} value={n} />)}
          </datalist>
        </div>
        <div className="field">
          <label htmlFor="amount">Mensalidade (R$) *</label>
          <input id="amount" name="amount" inputMode="decimal" placeholder="1.500,00" required />
        </div>
        <div className="field">
          <label htmlFor="starts_on">Vale a partir de *</label>
          <input id="starts_on" name="starts_on" type="month" defaultValue={mesAtualISO().slice(0, 7)} required />
        </div>
      </div>
      <div className="row">
        <div className="field">
          <label htmlFor="pay_day">Dia do pagamento *</label>
          <input id="pay_day" name="pay_day" type="number" min={1} max={31} placeholder="10" required />
        </div>
      </div>
      <div className="row">
        <div className="field">
          <label htmlFor="setup_amount">Setup (R$), se houver</label>
          <input id="setup_amount" name="setup_amount" inputMode="decimal" placeholder="3.000,00" />
        </div>
        <div className="field">
          <label htmlFor="setup_date">Data do setup</label>
          <input id="setup_date" name="setup_date" type="date" />
        </div>
        <div className="field">
          <label htmlFor="setup_method">Forma do setup</label>
          <select id="setup_method" name="setup_method" defaultValue="">
            <option value="">—</option>
            <option value="pix">Pix</option>
            <option value="cartao">Cartão</option>
          </select>
        </div>
      </div>
      <p className="muted small">Dia 29, 30 ou 31 em meses mais curtos cai no último dia do mês. Mudanças de valor ou de dia entram como novo valor, na edição do cliente.</p>
    </>
  );
}
