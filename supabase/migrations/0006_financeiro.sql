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
