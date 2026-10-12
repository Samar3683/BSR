"use client";

import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import {
  Archive,
  ArchiveRestore,
  Columns3,
  Download,
  Plus,
  RefreshCcw,
  Search,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Button, ButtonLink } from "../../components/ui/button";
import { ConfirmDialog, Dialog } from "../../components/ui/dialog";
import { EmptyState, ErrorState, LoadingState, SkeletonRows } from "../../components/ui/feedback";
import { Checkbox, Field, Input, Segmented, Select, Textarea } from "../../components/ui/form";
import { PageHeader, Pagination, SortHeader, StatusBadge } from "../../components/ui/layout";
import { Popover } from "../../components/ui/popover";
import { useToast } from "../../components/ui/toast";
import { useAdminConfig, useInvalidateData, useRecordNames } from "../../hooks/use-admin-config";
import { csvFileName, downloadCsv, toCsv } from "../../lib/csv";
import { addDays, businessToday, businessToInstant, startOfWeek } from "../../lib/datetime";
import { toAdminError } from "../../lib/errors";
import type { EntityKey, EntityRecord } from "../../lib/fields/types";
import type { AdminConfig } from "../../services/config";
import { filterableFields, liveFields } from "../../services/config";
import { ORDER_STATUSES, STATUS_LABELS } from "../../services/operations";
import {
  bulkChangeOrderStatus,
  bulkSetArchived,
  ENTITY_PATHS,
  fetchRecordNames,
  listAllRecords,
  listRecords,
  type ArchiveScope,
  type BulkResult,
  type ListQuery,
  type OrderRow,
  type OrderStatus,
  type RecordFilter,
} from "../../services/records";
import { buildColumns, collectRelationIds, type Column } from "./columns";
import { FilterPanel, FilterToggle, toApiFilters, type UiFilter } from "./filters";
import { parseJsonParam, useUrlState } from "./url-state";

type When = "today" | "tomorrow" | "week" | "next7";
const WHEN_LABELS: Record<When | "any", string> = {
  any: "Any day",
  today: "Today",
  tomorrow: "Tomorrow",
  week: "This week",
  next7: "Next 7 days",
};

/** Pickup range of a quick date filter, as Europe/Rome instants [from, to). */
function whenRange(when: When): [string, string] {
  const today = businessToday();
  const [from, to] =
    when === "today"
      ? [today, addDays(today, 1)]
      : when === "tomorrow"
        ? [addDays(today, 1), addDays(today, 2)]
        : when === "week"
          ? [startOfWeek(today), addDays(startOfWeek(today), 7)]
          : [today, addDays(today, 7)];
  return [businessToInstant(from).toISOString(), businessToInstant(to).toISOString()];
}

/** Columns a person chose to hide, per entity (kept in this browser). */
function useHiddenColumns(entity: EntityKey) {
  const key = `bsr-admin:hidden-columns:${entity}`;
  const [hidden, setHidden] = useState<string[]>([]);
  useEffect(() => {
    // Per-viewer preference that only exists in the browser: read after hydration.
    try {
      const stored = JSON.parse(window.localStorage.getItem(key) ?? "[]") as unknown;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client-only read
      if (Array.isArray(stored)) setHidden(stored.filter((v): v is string => typeof v === "string"));
    } catch {
      // storage unavailable or corrupt: show every column
    }
  }, [key]);
  const toggle = (column: string) =>
    setHidden((current) => {
      const next = current.includes(column) ? current.filter((c) => c !== column) : [...current, column];
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // storage unavailable
      }
      return next;
    });
  return { hidden, toggle };
}

/** Columns that always stay visible (they identify the row). */
const LOCKED_COLUMNS = new Set(["display_name", "status"]);

export function RecordListView({ entity }: { entity: EntityKey }) {
  const router = useRouter();
  const toast = useToast();
  const { get, update } = useUrlState();
  const configQuery = useAdminConfig();
  const config = configQuery.data;
  const { hidden, toggle } = useHiddenColumns(entity);

  const page = Math.max(1, Number(get("page") ?? 1) || 1);
  const pageSize = [25, 50, 100].includes(Number(get("size"))) ? Number(get("size")) : 25;
  const scope = (
    ["active", "archived", "all"].includes(get("scope") ?? "") ? get("scope") : "active"
  ) as ArchiveScope;
  const sortField = get("sort");
  const sortDir: "asc" | "desc" | null =
    get("dir") === "asc" ? "asc" : get("dir") === "desc" ? "desc" : null;
  const statusParam = get("status");
  const statuses = useMemo(
    () =>
      statusParam
        ? statusParam
            .split(",")
            .filter((s): s is OrderStatus => (ORDER_STATUSES as string[]).includes(s))
        : [],
    [statusParam],
  );
  const dispatch = get("dispatch");
  const availability = get("avail");
  const whenParam = get("when");
  const when = (["today", "tomorrow", "week", "next7"].includes(whenParam ?? "") ? whenParam : null) as When | null;
  const filterParam = get("f");
  const uiFilters = useMemo(() => parseJsonParam<UiFilter[]>(filterParam, []), [filterParam]);
  const urlSearch = get("q") ?? "";

  const [search, setSearch] = useState(urlSearch);
  const [filtersOpen, setFiltersOpen] = useState(uiFilters.length > 0);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (search === urlSearch) return;
    const timer = setTimeout(() => update({ q: search }, { resetPage: true }), 300);
    return () => clearTimeout(timer);
  }, [search, urlSearch, update]);

  const fields = useMemo(() => (config ? filterableFields(config, entity) : []), [config, entity]);
  const apiFilters = useMemo<RecordFilter[]>(() => {
    const list = toApiFilters(uiFilters, fields);
    if (entity === "order" && statuses.length)
      list.push({ field: "status", op: "in", value: statuses });
    if (entity === "order" && (dispatch === "assigned" || dispatch === "unassigned")) {
      list.push({ field: "dispatch", op: "eq", value: dispatch });
    }
    if (entity === "order" && when) {
      list.push({ field: "pickup_between", op: "between", value: whenRange(when) });
    }
    if (
      (entity === "driver" || entity === "vehicle") &&
      (availability === "yes" || availability === "no")
    ) {
      list.push({ field: "available", op: "eq", value: availability === "yes" });
    }
    return list;
  }, [uiFilters, fields, statuses, dispatch, availability, entity, when]);

  const query: ListQuery = {
    search: urlSearch,
    filters: apiFilters,
    sort: sortField && sortDir ? { field: sortField, direction: sortDir } : null,
    limit: pageSize,
    offset: (page - 1) * pageSize,
    archived: scope,
  };
  const queryKey = JSON.stringify(query);

  // Selection belongs to the visible page: a new query starts with none.
  const [selection, setSelection] = useState<{ key: string; ids: string[] }>({ key: queryKey, ids: [] });
  const selected = selection.key === queryKey ? selection.ids : [];
  const setSelected = (ids: string[]) => setSelection({ key: queryKey, ids });

  const list = useQuery({
    queryKey: ["records", entity, query],
    queryFn: () => listRecords(entity, query),
    enabled: Boolean(config),
    placeholderData: keepPreviousData,
  });

  const rows = list.data?.rows ?? [];
  const relationIds = config ? collectRelationIds(liveFields(config, entity), rows) : null;
  const orderNames = useRecordNames("order", relationIds?.order ?? []);
  const vehicleNames = useRecordNames("vehicle", relationIds?.vehicle ?? []);
  const driverNames = useRecordNames("driver", relationIds?.driver ?? []);
  const customerNames = useRecordNames("customer", relationIds?.customer ?? []);

  if (configQuery.isError)
    return <ErrorState error={configQuery.error} onRetry={() => configQuery.refetch()} />;
  if (!config) return <LoadingState />;

  const entityConfig = config.entities[entity];
  const plural = entityConfig?.plural_display_name ?? entity;
  const singular = entityConfig?.display_name ?? entity;
  const ctx = {
    optionsByField: config.options,
    relationNames: {
      ...orderNames.data,
      ...vehicleNames.data,
      ...driverNames.data,
      ...customerNames.data,
    },
  };
  const allColumns = buildColumns(entity, config, ctx);
  const columns = allColumns.filter((c) => LOCKED_COLUMNS.has(c.key) || !hidden.includes(c.key));
  const sort = sortField && sortDir ? { field: sortField, direction: sortDir } : null;
  const filtersActive =
    uiFilters.length +
      statuses.length +
      (dispatch ? 1 : 0) +
      (availability ? 1 : 0) +
      (when ? 1 : 0) +
      (urlSearch ? 1 : 0) >
    0;
  const href = (id: string) => `${ENTITY_PATHS[entity]}/${id}`;

  const onSort = (field: string) => {
    const direction = sort?.field === field && sort.direction === "asc" ? "desc" : "asc";
    update({ sort: field, dir: direction }, { resetPage: true });
  };

  const exportRows = async (extra: RecordFilter[] = []) => {
    setExporting(true);
    try {
      const all = await listAllRecords(entity, {
        search: query.search,
        filters: [...(query.filters ?? []), ...extra],
        sort: query.sort,
        archived: query.archived,
      });
      const ids = collectRelationIds(liveFields(config, entity), all);
      const names: Record<string, string> = {};
      for (const [target, list] of Object.entries(ids) as [EntityKey, string[]][]) {
        for (const row of await fetchRecordNames(target, list)) names[row.id] = row.display_name;
      }
      const exportColumns = buildColumns(entity, config, {
        optionsByField: config.options,
        relationNames: names,
      }).filter((c) => LOCKED_COLUMNS.has(c.key) || !hidden.includes(c.key));
      const csv = toCsv(
        exportColumns.map((c) => c.label),
        all.map((row) => exportColumns.map((c) => c.csv(row))),
      );
      downloadCsv(csvFileName(plural), csv);
      toast.success(
        `Exported ${all.length} ${all.length === 1 ? singular.toLowerCase() : plural.toLowerCase()}.`,
      );
    } catch (error) {
      toast.error(toAdminError(error).message);
    } finally {
      setExporting(false);
    }
  };

  const clearFilters = () => {
    setSearch("");
    update(
      { q: null, f: null, status: null, dispatch: null, avail: null, scope: null, when: null },
      { resetPage: true },
    );
  };

  const counts = list.data?.statusCounts;
  const pageIds = rows.map((r) => r.id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));

  return (
    <div className="a-page">
      <PageHeader
        title={plural}
        meta={
          list.data ? (
            <span>
              {list.data.total}{" "}
              {scope === "archived" ? "archived" : scope === "all" ? "in total" : "current"}
            </span>
          ) : null
        }
        actions={
          <>
            <Button onClick={() => exportRows()} loading={exporting} disabled={!list.data?.total}>
              {exporting ? null : <Download aria-hidden="true" />}
              Export CSV
            </Button>
            {entityConfig?.active ? (
              <ButtonLink href={`${ENTITY_PATHS[entity]}/new`} variant="primary">
                <Plus aria-hidden="true" />
                New {singular.toLowerCase()}
              </ButtonLink>
            ) : (
              <span className="a-badge" title="Enable the entity in Settings to create records">
                Entity disabled
              </span>
            )}
          </>
        }
      />

      <section className="a-panel" aria-label={`${plural} list`}>
        <div className="a-toolbar">
          <div className="a-search">
            <Search aria-hidden="true" />
            <Input
              type="search"
              placeholder={`Search ${plural.toLowerCase()}…`}
              aria-label={`Search ${plural.toLowerCase()}`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {fields.length ? (
            <FilterToggle
              count={uiFilters.length}
              open={filtersOpen}
              onToggle={() => setFiltersOpen((v) => !v)}
            />
          ) : null}
          {entity === "order" ? (
            <Select
              className="a-select--sm"
              aria-label="Dispatch state"
              value={dispatch ?? ""}
              style={{ width: "auto" }}
              onChange={(e) => update({ dispatch: e.target.value }, { resetPage: true })}
            >
              <option value="">Any dispatch state</option>
              <option value="unassigned">Not fully assigned</option>
              <option value="assigned">Driver and vehicle assigned</option>
            </Select>
          ) : null}
          {entity === "driver" || entity === "vehicle" ? (
            <Select
              className="a-select--sm"
              aria-label="Availability"
              value={availability ?? ""}
              style={{ width: "auto" }}
              onChange={(e) => update({ avail: e.target.value }, { resetPage: true })}
            >
              <option value="">Any availability</option>
              <option value="yes">Available</option>
              <option value="no">Unavailable</option>
            </Select>
          ) : null}
          <Select
            className="a-select--sm"
            aria-label="Records shown"
            value={scope}
            style={{ width: "auto" }}
            onChange={(e) =>
              update(
                { scope: e.target.value === "active" ? null : e.target.value },
                { resetPage: true },
              )
            }
          >
            <option value="active">Current</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </Select>
          <ColumnChooser columns={allColumns} hidden={hidden} onToggle={toggle} />
        </div>

        {entity === "order" ? (
          <div className="a-toolbar a-toolbar--split">
            <div className="a-chips" role="group" aria-label="Filter by status">
              {ORDER_STATUSES.map((status) => {
                const isSelected = statuses.includes(status);
                const count = counts?.[status] ?? 0;
                return (
                  <button
                    key={status}
                    type="button"
                    className="a-chip"
                    data-selected={isSelected}
                    aria-pressed={isSelected}
                    style={{ cursor: "pointer", paddingRight: 9 }}
                    onClick={() => {
                      const next = isSelected
                        ? statuses.filter((s) => s !== status)
                        : [...statuses, status];
                      update({ status: next.join(",") }, { resetPage: true });
                    }}
                  >
                    {STATUS_LABELS[status]}
                    {counts ? <span className="a-chip-count">{count}</span> : null}
                  </button>
                );
              })}
            </div>
            <Segmented
              label="Pickup day"
              value={when ?? "any"}
              onChange={(value) => update({ when: value === "any" ? null : value }, { resetPage: true })}
              options={(["any", "today", "tomorrow", "week", "next7"] as const).map((value) => ({
                value,
                label: WHEN_LABELS[value],
              }))}
            />
          </div>
        ) : null}

        {filtersOpen && fields.length ? (
          <FilterPanel
            fields={fields}
            options={config.options}
            filters={uiFilters}
            onChange={(next) =>
              update({ f: next.length ? JSON.stringify(next) : null }, { resetPage: true })
            }
          />
        ) : null}

        {selected.length ? (
          <BulkBar
            entity={entity}
            config={config}
            selected={selected}
            scope={scope}
            exporting={exporting}
            onExport={() => exportRows([{ field: "ids", op: "in", value: selected }])}
            onClear={() => setSelected([])}
          />
        ) : null}

        {list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : list.isLoading ? (
          <SkeletonRows columns={Math.min(columns.length, 6)} />
        ) : rows.length === 0 ? (
          filtersActive || scope !== "active" ? (
            <EmptyState
              title={`No matching ${plural.toLowerCase()}`}
              message="Change the search or the filters to see more."
              actions={<Button onClick={clearFilters}>Clear search and filters</Button>}
            />
          ) : (
            <EmptyState
              title={`No ${plural.toLowerCase()} yet`}
              message={`${plural} you create appear here.`}
              actions={
                entityConfig?.active ? (
                  <ButtonLink href={`${ENTITY_PATHS[entity]}/new`} variant="primary">
                    <Plus aria-hidden="true" />
                    New {singular.toLowerCase()}
                  </ButtonLink>
                ) : null
              }
            />
          )
        ) : (
          <>
            <div
              className="a-table-wrap a-table-wrap--scroll a-list-table"
              aria-busy={list.isFetching || undefined}
            >
              <table className="a-table">
                <thead>
                  <tr>
                    <th scope="col" className="a-select-cell">
                      <input
                        type="checkbox"
                        aria-label={`Select all ${plural.toLowerCase()} on this page`}
                        checked={allOnPage}
                        onChange={(e) => setSelected(e.target.checked ? pageIds : [])}
                      />
                    </th>
                    {columns.map((column) => (
                      <SortHeader
                        key={column.key}
                        label={column.label}
                        field={column.sortField ?? column.key}
                        sort={sort}
                        onSort={onSort}
                        sortable={Boolean(column.sortField)}
                      />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      data-clickable="true"
                      data-selected={selected.includes(row.id) || undefined}
                      data-archived={row.archived_at ? "true" : undefined}
                      onMouseEnter={() => router.prefetch(href(row.id))}
                      onClick={() => router.push(href(row.id))}
                    >
                      <td className="a-select-cell" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Select ${row.display_name}`}
                          checked={selected.includes(row.id)}
                          onChange={(e) =>
                            setSelected(
                              e.target.checked
                                ? [...selected, row.id]
                                : selected.filter((id) => id !== row.id),
                            )
                          }
                        />
                      </td>
                      {columns.map((column) => (
                        <td key={column.key} className={column.numeric ? "a-num" : undefined}>
                          {column.render(row)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ListCards
              entity={entity}
              rows={rows}
              columns={columns}
              selected={selected}
              onSelect={(id, checked) =>
                setSelected(checked ? [...selected, id] : selected.filter((x) => x !== id))
              }
              href={href}
            />
            <Pagination
              total={list.data?.total ?? 0}
              page={page}
              pageSize={pageSize}
              onPage={(next) => update({ page: next === 1 ? null : next })}
              onPageSize={(size) =>
                update({ size: size === 25 ? null : size }, { resetPage: true })
              }
            />
          </>
        )}
      </section>
    </div>
  );
}

/** Choose which columns this browser shows (the identifying ones always stay). */
function ColumnChooser({
  columns,
  hidden,
  onToggle,
}: {
  columns: Column[];
  hidden: string[];
  onToggle: (key: string) => void;
}) {
  const optional = columns.filter((c) => !LOCKED_COLUMNS.has(c.key));
  if (!optional.length) return null;
  const hiddenCount = optional.filter((c) => hidden.includes(c.key)).length;
  return (
    <Popover
      title="Visible columns"
      icon={<Columns3 aria-hidden="true" />}
      label={hiddenCount ? `Columns (${optional.length - hiddenCount}/${optional.length})` : "Columns"}
    >
      <div className="a-stack" style={{ gap: 4, padding: 6 }}>
        <span className="a-help">Shown in this browser only.</span>
        {optional.map((column) => (
          <Checkbox
            key={column.key}
            label={column.label}
            checked={!hidden.includes(column.key)}
            onChange={() => onToggle(column.key)}
          />
        ))}
      </div>
    </Popover>
  );
}

/** Phone layout: one card per record instead of a wide table. */
function ListCards({
  entity,
  rows,
  columns,
  selected,
  onSelect,
  href,
}: {
  entity: EntityKey;
  rows: EntityRecord[];
  columns: Column[];
  selected: string[];
  onSelect: (id: string, checked: boolean) => void;
  href: (id: string) => string;
}) {
  const details = columns
    .filter((c) => !["display_name", "status", "updated_at", "assignment"].includes(c.key))
    .slice(0, 3);
  return (
    <ul className="a-cards" aria-label="Records">
      {rows.map((row) => {
        const order = entity === "order" ? (row as OrderRow) : null;
        return (
          <li key={row.id} className="a-card" data-archived={row.archived_at ? "true" : undefined}>
            <input
              type="checkbox"
              className="a-card-check"
              aria-label={`Select ${row.display_name}`}
              checked={selected.includes(row.id)}
              onChange={(e) => onSelect(row.id, e.target.checked)}
            />
            <Link href={href(row.id)} className="a-card-link">
              <span className="a-card-head">
                <strong className={order ? "a-mono" : undefined}>{row.display_name}</strong>
                {order ? <StatusBadge status={order.status} /> : null}
              </span>
              <dl className="a-card-details">
                {details.map((column) => (
                  <div key={column.key}>
                    <dt>{column.label}</dt>
                    <dd>{column.render(row) as ReactNode}</dd>
                  </div>
                ))}
                {order ? (
                  <div>
                    <dt>Driver · Vehicle</dt>
                    <dd>
                      {order.assignment
                        ? `${order.assignment.driver_name ?? "—"} · ${order.assignment.vehicle_name ?? "—"}`
                        : "Unassigned"}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Actions on the selected records; each record succeeds or fails on its own. */
function BulkBar({
  entity,
  config,
  selected,
  scope,
  exporting,
  onExport,
  onClear,
}: {
  entity: EntityKey;
  config: AdminConfig;
  selected: string[];
  scope: ArchiveScope;
  exporting: boolean;
  onExport: () => void;
  onClear: () => void;
}) {
  const toast = useToast();
  const invalidate = useInvalidateData();
  const [statusOpen, setStatusOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState<"archive" | "restore" | null>(null);
  const [status, setStatus] = useState<OrderStatus>("confirmed");
  const [note, setNote] = useState("");
  const [failures, setFailures] = useState<BulkResult[]>([]);
  const plural = (config.entities[entity]?.plural_display_name ?? entity).toLowerCase();

  const report = async (results: BulkResult[], verb: string) => {
    await invalidate();
    const failed = results.filter((r) => !r.ok);
    const done = results.length - failed.length;
    setFailures(failed);
    if (failed.length) toast.error(`${done} ${verb}, ${failed.length} could not be changed.`);
    else toast.success(`${done} ${verb}.`);
    if (!failed.length) onClear();
  };

  const statusChange = useMutation({
    mutationFn: () => bulkChangeOrderStatus(selected, status, note.trim() || undefined),
    onSuccess: async (results) => {
      setStatusOpen(false);
      await report(results, "updated");
    },
  });
  const archive = useMutation({
    mutationFn: (archived: boolean) => bulkSetArchived(entity, selected, archived),
    onSuccess: async (results, archived) => {
      setArchiveOpen(null);
      await report(results, archived ? "archived" : "restored");
    },
  });

  return (
    <div className="a-bulkbar" role="region" aria-label="Bulk actions">
      <strong>{selected.length} selected</strong>
      {entity === "order" ? (
        <Button size="sm" onClick={() => setStatusOpen(true)}>
          <RefreshCcw aria-hidden="true" />
          Change status
        </Button>
      ) : null}
      {scope !== "archived" ? (
        <Button size="sm" onClick={() => setArchiveOpen("archive")}>
          <Archive aria-hidden="true" />
          Archive
        </Button>
      ) : null}
      {scope !== "active" ? (
        <Button size="sm" onClick={() => setArchiveOpen("restore")}>
          <ArchiveRestore aria-hidden="true" />
          Restore
        </Button>
      ) : null}
      <Button size="sm" onClick={onExport} loading={exporting}>
        {exporting ? null : <Download aria-hidden="true" />}
        Export selected
      </Button>
      <Button size="sm" variant="ghost" onClick={onClear}>
        <X aria-hidden="true" />
        Clear selection
      </Button>
      {failures.length ? (
        <details className="a-bulk-failures">
          <summary>{failures.length} not changed — why?</summary>
          <ul>
            {failures.map((f) => (
              <li key={f.id}>
                <Link className="a-link" href={`${ENTITY_PATHS[entity]}/${f.id}`}>
                  Open
                </Link>{" "}
                {f.error}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <Dialog
        open={statusOpen}
        title={`Change the status of ${selected.length} ${plural}`}
        onClose={() => setStatusOpen(false)}
        busy={statusChange.isPending}
        onSubmit={() => statusChange.mutate()}
        footer={
          <>
            <Button onClick={() => setStatusOpen(false)} disabled={statusChange.isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={statusChange.isPending}>
              Change status
            </Button>
          </>
        }
      >
        <p className="a-muted">
          Each order follows its own workflow: orders that cannot move to this status are left
          unchanged and listed afterwards.
        </p>
        <Field label="New status">
          <Select value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Note" help="Recorded in each order's status history.">
          <Textarea rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </Dialog>

      <ConfirmDialog
        open={archiveOpen !== null}
        tone={archiveOpen === "restore" ? "primary" : "danger"}
        title={archiveOpen === "restore" ? `Restore ${selected.length} ${plural}?` : `Archive ${selected.length} ${plural}?`}
        message={
          archiveOpen === "restore"
            ? "They return to working lists and pickers."
            : "Archived records leave working lists but keep all their history. Records that cannot be archived are left unchanged and listed afterwards."
        }
        confirmLabel={archiveOpen === "restore" ? "Restore" : "Archive"}
        busy={archive.isPending}
        onConfirm={() => archive.mutate(archiveOpen === "archive")}
        onClose={() => setArchiveOpen(null)}
      />
    </div>
  );
}
