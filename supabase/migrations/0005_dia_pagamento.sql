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
