# painel.willianleite.com

Painel administrativo (Next.js + Supabase + Vercel).

## Fluxo de publicação
- `main` = produção (painel.willianleite.com).
- Toda mudança chega por Pull Request; a Vercel gera uma URL de preview.
- Clicar em **Merge** no PR publica em produção.

## Configuração (uma vez)
1. Supabase: criar projeto; em Authentication > Providers > Email, **desativar "Allow new users to sign up"**.
2. Rodar `supabase/migrations/*.sql` no SQL Editor, em ordem.
3. Criar seu usuário em Authentication > Users e liberar o acesso:
   `insert into public.admins (user_id) select id from auth.users where email = 'SEU@EMAIL';`
4. Vercel: importar este repositório e definir `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Production e Preview).
5. Domínio `painel.willianleite.com` em Vercel > Settings > Domains.

## Desenvolvimento
```
cp .env.example .env.local
npm install
npm run dev
```
