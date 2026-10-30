import type { Cliente } from "@/lib/clientes";

/** Campos do cadastro/edição (componente de servidor, sem JavaScript no navegador). */
export function CamposCliente({ c }: { c?: Cliente }) {
  return (
    <>
      <div className="field">
        <label htmlFor="name">Nome do cliente *</label>
        <input id="name" name="name" defaultValue={c?.name} required />
      </div>
      <div className="row">
        <div className="field">
          <label htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={c?.status ?? "ativo"}>
            <option value="ativo">Ativo</option>
            <option value="encerrado">Encerrado</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="billing_day">Dia de vencimento</label>
          <input id="billing_day" name="billing_day" type="number" min={1} max={31} defaultValue={c?.billing_day ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="document">CNPJ / CPF</label>
          <input id="document" name="document" defaultValue={c?.document ?? ""} />
        </div>
      </div>
      <div className="row">
        <div className="field">
          <label htmlFor="contact_name">Contato</label>
          <input id="contact_name" name="contact_name" defaultValue={c?.contact_name ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="contact_phone">WhatsApp</label>
          <input id="contact_phone" name="contact_phone" inputMode="tel" defaultValue={c?.contact_phone ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="contact_email">E-mail</label>
          <input id="contact_email" name="contact_email" type="email" defaultValue={c?.contact_email ?? ""} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="services">Serviços contratados</label>
        <input id="services" name="services" defaultValue={c?.services ?? ""} />
      </div>
      <div className="row">
        <div className="field">
          <label htmlFor="project_start">Início do projeto</label>
          <input id="project_start" name="project_start" type="date" defaultValue={c?.project_start ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="project_end">Término do projeto</label>
          <input id="project_end" name="project_end" type="date" defaultValue={c?.project_end ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="renewal_date">Renovação</label>
          <input id="renewal_date" name="renewal_date" type="date" defaultValue={c?.renewal_date ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="contract_end">Fim do contrato</label>
          <input id="contract_end" name="contract_end" type="date" defaultValue={c?.contract_end ?? ""} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="notes">Observações</label>
        <textarea id="notes" name="notes" rows={3} defaultValue={c?.notes ?? ""} />
      </div>
    </>
  );
}
