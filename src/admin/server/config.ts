/**
 * Server-side settings, read from the environment. None of these values is
 * ever sent to the browser; the admin panel only talks to its own API.
 */
export interface ServerConfig {
  /** PostgreSQL connection of the application role (limited rights). */
  databaseUrl: string;
  /** Signs the session cookie (at least 32 characters). */
  sessionSecret: string;
  /** Public base URL used in emailed links; falls back to the request origin. */
  appUrl: string | null;
  /** SMTP connection, e.g. smtp://user:pass@host:587 (smtps:// for TLS). */
  smtpUrl: string | null;
  mailFrom: string;
}

export function readConfig(): ServerConfig | null {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const sessionSecret = process.env.SESSION_SECRET?.trim();
  if (!databaseUrl || !sessionSecret || sessionSecret.length < 32) return null;
  return {
    databaseUrl,
    sessionSecret,
    appUrl: process.env.APP_URL?.trim().replace(/\/+$/, "") || null,
    smtpUrl: process.env.SMTP_URL?.trim() || null,
    mailFrom: process.env.MAIL_FROM?.trim() || "BSR Trasporti <no-reply@localhost>",
  };
}

export function requireConfig(): ServerConfig {
  const config = readConfig();
  if (!config) {
    throw new Error(
      "The admin backend is not configured: set DATABASE_URL and SESSION_SECRET (32+ characters).",
    );
  }
  return config;
}

export function isBackendConfigured(): boolean {
  return readConfig() !== null;
}
