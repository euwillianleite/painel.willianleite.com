import type { Metadata } from "next";
import { EMPRESA } from "@/lib/empresa";

export const metadata: Metadata = { title: "Política de Privacidade" };

export default function Privacidade() {
  return (
    <main className="login">
      <div className="card" style={{ maxWidth: 680 }}>
        <h1>Política de Privacidade</h1>
        <p className="muted">{[EMPRESA.nome, EMPRESA.dominio, "atualizada em 30/10/2026"].filter(Boolean).join(" · ")}</p>

        <h2>Quem somos</h2>
        <p>
          {EMPRESA.nome} é uma ferramenta interna de gestão, de uso exclusivo do administrador da empresa
          {EMPRESA.responsavel ? ` (${EMPRESA.responsavel})` : ""}. Não é aberta ao público e não há cadastro de outros usuários.
        </p>

        <h2>Dados que acessamos</h2>
        <p>
          Com a autorização do administrador, o painel lê, somente para consulta, dados de gasto e identificação das contas de
          anúncio da própria empresa e de clientes sob sua gestão (Google Ads e Meta Ads). Também guardamos dados de cadastro
          e financeiros dos clientes da empresa, informados pelo próprio administrador.
        </p>

        <h2>Dados do Google</h2>
        <p>
          O acesso à API do Google Ads é usado apenas para ler o valor investido em anúncios e a lista de contas, a fim de
          exibir esses números na ficha de cada cliente. O painel não altera campanhas, não cria anúncios e não grava nada
          nas contas. O uso das informações recebidas das APIs do Google segue a{" "}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">
            Política de Dados de Usuário dos Serviços de API do Google
          </a>
          , incluindo os requisitos de Uso Limitado.
        </p>

        <h2>Compartilhamento</h2>
        <p>
          Não vendemos, não transferimos e não compartilhamos esses dados com terceiros, exceto com os provedores de
          infraestrutura necessários ao funcionamento do painel (hospedagem e banco de dados), que os tratam sob nossas
          instruções. Nenhum dado é usado para publicidade, perfilamento ou treinamento de modelos de IA.
        </p>

        <h2>Armazenamento e segurança</h2>
        <p>
          Os dados ficam em banco de dados com acesso restrito ao administrador e conexão criptografada. As credenciais de
          integração ficam em variáveis de ambiente do servidor e não são exibidas no painel.
        </p>

        <h2>Seus direitos e contato</h2>
        <p>
          Para saber quais dados mantemos, corrigi-los ou excluí-los, ou para revogar o acesso do painel à sua conta Google
          (em myaccount.google.com/permissions), fale com o administrador
          {EMPRESA.email ? (
            <>
              {" "}pelo e-mail <a href={`mailto:${EMPRESA.email}`}>{EMPRESA.email}</a>
            </>
          ) : null}
          .
        </p>
      </div>
    </main>
  );
}
