"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { EmptyState, ErrorState, SkeletonRows } from "../../components/ui/feedback";
import { PageHeader } from "../../components/ui/layout";
import { formatDateTime } from "../../lib/datetime";
import {
  fetchMessageCounts,
  fetchMessages,
  MESSAGE_STATUS_LABELS,
  MESSAGE_STATUSES,
  type ContactMessage,
  type MessageStatus,
} from "../../services/messages";
import { useUrlState } from "../records/url-state";

const BADGE: Record<MessageStatus, string> = {
  new: "a-badge a-badge--warn",
  answered: "a-badge a-badge--green",
  closed: "a-badge a-badge--outline",
};

export function MessageStatusBadge({
  message,
}: {
  message: Pick<ContactMessage, "status" | "needs_reply">;
}) {
  return (
    <span className="a-row" style={{ gap: 6 }}>
      <span className={BADGE[message.status]}>{MESSAGE_STATUS_LABELS[message.status]}</span>
      {message.needs_reply && message.status !== "new" ? (
        <span className="a-badge a-badge--warn">Awaiting reply</span>
      ) : null}
    </span>
  );
}

/** Messages sent with the website's contact form: the team's inbox. */
export function MessagesView() {
  const { get, update } = useUrlState();
  const param = get("status");
  const status: MessageStatus | "all" = (MESSAGE_STATUSES as readonly string[]).includes(
    param ?? "",
  )
    ? (param as MessageStatus)
    : param === "all"
      ? "all"
      : "new";

  const list = useQuery({
    queryKey: ["messages", status],
    queryFn: () => fetchMessages(status),
    placeholderData: keepPreviousData,
  });
  const counts = useQuery({ queryKey: ["messages", "counts"], queryFn: fetchMessageCounts });
  const chips: (MessageStatus | "all")[] = ["new", "answered", "closed", "all"];

  return (
    <div className="a-page">
      <PageHeader
        title="Messages"
        meta={<span>Messages sent with the website&apos;s contact form.</span>}
      />
      <section className="a-panel" aria-label="Messages">
        <div className="a-toolbar">
          <div className="a-chips" role="group" aria-label="Status">
            {chips.map((chip) => (
              <button
                key={chip}
                type="button"
                className="a-chip"
                aria-pressed={status === chip}
                onClick={() => update({ status: chip === "new" ? null : chip })}
              >
                {chip === "all" ? "All" : MESSAGE_STATUS_LABELS[chip]}
                <span className="a-chip-count">{counts.data?.[chip] ?? 0}</span>
              </button>
            ))}
          </div>
        </div>

        {list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : list.isLoading ? (
          <SkeletonRows columns={5} />
        ) : !list.data?.rows.length ? (
          <EmptyState
            title="No messages"
            message="Messages sent from the website's contact form appear here."
          />
        ) : (
          <div className="a-table-wrap" aria-busy={list.isFetching || undefined}>
            <table className="a-table a-table-stack">
              <thead>
                <tr>
                  <th scope="col">Received</th>
                  <th scope="col">Message</th>
                  <th scope="col">Contact</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {list.data.rows.map((row) => (
                  <tr key={row.id}>
                    <td className="a-nowrap" data-label="Received">
                      {formatDateTime(row.created_at)}
                    </td>
                    <td data-label="Message">
                      <Link className="a-row-link" href={`/admin/messages/${row.id}`}>
                        {row.subject || row.body.slice(0, 60)}
                      </Link>
                      <div className="a-small a-muted a-mono">{row.reference}</div>
                    </td>
                    <td data-label="Contact">
                      <strong style={{ fontWeight: 600 }}>{row.name}</strong>
                      <div className="a-small a-muted">{row.email ?? row.phone}</div>
                    </td>
                    <td data-label="Status">
                      <MessageStatusBadge message={row} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
