"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { ErrorState, LoadingState } from "../../components/ui/feedback";
import { Panel } from "../../components/ui/layout";
import { useAdminConfig } from "../../hooks/use-admin-config";
import { formatDateTime, formatRelative } from "../../lib/datetime";
import { AUDIT_ACTION_LABELS, AUDIT_ENTITY_LABELS, fetchAuditLog } from "../../services/audit";
import { describeChange } from "./audit-diff";

/** Recent audit entries about one record (orders include their assignments). */
export function ActivityPanel({ entityType, entityId }: { entityType: string; entityId: string }) {
  const { data: config } = useAdminConfig();
  const query = useQuery({
    queryKey: ["audit", "record", entityType, entityId],
    queryFn: () =>
      fetchAuditLog(
        entityType === "order"
          ? { orderId: entityId, limit: 12 }
          : { entityType, entityId, limit: 12 },
      ),
  });
  const auditHref =
    entityType === "order"
      ? `/admin/audit?order=${entityId}`
      : `/admin/audit?entity=${entityType}&id=${entityId}`;

  return (
    <Panel
      title="Activity"
      actions={
        <Link className="a-link a-small" href={auditHref}>
          Full history
        </Link>
      }
    >
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.isLoading ? (
        <LoadingState />
      ) : !query.data?.rows.length ? (
        <p className="a-muted">No activity recorded yet.</p>
      ) : (
        <ol className="a-timeline">
          {query.data.rows.map((entry) => {
            const summary = entry.changed_fields
              .slice(0, 3)
              .map((key) => describeChange(entry, key, config).label)
              .join(", ");
            return (
              <li
                key={entry.id}
                data-tone={
                  entry.action === "delete" || entry.action === "archive" ? "red" : "green"
                }
              >
                <span>
                  <strong>{AUDIT_ACTION_LABELS[entry.action] ?? entry.action}</strong>
                  {entry.entity_type !== entityType ? (
                    <span className="a-muted">
                      {" "}
                      · {AUDIT_ENTITY_LABELS[entry.entity_type] ?? entry.entity_type}
                    </span>
                  ) : null}
                  {summary && entry.action === "update" ? (
                    <span className="a-muted"> · {summary}</span>
                  ) : null}
                </span>
                <span className="a-small a-muted" title={formatDateTime(entry.occurred_at)}>
                  {entry.actor_label} · {formatRelative(entry.occurred_at)}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
