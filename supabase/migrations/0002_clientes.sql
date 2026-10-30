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
