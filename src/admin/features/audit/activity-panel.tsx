"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { ErrorState, LoadingState } from "../../components/ui/feedback";
import { Panel } from "../../components/ui/layout";
import { useAdminConfig } from "../../hooks/use-admin-config";
import { formatDateTime, formatRelative } from "../../lib/datetime";
import { fetchAuditLog } from "../../services/audit";
import { auditSentence, useAuditNames } from "./audit-diff";

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
  const names = useAuditNames(query.data?.rows ?? []);
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
            return (
              <li
                key={entry.id}
                data-tone={
                  entry.action === "delete" || entry.action === "archive" ? "red" : "green"
                }
              >
                <span>{auditSentence(entry, config, names)}</span>
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
