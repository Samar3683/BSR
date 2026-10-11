import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface StackEnv {
  url: string;
  anonKey: string;
  serviceKey: string;
  dbUrl: string;
  local: boolean;
}

/** Backend under test: explicit env vars, else the local stack's generated keys. */
export function stackEnv(): StackEnv {
  const keysFile = resolve(process.cwd(), ".supabase-local/keys.json");
  const keys = existsSync(keysFile)
    ? (JSON.parse(readFileSync(keysFile, "utf8")) as { anonKey: string; serviceRoleKey: string })
    : null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? (keys ? "http://localhost:54321" : "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? keys?.anonKey ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? keys?.serviceRoleKey ?? "";
  const dbUrl = process.env.SUPABASE_DB_URL ?? "postgresql://postgres@localhost:54322/postgres";
  return {
    url,
    anonKey,
    serviceKey,
    dbUrl,
    local: !process.env.NEXT_PUBLIC_SUPABASE_URL && Boolean(keys),
  };
}
