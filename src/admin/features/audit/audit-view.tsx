"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { Fragment, useEffect, useState } from "react";

import { Button } from "../../components/ui/button";
import { EmptyState, ErrorState, SkeletonRows } from "../../components/ui/feedback";
import { Field, Input, Select } from "../../components/ui/form";
import { PageHeader, Pagination } from "../../components/ui/layout";
import { useAdminConfig } from "../../hooks/use-admin-config";
import { addDays, businessToInstant, formatDateTime } from "../../lib/datetime";
import { fetchAdmins } from "../../services/admins";
import {
  AUDIT_ACTION_LABELS,
  AUDIT_ENTITY_LABELS,
  fetchAuditLog,
  type AuditEntry,
} from "../../services/audit";
import { ENTITY_PATHS } from "../../services/records";
import type { EntityKey } from "../../lib/fields/types";
import { useUrlState } from "../records/url-state";
import { AuditChanges, auditSentence, useAuditNames } from "./audit-diff";

const PAGE_SIZE = 50;

function recordHref(entry: AuditEntry): string | null {
  if (entry.action === "delete") return null;
  if (entry.entity_type in ENTITY_PATHS)
    return `${ENTITY_PATHS[entry.entity_type as EntityKey]}/${entry.entity_id}`;
  if (entry.entity_type === "order_assignment" && typeof entry.context.order_id === "string") {
    return `/admin/orders/${entry.context.order_id}`;
  }
  if (
    entry.entity_type === "driver_vehicle_assignment" &&
    typeof entry.context.driver_id === "string"
  ) {
    return `/admin/drivers/${entry.context.driver_id}`;
  }
  if (
    entry.entity_type === "field_definition" ||
    entry.entity_type === "field_option" ||
    entry.entity_type === "entity_config"
  ) {
    return "/admin/settings/fields";
  }
  return null;
}

export function AuditView() {
  const { get, update } = useUrlState();
  const { data: config } = useAdminConfig();
  const admins = useQuery({ queryKey: ["admins"], queryFn: fetchAdmins });
  const page = Math.max(1, Number(get("page") ?? 1) || 1);
  const [search, setSearch] = useState(get("q") ?? "");
  const [expanded, setExpanded] = useState<number | null>(null);
  const urlSearch = get("q") ?? "";

  useEffect(() => {
    if (search === urlSearch) return;
    const timer = setTimeout(() => update({ q: search }, { resetPage: true }), 300);
    return () => clearTimeout(timer);
  }, [search, urlSearch, update]);

  const from = get("from");
  const to = get("to");
  const query = {
    entityType: get("entity") ?? undefined,
    entityId: get("id") ?? undefined,
    orderId: get("order") ?? undefined,
    action: get("action") ?? undefined,
    actorId: get("actor") ?? undefined,
    from: from ? businessToInstant(from).toISOString() : undefined,
    to: to ? businessToInstant(addDays(to, 1)).toISOString() : undefined,
    search: urlSearch || undefined,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  };
  const log = useQuery({
    queryKey: ["audit", "log", query],
    queryFn: () => fetchAuditLog(query),
    placeholderData: keepPreviousData,
  });
  const scoped = query.entityId || query.orderId;
  const names = useAuditNames(log.data?.rows ?? []);

  return (
    <div className="a-page">
      <PageHeader
        title="Audit Log"
        meta={
          <span>
            Every change to operations and configuration. Entries are permanent and cannot be edited
            or deleted.
          </span>
        }
      />
      <section className="a-panel" aria-label="Audit entries">
        <div
          className="a-filter-panel"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", alignItems: "end" }}
        >
          <Field label="Search">
            <div className="a-search">
              <Search aria-hidden="true" />
              <Input
                type="search"
                placeholder="Record, actor or ID"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </Field>
          <Field label="Entity">
            <Select
              value={query.entityType ?? ""}
              onChange={(e) => update({ entity: e.target.value, id: null }, { resetPage: true })}
            >
              <option value="">All</option>
              {Object.entries(AUDIT_ENTITY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Action">
            <Select
              value={query.action ?? ""}
              onChange={(e) => update({ action: e.target.value }, { resetPage: true })}
            >
              <option value="">All</option>
              {Object.entries(AUDIT_ACTION_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Actor">
            <Select
              value={query.actorId ?? ""}
              onChange={(e) => update({ actor: e.target.value }, { resetPage: true })}
            >
              <option value="">Anyone</option>
              {(admins.data ?? []).map((a) => (
                <option key={a.user_id} value={a.user_id}>
                  {a.display_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="From">
            <Input
              type="date"
              value={from ?? ""}
              onChange={(e) => update({ from: e.target.value }, { resetPage: true })}
            />
          </Field>
          <Field label="To">
            <Input
              type="date"
              value={to ?? ""}
              onChange={(e) => update({ to: e.target.value }, { resetPage: true })}
            />
          </Field>
        </div>
        {scoped ? (
          <div className="a-toolbar">
            <span className="a-badge a-badge--green">Showing one record&apos;s history</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => update({ id: null, order: null }, { resetPage: true })}
            >
              Show all records
            </Button>
          </div>
        ) : null}

        {log.isError ? (
          <ErrorState error={log.error} onRetry={() => log.refetch()} />
        ) : log.isLoading ? (
          <SkeletonRows columns={6} />
        ) : !log.data?.rows.length ? (
          <EmptyState title="No entries" message="Changes made in the panel are recorded here." />
        ) : (
          <>
            <div className="a-table-wrap" aria-busy={log.isFetching || undefined}>
              <table className="a-table">
                <thead>
                  <tr>
                    <th scope="col">
                      <span className="a-sr-only">Details</span>
                    </th>
                    <th scope="col">When</th>
                    <th scope="col">Actor</th>
                    <th scope="col">Action</th>
                    <th scope="col">Entity</th>
                    <th scope="col">Record</th>
                    <th scope="col">What happened</th>
                  </tr>
                </thead>
                <tbody>
                  {log.data.rows.map((entry, index, rows) => {
                    const open = expanded === entry.id;
                    const href = recordHref(entry);
                    // Entries of one database transaction are one action: shown together.
                    const previous = rows[index - 1];
                    const sameAction =
                      previous !== undefined &&
                      entry.transaction_id !== null &&
                      previous.transaction_id === entry.transaction_id &&
                      previous.actor_id === entry.actor_id;
                    return (
                      <Fragment key={entry.id}>
                        <tr data-follows={sameAction || undefined}>
                          <td style={{ width: 40 }}>
                            <Button
                              size="sm"
                              variant="ghost"
                              icon
                              aria-expanded={open}
                              aria-label={open ? "Hide details" : "Show details"}
                              onClick={() => setExpanded(open ? null : entry.id)}
                            >
                              {open ? (
                                <ChevronDown aria-hidden="true" />
                              ) : (
                                <ChevronRight aria-hidden="true" />
                              )}
                            </Button>
                          </td>
                          <td className="a-nowrap">
                            {sameAction ? (
                              <span className="a-muted a-small">same action</span>
                            ) : (
                              formatDateTime(entry.occurred_at)
                            )}
                          </td>
                          <td>{sameAction ? "" : entry.actor_label}</td>
                          <td>
                            <span
                              className={`a-badge${entry.action === "delete" ? "a-badge--red" : ""}`}
                            >
                              {AUDIT_ACTION_LABELS[entry.action] ?? entry.action}
                            </span>
                          </td>
                          <td>{AUDIT_ENTITY_LABELS[entry.entity_type] ?? entry.entity_type}</td>
                          <td>
                            {href ? (
                              <Link className="a-row-link" href={href}>
                                {entry.entity_label ?? entry.entity_id}
                              </Link>
                            ) : (
                              (entry.entity_label ?? entry.entity_id)
                            )}
                          </td>
                          <td>{auditSentence(entry, config, names)}</td>
                        </tr>
                        {open ? (
                          <tr>
                            <td
                              colSpan={7}
                              className="a-wrap"
                              style={{ background: "var(--a-soft)", maxWidth: "none" }}
                            >
                              <div className="a-stack" style={{ gap: 8, padding: "6px 0" }}>
                                <span className="a-small a-muted">
                                  Entry #{entry.id} · record ID{" "}
                                  <span className="a-mono">{entry.entity_id}</span>
                                  {typeof entry.context.note === "string"
                                    ? ` · note: “${entry.context.note}”`
                                    : ""}
                                </span>
                                <AuditChanges entry={entry} config={config} names={names} />
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              total={log.data.total}
              page={page}
              pageSize={PAGE_SIZE}
              onPage={(next) => update({ page: next === 1 ? null : next })}
            />
          </>
        )}
      </section>
    </div>
  );
}
