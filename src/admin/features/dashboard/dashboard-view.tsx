"use client";

import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import Link from "next/link";

import { ButtonLink } from "../../components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/feedback";
import { Empty, PageHeader, Panel, StatusBadge } from "../../components/ui/layout";
import { useSession } from "../../components/shell/session";
import { formatDateTime, formatRelative } from "../../lib/datetime";
import { fetchDashboard, ORDER_STATUSES, STATUS_LABELS } from "../../services/operations";

const REASONS = {
  overdue: { label: "Overdue", tone: "a-badge--red" },
  missing_window: { label: "No planned window", tone: "a-badge--red" },
  unassigned_soon: { label: "Not dispatched, pickup within 48 h", tone: "a-badge--outline" },
} as const;

export function DashboardView() {
  const { admin } = useSession();
  const query = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
    refetchInterval: 60_000,
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
  const openTotal = d.status_distribution.reduce((sum, s) => sum + s.count, 0);
  const max = Math.max(1, ...d.status_distribution.map((s) => s.count));

  return (
    <div className="a-page">
      <PageHeader
        eyebrow="Dashboard"
        title={`Hello, ${admin.display_name.split(" ")[0]}`}
        meta={<span>Updated {formatRelative(d.generated_at)} · Europe/Rome</span>}
        actions={
          <ButtonLink href="/admin/orders/new" variant="primary">
            <Plus aria-hidden="true" />
            New order
          </ButtonLink>
        }
      />

      <div className="a-kpis" aria-label="Today's figures">
        <Link className="a-kpi" href="/admin/calendar?view=week">
          <div className="a-kpi-label">Pickups today</div>
          <div className="a-kpi-value">{c.pickups_today}</div>
        </Link>
        <Link className="a-kpi" href="/admin/orders?status=in_transit" data-tone="positive">
          <div className="a-kpi-label">In transit</div>
          <div className="a-kpi-value">{c.in_transit}</div>
        </Link>
        <Link
          className="a-kpi"
          href="/admin/dispatch"
          data-tone={c.awaiting_dispatch ? "critical" : undefined}
        >
          <div className="a-kpi-label">Awaiting dispatch</div>
          <div className="a-kpi-value">{c.awaiting_dispatch}</div>
        </Link>
        <Link className="a-kpi" href="/admin/orders?status=scheduled">
          <div className="a-kpi-label">Scheduled · next 7 days</div>
          <div className="a-kpi-value">{c.scheduled_next_7_days}</div>
        </Link>
        <Link
          className="a-kpi"
          href="/admin/orders?status=confirmed,scheduled,in_transit"
          data-tone={c.overdue ? "critical" : undefined}
        >
          <div className="a-kpi-label">Overdue</div>
          <div className="a-kpi-value">{c.overdue}</div>
        </Link>
        <Link className="a-kpi" href="/admin/reports">
          <div className="a-kpi-label">Delivered · last 30 days</div>
          <div className="a-kpi-value">{c.delivered_last_30_days}</div>
        </Link>
      </div>

      <div className="a-grid a-grid--main-side">
        <div className="a-stack">
          <Panel
            title="Needs attention"
            flush
            actions={
              <Link className="a-link a-small" href="/admin/dispatch">
                Open dispatch
              </Link>
            }
          >
            {d.attention.length === 0 ? (
              <EmptyState
                title="Nothing needs attention"
                message="Overdue and undispatched orders appear here."
              />
            ) : (
              <div className="a-table-wrap">
                <table className="a-table">
                  <thead>
                    <tr>
                      <th scope="col">Order</th>
                      <th scope="col">Customer</th>
                      <th scope="col">Pickup</th>
                      <th scope="col">Issue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.attention.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <Link className="a-row-link a-mono" href={`/admin/orders/${row.id}`}>
                            {row.order_number}
                          </Link>
                        </td>
                        <td>{row.customer_name ?? <Empty />}</td>
                        <td>{row.pickup_at ? formatDateTime(row.pickup_at) : <Empty />}</td>
                        <td>
                          <span className={`a-badge ${REASONS[row.reason].tone}`}>
                            {REASONS[row.reason].label}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel
            title="Upcoming pickups"
            flush
            actions={
              <Link className="a-link a-small" href="/admin/calendar">
                Calendar
              </Link>
            }
          >
            {d.upcoming.length === 0 ? (
              <EmptyState
                title="No upcoming pickups"
                message="Confirmed and scheduled orders with a future pickup appear here."
              />
            ) : (
              <div className="a-table-wrap">
                <table className="a-table">
                  <thead>
                    <tr>
                      <th scope="col">Pickup</th>
                      <th scope="col">Order</th>
                      <th scope="col">Customer</th>
                      <th scope="col">Driver · Vehicle</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.upcoming.map((row) => (
                      <tr key={row.id}>
                        <td className="a-nowrap">{formatDateTime(row.pickup_at)}</td>
                        <td>
                          <Link className="a-row-link a-mono" href={`/admin/orders/${row.id}`}>
                            {row.order_number}
                          </Link>
                        </td>
                        <td>{row.customer_name}</td>
                        <td>
                          {row.driver_name || row.vehicle_name ? (
                            `${row.driver_name ?? "—"} · ${row.vehicle_name ?? "—"}`
                          ) : (
                            <span className="a-badge a-badge--outline">Unassigned</span>
                          )}
                        </td>
                        <td>
                          <StatusBadge status={row.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        <div className="a-stack">
          <Panel title="Open orders by status">
            {openTotal === 0 ? (
              <p className="a-muted">No orders yet.</p>
            ) : (
              <div className="a-bars">
                {ORDER_STATUSES.map((status) => {
                  const count = d.status_distribution.find((s) => s.status === status)?.count ?? 0;
                  return (
                    <Link
                      key={status}
                      className="a-bar-row"
                      href={`/admin/orders?status=${status}`}
                      style={{ textDecoration: "none", color: "inherit" }}
                    >
                      <span className="a-bar-label">{STATUS_LABELS[status]}</span>
                      <span className="a-bar-track">
                        <span
                          className="a-bar-fill"
                          data-tone={
                            status === "cancelled"
                              ? "red"
                              : status === "draft"
                                ? "muted"
                                : undefined
                          }
                          style={{ width: `${(count / max) * 100}%` }}
                        />
                      </span>
                      <span className="a-bar-value">{count}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel title="Resources now">
            <dl className="a-dl">
              <div>
                <dt>Drivers free</dt>
                <dd>
                  {c.drivers_free_now} of {c.drivers_total} available
                </dd>
              </div>
              <div>
                <dt>Vehicles free</dt>
                <dd>
                  {c.vehicles_free_now} of {c.vehicles_total} available
                </dd>
              </div>
              <div>
                <dt>Customers</dt>
                <dd>{c.customers_total}</dd>
              </div>
            </dl>
          </Panel>

          <Panel title="Recent status changes">
            {d.recent_activity.length === 0 ? (
              <p className="a-muted">No activity yet.</p>
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
                      → {STATUS_LABELS[entry.to_status]}
                    </span>
                    <span className="a-small a-muted">
                      {entry.actor ?? "System"} · {formatRelative(entry.changed_at)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
