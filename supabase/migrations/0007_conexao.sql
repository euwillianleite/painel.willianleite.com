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
