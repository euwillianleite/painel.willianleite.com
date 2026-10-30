# Painel administrativo

Painel de gestão para agências e empresas de serviço: clientes, financeiro (fluxo de caixa com valores versionados) e
conexão com Meta Ads, Google Ads e WhatsApp (Z-API). Next.js + Supabase + Vercel.

Este repositório é o **modelo**. Toda empresa usa o mesmo código; o que muda de uma para outra vem de variáveis de
ambiente e do banco de dados. Assim, toda atualização do modelo pode ser recebida por todas as empresas.

## Fluxo de publicação
- `main` = produção. Toda mudança chega por Pull Request e a Vercel gera uma URL de preview.
- Clicar em **Merge** no PR publica em produção.
- Mudou o banco? Crie a migration em `supabase/migrations/` e rode `npm run setup-sql` (atualiza `supabase/setup.sql`).
  A CI reprova o PR se o `setup.sql` estiver desatualizado.

## Instalar para uma empresa nova

### 1. Código (mantendo as atualizações)
Não use "Use this template": o repositório novo nasceria sem histórico em comum e ficaria difícil receber atualizações.
Faça assim:
```
git clone https://github.com/euwillianleite/painel.willianleite.com.git painel-nova-empresa
cd painel-nova-empresa
git remote rename origin modelo
# crie um repositório PRIVADO vazio no GitHub para a empresa e use a URL dele:
git remote add origin https://github.com/CONTA/REPO-DA-EMPRESA.git
git push -u origin main
```

### 2. Banco (Supabase)
1. Crie um projeto. Em Authentication > Providers > Email, **desative "Allow new users to sign up"**.
2. SQL Editor: cole todo o `supabase/setup.sql` e rode **uma vez**.
3. Authentication > Users: crie seu usuário (e-mail e senha) e libere o acesso, trocando o e-mail:
   `insert into public.admins (user_id) select id from auth.users where email = 'SEU@EMAIL';`

### 3. Publicação (Vercel)
Importe o repositório da empresa e defina as variáveis (escopos Production **e** Preview):

| Variável | Para quê |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase (use a chave **Publishable**, nunca a Secret) |
| `NEXT_PUBLIC_EMPRESA_NOME`, `_RESPONSAVEL`, `_EMAIL`, `_DOMINIO` | Nome no menu e dados da página `/privacidade` |
| `META_ACCESS_TOKEN` | Contas e gasto do Meta Ads |
| `GOOGLE_ADS_CLIENT_ID`, `_CLIENT_SECRET`, `_REFRESH_TOKEN`, `_LOGIN_CUSTOMER_ID` | Google Ads (MCC) |
| `ZAPI_INSTANCE_ID`, `ZAPI_TOKEN`, `ZAPI_CLIENT_TOKEN` | WhatsApp (Z-API) |

As de integração podem ficar para depois: cada aba da tela Conexão diz o que falta. Variáveis `NEXT_PUBLIC_*` só valem
depois de um novo deploy.

### 4. Google Ads (uma vez por empresa)
Projeto no Google Cloud com a Google Ads API ativada e acesso **Exploração** (ou superior) pedido em *Google Ads API
Overview*. Crie a tela de consentimento (Branding com a URL `/privacidade` do painel), publique o app e crie o cliente
OAuth "Aplicativo da Web" com o redirecionamento `https://developers.google.com/oauthplayground`. Gere o Refresh Token no
OAuth Playground com o escopo `https://www.googleapis.com/auth/adwords`.

## Receber atualizações do modelo
```
git fetch modelo
git merge modelo/main
```
Resolva conflitos (raros, se você só mexeu em `src/custom/`), abra um PR e faça o merge. Se vier migration nova, rode o
arquivo novo de `supabase/migrations/` no SQL Editor da empresa (nunca o `setup.sql` inteiro de novo).

## O que é só de cada empresa
Relatórios individuais por cliente e qualquer outra coisa específica ficam em `src/custom/` (veja o README de lá).
O restante do código não deve ser alterado por empresa.

## Desenvolvimento
```
cp .env.example .env.local
npm install
npm run dev
```
