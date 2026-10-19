"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import { RelationPicker } from "../../components/fields/relation-picker";
import { Button } from "../../components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/feedback";
import { Field, Input, Select } from "../../components/ui/form";
import { PageHeader, Panel } from "../../components/ui/layout";
import { useToast } from "../../components/ui/toast";
import { useAdminConfig } from "../../hooks/use-admin-config";
import { csvFileName, downloadCsv, toCsv, type CsvCell } from "../../lib/csv";
import {
  addDays,
  addMonths,
  businessToday,
  formatCalendarDate,
  formatDateTime,
  startOfMonth,
} from "../../lib/datetime";
import { toAdminError } from "../../lib/errors";
import { formatFieldValue, formatNumber } from "../../lib/fields/format";
import { ENTITY_KEYS, type EntityKey } from "../../lib/fields/types";
import { recordValue } from "../../lib/fields/values";
import { liveFields, reportableFields } from "../../services/config";
import { ORDER_STATUSES, STATUS_LABELS } from "../../services/operations";
import { fetchRecordNames, type OrderStatus } from "../../services/records";
import {
  fetchFieldBreakdown,
  fetchReportOrders,
  fetchReportSummary,
  type FieldBreakdown,
  type ReportFilters,
} from "../../services/reports";
import { collectRelationIds } from "../records/columns";
import { useUrlState } from "../records/url-state";

type Preset = "this_month" | "last_month" | "last_30" | "this_year" | "custom";

function presetRange(preset: Preset, today: string): { from: string; to: string } {
  switch (preset) {
    case "last_month": {
      const start = addMonths(startOfMonth(today), -1);
      return { from: start, to: addDays(startOfMonth(today), -1) };
    }
    case "last_30":
      return { from: addDays(today, -29), to: today };
    case "this_year":
      return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` };
    default:
      return { from: startOfMonth(today), to: addDays(addMonths(startOfMonth(today), 1), -1) };
  }
}

function pct(part: number, total: number) {
  return total > 0 ? `${formatNumber((part / total) * 100, 1)}%` : "—";
}

function exportTable(name: string, headers: string[], rows: CsvCell[][]) {
  downloadCsv(csvFileName(name), toCsv(headers, rows));
}

export function ReportsView() {
  const { get, update } = useUrlState();
  const toast = useToast();
  const configQuery = useAdminConfig();
  const config = configQuery.data;
  const today = businessToday();
  const preset = (
    ["this_month", "last_month", "last_30", "this_year", "custom"].includes(get("preset") ?? "")
      ? get("preset")
      : "this_month"
  ) as Preset;
  const range =
    preset === "custom" && get("from") && get("to")
      ? { from: get("from")!, to: get("to")! }
      : presetRange(preset, today);
  const statuses = (get("status") ?? "")
    .split(",")
    .filter((s): s is OrderStatus => (ORDER_STATUSES as string[]).includes(s));
  const filters: ReportFilters = {
    status: statuses.length ? statuses : undefined,
    customer_id: get("customer") ?? undefined,
    driver_id: get("driver") ?? undefined,
    vehicle_id: get("vehicle") ?? undefined,
  };
  const [exporting, setExporting] = useState(false);

  const summary = useQuery({
    queryKey: ["report", range.from, range.to, filters],
    queryFn: () => fetchReportSummary(range.from, range.to, filters),
    placeholderData: keepPreviousData,
  });

  const exportOrders = async () => {
    if (!config) return;
    setExporting(true);
    try {
      const rows = await fetchReportOrders(range.from, range.to, filters);
      const fields = liveFields(config, "order").filter(
        (f) => !f.binding_key && f.field_type !== "image" && f.field_type !== "file",
      );
      const ids = collectRelationIds(fields, rows);
      const names: Record<string, string> = {};
      for (const [target, list] of Object.entries(ids) as [EntityKey, string[]][]) {
        for (const r of await fetchRecordNames(target, list)) names[r.id] = r.display_name;
      }
      const ctx = { optionsByField: config.options, relationNames: names };
      exportTable(
        `orders-${range.from}-${range.to}`,
        [
          "Order number",
          "Status",
          "Customer",
          "Pickup",
          "Delivery",
          "Driver",
          "Vehicle",
          ...fields.map((f) => f.label),
          "Created",
        ],
        rows.map((row) => [
          row.order_number,
          STATUS_LABELS[row.status],
          row.customer_name,
          formatDateTime(row.pickup_at),
          formatDateTime(row.delivery_at),
          row.driver_name,
          row.vehicle_name,
          ...fields.map((f) => formatFieldValue(f, recordValue(f, row), ctx)),
          formatDateTime(row.created_at),
        ]),
      );
      toast.success(`Exported ${rows.length} orders.`);
    } catch (error) {
      toast.error(toAdminError(error).message);
    } finally {
      setExporting(false);
    }
  };

  const s = summary.data;
  const periodMax = Math.max(1, ...(s?.by_period.map((p) => p.orders) ?? [0]));
  const statusMax = Math.max(1, ...(s?.by_status.map((p) => p.count) ?? [0]));

  return (
    <div className="a-page">
      <PageHeader
        title="Reports"
        meta={
          <span>
            Orders dated by pickup day (Europe/Rome) · {formatCalendarDate(range.from)} –{" "}
            {formatCalendarDate(range.to)}
          </span>
        }
        actions={
          <Button onClick={exportOrders} loading={exporting} disabled={!s?.totals.orders}>
            {exporting ? null : <Download aria-hidden="true" />}
            Export orders CSV
          </Button>
        }
      />

      <Panel title="Filters">
        <div
          className="a-form-grid"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}
        >
          <Field label="Period">
            <Select
              value={preset}
              onChange={(e) => {
                const next = e.target.value as Preset;
                if (next === "custom") update({ preset: "custom", from: range.from, to: range.to });
                else update({ preset: next === "this_month" ? null : next, from: null, to: null });
              }}
            >
              <option value="this_month">This month</option>
              <option value="last_month">Last month</option>
              <option value="last_30">Last 30 days</option>
              <option value="this_year">This year</option>
              <option value="custom">Custom range</option>
            </Select>
          </Field>
          {preset === "custom" ? (
            <>
              <Field label="From">
                <Input
                  type="date"
                  value={range.from}
                  max={range.to}
                  onChange={(e) => e.target.value && update({ from: e.target.value })}
                />
              </Field>
              <Field label="To">
                <Input
                  type="date"
                  value={range.to}
                  min={range.from}
                  onChange={(e) => e.target.value && update({ to: e.target.value })}
                />
              </Field>
            </>
          ) : null}
          <Field label="Customer">
            <RelationPicker
              entity="customer"
              value={filters.customer_id ?? null}
              onChange={(id) => update({ customer: id })}
              placeholder="All customers"
            />
          </Field>
          <Field label="Driver">
            <RelationPicker
              entity="driver"
              value={filters.driver_id ?? null}
              onChange={(id) => update({ driver: id })}
              placeholder="All drivers"
            />
          </Field>
          <Field label="Vehicle">
            <RelationPicker
              entity="vehicle"
              value={filters.vehicle_id ?? null}
              onChange={(id) => update({ vehicle: id })}
              placeholder="All vehicles"
            />
          </Field>
        </div>
        <div className="a-chips" role="group" aria-label="Status" style={{ marginTop: 12 }}>
          {ORDER_STATUSES.map((status) => {
            const selected = statuses.includes(status);
            return (
              <button
                key={status}
                type="button"
                className="a-chip"
                data-selected={selected}
                aria-pressed={selected}
                style={{ cursor: "pointer", paddingRight: 9 }}
                onClick={() =>
                  update({
                    status: (selected
                      ? statuses.filter((x) => x !== status)
                      : [...statuses, status]
                    ).join(","),
                  })
                }
              >
                {STATUS_LABELS[status]}
              </button>
            );
          })}
        </div>
      </Panel>

      {summary.isError ? (
        <ErrorState error={summary.error} onRetry={() => summary.refetch()} />
      ) : !s ? (
        <LoadingState />
      ) : (
        <>
          <div className="a-kpis" aria-label="Totals" aria-busy={summary.isFetching || undefined}>
            <Kpi label="Orders" value={s.totals.orders} />
            <Kpi
              label="Delivered"
              value={s.totals.delivered}
              sub={pct(s.totals.delivered, s.totals.orders)}
              tone="positive"
            />
            <Kpi label="Open" value={s.totals.open} />
            <Kpi
              label="Cancelled"
              value={s.totals.cancelled}
              sub={pct(s.totals.cancelled, s.totals.orders)}
              tone={s.totals.cancelled ? "critical" : undefined}
            />
            <Kpi
              label="Delivered on time"
              value={pct(s.totals.delivered_on_time, s.totals.delivered_with_deadline)}
              sub={`${s.totals.delivered_on_time} of ${s.totals.delivered_with_deadline} with a delivery time`}
            />
          </div>

          {s.totals.orders === 0 ? (
            <Panel>
              <EmptyState
                title="No orders in this period"
                message="Change the period or the filters."
              />
            </Panel>
          ) : (
            <div className="a-grid a-grid--2">
              <Panel title="Status distribution">
                <div className="a-bars">
                  {ORDER_STATUSES.map((status) => {
                    const count = s.by_status.find((b) => b.status === status)?.count ?? 0;
                    return (
                      <div key={status} className="a-bar-row">
                        <span className="a-bar-label">{STATUS_LABELS[status]}</span>
                        <span className="a-bar-track" aria-hidden="true">
                          <span
                            className="a-bar-fill"
                            data-tone={
                              status === "cancelled"
                                ? "red"
                                : status === "draft"
                                  ? "muted"
                                  : undefined
                            }
                            style={{ width: `${(count / statusMax) * 100}%` }}
                          />
                        </span>
                        <span className="a-bar-value">
                          {count} <span className="a-sr-only">orders</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Panel>
              <Panel title={`Orders per ${s.range.bucket}`}>
                <div
                  className="a-columns"
                  role="img"
                  aria-label={`Orders per ${s.range.bucket}: ${s.by_period.map((p) => `${p.period} ${p.orders}`).join(", ")}`}
                >
                  {s.by_period.map((p) => (
                    <div
                      key={p.period}
                      className="a-column"
                      title={`${formatCalendarDate(p.period)}: ${p.orders} orders, ${p.delivered} delivered`}
                    >
                      <span
                        style={{ height: `${((p.orders - p.delivered) / periodMax) * 100}%` }}
                      />
                      <span
                        data-part="delivered"
                        style={{ height: `${(p.delivered / periodMax) * 100}%` }}
                      />
                    </div>
                  ))}
                </div>
                <div className="a-columns-axis">
                  <span>{formatCalendarDate(s.by_period[0]?.period)}</span>
                  <span>{formatCalendarDate(s.by_period.at(-1)?.period)}</span>
                </div>
                <div className="a-legend" style={{ marginTop: 8 }}>
                  <span>
                    <i style={{ background: "var(--a-emerald)" }} />
                    Delivered
                  </span>
                  <span>
                    <i style={{ background: "var(--a-green-tint-2)" }} />
                    Other
                  </span>
                </div>
              </Panel>
            </div>
          )}

          <ReportTable
            title="Customers"
            empty="No customers with orders in this period."
            headers={["Customer", "Orders", "Delivered", "Open", "Cancelled"]}
            rows={s.by_customer.map((r) => ({
              key: r.customer_id,
              cells: [
                <Link key="n" className="a-row-link" href={`/admin/customers/${r.customer_id}`}>
                  {r.name}
                </Link>,
                r.orders,
                r.delivered,
                r.open,
                r.cancelled,
              ],
              csv: [r.name, r.orders, r.delivered, r.open, r.cancelled],
            }))}
            fileName={`customers-${range.from}-${range.to}`}
          />
          <div className="a-grid a-grid--2">
            <ReportTable
              title="Drivers"
              empty="No dispatched orders in this period."
              headers={["Driver", "Orders", "Delivered", "Planned hours"]}
              rows={s.by_driver.map((r) => ({
                key: r.driver_id,
                cells: [
                  <Link key="n" className="a-row-link" href={`/admin/drivers/${r.driver_id}`}>
                    {r.name}
                  </Link>,
                  r.orders,
                  r.delivered,
                  formatNumber(r.hours, 1),
                ],
                csv: [r.name, r.orders, r.delivered, r.hours],
              }))}
              fileName={`drivers-${range.from}-${range.to}`}
            />
            <ReportTable
              title="Vehicles"
              empty="No dispatched orders in this period."
              headers={["Vehicle", "Orders", "Delivered", "Planned hours", "Utilisation"]}
              rows={s.by_vehicle.map((r) => ({
                key: r.vehicle_id,
                cells: [
                  <Link key="n" className="a-row-link" href={`/admin/vehicles/${r.vehicle_id}`}>
                    {r.name}
                  </Link>,
                  r.orders,
                  r.delivered,
                  formatNumber(r.hours, 1),
                  `${formatNumber(r.utilization, 1)}%`,
                ],
                csv: [r.name, r.orders, r.delivered, r.hours, r.utilization],
              }))}
              fileName={`vehicles-${range.from}-${range.to}`}
            />
          </div>
        </>
      )}

      {config ? <FieldBreakdownPanel range={range} filters={filters} /> : null}
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  tone?: "positive" | "critical";
}) {
  return (
    <div className="a-kpi" data-tone={tone}>
      <div className="a-kpi-label">{label}</div>
      <div className="a-kpi-value">{value}</div>
      {sub ? <div className="a-kpi-sub">{sub}</div> : null}
    </div>
  );
}

function ReportTable({
  title,
  headers,
  rows,
  empty,
  fileName,
}: {
  title: string;
  headers: string[];
  rows: { key: string; cells: ReactNode[]; csv: CsvCell[] }[];
  empty: string;
  fileName: string;
}) {
  return (
    <Panel
      title={title}
      flush
      actions={
        <Button
          size="sm"
          disabled={!rows.length}
          onClick={() =>
            exportTable(
              fileName,
              headers,
              rows.map((r) => r.csv),
            )
          }
        >
          <Download aria-hidden="true" />
          CSV
        </Button>
      }
    >
      {rows.length === 0 ? (
        <p className="a-panel-body a-muted">{empty}</p>
      ) : (
        <div className="a-table-wrap">
          <table className="a-table">
            <thead>
              <tr>
                {headers.map((h, i) => (
                  <th key={h} scope="col" className={i > 0 ? "a-num" : undefined}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  {row.cells.map((cell, i) => (
                    <td key={i} className={i > 0 ? "a-num" : undefined}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function FieldBreakdownPanel({
  range,
  filters,
}: {
  range: { from: string; to: string };
  filters: ReportFilters;
}) {
  const { get, update } = useUrlState();
  const { data: config } = useAdminConfig();
  const entity = (ENTITY_KEYS as readonly string[]).includes(get("bentity") ?? "")
    ? (get("bentity") as EntityKey)
    : "order";
  const fields = config ? reportableFields(config, entity) : [];
  const fieldKey = fields.some((f) => f.field_key === get("bfield"))
    ? get("bfield")!
    : fields[0]?.field_key;

  const query = useQuery({
    queryKey: ["breakdown", entity, fieldKey, range.from, range.to, filters],
    queryFn: () => fetchFieldBreakdown(entity, fieldKey!, range.from, range.to, filters),
    enabled: Boolean(fieldKey),
  });

  return (
    <Panel
      title="Field breakdown"
      actions={
        query.data && query.data.kind !== "numeric" ? (
          <Button
            size="sm"
            onClick={() =>
              exportTable(
                `${entity}-${query.data.field.field_key}-breakdown`,
                [query.data.field.label, "Records"],
                query.data.rows.map((r) => [r.label, r.count]),
              )
            }
          >
            <Download aria-hidden="true" />
            CSV
          </Button>
        ) : null
      }
    >
      <div className="a-stack">
        <div className="a-form-grid">
          <Field label="Entity">
            <Select
              value={entity}
              onChange={(e) => update({ bentity: e.target.value, bfield: null })}
            >
              {ENTITY_KEYS.map((key) => (
                <option key={key} value={key}>
                  {config?.entities[key]?.plural_display_name ?? key}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Reportable field"
            help={fields.length ? undefined : "Mark fields as reportable in Settings → Fields."}
          >
            <Select
              value={fieldKey ?? ""}
              onChange={(e) => update({ bfield: e.target.value })}
              disabled={!fields.length}
            >
              {fields.length === 0 ? <option value="">No reportable fields</option> : null}
              {fields.map((f) => (
                <option key={f.id} value={f.field_key}>
                  {f.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <p className="a-help">
          {entity === "order"
            ? "Uses the period and filters above."
            : "Counts current (non-archived) records; the period and filters apply to orders only."}
        </p>
        {!fieldKey ? null : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : !query.data ? (
          <LoadingState />
        ) : (
          <BreakdownResult data={query.data} />
        )}
      </div>
    </Panel>
  );
}

function BreakdownResult({ data }: { data: FieldBreakdown }) {
  if (data.kind === "numeric") {
    const stats = data.stats;
    const fmt = (v: number | null | undefined) =>
      v === null || v === undefined ? "—" : formatNumber(Number(v), 2);
    return (
      <div className="a-kpis">
        <Kpi
          label="Records with a value"
          value={stats?.count ?? 0}
          sub={`of ${data.total_records}`}
        />
        <Kpi label="Total" value={fmt(stats?.sum)} />
        <Kpi label="Average" value={fmt(stats?.avg)} />
        <Kpi label="Minimum" value={fmt(stats?.min)} />
        <Kpi label="Maximum" value={fmt(stats?.max)} />
      </div>
    );
  }
  const max = Math.max(1, ...data.rows.map((r) => r.count));
  if (!data.rows.length || data.total_records === 0) {
    return <EmptyState title="No data" message="No records in this selection." />;
  }
  return (
    <div className="a-bars">
      {data.rows.map((row) => (
        <div key={row.key ?? "empty"} className="a-bar-row">
          <span className="a-bar-label" title={row.label}>
            {row.label}
            {row.archived ? " (archived)" : ""}
          </span>
          <span className="a-bar-track" aria-hidden="true">
            <span
              className="a-bar-fill"
              data-tone={row.key === null ? "muted" : undefined}
              style={{ width: `${(row.count / max) * 100}%` }}
            />
          </span>
          <span className="a-bar-value">{row.count}</span>
        </div>
      ))}
      <p className="a-help">{`${data.total_records} records in the selection.`}</p>
    </div>
  );
}
