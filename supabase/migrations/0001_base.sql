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
