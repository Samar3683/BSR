import { defineConfig } from "prisma/config";

/**
 * Prisma CLI: migrations, introspection and client generation. Migrations and
 * `db pull` connect as DATABASE_ADMIN_URL — the owner role that may create
 * schemas, roles and functions — never as the web server's DATABASE_URL.
 * Values come from the environment, or from .env.local during development.
 */
try {
  process.loadEnvFile(".env.local");
} catch {
  // No file: the environment already has what is needed.
}

const url = process.env.DATABASE_ADMIN_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  ...(url ? { datasource: { url } } : {}),
});
