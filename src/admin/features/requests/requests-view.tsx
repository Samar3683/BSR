"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { EmptyState, ErrorState, SkeletonRows } from "../../components/ui/feedback";
import { PageHeader, Panel } from "../../components/ui/layout";
import { useT } from "../../i18n/provider";
import { formatDateTime } from "../../lib/datetime";
import {
  fetchContactSummary,
  fetchRequestCounts,
  fetchRequests,
  REQUEST_STATUS_LABELS,
  REQUEST_STATUSES,
  type RequestStatus,
} from "../../services/requests";
import { useUrlState } from "../records/url-state";

const BADGE: Record<RequestStatus, string> = {
  new: "a-badge a-badge--warn",
  contacted: "a-badge",
  converted: "a-badge a-badge--green",
  discarded: "a-badge a-badge--outline",
};

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const t = useT();
  return <span className={BADGE[status]}>{t(REQUEST_STATUS_LABELS[status])}</span>;
}

/** Quote requests from the public site: the dispatch team's inbox. */
export function RequestsView() {
  const t = useT();
  const { get, update } = useUrlState();
  const param = get("status");
  const status: RequestStatus | "all" = (REQUEST_STATUSES as readonly string[]).includes(
    param ?? "",
  )
    ? (param as RequestStatus)
    : param === "all"
      ? "all"
      : "new";

  const list = useQuery({
    queryKey: ["requests", status],
    queryFn: () => fetchRequests(status),
    placeholderData: keepPreviousData,
  });
  const counts = useQuery({ queryKey: ["requests", "counts"], queryFn: fetchRequestCounts });
  const contacts = useQuery({
    queryKey: ["contact-summary"],
    queryFn: () => fetchContactSummary(30),
  });

  const chips: (RequestStatus | "all")[] = ["new", "contacted", "converted", "discarded", "all"];

  return (
    <div className="a-page">
      <PageHeader
        title="Requests"
        meta={<span>Quote requests sent from the public website.</span>}
      />

      <Panel title="Contact clicks · last 30 days">
        <p className="a-help" style={{ marginBottom: 10 }}>
          {t("Anonymous counts of clicks on the website's WhatsApp, phone and email buttons.")}
        </p>
        <div className="a-row" style={{ gap: 24 }}>
          {(["whatsapp", "phone", "email"] as const).map((channel) => (
            <span key={channel}>
              <strong style={{ fontSize: 22, fontWeight: 600 }}>
                {contacts.data?.[channel] ?? 0}
              </strong>{" "}
              <span className="a-muted">
                {channel === "whatsapp" ? "WhatsApp" : channel === "phone" ? t("Phone") : "Email"}
              </span>
            </span>
          ))}
        </div>
      </Panel>

      <section className="a-panel" aria-label={t("Quote requests")}>
        <div className="a-toolbar">
          <div className="a-chips" role="group" aria-label={t("Status")}>
            {chips.map((chip) => (
              <button
                key={chip}
                type="button"
                className="a-chip"
                aria-pressed={status === chip}
                onClick={() => update({ status: chip === "new" ? null : chip })}
              >
                {t(chip === "all" ? "All" : REQUEST_STATUS_LABELS[chip])}
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
            title="No requests"
            message="Requests sent from the quote form of the website appear here."
          />
        ) : (
          <div className="a-table-wrap" aria-busy={list.isFetching || undefined}>
            <table className="a-table a-table-stack">
              <thead>
                <tr>
                  <th scope="col">{t("Received")}</th>
                  <th scope="col">{t("Request")}</th>
                  <th scope="col">{t("Contact")}</th>
                  <th scope="col">{t("Route")}</th>
                  <th scope="col">{t("Status")}</th>
                </tr>
              </thead>
              <tbody>
                {list.data.rows.map((row) => (
                  <tr key={row.id}>
                    <td className="a-nowrap" data-label={t("Received")}>
                      {formatDateTime(row.created_at)}
                    </td>
                    <td data-label={t("Request")}>
                      <Link className="a-row-link a-mono" href={`/admin/requests/${row.id}`}>
                        {row.reference}
                      </Link>
                    </td>
                    <td data-label={t("Contact")}>
                      <strong style={{ fontWeight: 600 }}>{row.name}</strong>
                      <div className="a-small a-muted">{row.phone}</div>
                    </td>
                    <td data-label={t("Route")}>
                      {row.pickup.city ?? "—"} → {row.delivery.city ?? "—"}
                    </td>
                    <td data-label={t("Status")}>
                      <RequestStatusBadge status={row.status} />
                      {row.needs_reply && row.status !== "new" && row.status !== "discarded" ? (
                        <span className="a-badge a-badge--warn" style={{ marginLeft: 6 }}>
                          Awaiting reply
                        </span>
                      ) : null}
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
