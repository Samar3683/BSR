"use client";

import { CircleAlert, CircleCheck, Inbox, RefreshCw, ShieldAlert, WifiOff } from "lucide-react";
import type { ReactNode } from "react";

import { toAdminError } from "../../lib/errors";
import { Button } from "./button";

export function EmptyState({
  title,
  message,
  icon,
  actions,
}: {
  title: string;
  message?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="a-empty">
      {icon ?? <Inbox aria-hidden="true" />}
      <h3>{title}</h3>
      {message ? <p>{message}</p> : null}
      {actions ? <div className="a-actions">{actions}</div> : null}
    </div>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="a-loading" role="status">
      <span className="a-spinner" aria-hidden="true" />
      {label}
    </div>
  );
}

/** Placeholder rows while a table loads. */
export function SkeletonRows({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="a-table-wrap" aria-busy="true" aria-label="Loading">
      <table className="a-table">
        <tbody>
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r}>
              {Array.from({ length: columns }, (_, c) => (
                <td key={c}>
                  <span
                    className="a-skeleton"
                    style={{ width: `${40 + ((r * 7 + c * 13) % 50)}%` }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  title,
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}) {
  const mapped = toAdminError(error);
  const Icon =
    mapped.kind === "network" ? WifiOff : mapped.kind === "forbidden" ? ShieldAlert : CircleAlert;
  return (
    <div className="a-empty" role="alert">
      <Icon aria-hidden="true" />
      <h3>{title ?? (mapped.kind === "not_found" ? "Not found" : "Could not load this")}</h3>
      <p>{mapped.message}</p>
      {onRetry && mapped.kind !== "not_found" && mapped.kind !== "forbidden" ? (
        <div className="a-actions">
          <Button onClick={onRetry}>
            <RefreshCw aria-hidden="true" />
            Try again
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function Alert({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "error" | "success";
  title?: ReactNode;
  children?: ReactNode;
}) {
  const Icon = tone === "error" ? CircleAlert : tone === "success" ? CircleCheck : CircleAlert;
  return (
    <div
      className={`a-alert${tone === "info" ? "" : ` a-alert--${tone}`}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <Icon aria-hidden="true" />
      <div className="a-alert-body">
        {title ? <strong>{title}</strong> : null}
        {children ? <div>{children}</div> : null}
      </div>
    </div>
  );
}

export function FormError({ error }: { error: unknown }) {
  if (!error) return null;
  const mapped = toAdminError(error);
  return <Alert tone="error">{mapped.message}</Alert>;
}
