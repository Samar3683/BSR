"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ExternalLink, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { FieldValue } from "../../components/fields/field-value";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/feedback";
import { Checkbox, Input, Select } from "../../components/ui/form";
import { Empty, PageHeader, Panel, StatusBadge } from "../../components/ui/layout";
import { useAdminConfig, useRecordNames } from "../../hooks/use-admin-config";
import { useT } from "../../i18n/provider";
import { addDays, businessToInstant, businessToday, formatDateTime } from "../../lib/datetime";
import { recordValue } from "../../lib/fields/values";
import { detailFields } from "../../services/config";
import { getRecord, listRecords, type OrderRow, type RecordFilter } from "../../services/records";
import { useUrlState } from "../records/url-state";
import { AssignmentEditor } from "./assignment-editor";
import { PairingsBoard } from "./pairings";
import { DispatchTimeline } from "./timeline";

type Range = "today" | "7d" | "30d" | "all";

function rangeFilter(range: Range): RecordFilter | null {
  if (range === "all") return null;
  const today = businessToday();
  const days = range === "today" ? 1 : range === "7d" ? 7 : 30;
  return {
    field: "window",
    op: "between",
    value: [
      businessToInstant(today).toISOString(),
      businessToInstant(addDays(today, days)).toISOString(),
    ],
  };
}

export function DispatchView() {
  const { get, update } = useUrlState();
  const t = useT();
  const tab = get("tab") === "pairings" || get("tab") === "timeline" ? get("tab") : "queue";
  return (
    <div className="a-page">
      <PageHeader
        title="Dispatch"
        meta={
          <span>Assign drivers and vehicles to orders. Conflicts are checked by the database.</span>
        }
      />
      <div className="a-tabs" role="tablist" aria-label="Dispatch views">
        <button
          type="button"
          role="tab"
          className="a-tab"
          aria-selected={tab === "queue"}
          onClick={() => update({ tab: null, day: null, lanes: null })}
        >
          {t("Order queue")}
        </button>
        <button
          type="button"
          role="tab"
          className="a-tab"
          aria-selected={tab === "timeline"}
          onClick={() => update({ tab: "timeline", order: null })}
        >
          {t("Day timeline")}
        </button>
        <button
          type="button"
          role="tab"
          className="a-tab"
          aria-selected={tab === "pairings"}
          onClick={() => update({ tab: "pairings", order: null, day: null, lanes: null })}
        >
          {t("Driver–vehicle pairings")}
        </button>
      </div>
      {tab === "queue" ? <Queue /> : tab === "timeline" ? <DispatchTimeline /> : <PairingsBoard />}
    </div>
  );
}

function Queue() {
  const { get, update } = useUrlState();
  const selected = get("order");
  const range = (
    ["today", "7d", "30d", "all"].includes(get("range") ?? "") ? get("range") : "7d"
  ) as Range;
  const onlyOpen = get("all") !== "1";
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setTerm(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const filters: RecordFilter[] = [
    { field: "status", op: "in", value: ["confirmed", "scheduled", "in_transit"] },
  ];
  const windowFilter = rangeFilter(range);
  if (windowFilter) filters.push(windowFilter);
  if (onlyOpen) filters.push({ field: "dispatch", op: "eq", value: "unassigned" });

  const queue = useQuery({
    queryKey: ["records", "order", "dispatch-queue", range, onlyOpen, term],
    queryFn: () =>
      listRecords<OrderRow>("order", {
        search: term,
        filters,
        sort: { field: "pickup_at", direction: "asc" },
        limit: 100,
      }),
    placeholderData: keepPreviousData,
  });
  const rows = queue.data?.rows ?? [];

  return (
    <div className="a-dispatch">
      <section className="a-panel" aria-label="Order queue">
        <div className="a-toolbar">
          <div className="a-search" style={{ flexBasis: "100%", maxWidth: "none" }}>
            <Search aria-hidden="true" />
            <Input
              type="search"
              placeholder="Search orders…"
              aria-label="Search orders"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select
            className="a-select--sm"
            aria-label="Pickup window"
            value={range}
            style={{ width: "auto" }}
            onChange={(e) => update({ range: e.target.value === "7d" ? null : e.target.value })}
          >
            <option value="today">Today</option>
            <option value="7d">Next 7 days</option>
            <option value="30d">Next 30 days</option>
            <option value="all">Any date</option>
          </Select>
          <Checkbox
            label="Only not fully assigned"
            checked={onlyOpen}
            onChange={(checked) => update({ all: checked ? null : "1" })}
          />
        </div>
        <div className="a-queue" aria-busy={queue.isFetching || undefined}>
          {queue.isError ? (
            <ErrorState error={queue.error} onRetry={() => queue.refetch()} />
          ) : queue.isLoading ? (
            <LoadingState />
          ) : rows.length === 0 ? (
            <EmptyState
              title={onlyOpen ? "Everything is dispatched" : "No orders in this window"}
              message="Confirmed orders waiting for a driver and vehicle appear here."
            />
          ) : (
            rows.map((row) => {
              const assignment = row.assignment;
              const full = assignment?.driver_id && assignment?.vehicle_id;
              return (
                <button
                  key={row.id}
                  type="button"
                  className="a-queue-item"
                  aria-pressed={selected === row.id}
                  onClick={() => update({ order: row.id })}
                >
                  <span className="a-queue-line">
                    <strong className="a-mono">{row.order_number}</strong>
                    <StatusBadge status={row.status} />
                  </span>
                  <span className="a-queue-line">
                    <span
                      style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    >
                      {row.customer?.display_name}
                    </span>
                    <span className="a-small a-muted a-nowrap">
                      {row.pickup_at ? formatDateTime(row.pickup_at) : "No pickup time"}
                    </span>
                  </span>
                  <span className="a-small">
                    {full ? (
                      <span className="a-muted">
                        {assignment!.driver_name} · {assignment!.vehicle_name}
                      </span>
                    ) : assignment ? (
                      <span className="a-badge a-badge--outline">Partly assigned</span>
                    ) : (
                      <span className="a-badge a-badge--red">Unassigned</span>
                    )}
                  </span>
                </button>
              );
            })
          )}
        </div>
        {queue.data && queue.data.total > rows.length ? (
          <div className="a-table-foot">
            Showing the first {rows.length} of {queue.data.total}. Narrow the window or search.
          </div>
        ) : null}
      </section>

      {selected ? (
        <SelectedOrder key={selected} orderId={selected} />
      ) : (
        <Panel title="Assignment">
          <EmptyState
            title="Select an order"
            message="Choose an order from the queue to assign its driver and vehicle."
          />
        </Panel>
      )}
    </div>
  );
}

function SelectedOrder({ orderId }: { orderId: string }) {
  const { data: config } = useAdminConfig();
  const order = useQuery({
    queryKey: ["record", "order", orderId],
    queryFn: () => getRecord<OrderRow>("order", orderId),
  });
  const customerName = useRecordNames("customer", order.data ? [order.data.customer_id] : []);

  if (order.isError) return <ErrorState error={order.error} onRetry={() => order.refetch()} />;
  if (!order.data || !config) return <LoadingState />;
  const row = order.data;
  // A compact summary: the order's address, select and text fields shown on record pages.
  const summary = detailFields(config, "order").filter(
    (f) =>
      !f.binding_key &&
      ["address", "single_select", "multi_select", "short_text", "decimal", "integer"].includes(
        f.field_type,
      ),
  );

  return (
    <div className="a-stack">
      <Panel
        title={
          <span className="a-row">
            <span className="a-mono">{row.order_number}</span>
            <StatusBadge status={row.status} />
          </span>
        }
        actions={
          <Link className="a-btn a-btn--sm a-btn--ghost" href={`/admin/orders/${row.id}`}>
            <ExternalLink aria-hidden="true" />
            Open order
          </Link>
        }
      >
        <dl className="a-dl">
          <div>
            <dt>Customer</dt>
            <dd>
              <Link className="a-link" href={`/admin/customers/${row.customer_id}`}>
                {customerName.data?.[row.customer_id] ?? "Customer"}
              </Link>
            </dd>
          </div>
          <div>
            <dt>Window</dt>
            <dd>
              {row.pickup_at ? formatDateTime(row.pickup_at) : <Empty>No pickup</Empty>} →{" "}
              {row.delivery_at ? formatDateTime(row.delivery_at) : <Empty>No delivery</Empty>}
            </dd>
          </div>
          {summary.slice(0, 5).map((def) => (
            <div key={def.id}>
              <dt>{def.label}</dt>
              <dd>
                <FieldValue
                  def={def}
                  value={recordValue(def, row)}
                  ctx={{ optionsByField: config.options }}
                />
              </dd>
            </div>
          ))}
        </dl>
      </Panel>
      <Panel title="Driver and vehicle">
        <AssignmentEditor orderId={row.id} status={row.status} />
      </Panel>
    </div>
  );
}
