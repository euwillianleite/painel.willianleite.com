-- GERADO por scripts/gerar-setup.sh a partir de supabase/migrations/*.sql. Não edite à mão.
-- Instalação completa de um banco NOVO: cole tudo no SQL Editor do Supabase e rode uma única vez.

-- ===== 0001_base.sql =====
-- Base: lista de administradores. Só quem está aqui acessa dados do painel.
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

-- Cada usuário só enxerga a própria linha (suficiente para checar o acesso).
create policy "admin lê a si mesmo" on public.admins
  for select to authenticated
  using (user_id = (select auth.uid()));

-- ===== 0002_clientes.sql =====
-- Clientes, links da ficha e histórico de valores (mensalidade).
-- Regra: valores nunca são editados. Mudança = novo valor com mês de início.

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  document text,                      -- CNPJ/CPF (opcional)
  contact_name text,
  contact_phone text,
  contact_email text,
  services text,
  status text not null default 'ativo' check (status in ('ativo', 'encerrado')),
  billing_day smallint check (billing_day between 1 and 31),
  project_start date,
  project_end date,
  renewal_date date,
  contract_end date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.client_links (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  label text not null check (length(trim(label)) > 0),
  url text not null check (url ~* '^https?://'),
  created_at timestamptz not null default now()
);
create index client_links_client_idx on public.client_links (client_id);

-- Cada linha vale a partir do mês `starts_on` (sempre dia 1) até o próximo valor.
create table public.client_price_versions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  starts_on date not null check (extract(day from starts_on) = 1),
  amount numeric(12, 2) not null check (amount >= 0),
  note text,
  created_at timestamptz not null default now(),
  unique (client_id, starts_on)
);
create index client_price_versions_client_idx on public.client_price_versions (client_id, starts_on desc);

alter table public.clients enable row level security;
alter table public.client_links enable row level security;
alter table public.client_price_versions enable row level security;

-- clientes: sem delete (encerra-se o cliente para preservar o histórico financeiro)
create policy "admin lê clientes" on public.clients for select to authenticated using (public.is_admin());
create policy "admin cria clientes" on public.clients for insert to authenticated with check (public.is_admin());
create policy "admin edita clientes" on public.clients for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "admin lê links" on public.client_links for select to authenticated using (public.is_admin());
create policy "admin cria links" on public.client_links for insert to authenticated with check (public.is_admin());
create policy "admin edita links" on public.client_links for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin apaga links" on public.client_links for delete to authenticated using (public.is_admin());

-- valores: só leitura e inserção; sem update. Só dá para apagar valor do mês atual em diante
-- (engano de digitação). O PR 3 passa a travar meses com pagamento.
create policy "admin lê valores" on public.client_price_versions for select to authenticated using (public.is_admin());
create policy "admin cria valores" on public.client_price_versions for insert to authenticated with check (public.is_admin());
create policy "admin apaga valores futuros" on public.client_price_versions for delete to authenticated
  using (
    public.is_admin()
    and starts_on >= date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date
  );

-- ===== 0003_clientes_ajustes.sql =====
-- 1) Uma única data de término/renovação do contrato.
alter table public.clients drop column if exists project_end;
alter table public.clients drop column if exists renewal_date;

-- 2) Permissões da Data API (o acesso continua limitado pelas policies de RLS).
grant select, insert, update on public.clients to authenticated;
grant select, insert, update, delete on public.client_links to authenticated;
grant select, insert, delete on public.client_price_versions to authenticated;

-- ===== 0004_servicos.sql =====
-- Serviços por cliente. Mensalidade (com histórico) e setup passam a ser do serviço do cliente.

create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);
create unique index services_name_uniq on public.services (lower(trim(name)));

create table public.client_services (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  service_id uuid not null references public.services (id),
  setup_amount numeric(12, 2) check (setup_amount >= 0),
  setup_month date check (extract(day from setup_month) = 1),
  setup_method text check (setup_method in ('pix', 'cartao')),
  created_at timestamptz not null default now(),
  unique (client_id, service_id)
);
create index client_services_client_idx on public.client_services (client_id);

-- Migra valores já cadastrados para um serviço "Assessoria de Tráfego" (pode ser removido/refeito na edição do cliente).
insert into public.services (name)
select 'Assessoria de Tráfego' where exists (select 1 from public.client_price_versions);

insert into public.client_services (client_id, service_id)
select distinct v.client_id, (select id from public.services limit 1)
from public.client_price_versions v;

alter table public.client_price_versions
  add column client_service_id uuid references public.client_services (id) on delete cascade;
update public.client_price_versions v
  set client_service_id = cs.id
  from public.client_services cs
  where cs.client_id = v.client_id;
alter table public.client_price_versions alter column client_service_id set not null;
alter table public.client_price_versions drop constraint client_price_versions_client_id_starts_on_key;
alter table public.client_price_versions drop column client_id;
alter table public.client_price_versions add unique (client_service_id, starts_on);
create index client_price_versions_service_idx on public.client_price_versions (client_service_id, starts_on desc);

-- O texto livre de serviços do cliente é substituído pelo catálogo.
alter table public.clients drop column if exists services;

-- Valores agora podem ser corrigidos. (O PR 3 trava meses já marcados como pagos.)
drop policy if exists "admin apaga valores futuros" on public.client_price_versions;
create policy "admin edita valores" on public.client_price_versions
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin apaga valores" on public.client_price_versions
  for delete to authenticated using (public.is_admin());

alter table public.services enable row level security;
alter table public.client_services enable row level security;

create policy "admin lê serviços" on public.services for select to authenticated using (public.is_admin());
create policy "admin cria serviços" on public.services for insert to authenticated with check (public.is_admin());
create policy "admin edita serviços" on public.services for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "admin lê contratos" on public.client_services for select to authenticated using (public.is_admin());
create policy "admin cria contratos" on public.client_services for insert to authenticated with check (public.is_admin());
create policy "admin edita contratos" on public.client_services for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin apaga contratos" on public.client_services for delete to authenticated using (public.is_admin());

grant select, insert, update on public.services to authenticated;
grant select, insert, update, delete on public.client_services to authenticated;
grant update on public.client_price_versions to authenticated;

-- ===== 0005_dia_pagamento.sql =====
-- Dia de pagamento passa a ser parte de cada valor da mensalidade (versionado).
alter table public.client_price_versions
  add column pay_day smallint check (pay_day between 1 and 31);

-- Aproveita o "dia de vencimento" que estava no cliente.
update public.client_price_versions v
  set pay_day = c.billing_day
  from public.client_services cs
  join public.clients c on c.id = cs.client_id
  where cs.id = v.client_service_id and c.billing_day is not null;

alter table public.clients drop column if exists billing_day;

-- Setup: data exata em vez de mês.
alter table public.client_services add column setup_date date;
update public.client_services set setup_date = setup_month where setup_month is not null;
alter table public.client_services drop column setup_month;

-- ===== 0006_financeiro.sql =====
-- Financeiro: pagamentos recebidos, despesas e pagamentos de despesas.

-- Entradas realizadas. O valor fica "congelado" no momento do pagamento.
create table public.client_payments (
  id uuid primary key default gen_random_uuid(),
  client_service_id uuid not null references public.client_services (id) on delete restrict,
  kind text not null check (kind in ('mensalidade', 'setup')),
  ref_month date not null check (extract(day from ref_month) = 1),
  amount numeric(12, 2) not null check (amount >= 0),
  paid_on date not null,
  created_at timestamptz not null default now(),
  unique (client_service_id, kind, ref_month)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  category text not null check (category in ('ferramentas', 'equipe', 'outras')),
  currency text not null default 'BRL' check (currency in ('BRL', 'USD')),
  kind text not null check (kind in ('recorrente', 'pontual')),
  one_off_date date,
  one_off_amount numeric(12, 2) check (one_off_amount >= 0),
  last_month date check (extract(day from last_month) = 1), -- recorrente: último mês cobrado
  created_at timestamptz not null default now(),
  check (kind = 'recorrente' or (one_off_date is not null and one_off_amount is not null))
);

-- Despesa recorrente: valor e dia versionados, como a mensalidade.
create table public.expense_versions (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses (id) on delete cascade,
  starts_on date not null check (extract(day from starts_on) = 1),
  amount numeric(12, 2) not null check (amount >= 0),
  pay_day smallint not null check (pay_day between 1 and 31),
  note text,
  unique (expense_id, starts_on)
);

create table public.expense_payments (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses (id) on delete restrict,
  ref_month date not null check (extract(day from ref_month) = 1),
  amount numeric(12, 2) not null check (amount >= 0),   -- na moeda da despesa
  fx_rate numeric(10, 4),                                -- USD -> BRL no dia do pagamento
  amount_brl numeric(12, 2) not null check (amount_brl >= 0),
  paid_on date not null,
  created_at timestamptz not null default now(),
  unique (expense_id, ref_month)
);

create index client_payments_month_idx on public.client_payments (ref_month);
create index expense_payments_month_idx on public.expense_payments (ref_month);

-- Trava: não deixa alterar/apagar um valor que cobre meses já pagos.
create or replace function public.guard_price_version() returns trigger
language plpgsql security definer set search_path = '' as $$
declare nxt date;
begin
  if tg_op = 'UPDATE' and (new.amount, new.starts_on, new.pay_day)
       is not distinct from (old.amount, old.starts_on, old.pay_day) then
    return new;
  end if;
  select min(starts_on) into nxt from public.client_price_versions
    where client_service_id = old.client_service_id and starts_on > old.starts_on;
  if exists (
    select 1 from public.client_payments p
    where p.client_service_id = old.client_service_id and p.kind = 'mensalidade'
      and p.ref_month >= old.starts_on and (nxt is null or p.ref_month < nxt)
  ) then
    raise exception 'Este valor cobre meses já pagos. Desfaça os pagamentos ou cadastre um novo valor.'
      using errcode = '23514';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger guard_price_version before update or delete on public.client_price_versions
  for each row execute function public.guard_price_version();

create or replace function public.guard_expense_version() returns trigger
language plpgsql security definer set search_path = '' as $$
declare nxt date;
begin
  if tg_op = 'UPDATE' and (new.amount, new.starts_on, new.pay_day)
       is not distinct from (old.amount, old.starts_on, old.pay_day) then
    return new;
  end if;
  select min(starts_on) into nxt from public.expense_versions
    where expense_id = old.expense_id and starts_on > old.starts_on;
  if exists (
    select 1 from public.expense_payments p
    where p.expense_id = old.expense_id
      and p.ref_month >= old.starts_on and (nxt is null or p.ref_month < nxt)
  ) then
    raise exception 'Este valor cobre meses já pagos. Desfaça os pagamentos ou cadastre um novo valor.'
      using errcode = '23514';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger guard_expense_version before update or delete on public.expense_versions
  for each row execute function public.guard_expense_version();

-- Trava o setup depois de pago.
create or replace function public.guard_setup() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (new.setup_amount, new.setup_date) is distinct from (old.setup_amount, old.setup_date)
     and exists (select 1 from public.client_payments where client_service_id = old.id and kind = 'setup') then
    raise exception 'O setup deste serviço já foi pago. Desfaça o pagamento para alterá-lo.'
      using errcode = '23514';
  end if;
  return new;
end $$;
create trigger guard_setup before update on public.client_services
  for each row execute function public.guard_setup();

alter table public.client_payments enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_versions enable row level security;
alter table public.expense_payments enable row level security;

create policy "admin lê recebimentos" on public.client_payments for select to authenticated using (public.is_admin());
create policy "admin cria recebimentos" on public.client_payments for insert to authenticated with check (public.is_admin());
create policy "admin desfaz recebimentos" on public.client_payments for delete to authenticated using (public.is_admin());

create policy "admin lê despesas" on public.expenses for select to authenticated using (public.is_admin());
create policy "admin cria despesas" on public.expenses for insert to authenticated with check (public.is_admin());
create policy "admin edita despesas" on public.expenses for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin apaga despesas" on public.expenses for delete to authenticated using (public.is_admin());

create policy "admin lê valores de despesa" on public.expense_versions for select to authenticated using (public.is_admin());
create policy "admin cria valores de despesa" on public.expense_versions for insert to authenticated with check (public.is_admin());
create policy "admin edita valores de despesa" on public.expense_versions for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin apaga valores de despesa" on public.expense_versions for delete to authenticated using (public.is_admin());

create policy "admin lê pagamentos de despesa" on public.expense_payments for select to authenticated using (public.is_admin());
create policy "admin cria pagamentos de despesa" on public.expense_payments for insert to authenticated with check (public.is_admin());
create policy "admin desfaz pagamentos de despesa" on public.expense_payments for delete to authenticated using (public.is_admin());

grant select, insert, delete on public.client_payments to authenticated;
grant select, insert, update, delete on public.expenses to authenticated;
grant select, insert, update, delete on public.expense_versions to authenticated;
grant select, insert, delete on public.expense_payments to authenticated;

-- Configurações simples (chave/valor). Usada para "o controle financeiro começa em".
create table public.settings (
  key text primary key,
  value text not null
);
alter table public.settings enable row level security;
create policy "admin lê configurações" on public.settings for select to authenticated using (public.is_admin());
create policy "admin cria configurações" on public.settings for insert to authenticated with check (public.is_admin());
create policy "admin edita configurações" on public.settings for update to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update on public.settings to authenticated;

-- ===== 0007_conexao.sql =====
-- Vínculos do cliente com plataformas (contas de anúncio, grupos de WhatsApp e links manuais).
create table public.client_connections (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  platform text not null check (platform in ('meta_ads', 'google_ads', 'whatsapp_group', 'gmb', 'hotjar', 'analytics')),
  external_id text,   -- Meta: id da conta sem "act_"; Google: id sem hífens; WhatsApp: id do grupo
  name text,
  url text check (url is null or url ~* '^https?://'),
  currency text,
  created_at timestamptz not null default now(),
  -- contas de API pertencem a um único cliente
  unique (platform, external_id)
);
create index client_connections_client_idx on public.client_connections (client_id);

alter table public.client_connections enable row level security;
create policy "admin lê vínculos" on public.client_connections for select to authenticated using (public.is_admin());
create policy "admin cria vínculos" on public.client_connections for insert to authenticated with check (public.is_admin());
create policy "admin edita vínculos" on public.client_connections for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin apaga vínculos" on public.client_connections for delete to authenticated using (public.is_admin());
grant select, insert, update, delete on public.client_connections to authenticated;

-- ===== Último passo: liberar o primeiro administrador =====
-- 1) Crie seu usuário em Authentication > Users (e-mail e senha).
-- 2) Rode esta linha, trocando o e-mail:
-- insert into public.admins (user_id) select id from auth.users where email = 'SEU@EMAIL';
