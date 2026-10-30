-- 1) Uma única data de término/renovação do contrato.
alter table public.clients drop column if exists project_end;
alter table public.clients drop column if exists renewal_date;

-- 2) Permissões da Data API (o acesso continua limitado pelas policies de RLS).
grant select, insert, update on public.clients to authenticated;
grant select, insert, update, delete on public.client_links to authenticated;
grant select, insert, delete on public.client_price_versions to authenticated;
