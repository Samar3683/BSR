"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Archive, ArchiveRestore, Pencil, RefreshCcw, Route, Trash } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ContactActions, FieldValue } from "../../components/fields/field-value";
import { Button, ButtonLink } from "../../components/ui/button";
import { ConfirmDialog } from "../../components/ui/dialog";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/feedback";
import { Switch } from "../../components/ui/form";
import { Empty, PageHeader, Panel, StatusBadge } from "../../components/ui/layout";
import { useToast } from "../../components/ui/toast";
import { useAdminConfig, useInvalidateData, useRecordNames } from "../../hooks/use-admin-config";
import { formatDateTime } from "../../lib/datetime";
import { toAdminError } from "../../lib/errors";
import type { EntityKey, EntityRecord, FieldDefinition } from "../../lib/fields/types";
import { recordValue } from "../../lib/fields/values";
import { detailFields, liveFields, retiredFields, type AdminConfig } from "../../services/config";
import {
  fetchOrderAssignments,
  fetchResourceAssignments,
  fetchStatusHistory,
  STATUS_LABELS,
  type OrderAssignment,
} from "../../services/operations";
import {
  deleteRecord,
  ENTITY_PATHS,
  fetchCustomerOrders,
  getRecord,
  setRecordArchived,
  setResourceAvailable,
  type OrderRow,
  type ResourceRow,
} from "../../services/records";
import { ActivityPanel } from "../audit/activity-panel";
import { AssignmentEditor } from "../dispatch/assignment-editor";
import { ResourcePairingsPanel } from "../dispatch/pairings";
import { StatusDialog } from "../orders/status-dialog";
import { collectRelationIds } from "./columns";

export function RecordDetailView({ entity, id }: { entity: EntityKey; id: string }) {
  const configQuery = useAdminConfig();
  const recordQuery = useQuery({
    queryKey: ["record", entity, id],
    queryFn: () => getRecord(entity, id),
  });

  if (configQuery.isError)
    return <ErrorState error={configQuery.error} onRetry={() => configQuery.refetch()} />;
  if (recordQuery.isError) {
    return (
      <div className="a-page">
        <ErrorState error={recordQuery.error} onRetry={() => recordQuery.refetch()} />
      </div>
    );
  }
  if (!configQuery.data || !recordQuery.data) return <LoadingState />;
  return <Detail entity={entity} config={configQuery.data} record={recordQuery.data} />;
}

function Detail({
  entity,
  config,
  record,
}: {
  entity: EntityKey;
  config: AdminConfig;
  record: EntityRecord;
}) {
  const router = useRouter();
  const toast = useToast();
  const invalidate = useInvalidateData();
  const [confirm, setConfirm] = useState<"archive" | "restore" | "delete" | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const entityConfig = config.entities[entity];
  const singular = entityConfig?.display_name ?? entity;
  const basePath = ENTITY_PATHS[entity];
  const archived = Boolean(record.archived_at);
  const order = entity === "order" ? (record as OrderRow) : null;

  const fields = detailFields(config, entity);
  const retired = retiredFields(config, entity).filter((def) => {
    const value = recordValue(def, record);
    return value !== null && value !== undefined;
  });
  const relationIds = collectRelationIds([...liveFields(config, entity), ...retired], [record]);
  const names = {
    ...useRecordNames("order", relationIds.order).data,
    ...useRecordNames("vehicle", relationIds.vehicle).data,
    ...useRecordNames("driver", relationIds.driver).data,
    ...useRecordNames("customer", relationIds.customer).data,
  };
  const ctx = { optionsByField: config.options, relationNames: names };

  const action = useMutation({
    mutationFn: async (kind: "archive" | "restore" | "delete") => {
      if (kind === "delete") await deleteRecord(entity, record.id);
      else await setRecordArchived(entity, record.id, kind === "archive");
      return kind;
    },
    onSuccess: async (kind) => {
      await invalidate();
      setConfirm(null);
      if (kind === "delete") {
        toast.success(`${singular} deleted.`);
        router.push(basePath);
      } else {
        toast.success(kind === "archive" ? `${singular} archived.` : `${singular} restored.`);
      }
    },
  });

  const contactFields = liveFields(config, entity).filter(
    (f) =>
      (f.field_type === "phone" || f.field_type === "email") &&
      typeof recordValue(f, record) === "string",
  );

  return (
    <div className="a-page">
      <PageHeader
        back={{ href: basePath, label: entityConfig?.plural_display_name ?? "Back" }}
        eyebrow={singular}
        title={<span className={order ? "a-mono" : undefined}>{record.display_name}</span>}
        meta={
          <>
            {order ? <StatusBadge status={order.status} /> : null}
            {entity === "driver" || entity === "vehicle" ? (
              (record as ResourceRow).available ? (
                <span className="a-badge a-badge--green">Available</span>
              ) : (
                <span className="a-badge">Unavailable</span>
              )
            ) : null}
            {archived ? (
              <span className="a-badge a-badge--red">
                Archived {formatDateTime(record.archived_at)}
              </span>
            ) : null}
          </>
        }
        actions={
          <>
            {order && !archived ? (
              <>
                <Button onClick={() => setStatusOpen(true)}>
                  <RefreshCcw aria-hidden="true" />
                  Change status
                </Button>
                <ButtonLink href={`/admin/dispatch?order=${order.id}`}>
                  <Route aria-hidden="true" />
                  Dispatch
                </ButtonLink>
              </>
            ) : null}
            {!archived ? (
              <ButtonLink href={`${basePath}/${record.id}/edit`} variant="primary">
                <Pencil aria-hidden="true" />
                Edit
              </ButtonLink>
            ) : null}
            {archived ? (
              <Button onClick={() => setConfirm("restore")}>
                <ArchiveRestore aria-hidden="true" />
                Restore
              </Button>
            ) : (
              <Button onClick={() => setConfirm("archive")}>
                <Archive aria-hidden="true" />
                Archive
              </Button>
            )}
            <Button variant="danger-ghost" onClick={() => setConfirm("delete")}>
              <Trash aria-hidden="true" />
              Delete
            </Button>
          </>
        }
      />

      <div className="a-grid a-grid--main-side">
        <div className="a-stack">
          <Panel title="Details">
            {fields.length === 0 ? (
              <p className="a-muted">
                No fields are shown on record pages. Configure them in Settings → Fields.
              </p>
            ) : (
              <dl className="a-dl">
                {fields.map((def) => (
                  <div key={def.id}>
                    <dt>{def.label}</dt>
                    <dd>
                      {def.binding_key === "customer_id" && order ? (
                        <CustomerLink id={order.customer_id} name={names[order.customer_id]} />
                      ) : (
                        <FieldValue def={def} value={recordValue(def, record)} ctx={ctx} />
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </Panel>

          {retired.length ? (
            <Panel title="Values of retired fields">
              <p className="a-help" style={{ marginBottom: 8 }}>
                These fields are archived or disabled. Their values are kept for history and are
                read-only.
              </p>
              <dl className="a-dl">
                {retired.map((def: FieldDefinition) => (
                  <div key={def.id}>
                    <dt>
                      {def.label}{" "}
                      <span className="a-badge">{def.archived_at ? "archived" : "disabled"}</span>
                    </dt>
                    <dd>
                      <FieldValue def={def} value={recordValue(def, record)} ctx={ctx} />
                    </dd>
                  </div>
                ))}
              </dl>
            </Panel>
          ) : null}

          {order ? <OrderHistoryPanels orderId={order.id} /> : null}
          {entity === "driver" || entity === "vehicle" ? (
            <>
              <ResourcePairingsPanel resource={entity} id={record.id} archived={archived} />
              <ResourceAssignmentsPanel resource={entity} id={record.id} />
            </>
          ) : null}
          {entity === "customer" ? <CustomerOrdersPanel customerId={record.id} /> : null}
        </div>

        <div className="a-stack">
          {order ? (
            <Panel title="Driver and vehicle">
              <AssignmentEditor orderId={order.id} status={order.status} />
            </Panel>
          ) : null}
          {entity === "driver" || entity === "vehicle" ? (
            <AvailabilityPanel entity={entity} record={record as ResourceRow} />
          ) : null}
          {contactFields.length ? (
            <Panel title="Contact">
              <div className="a-stack" style={{ gap: 10 }}>
                {contactFields.map((def) => (
                  <div key={def.id} style={{ display: "grid", gap: 4 }}>
                    <span className="a-small a-muted">
                      {def.label}: {String(recordValue(def, record))}
                    </span>
                    <div className="a-row">
                      <ContactActions
                        type={def.field_type as "phone" | "email"}
                        value={String(recordValue(def, record))}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          ) : null}
          <ActivityPanel entityType={entity} entityId={record.id} />
          <Panel title="Record">
            <dl className="a-dl">
              <div>
                <dt>Created</dt>
                <dd>{formatDateTime(record.created_at)}</dd>
              </div>
              <div>
                <dt>Last updated</dt>
                <dd>{formatDateTime(record.updated_at)}</dd>
              </div>
              <div>
                <dt>ID</dt>
                <dd className="a-mono a-small">{record.id}</dd>
              </div>
            </dl>
          </Panel>
        </div>
      </div>

      {order ? (
        <StatusDialog
          key={order.status}
          orderId={order.id}
          status={order.status}
          open={statusOpen}
          onClose={() => setStatusOpen(false)}
        />
      ) : null}

      <ConfirmDialog
        open={confirm !== null}
        tone={confirm === "restore" ? "primary" : "danger"}
        title={
          confirm === "delete"
            ? `Delete this ${singular.toLowerCase()}?`
            : confirm === "archive"
              ? `Archive this ${singular.toLowerCase()}?`
              : `Restore this ${singular.toLowerCase()}?`
        }
        message={
          confirm === "delete"
            ? "Deleting is permanent and only allowed for records without operational history (for orders: drafts). Otherwise archive the record."
            : confirm === "archive"
              ? "Archived records leave working lists and pickers but keep all their history. You can restore them later."
              : "The record returns to working lists and pickers."
        }
        confirmLabel={
          confirm === "delete"
            ? "Delete permanently"
            : confirm === "archive"
              ? "Archive"
              : "Restore"
        }
        busy={action.isPending}
        error={action.error ? toAdminError(action.error).message : null}
        onConfirm={() => confirm && action.mutate(confirm)}
        onClose={() => {
          action.reset();
          setConfirm(null);
        }}
      />
    </div>
  );
}

function CustomerLink({ id, name }: { id: string; name?: string }) {
  return (
    <Link className="a-link" href={`/admin/customers/${id}`}>
      {name ?? "Open customer"}
    </Link>
  );
}

function AvailabilityPanel({
  entity,
  record,
}: {
  entity: "driver" | "vehicle";
  record: ResourceRow;
}) {
  const toast = useToast();
  const invalidate = useInvalidateData();
  const mutation = useMutation({
    mutationFn: (available: boolean) => setResourceAvailable(entity, record.id, available),
    onSuccess: async (_, available) => {
      await invalidate();
      toast.success(
        available ? "Marked available for dispatch." : "Marked unavailable for dispatch.",
      );
    },
    onError: (error) => toast.error(toAdminError(error).message),
  });
  return (
    <Panel title="Dispatch availability">
      <Switch
        label="Available for dispatch"
        description="Unavailable resources are not offered when assigning orders."
        checked={record.available}
        disabled={mutation.isPending || Boolean(record.archived_at)}
        onChange={(checked) => mutation.mutate(checked)}
      />
    </Panel>
  );
}

function AssignmentTable({ rows, show }: { rows: OrderAssignment[]; show: "order" | "resources" }) {
  return (
    <div className="a-table-wrap">
      <table className="a-table">
        <thead>
          <tr>
            {show === "order" ? <th scope="col">Order</th> : null}
            {show === "resources" ? <th scope="col">Driver</th> : null}
            {show === "resources" ? <th scope="col">Vehicle</th> : null}
            <th scope="col">Window</th>
            <th scope="col">State</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => {
            const released = Boolean(a.released_at);
            const empty = released && Date.parse(a.released_at!) <= Date.parse(a.starts_at);
            return (
              <tr key={a.id}>
                {show === "order" ? (
                  <td>
                    <Link className="a-row-link a-mono" href={`/admin/orders/${a.order_id}`}>
                      {a.order?.order_number}
                    </Link>{" "}
                    {a.order ? <StatusBadge status={a.order.status} /> : null}
                  </td>
                ) : null}
                {show === "resources" ? <td>{a.driver?.display_name ?? <Empty />}</td> : null}
                {show === "resources" ? <td>{a.vehicle?.display_name ?? <Empty />}</td> : null}
                <td className="a-small">
                  {formatDateTime(a.starts_at)} →{" "}
                  {formatDateTime(released && !empty ? a.released_at : a.ends_at)}
                </td>
                <td className="a-wrap">
                  {released ? (
                    <span className="a-badge" title={a.release_reason ?? undefined}>
                      Released{a.release_reason ? ` · ${a.release_reason}` : ""}
                    </span>
                  ) : (
                    <span className="a-badge a-badge--green">Active</span>
                  )}
                  {a.note ? <div className="a-help">{a.note}</div> : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function OrderHistoryPanels({ orderId }: { orderId: string }) {
  const statuses = useQuery({
    queryKey: ["status-history", orderId],
    queryFn: () => fetchStatusHistory(orderId),
  });
  const assignments = useQuery({
    queryKey: ["assignments", "order", orderId],
    queryFn: () => fetchOrderAssignments(orderId),
  });
  return (
    <>
      <Panel title="Status history">
        {statuses.isError ? (
          <ErrorState error={statuses.error} onRetry={() => statuses.refetch()} />
        ) : statuses.isLoading ? (
          <LoadingState />
        ) : (
          <ol className="a-timeline">
            {(statuses.data ?? []).map((entry) => (
              <li key={entry.id} data-tone={entry.to_status === "cancelled" ? "red" : "green"}>
                <span className="a-row">
                  {entry.from_status ? (
                    <>
                      <StatusBadge status={entry.from_status} />
                      <span aria-hidden="true">→</span>
                    </>
                  ) : (
                    <span className="a-muted">Created as</span>
                  )}
                  <StatusBadge status={entry.to_status} />
                  <span className="a-sr-only">
                    {entry.from_status ? `from ${STATUS_LABELS[entry.from_status]} ` : ""}to{" "}
                    {STATUS_LABELS[entry.to_status]}
                  </span>
                </span>
                <span className="a-small a-muted">
                  {formatDateTime(entry.changed_at)} · {entry.changed_by_label ?? "System"}
                  {entry.note ? ` · “${entry.note}”` : ""}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Panel>
      <Panel title="Assignment history" flush>
        {assignments.isError ? (
          <ErrorState error={assignments.error} onRetry={() => assignments.refetch()} />
        ) : assignments.isLoading ? (
          <LoadingState />
        ) : !assignments.data?.length ? (
          <EmptyState
            title="Not dispatched yet"
            message="Assignments appear here, including released ones."
          />
        ) : (
          <AssignmentTable rows={assignments.data} show="resources" />
        )}
      </Panel>
    </>
  );
}

function ResourceAssignmentsPanel({
  resource,
  id,
}: {
  resource: "driver" | "vehicle";
  id: string;
}) {
  const query = useQuery({
    queryKey: ["assignments", resource, id],
    queryFn: () => fetchResourceAssignments(resource, id, 25),
  });
  return (
    <Panel title="Order assignments" flush>
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.isLoading ? (
        <LoadingState />
      ) : !query.data?.length ? (
        <EmptyState
          title="No assignments"
          message="Orders dispatched to this resource appear here."
        />
      ) : (
        <AssignmentTable rows={query.data} show="order" />
      )}
    </Panel>
  );
}

function CustomerOrdersPanel({ customerId }: { customerId: string }) {
  const { data: config } = useAdminConfig();
  const customerField = config?.fields.order.find((f) => f.binding_key === "customer_id");
  const query = useQuery({
    queryKey: ["records", "order", "customer", customerId],
    queryFn: () => fetchCustomerOrders(customerId, 10),
  });
  const allHref =
    customerField?.filterable && customerField.active
      ? `/admin/orders?scope=all&f=${encodeURIComponent(
          JSON.stringify([
            { id: "customer", field: customerField.field_key, op: "eq", value: customerId },
          ]),
        )}`
      : null;
  return (
    <Panel
      title="Recent orders"
      flush
      actions={
        allHref ? (
          <ButtonLink size="sm" href={allHref}>
            All orders
          </ButtonLink>
        ) : null
      }
    >
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.isLoading ? (
        <LoadingState />
      ) : !query.data?.length ? (
        <EmptyState title="No orders yet" message="Orders for this customer appear here." />
      ) : (
        <div className="a-table-wrap">
          <table className="a-table">
            <thead>
              <tr>
                <th scope="col">Order</th>
                <th scope="col">Status</th>
                <th scope="col">Pickup</th>
              </tr>
            </thead>
            <tbody>
              {query.data.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link className="a-row-link a-mono" href={`/admin/orders/${row.id}`}>
                      {row.order_number}
                    </Link>
                  </td>
                  <td>
                    <StatusBadge status={row.status} />
                  </td>
                  <td>{row.pickup_at ? formatDateTime(row.pickup_at) : <Empty />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
