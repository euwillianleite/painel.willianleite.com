# Customizações da empresa

Tudo que é **só desta empresa** (por exemplo, relatórios individuais de cada cliente) fica aqui dentro.
O resto do código é o mesmo para todas as empresas e recebe as atualizações do modelo sem conflito.

Regras:
- Não edite arquivos fora de `src/custom/` para fazer algo específico de uma empresa. Se o painel precisar de um
  gancho novo para isso, ele entra no código comum (no repositório modelo) e todas as empresas ganham.
- Para aparecer no menu, acrescente o item em `src/custom/menu.ts`. As páginas ficam em `src/app/(painel)/<nome>/` e a lógica própria em `src/custom/`.
