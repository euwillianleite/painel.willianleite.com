import { unstable_cache } from "next/cache";
import { faltando, falha, type Conta, type Resultado } from "./tipos";

export const ZAPI_VARS = ["ZAPI_INSTANCE_ID", "ZAPI_TOKEN", "ZAPI_CLIENT_TOKEN"];
const base = () => `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE_ID}/token/${process.env.ZAPI_TOKEN}`;

async function zapi(caminho: string): Promise<any> {
  const r = await fetch(`${base()}${caminho}`, { headers: { "Client-Token": process.env.ZAPI_CLIENT_TOKEN! }, cache: "no-store" });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`Z-API: ${j?.error ?? j?.message ?? `HTTP ${r.status}`}`);
  return j;
}

type Chat = { phone?: string; name?: string; isGroup?: boolean };
/** Aceita lista de grupos ou de chats; só devolve grupos (id termina em "-group" ou isGroup). */
export function parseGrupos(itens: Chat[]): Conta[] {
  return itens
    .filter((c) => c.phone && (c.isGroup || String(c.phone).endsWith("-group")))
    .map((c) => ({ id: String(c.phone), nome: c.name || String(c.phone) }));
}

export const statusZapi = unstable_cache(
  async (): Promise<Resultado<{ conectado: boolean }>> => {
    const f = faltando(ZAPI_VARS);
    if (f.length) return { ok: false, erro: "Z-API não configurado.", faltando: f };
    try {
      const j = await zapi("/status");
      return { ok: true, dados: { conectado: !!j?.connected } };
    } catch (e) {
      return falha(e);
    }
  },
  ["zapi-status"],
  { revalidate: 60, tags: ["conexao"] },
);

export const listarGruposZapi = unstable_cache(
  async (): Promise<Resultado<Conta[]>> => {
    const f = faltando(ZAPI_VARS);
    if (f.length) return { ok: false, erro: "Z-API não configurado.", faltando: f };
    const paginas = async (caminho: string) => {
      const out: Chat[] = [];
      for (let p = 1; p <= 20; p++) {
        const j = await zapi(`${caminho}${caminho.includes("?") ? "&" : "?"}page=${p}&pageSize=100`);
        const itens: Chat[] = Array.isArray(j) ? j : (j?.value ?? j?.data ?? []);
        out.push(...itens);
        if (itens.length < 100) break;
      }
      return out;
    };
    try {
      let itens: Chat[];
      try {
        itens = await paginas("/groups");
      } catch {
        itens = await paginas("/chats"); // alternativa, caso a rota de grupos não exista no plano
      }
      return { ok: true, dados: parseGrupos(itens).sort((a, b) => a.nome.localeCompare(b.nome)) };
    } catch (e) {
      return falha(e);
    }
  },
  ["zapi-grupos"],
  { revalidate: 300, tags: ["conexao"] },
);
