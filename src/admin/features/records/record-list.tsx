"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Download, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button, ButtonLink } from "../../components/ui/button";
import { EmptyState, ErrorState, LoadingState, SkeletonRows } from "../../components/ui/feedback";
import { Input, Select } from "../../components/ui/form";
import { PageHeader, Pagination, SortHeader } from "../../components/ui/layout";
import { useToast } from "../../components/ui/toast";
import { useAdminConfig, useRecordNames } from "../../hooks/use-admin-config";
import { csvFileName, downloadCsv, toCsv } from "../../lib/csv";
import { toAdminError } from "../../lib/errors";
import type { EntityKey } from "../../lib/fields/types";
import { filterableFields, liveFields } from "../../services/config";
import { ORDER_STATUSES, STATUS_LABELS } from "../../services/operations";
import {
  ENTITY_PATHS,
  fetchRecordNames,
  listAllRecords,
  listRecords,
  type ArchiveScope,
  type ListQuery,
  type OrderStatus,
  type RecordFilter,
} from "../../services/records";
import { buildColumns, collectRelationIds } from "./columns";
import { FilterPanel, FilterToggle, toApiFilters, type UiFilter } from "./filters";
import { parseJsonParam, useUrlState } from "./url-state";

export function RecordListView({ entity }: { entity: EntityKey }) {
  const router = useRouter();
  const toast = useToast();
  const { get, update } = useUrlState();
  const configQuery = useAdminConfig();
  const config = configQuery.data;

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
    if (
      (entity === "driver" || entity === "vehicle") &&
      (availability === "yes" || availability === "no")
    ) {
      list.push({ field: "available", op: "eq", value: availability === "yes" });
    }
    return list;
  }, [uiFilters, fields, statuses, dispatch, availability, entity]);

  const query: ListQuery = {
    search: urlSearch,
    filters: apiFilters,
    sort: sortField && sortDir ? { field: sortField, direction: sortDir } : null,
    limit: pageSize,
    offset: (page - 1) * pageSize,
    archived: scope,
  };

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
  const columns = buildColumns(entity, config, ctx);
  const sort = sortField && sortDir ? { field: sortField, direction: sortDir } : null;
  const filtersActive =
    uiFilters.length +
      statuses.length +
      (dispatch ? 1 : 0) +
      (availability ? 1 : 0) +
      (urlSearch ? 1 : 0) >
    0;

  const onSort = (field: string) => {
    const direction = sort?.field === field && sort.direction === "asc" ? "desc" : "asc";
    update({ sort: field, dir: direction }, { resetPage: true });
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const all = await listAllRecords(entity, {
        ...query,
        limit: undefined,
        offset: undefined,
      } as ListQuery);
      const ids = collectRelationIds(liveFields(config, entity), all);
      const names: Record<string, string> = {};
      for (const [target, list] of Object.entries(ids) as [EntityKey, string[]][]) {
        for (const row of await fetchRecordNames(target, list)) names[row.id] = row.display_name;
      }
      const exportColumns = buildColumns(entity, config, {
        optionsByField: config.options,
        relationNames: names,
      });
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
            <Button onClick={exportCsv} loading={exporting} disabled={!list.data?.total}>
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
        </div>

        {entity === "order" ? (
          <div className="a-toolbar" role="group" aria-label="Filter by status">
            <div className="a-chips">
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
                    onClick={() => {
                      const next = selected
                        ? statuses.filter((s) => s !== status)
                        : [...statuses, status];
                      update({ status: next.join(",") }, { resetPage: true });
                    }}
                  >
                    {STATUS_LABELS[status]}
                  </button>
                );
              })}
            </div>
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

        {list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : list.isLoading ? (
          <SkeletonRows columns={Math.min(columns.length, 6)} />
        ) : rows.length === 0 ? (
          filtersActive || scope !== "active" ? (
            <EmptyState
              title={`No matching ${plural.toLowerCase()}`}
              message="Change the search or the filters to see more."
              actions={
                <Button
                  onClick={() => {
                    setSearch("");
                    update(
                      { q: null, f: null, status: null, dispatch: null, avail: null, scope: null },
                      { resetPage: true },
                    );
                  }}
                >
                  Clear search and filters
                </Button>
              }
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
            <div className="a-table-wrap" aria-busy={list.isFetching || undefined}>
              <table className="a-table">
                <thead>
                  <tr>
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
                      data-archived={row.archived_at ? "true" : undefined}
                      onClick={() => router.push(`${ENTITY_PATHS[entity]}/${row.id}`)}
                    >
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
