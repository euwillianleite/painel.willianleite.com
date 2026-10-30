#!/usr/bin/env bash
# Junta supabase/migrations/*.sql em supabase/setup.sql (instalação completa de um banco novo).
# Rode sempre que criar uma migration: npm run setup-sql. A CI confere que o arquivo está atualizado.
set -euo pipefail
cd "$(dirname "$0")/.."
out=supabase/setup.sql
{
  echo "-- GERADO por scripts/gerar-setup.sh a partir de supabase/migrations/*.sql. Não edite à mão."
  echo "-- Instalação completa de um banco NOVO: cole tudo no SQL Editor do Supabase e rode uma única vez."
  echo
  for f in supabase/migrations/*.sql; do
    echo "-- ===== $(basename "$f") ====="
    cat "$f"
    echo
  done
  cat <<'FIM'
-- ===== Último passo: liberar o primeiro administrador =====
-- 1) Crie seu usuário em Authentication > Users (e-mail e senha).
-- 2) Rode esta linha, trocando o e-mail:
-- insert into public.admins (user_id) select id from auth.users where email = 'SEU@EMAIL';
FIM
} > "$out"
echo "Gerado $out"
