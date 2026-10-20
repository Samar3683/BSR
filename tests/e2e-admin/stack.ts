import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface StackEnv {
  /** Application role connection (what the app server uses). */
  databaseUrl: string;
  /** Administrative connection: schema reset and test fixtures only. */
  adminUrl: string;
  sessionSecret: string;
  smtpUrl: string;
  /** Directory the local mail sink writes captured emails to. */
  mailDir: string;
  /** True when the Docker database from `npm run db:start` is used (it may be reset). */
  local: boolean;
}

/** SESSION_SECRET of .env.local, if there is one. */
function localSessionSecret(): string {
  const file = resolve(process.cwd(), ".env.local");
  if (!existsSync(file)) return "";
  const line = readFileSync(file, "utf8").match(/^\s*SESSION_SECRET\s*=\s*(.*)$/m)?.[1] ?? "";
  return line.trim().replace(/^["']|["']$/g, "");
}

/** Backend under test: explicit env vars, else the Docker services started by `npm run db:start`. */
export function stackEnv(): StackEnv {
  return {
    databaseUrl: process.env.DATABASE_URL ?? "postgresql://bsr_app@localhost:54320/bsr",
    adminUrl: process.env.DATABASE_ADMIN_URL ?? "postgresql://postgres@localhost:54320/bsr",
    sessionSecret: process.env.SESSION_SECRET ?? localSessionSecret(),
    smtpUrl: process.env.SMTP_URL ?? "smtp://127.0.0.1:54325",
    mailDir: process.env.BSR_MAIL_DIR ?? resolve(process.cwd(), ".local/mail"),
    local: !process.env.DATABASE_URL,
  };
}
