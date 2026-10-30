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
