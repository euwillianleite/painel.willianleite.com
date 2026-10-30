/**
 * Identidade da empresa que usa este painel. Tudo vem de variáveis de ambiente,
 * então o código é idêntico para qualquer empresa (e recebe todas as atualizações).
 * Variáveis NEXT_PUBLIC_* são gravadas no build: mudou, faça um novo deploy.
 */
export const EMPRESA = {
  nome: process.env.NEXT_PUBLIC_EMPRESA_NOME?.trim() || "Painel",
  responsavel: process.env.NEXT_PUBLIC_EMPRESA_RESPONSAVEL?.trim() || "",
  email: process.env.NEXT_PUBLIC_EMPRESA_EMAIL?.trim() || "",
  dominio: process.env.NEXT_PUBLIC_EMPRESA_DOMINIO?.trim() || "",
};
