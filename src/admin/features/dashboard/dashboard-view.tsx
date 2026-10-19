"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, CircleAlert, Inbox, Plus } from "lucide-react";
import Link from "next/link";

import { ButtonLink } from "../../components/ui/button";
import { ErrorState, LoadingState } from "../../components/ui/feedback";
import { PageHeader, StatusBadge } from "../../components/ui/layout";
import { useSession } from "../../components/shell/session";
import { useLiveStatus } from "../../hooks/use-realtime";
import { useT } from "../../i18n/provider";
import { formatDateTime, formatRelative } from "../../lib/datetime";
import { fetchDashboard, ORDER_STATUSES, STATUS_LABELS } from "../../services/operations";
import { fetchRequests } from "../../services/requests";

const REASONS = {
  overdue: { label: "Overdue", tone: "a-badge--red" },
  missing_window: { label: "No planned window", tone: "a-badge--red" },
  unassigned_soon: { label: "Not dispatched, pickup within 48 h", tone: "a-badge--warn" },
} as const;

function Kpi({
  href,
  label,
  value,
  tone,
}: {
  href: string;
  label: string;
  value: number;
  tone?: "warn";
}) {
  const t = useT();
  return (
    <Link className="a-kpi" href={href} data-tone={tone}>
      <div className="a-kpi-label">{t(label)}</div>
      <div className="a-kpi-value">{value}</div>
    </Link>
  );
}

function Meter({ label, free, total }: { label: string; free: number; total: number }) {
  const t = useT();
  const busy = Math.max(0, total - free);
  const pct = total ? Math.round((busy / total) * 100) : 0;
  return (
    <div className="a-meter">
      <div className="a-meter-head">
        <span>{t(label)}</span>
        <span className="a-muted">
          {free} / {total} {t("free")}
        </span>
      </div>
      <div
        className="a-meter-track"
        role="meter"
        aria-label={`${t(label)}: ${busy} / ${total}`}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={busy}
      >
        <span className="a-meter-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

export function DashboardView() {
  const { admin } = useSession();
  const t = useT();
  const live = useLiveStatus();
  const query = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
    refetchInterval: live ? false : 60_000,
  });
  const requests = useQuery({
    queryKey: ["requests", "dashboard"],
    queryFn: () => fetchRequests("new", 5),
    refetchInterval: live ? false : 60_000,
  });

  if (query.isError) {
    return (
      <div className="a-page">
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      </div>
    );
  }
  if (!query.data) return <LoadingState />;
  const d = query.data;
  const c = d.counts;
  const countOf = (status: (typeof ORDER_STATUSES)[number]) =>
    d.status_distribution.find((s) => s.status === status)?.count ?? 0;
  const openTotal = d.status_distribution.reduce((sum, s) => sum + s.count, 0);
  const max = Math.max(1, ...d.status_distribution.map((s) => s.count));

  return (
    <div className="a-page">
      <PageHeader
        eyebrow="Dashboard"
        title={`${t(greeting())}, ${admin.display_name.split(" ")[0]}`}
        meta={
          <span>
            {live ? (
              <span className="a-live" title={t("Updates arrive as they happen")}>
                <span className="a-live-dot" aria-hidden="true" />
                {t("Live")}
              </span>
            ) : (
              <>
                {t("Data updated")} {formatRelative(d.generated_at)}
              </>
            )}{" "}
            · Europe/Rome
          </span>
        }
        actions={
          <ButtonLink href="/admin/orders/new" variant="primary">
            <Plus aria-hidden="true" />
            New order
          </ButtonLink>
        }
      />

      <div className="a-kpis" aria-label="Today's figures">
        <Kpi href="/admin/calendar?view=week" label="Pickups today" value={c.pickups_today} />
        <Kpi href="/admin/orders?status=in_transit" label="In transit" value={c.in_transit} />
        <Kpi
          href="/admin/dispatch"
          label="Awaiting dispatch"
          value={c.awaiting_dispatch}
          tone={c.awaiting_dispatch ? "warn" : undefined}
        />
        <Kpi
          href="/admin/orders?status=scheduled"
          label="Scheduled · next 7 days"
          value={c.scheduled_next_7_days}
        />
        <Kpi
          href="/admin/orders?status=confirmed,scheduled,in_transit"
          label="Overdue"
          value={c.overdue}
        />
        <Kpi
          href="/admin/reports"
          label="Delivered · last 30 days"
          value={c.delivered_last_30_days}
        />
      </div>

      <section className="a-attention" aria-labelledby="attention-title">
        <div className="a-attention-head">
          <h2 id="attention-title">
            <CircleAlert aria-hidden="true" />
            {t("Needs attention")}
          </h2>
          <Link className="a-link" href="/admin/dispatch">
            {t("Open dispatch")}{" "}
            <ArrowUpRight size={14} aria-hidden="true" style={{ display: "inline" }} />
          </Link>
        </div>
        {d.attention.length === 0 ? (
          <p>{t("Overdue and undispatched orders appear here.")}</p>
        ) : (
          <div>
            {d.attention.map((row) => (
              <div className="a-attention-item" key={row.id}>
                <div>
                  <strong>{row.customer_name ?? "—"}</strong>
                  <Link className="a-row-link a-mono" href={`/admin/orders/${row.id}`}>
                    {row.order_number}
                  </Link>
                </div>
                <div className="a-small">{row.pickup_at ? formatDateTime(row.pickup_at) : "—"}</div>
                <span className={`a-badge ${REASONS[row.reason].tone}`}>
                  ! {t(REASONS[row.reason].label)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="requests-title" className="a-open-section">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <h2 id="requests-title" style={{ paddingTop: 0 }}>
            <Inbox
              aria-hidden="true"
              size={18}
              style={{ display: "inline", verticalAlign: "-3px", marginRight: 8 }}
            />
            {t("New quote requests")}
            {requests.data?.total ? ` (${requests.data.total})` : ""}
          </h2>
          <Link className="a-link" href="/admin/requests">
            {t("Open requests")}
          </Link>
        </div>
        {!requests.data?.rows.length ? (
          <p className="a-muted">{t("No new requests. Requests from the website appear here.")}</p>
        ) : (
          <div className="a-table-wrap">
            <table className="a-table a-table-stack">
              <thead>
                <tr>
                  <th scope="col">{t("Received")}</th>
                  <th scope="col">{t("Contact")}</th>
                  <th scope="col">{t("Route")}</th>
                  <th scope="col">{t("Request")}</th>
                </tr>
              </thead>
              <tbody>
                {requests.data.rows.map((row) => (
                  <tr key={row.id}>
                    <td className="a-nowrap" data-label={t("Received")}>
                      {formatRelative(row.created_at)}
                    </td>
                    <td data-label={t("Contact")}>
                      <strong style={{ fontWeight: 600 }}>{row.name}</strong>
                      <div className="a-small a-muted">{row.phone}</div>
                    </td>
                    <td data-label={t("Route")}>
                      {row.pickup.city ?? "—"} → {row.delivery.city ?? "—"}
                    </td>
                    <td data-label={t("Request")}>
                      <Link className="a-row-link a-mono" href={`/admin/requests/${row.id}`}>
                        {row.reference}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="upcoming-title" className="a-open-section">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <h2 id="upcoming-title" style={{ paddingTop: 0 }}>
            {t("Upcoming pickups")}
          </h2>
          <Link className="a-link" href="/admin/calendar">
            {t("Calendar")}
          </Link>
        </div>
        {d.upcoming.length === 0 ? (
          <p className="a-muted">
            {t("Confirmed and scheduled orders with a future pickup appear here.")}
          </p>
        ) : (
          <div className="a-table-wrap">
            <table className="a-table a-table-stack">
              <thead>
                <tr>
                  <th scope="col">{t("Pickup")}</th>
                  <th scope="col">{t("Customer")}</th>
                  <th scope="col">{t("Driver · Vehicle")}</th>
                  <th scope="col">{t("Status")}</th>
                </tr>
              </thead>
              <tbody>
                {d.upcoming.map((row) => (
                  <tr key={row.id}>
                    <td className="a-nowrap" data-label={t("Pickup")}>
                      {formatDateTime(row.pickup_at)}
                    </td>
                    <td data-label={t("Customer")}>
                      <strong style={{ fontWeight: 600 }}>{row.customer_name}</strong>
                      <div>
                        <Link className="a-row-link a-mono" href={`/admin/orders/${row.id}`}>
                          {row.order_number}
                        </Link>
                      </div>
                    </td>
                    <td data-label={t("Driver · Vehicle")}>
                      {row.driver_name || row.vehicle_name ? (
                        `${row.driver_name ?? "—"} · ${row.vehicle_name ?? "—"}`
                      ) : (
                        <span className="a-badge a-badge--warn">{t("Unassigned")}</span>
                      )}
                    </td>
                    <td data-label={t("Status")}>
                      <StatusBadge status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="a-dash-lower">
        <section className="a-open-section" aria-labelledby="resources-title">
          <h2 id="resources-title">{t("Resources now")}</h2>
          <Meter label="Drivers" free={c.drivers_free_now} total={c.drivers_total} />
          <Meter label="Vehicles" free={c.vehicles_free_now} total={c.vehicles_total} />
          <p className="a-help">
            {t("Customers")}: {c.customers_total}
          </p>
        </section>

        <section className="a-open-section" aria-labelledby="status-title">
          <h2 id="status-title">{t("Open orders by status")}</h2>
          {openTotal === 0 ? (
            <p className="a-muted">{t("No orders yet.")}</p>
          ) : (
            <>
              <div className="a-stat-bar" aria-hidden="true">
                {ORDER_STATUSES.filter((s) => s !== "cancelled" && s !== "delivered").map(
                  (status) =>
                    countOf(status) ? (
                      <Link
                        key={status}
                        href={`/admin/orders?status=${status}`}
                        data-status={status}
                        tabIndex={-1}
                        style={{ flexGrow: countOf(status) }}
                      />
                    ) : null,
                )}
              </div>
              <div className="a-bars">
                {ORDER_STATUSES.map((status) => (
                  <Link
                    key={status}
                    className="a-bar-row"
                    href={`/admin/orders?status=${status}`}
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <span className="a-bar-label">{t(STATUS_LABELS[status])}</span>
                    <span className="a-bar-track">
                      <span
                        className="a-bar-fill"
                        data-status={status}
                        style={{ width: `${(countOf(status) / max) * 100}%` }}
                      />
                    </span>
                    <span className="a-bar-value">{countOf(status)}</span>
                  </Link>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="a-open-section" aria-labelledby="recent-title">
          <h2 id="recent-title">{t("Recent status changes")}</h2>
          {d.recent_activity.length === 0 ? (
            <p className="a-muted">{t("No activity yet.")}</p>
          ) : (
            <ol className="a-timeline">
              {d.recent_activity.map((entry, index) => (
                <li
                  key={`${entry.order_id}-${index}`}
                  data-tone={entry.to_status === "cancelled" ? "red" : "green"}
                >
                  <span>
                    <Link className="a-link a-mono" href={`/admin/orders/${entry.order_id}`}>
                      {entry.order_number}
                    </Link>{" "}
                    → {t(STATUS_LABELS[entry.to_status])}
                  </span>
                  <span className="a-small a-muted">
                    {entry.actor ?? "System"} · {formatRelative(entry.changed_at)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
