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
  /** True when the local PostgreSQL from `pnpm db:start` is used (it may be reset). */
  local: boolean;
}

/** Backend under test: explicit env vars, else the local PostgreSQL started by `pnpm db:start`. */
export function stackEnv(): StackEnv {
  const secretFile = resolve(process.cwd(), ".postgres-local/session-secret");
  const generated = existsSync(secretFile) ? readFileSync(secretFile, "utf8").trim() : "";
  return {
    databaseUrl: process.env.DATABASE_URL ?? "postgresql://bsr_app@localhost:54320/bsr",
    adminUrl: process.env.DATABASE_ADMIN_URL ?? "postgresql://postgres@localhost:54320/bsr",
    sessionSecret: process.env.SESSION_SECRET ?? generated,
    smtpUrl: process.env.SMTP_URL ?? "smtp://127.0.0.1:54325",
    mailDir: process.env.BSR_MAIL_DIR ?? resolve(process.cwd(), ".postgres-local/mail"),
    local: !process.env.DATABASE_URL,
  };
}
